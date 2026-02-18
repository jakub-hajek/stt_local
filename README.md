# STT Local

Privacy-first, real-time speech-to-text running entirely on your machine. No cloud, no data leaves your device.

Built with a **FastAPI + SimulStreaming** backend and a **SvelteKit** frontend, STT Local delivers low-latency streaming transcription using the AlignAtt simultaneous decoding policy from [UFAL SimulStreaming](https://github.com/ufal/SimulStreaming).

## Features

- **Real-time streaming transcription** — partial results appear as you speak, finalized when you stop
- **Privacy-first** — all processing happens locally; audio never leaves your machine
- **Multi-backend support** — automatic hardware detection:
  - `mlx-whisper` on macOS Apple Silicon (MPS)
  - `faster-whisper` on Linux with CUDA
  - CPU fallback everywhere else
- **Live waveform visualization** — real-time frequency display via Canvas + AnalyserNode
- **Multi-language** — Czech (primary) and English, with easy extensibility to any Whisper-supported language
- **WebSocket streaming protocol** — lightweight JSON control messages + binary PCM audio
- **Exponential backoff reconnection** — automatic reconnection with progressive delays
- **Comprehensive test coverage** — 185+ tests across frontend and backend, >90% coverage enforced

## Architecture

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

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.13.1 | Managed via [pyenv](https://github.com/pyenv/pyenv) (pinned in `.python-version`) |
| Bun | latest | Or Node.js 20+ for the SvelteKit frontend |
| Git | latest | Required to clone SimulStreaming during backend install |

### Installation

```bash
# 1. Clone the repository
git clone <repo-url> stt_local
cd stt_local

# 2. Backend setup
make install-be

# 3. Frontend setup
cd frontend
bun install

# 4. Start both services
cd ..
./start.sh
```

Or use the Makefile:

```bash
make install   # Install both frontend + backend dependencies
make dev       # Start both servers
```

The application will be available at:
- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:8765
- **Health check:** http://localhost:8765/health

### SimulStreaming Setup

`make install-be` now bootstraps SimulStreaming automatically:

```bash
# Runs backend/scripts/install_backend.sh:
# - creates backend/.venv (if missing)
# - installs backend deps (auto-adds mps extra on Apple Silicon, cuda extra on Linux)
# - clones SimulStreaming into ./SimulStreaming (project root)
# - installs SimulStreaming requirements_whisper.txt
# - patches backend/.venv/bin/activate to export PYTHONPATH with ./SimulStreaming
make install-be
```

If your venv is already active after installation, reload it:

```bash
deactivate
source backend/.venv/bin/activate
```

### Hardware-Specific Installation

```bash
# macOS Apple Silicon (MLX acceleration)
cd backend && pip install -e ".[mps]"

# Linux with NVIDIA GPU (CUDA acceleration)
cd backend && pip install -e ".[cuda]"

# CPU-only (no extra install needed — automatic fallback)
```

## Configuration

All backend settings use the `STT_` prefix as environment variables:

| Variable | Default | Description |
|---|---|---|
| `STT_HOST` | `0.0.0.0` | Server bind address |
| `STT_PORT` | `8765` | Server port |
| `STT_MODEL_SIZE` | `large-v3-turbo` | Whisper model name or path |
| `STT_LANGUAGE` | `cs` | Default language code |
| `STT_CORS_ORIGINS` | `["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:4173"]` | Allowed CORS origins |
| `STT_LOG_LEVEL` | `info` | Python logging level |

Example:

```bash
STT_MODEL_SIZE=large-v3 STT_LANGUAGE=en ./start.sh
```

## Usage

1. Open http://localhost:5173 in your browser
2. Click **Connect** to establish a connection with the backend
3. Select your language (CS or EN)
4. Click the microphone button to start recording
5. Speak — partial transcriptions appear in real-time
6. Click the microphone button again to stop — final transcription is committed
7. Use the **Copy** button to copy the transcript to clipboard, or **Clear** to reset

## Testing

```bash
# Run all tests (frontend + backend)
make test

# Frontend only (129+ tests, Vitest + jsdom)
make test-fe

# Backend only (57+ tests, pytest + pytest-asyncio)
make test-be

# Coverage reports
make coverage
```

Both frontend and backend enforce a **90% coverage threshold**.

## Project Structure

```
stt_local/
├── start.sh                     # Launch both backend + frontend
├── Makefile                     # Build, test, and development tasks
├── ARCHITECTURE.md              # Detailed architecture & developer guide
├── README.md                    # This file
│
├── backend/                     # Python FastAPI backend
│   ├── pyproject.toml           # Dependencies, pytest config, coverage
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan handler
│   │   ├── config.py            # Pydantic Settings (STT_* env vars)
│   │   ├── models.py            # WebSocket protocol Pydantic schemas
│   │   ├── routes/
│   │   │   ├── health.py        # GET /health
│   │   │   └── websocket.py     # WS /ws/transcribe
│   │   ├── engine/
│   │   │   ├── detector.py      # Auto-detect MPS/CUDA/CPU
│   │   │   ├── factory.py       # Singleton TranscriptionEngine
│   │   │   └── processor.py     # Per-session SessionProcessor
│   │   └── audio/
│   │       └── normalizer.py    # PCM int16 → float32
│   └── tests/                   # 57+ pytest tests
│
├── frontend/                    # SvelteKit + TypeScript frontend
│   ├── package.json
│   ├── src/
│   │   ├── routes/
│   │   │   └── +page.svelte     # Main orchestrator page
│   │   └── lib/
│   │       ├── audio/           # AudioWorklet capture + PCM processing
│   │       ├── whisper/         # WebSocket client + health check
│   │       ├── state/           # Svelte 5 reactive state ($state)
│   │       ├── components/      # UI components (6 total)
│   │       ├── theme/           # Catppuccin color palette
│   │       └── utils/           # Formatting utilities
│   └── tests/                   # Test setup + mocks
```

## Makefile Reference

| Target | Description |
|---|---|
| `make install` | Install all dependencies (frontend + backend) |
| `make dev` | Start both servers via `start.sh` |
| `make dev-fe` | Start frontend only |
| `make dev-be` | Start backend only |
| `make test` | Run all tests |
| `make test-fe` | Run frontend tests |
| `make test-be` | Run backend tests |
| `make coverage` | Run tests with coverage reports |
| `make check` | TypeScript type checking |
| `make build` | Build frontend for production |
| `make clean` | Remove build artifacts and caches |

## Technology Stack

### Backend
- **Python 3.13** — Runtime
- **FastAPI** — Web framework with WebSocket support
- **Uvicorn** — ASGI server
- **Pydantic** — Data validation and settings management
- **NumPy** — Audio array processing
- **PyTorch** — GPU detection and tensor operations
- **SimulStreaming (UFAL)** — Real-time ASR with AlignAtt attention streaming

### Frontend
- **SvelteKit 2** — Meta-framework with static adapter
- **Svelte 5** — Component framework using Runes (`$state`, `$derived`, `$effect`)
- **TypeScript 5** — Type safety
- **Vite 6** — Build tool and dev server
- **Vitest 3** — Test framework with V8 coverage
- **Catppuccin Mocha** — Color theme

## API Reference

### REST Endpoints

#### `GET /health`

Returns server status and configuration.

**Response:**
```json
{
  "status": "ok",
  "backend": "mlx-whisper",
  "device": "mps",
  "model": "large-v3-turbo",
  "version": "0.1.0"
}
```

### WebSocket Protocol

#### `WS /ws/transcribe`

Full-duplex streaming transcription endpoint.

**Connection flow:**

```
Client                          Server
  |--- WS Connect ────────────────>|
  |<── connected (server info)     |
  |─── configure (language)  ─────>|
  |<── ready                       |
  |─── [binary PCM audio]   ─────>|  (repeat)
  |<── partial results             |  (repeat)
  |─── stop                  ─────>|
  |<── final results               |
  |<── done                        |
```

**Audio format:**
- Sample rate: 16,000 Hz
- Encoding: signed 16-bit integer, little-endian (s16le)
- Channels: mono
- Chunk size: 1,600 samples = 100ms = 3,200 bytes

**Server messages:**

| Type | Fields | Description |
|---|---|---|
| `connected` | `backend`, `device`, `model` | Server info after connection |
| `ready` | — | Session configured, ready for audio |
| `partial` | `text`, `start_ms`, `end_ms` | Intermediate result (may change) |
| `final` | `text`, `start_ms`, `end_ms` | Committed result (won't change) |
| `done` | — | Transcription segment complete |

**Client messages:**

| Type | Fields | Description |
|---|---|---|
| `configure` | `language` | Set session language (`cs`, `en`, `auto`) |
| `stop` | — | End audio stream, request final results |
| *(binary)* | PCM s16le bytes | Audio data (sent as binary WebSocket frame) |

## Further Reading

- [ARCHITECTURE.md](ARCHITECTURE.md) — Detailed architecture, engine internals, SimulStreaming API reference, AlignAtt policy explanation, and developer guide
- [backend/README.md](backend/README.md) — Backend-specific setup, API details, and engine documentation
- [frontend/README.md](frontend/README.md) — Frontend-specific setup, component guide, and audio pipeline details
- [CONTRIBUTING.md](CONTRIBUTING.md) — Contributing guidelines, code style, and development workflow

## License

Private project.
