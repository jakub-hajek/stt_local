#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$BACKEND_DIR/.." && pwd)"

VENV_DIR="$BACKEND_DIR/.venv"
ACTIVATE_FILE="$VENV_DIR/bin/activate"
SIMULSTREAMING_DIR="$ROOT_DIR/SimulStreaming"
SIMULSTREAMING_REPO="https://github.com/ufal/SimulStreaming.git"

MARKER_BEGIN="# >>> stt_local simulstreaming >>>"
MARKER_END="# <<< stt_local simulstreaming <<<"

if ! command -v git >/dev/null 2>&1; then
    echo "Error: git is required but not available in PATH."
    exit 1
fi

if [ ! -x "$VENV_DIR/bin/python" ]; then
    echo "Creating backend virtual environment at $VENV_DIR"
    python -m venv "$VENV_DIR"
fi

EXTRAS="dev"
if [ "$(uname -s)" = "Darwin" ] && [ "$(uname -m)" = "arm64" ]; then
    EXTRAS="dev,mps"
elif [ "$(uname -s)" = "Linux" ]; then
    EXTRAS="dev,cuda"
fi

echo "Installing backend dependencies..."
cd "$BACKEND_DIR"
"$VENV_DIR/bin/pip" install -e ".[${EXTRAS}]"

if [ ! -d "$SIMULSTREAMING_DIR/.git" ]; then
    echo "Cloning SimulStreaming into $SIMULSTREAMING_DIR"
    git clone "$SIMULSTREAMING_REPO" "$SIMULSTREAMING_DIR"
else
    echo "Using existing SimulStreaming checkout at $SIMULSTREAMING_DIR"
fi

echo "Installing SimulStreaming dependencies..."
"$VENV_DIR/bin/pip" install -r "$SIMULSTREAMING_DIR/requirements_whisper.txt"

if [ -f "$ACTIVATE_FILE" ] && ! grep -Fq "$MARKER_BEGIN" "$ACTIVATE_FILE"; then
    cat >>"$ACTIVATE_FILE" <<EOF

$MARKER_BEGIN
SIMULSTREAMING_DIR="$SIMULSTREAMING_DIR"
if [ -d "\$SIMULSTREAMING_DIR" ]; then
    case ":\${PYTHONPATH:-}:" in
        *":\$SIMULSTREAMING_DIR:"*) ;;
        *) export PYTHONPATH="\$SIMULSTREAMING_DIR\${PYTHONPATH:+:\$PYTHONPATH}" ;;
    esac
fi
$MARKER_END
EOF
fi

echo ""
echo "Backend installation complete."
echo "SimulStreaming path is auto-exported by backend/.venv/bin/activate."
echo "If your venv is already active, run: deactivate && source backend/.venv/bin/activate"
