# STT Local — Architecture & Developer Guide

Privacy-first speech-to-text using a Python backend with [SimulStreaming](https://github.com/ufal/SimulStreaming) (UFAL) for real-time streaming transcription. Czech is the primary language.

## System Architecture

```
Browser (SvelteKit)                    Backend (FastAPI + uvicorn)
┌────────────────────┐                 ┌──────────────────────────────┐
│ Mic → AudioWorklet │                 │ GET  /health                 │
│ (PCM 16kHz s16le)  │──WebSocket──▶   │ WS   /ws/transcribe          │
│                    │                 │                              │
│ Transcript UI      │◀──WS JSON────   │ SimulStreaming engine         │
│ Waveform (local)   │                 │  macOS ARM64 → mlx-whisper   │
└────────────────────┘                 │  Linux CUDA  → faster-whisper│
                                       │  fallback    → CPU           │
                                       └──────────────────────────────┘
```

## Quick Start

### Prerequisites

- **Python 3.13.1** via pyenv (pinned in `.python-version`)
- **Bun** (or Node.js) for the SvelteKit frontend
- **SimulStreaming** cloned separately (see [SimulStreaming Setup](#simulstreaming-setup))

### Setup

```bash
# 1. Clone and enter
cd stt_local

# 2. Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# 3. SimulStreaming (see section below)

# 4. Frontend
cd ../frontend
bun install

# 5. Run both (from project root)
cd ..
./start.sh

# Or use the Makefile:
make install   # install both FE + BE deps
make dev       # run both servers
```

### Running Tests

```bash
# All tests
make test

# Frontend (129+ tests, >90% coverage)
cd frontend
bun run test
bun run test:coverage

# Backend (57+ tests, >90% coverage)
cd backend
source .venv/bin/activate
pytest --cov=app --cov-report=term-missing
```

---

## Directory Structure

```
stt_local/
├── .python-version              # pyenv: 3.13.1
├── start.sh                     # Launch both backend + frontend
├── Makefile                     # Root Makefile for all common tasks
├── frontend/
│   ├── package.json             # Frontend deps (no @remotion/whisper-web)
│   ├── vite.config.ts           # Vite + CSP headers
│   ├── vitest.config.ts         # Test config, 90% coverage threshold
│   ├── svelte.config.js         # SvelteKit static adapter
│   ├── tsconfig.json
│   ├── src/
│   │   ├── hooks.server.ts      # CSP headers (ws://localhost:8765 allowed)
│   │   ├── routes/
│   │   │   └── +page.svelte     # Main UI: health check → WS → audio → transcript
│   │   └── lib/
│   │       ├── audio/
│   │       │   ├── pcm-processor.worklet.ts  # AudioWorklet: 1600-sample buffers @16kHz
│   │       │   ├── capture.ts                # AudioWorklet + AnalyserNode
│   │       │   └── types.ts
│   │       ├── whisper/
│   │       │   ├── transcriber.ts   # WebSocket client + reconnect backoff
│   │       │   ├── manager.ts       # Health check via fetch('/health')
│   │       │   └── types.ts         # ConnectionStatus, ServerMessage, etc.
│   │       ├── state/
│   │       │   ├── app.svelte.ts    # Reactive state (Svelte 5 $state)
│   │       │   └── transcript.svelte.ts  # Entries + partial/final streaming
│   │       └── components/
│   │           ├── ModelStatus.svelte      # Server connection status
│   │           ├── SettingsPanel.svelte    # Server URL, chunk interval
│   │           ├── MicControl.svelte       # Record button
│   │           ├── Waveform.svelte         # Canvas frequency viz
│   │           ├── LanguageSelector.svelte # CS/EN toggle
│   │           └── TranscriptDisplay.svelte
│   └── tests/
│       └── setup.ts             # Vitest: mock WebSocket, AudioWorklet, fetch
├── backend/
│   ├── .python-version          # pyenv: 3.13.1
│   ├── pyproject.toml           # Python deps, pytest config, coverage config
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan (model load)
│   │   ├── config.py            # Pydantic Settings (STT_* env vars)
│   │   ├── models.py            # WS protocol Pydantic schemas
│   │   ├── routes/
│   │   │   ├── health.py        # GET /health
│   │   │   └── websocket.py     # WS /ws/transcribe
│   │   ├── engine/
│   │   │   ├── detector.py      # Auto-detect MPS/CUDA/CPU
│   │   │   ├── factory.py       # Singleton TranscriptionEngine
│   │   │   └── processor.py     # Per-session SessionProcessor
│   │   └── audio/
│   │       └── normalizer.py    # PCM int16 → float32
│   └── tests/
│       ├── conftest.py          # Mock SimulStreaming module
│       ├── test_detector.py
│       ├── test_factory.py
│       ├── test_main.py
│       ├── test_normalizer.py
│       ├── test_processor.py
│       └── test_websocket.py
```

---

## WebSocket Protocol

```
Client                          Server
  |--- WS Connect ────────────────>|
  |<── {"type":"connected",        |   backend info
  |     "backend":"mlx-whisper",   |
  |     "device":"mps",           |
  |     "model":"large-v3-turbo"} ─|
  |─── {"type":"configure",  ─────>|   session config
  |     "language":"cs"}           |
  |<── {"type":"ready"} ──────────|
  |─── [binary PCM s16le] ───────>|   ~100ms chunks (3200 bytes)
  |<── {"type":"partial",          |   streaming partial
  |     "text":"...",              |
  |     "start_ms":0,             |
  |     "end_ms":1200} ──────────|
  |─── {"type":"stop"} ──────────>|   end of stream
  |<── {"type":"final",...} ──────|   flushed final
  |<── {"type":"done"} ──────────|
```

### Audio Format

- **Sample rate:** 16,000 Hz
- **Encoding:** signed 16-bit integer, little-endian (s16le)
- **Channels:** mono
- **Chunk size:** 1,600 samples = 100ms = 3,200 bytes

The browser's `AudioContext` is created with `sampleRate: 16000` for native resampling. The `AudioWorkletProcessor` collects 1,600-sample buffers and the main thread converts Float32 → Int16 LE before sending over WebSocket.

---

## Backend Configuration

All settings use the `STT_` prefix as environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `STT_HOST` | `0.0.0.0` | Server bind address |
| `STT_PORT` | `8765` | Server port |
| `STT_MODEL_SIZE` | `large-v3-turbo` | Whisper model name/path |
| `STT_LANGUAGE` | `cs` | Default language code |
| `STT_CORS_ORIGINS` | `["http://localhost:5173", "http://localhost:4173"]` | Allowed CORS origins |
| `STT_LOG_LEVEL` | `info` | Python logging level |

Example:
```bash
STT_MODEL_SIZE=large-v3 STT_LANGUAGE=en uvicorn app.main:app --port 8765
```

### Backend Detection Logic

Order of detection in `engine/detector.py`:

1. **macOS ARM64 + `mlx_whisper` importable** → `("mlx-whisper", "mps")`
2. **`torch.cuda.is_available()` + `faster_whisper` importable** → `("faster-whisper", "cuda")`
3. **Fallback** → `("faster-whisper", "cpu")`

---

## Engine Architecture

### TranscriptionEngine (Singleton)

`app/engine/factory.py` — Thread-safe singleton that:
1. **Loads once** at startup via `simul_asr_factory(args)` → returns `(asr, online_processor)`
2. **Creates sessions** for each WebSocket via `SimulWhisperOnline(asr)` — reuses the loaded ASR model, fresh processor state

### SessionProcessor (Per-Connection)

`app/engine/processor.py` wraps `SimulWhisperOnline`:

```python
# Per WebSocket connection:
session = SessionProcessor(engine.create_session())

# Feed audio chunks, get partial results:
partials = session.feed_audio(float32_array)  # → [(text, start_ms, end_ms), ...]

# Flush at end of speech:
finals = session.flush()  # → [(text, start_ms, end_ms), ...]
```

`process_iter()` returns a dict `{start, end, text, tokens, words}` or `{}` (empty). The processor converts `start`/`end` from seconds to milliseconds.

---

## SimulStreaming Setup

SimulStreaming doesn't have a standard `setup.py`/`pyproject.toml`. Install it by adding to `PYTHONPATH`:

```bash
# Clone SimulStreaming
git clone https://github.com/ufal/SimulStreaming.git /path/to/SimulStreaming

# Add to PYTHONPATH (add to .env or shell profile)
export PYTHONPATH="/path/to/SimulStreaming:$PYTHONPATH"

# Install SimulStreaming's dependencies
pip install -r /path/to/SimulStreaming/requirements_whisper.txt
```

### SimulStreaming API Reference

#### `simul_asr_factory(args)` → `(SimulWhisperASR, SimulWhisperOnline)`

Factory function that creates the ASR model and streaming processor.

**Key arguments** (passed via argparse namespace):

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `model_path` | str | `large-v3.pt` | Whisper model name or local path |
| `lan` | str | `en` | Language code (`cs`, `en`, `auto`, etc.) |
| `task` | str | `transcribe` | `transcribe` or `translate` |
| `beams` | int | `1` | Beam size (1 = greedy, >1 = beam search) |
| `frame_threshold` | int | `25` | AlignAtt attention threshold in frames (1 frame = 20ms) |
| `audio_max_len` | float | `30.0` | Max audio buffer (seconds) |
| `audio_min_len` | float | `0.0` | Min audio before processing (seconds) |
| `min_chunk_size` | float | `1.2` | Min chunk for processing (seconds) |
| `cif_ckpt_path` | str | `None` | CIF model for end-of-word detection |
| `never_fire` | bool | `False` | Never truncate last incomplete word |
| `init_prompt` | str | `None` | Initial prompt (in target language) |
| `static_init_prompt` | str | `None` | Static context that never scrolls |
| `max_context_tokens` | int | `None` | Max context tokens |
| `logdir` | str | `None` | Debug output directory |

#### `SimulWhisperOnline` — Streaming Processor

| Method | Description |
|--------|-------------|
| `__init__(asr)` | Create from an existing `SimulWhisperASR` (shares model) |
| `init(offset=None)` | Reset state for new session |
| `insert_audio_chunk(audio)` | Add numpy float32 audio chunk to queue |
| `process_iter()` | Process queued audio, return result dict or `{}` |
| `finish()` | Finalize: process remaining audio, return final result |
| `SAMPLING_RATE` | Constant: `16000` |

#### `process_iter()` / `finish()` Return Format

```python
{
    'start': 0.24,                    # Segment start (seconds)
    'end': 1.86,                      # Segment end (seconds)
    'text': 'Ahoj světe',             # Decoded text
    'tokens': [50364, 7921, ...],     # Token IDs
    'words': [                         # Word-level timestamps
        {'start': 0.24, 'end': 0.62, 'text': ' Ahoj', 'tokens': [...]},
        {'start': 0.62, 'end': 1.86, 'text': ' světe', 'tokens': [...]},
    ]
}
```

Returns `{}` when there's nothing to emit.

#### AlignAtt Policy

SimulStreaming uses the **AlignAtt (Attention-Alignment)** policy for simultaneous decoding, which differs from standard Whisper streaming:

- **Standard Whisper:** Waits for a fixed time window or complete audio before decoding
- **AlignAtt:** Monitors encoder-decoder attention heads to determine what audio frame the decoder is attending to, stopping when attention reaches `frame_threshold` frames from the audio end
- **Result:** Lower latency, better quality — the decoder naturally stops at semantically appropriate points

**frame_threshold** controls the latency/quality tradeoff:
- Lower → more aggressive (lower latency, potentially more corrections)
- Higher → more conservative (higher latency, fewer corrections)
- Default `25` = 500ms look-ahead at 50 frames/second

---

## Frontend Architecture

### Audio Pipeline

```
getUserMedia → AudioContext(16kHz) → MediaStreamSource
                                        ├─→ AnalyserNode → Waveform canvas
                                        └─→ AudioWorkletNode('pcm-processor')
                                                  ↓
                                            Float32 buffers (1600 samples)
                                                  ↓ (main thread)
                                            Int16 LE ArrayBuffer
                                                  ↓
                                            WebSocket.send(binary)
```

### State Management (Svelte 5 `$state`)

- **`appState`** — Language, recording status, server connection, server URL
- **`transcriptState`** — Transcript entries with partial/final streaming support
  - `updateOrAddPartial(text, lang)` — Update in-place or create new partial
  - `finalizePartial(text)` — Mark current partial as final, reset for next

### Reconnection Strategy

The `Transcriber` class implements exponential backoff reconnection:
- Initial delay: 1 second
- Max delay: 30 seconds
- Doubles on each failed attempt
- Resets to 1s on successful connection
- Only reconnects if connection was previously `ready` or `connected`
- `disconnect()` cancels reconnection

### Component Hierarchy

```
+page.svelte (orchestrator)
├── LanguageSelector    — CS/EN toggle (disabled during recording)
├── SettingsPanel       — Server URL, chunk interval
├── ModelStatus         — Server connection status + connect/retry button
├── Waveform            — Real-time frequency visualization (canvas)
├── MicControl          — Start/stop recording button
└── TranscriptDisplay   — Transcript entries with copy/clear
```

---

## Testing Strategy

### Frontend (Vitest + jsdom)

- **Coverage threshold:** 90% (statements, branches, functions, lines)
- **Exclusions:** `types.ts`, `theme/`, `pcm-processor.worklet.ts` (AudioWorklet context unavailable in jsdom)
- **Mocks:** WebSocket, AudioContext, AudioWorkletNode, fetch, navigator.mediaDevices
- **Pattern:** Each source file has a co-located `.test.ts`

### Backend (pytest + pytest-cov)

- **Coverage threshold:** 90% (`fail_under = 90` in pyproject.toml)
- **Mocks:** `simulstreaming_whisper` module stubbed via `conftest.py` (autouse fixture)
- **Pattern:** Test files in `tests/` directory, fixtures in `conftest.py`

The `conftest.py` creates a fake `simulstreaming_whisper` module with a `_MockOnlineProcessor` class that mimics the `SimulWhisperOnline` interface, so tests run without the heavy ML dependencies.

---

## Environment Setup Details

### Python (pyenv)

The project pins Python 3.13.1 via `.python-version` files (root + backend). Using pyenv:

```bash
pyenv install 3.13.1
# .python-version files handle the rest automatically
```

The venv is at `backend/.venv/` and is git-ignored. The `start.sh` script uses the venv Python directly without requiring activation.

### Frontend

```bash
cd frontend
bun install         # Install deps
bun run dev         # Dev server at :5173
bun run test        # Run tests
bun run check       # TypeScript check
```

### CSP Headers

Both `hooks.server.ts` and `vite.config.ts` set CSP headers allowing:
- `connect-src: 'self' https: http://localhost:8765 ws://localhost:8765 blob:`
- `worker-src: 'self' blob:` (for AudioWorklet)

---

## Common Development Tasks

### Adding a New Language

1. Update `Language` type in `frontend/src/lib/whisper/types.ts`
2. Add button in `LanguageSelector.svelte`
3. Backend handles any language Whisper supports (pass via `configure` message)

### Changing the Whisper Model

```bash
STT_MODEL_SIZE=large-v3 ./start.sh
# or
STT_MODEL_SIZE=medium ./start.sh
```

### Running with CUDA (Linux)

```bash
cd backend
pip install -e ".[cuda]"   # Installs faster-whisper
# detector.py auto-detects CUDA
```

### Running with MLX (macOS Apple Silicon)

```bash
cd backend
pip install -e ".[mps]"    # Installs mlx-whisper
# detector.py auto-detects MPS
```
