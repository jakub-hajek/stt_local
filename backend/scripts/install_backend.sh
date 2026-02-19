#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

VENV_DIR="$BACKEND_DIR/.venv"

if [ ! -x "$VENV_DIR/bin/python" ]; then
    echo "Creating backend virtual environment at $VENV_DIR"
    python -m venv "$VENV_DIR"
fi

echo "Installing backend dependencies..."
cd "$BACKEND_DIR"
"$VENV_DIR/bin/pip" install -e ".[dev]"

echo ""
echo "Backend installation complete."
