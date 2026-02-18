#!/usr/bin/env bash
set -euo pipefail

# Test SimulStreaming with a chosen Whisper model.
# Records 5 seconds from the microphone, then transcribes via streaming.
#
# Usage:
#   ./test_tiny.sh                       # tiny model, Czech, mic
#   ./test_tiny.sh en                    # tiny model, English, mic
#   ./test_tiny.sh cs file.wav           # tiny model, Czech, file
#   MODEL=small ./test_tiny.sh en        # small model, English, mic
#   MODEL=medium ./test_tiny.sh cs file.wav

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_PYTHON="$SCRIPT_DIR/backend/.venv/bin/python"
SIMULSTREAMING_DIR="$SCRIPT_DIR/SimulStreaming"
RECORD_SECONDS=5
MODEL="${MODEL:-tiny}"
LANGUAGE="${1:-cs}"
AUDIO_FILE="${2:-}"
TMP_WAV="$SCRIPT_DIR/test_recording.wav"

# --- Preflight checks ---

if [ ! -f "$VENV_PYTHON" ]; then
    echo "Error: Python venv not found. Run: make install-be"
    exit 1
fi

if [ ! -d "$SIMULSTREAMING_DIR" ]; then
    echo "Error: SimulStreaming not found at $SIMULSTREAMING_DIR"
    echo "Run: make install-be"
    exit 1
fi

export PYTHONPATH="$SIMULSTREAMING_DIR${PYTHONPATH:+:$PYTHONPATH}"

# --- Record or use provided file ---

if [ -z "$AUDIO_FILE" ]; then
    echo "Recording ${RECORD_SECONDS}s from microphone (16kHz, mono)..."
    echo "Speak now!"

    # macOS: use sox (brew install sox) for recording
    if command -v rec &>/dev/null; then
        rec -q -r 16000 -c 1 -b 16 "$TMP_WAV" trim 0 "$RECORD_SECONDS"
    # Linux: use arecord
    elif command -v arecord &>/dev/null; then
        arecord -f S16_LE -c 1 -r 16000 -d "$RECORD_SECONDS" "$TMP_WAV"
    # Fallback: ffmpeg
    elif command -v ffmpeg &>/dev/null; then
        if [[ "$(uname)" == "Darwin" ]]; then
            # macOS AVFoundation: "none:INDEX" for audio-only (no video)
            # Find first audio device index
            MIC_INDEX=$(ffmpeg -f avfoundation -list_devices true -i "" 2>&1 \
                | grep -A 999 "audio devices:" \
                | grep -m1 -oE '^\[.*\] \[([0-9]+)\]' \
                | grep -oE '\[[0-9]+\]$' \
                | tr -d '[]')
            MIC_INDEX="${MIC_INDEX:-0}"
            echo "Using AVFoundation audio device index: $MIC_INDEX"
            ffmpeg -y -f avfoundation -i "none:${MIC_INDEX}" -ar 16000 -ac 1 -t "$RECORD_SECONDS" "$TMP_WAV" 2>/dev/null \
                || { echo "Error: ffmpeg failed to record from AVFoundation device $MIC_INDEX"; exit 1; }
        else
            # Linux: try PulseAudio, then ALSA
            ffmpeg -y -f pulse -i default -ar 16000 -ac 1 -t "$RECORD_SECONDS" "$TMP_WAV" 2>/dev/null \
                || ffmpeg -y -f alsa -i default -ar 16000 -ac 1 -t "$RECORD_SECONDS" "$TMP_WAV" 2>/dev/null \
                || { echo "Error: ffmpeg could not find an audio input device"; exit 1; }
        fi
    else
        echo "Error: No audio recorder found. Install sox (brew install sox) or ffmpeg."
        exit 1
    fi

    AUDIO_FILE="$TMP_WAV"
    echo "Recorded to $AUDIO_FILE"
    echo ""
fi

if [ ! -f "$AUDIO_FILE" ]; then
    echo "Error: Audio file not found: $AUDIO_FILE"
    exit 1
fi

# --- Run SimulStreaming ---

BEAMS=1
if [[ "$MODEL" != "tiny" && "$MODEL" != "base" ]]; then
    BEAMS=5
fi

echo "Transcribing with $MODEL model (language=$LANGUAGE, beams=$BEAMS)..."
echo "---"

"$VENV_PYTHON" "$SIMULSTREAMING_DIR/simulstreaming_whisper.py" \
    "$AUDIO_FILE" \
    --model_path "$MODEL" \
    --language "$LANGUAGE" \
    --task transcribe \
    --beams "$BEAMS" \
    --frame_threshold 25 \
    --comp_unaware \
    --vac \
    -l WARNING \
    | python3 -c "
import sys, json
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        d = json.loads(line)
        if 'text' in d and d['text'].strip():
            start = d.get('start', 0)
            end = d.get('end', 0)
            print(f'[{start:.1f}s - {end:.1f}s] {d[\"text\"].strip()}')
    except json.JSONDecodeError:
        pass
"

echo "---"
echo "Done."

# Clean up temp recording
if [ "$AUDIO_FILE" = "$TMP_WAV" ] && [ -f "$TMP_WAV" ]; then
    rm -f "$TMP_WAV"
fi
