#!/usr/bin/env bash
set -euo pipefail

# Start STT Local — backend + frontend
# Usage: ./start.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$SCRIPT_DIR/backend/.venv"

cleanup() {
    echo "Shutting down..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

# Verify venv exists
if [ ! -f "$VENV_DIR/bin/python" ]; then
    echo "Error: Python venv not found at $VENV_DIR"
    echo "Run: cd backend && python -m venv .venv && source .venv/bin/activate && pip install -e '.[dev]'"
    exit 1
fi

# Start backend using the venv Python
echo "Starting backend (uvicorn)..."
"$VENV_DIR/bin/uvicorn" app.main:app --host 0.0.0.0 --port 8765 --log-level info --app-dir "$SCRIPT_DIR/backend" &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:8765/health >/dev/null 2>&1; then
        echo "Backend ready."
        break
    fi
    if [ "$i" -eq 30 ]; then
        echo "Warning: Backend did not respond within 30s"
    fi
    sleep 1
done

# Start frontend
echo "Starting frontend (vite)..."
cd "$SCRIPT_DIR/frontend"
bun run dev &
FRONTEND_PID=$!

echo ""
echo "STT Local is running:"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8765"
echo ""
echo "Press Ctrl+C to stop."

wait
