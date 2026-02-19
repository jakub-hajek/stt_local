# STT Local

Privacy-first, real-time speech-to-text running entirely on your machine. No cloud, no data leaves your device.

Built with a **FastAPI + mlx-whisper** backend and a **SvelteKit** frontend, STT Local delivers low-latency streaming transcription on macOS Apple Silicon.

## Features

- **Real-time streaming transcription** — partial results appear as you speak, finalized when you stop
- **Privacy-first** — all processing happens locally; audio never leaves your machine
- **Apple Silicon acceleration** — uses mlx-whisper for fast inference on MPS
- **File upload transcription** — upload audio files (WAV, MP3, FLAC, OGG, etc.) for batch transcription
- **Live waveform visualization** — real-time frequency display via Canvas + AnalyserNode
- **Multi-language** — Czech, Slovak, English, and Auto-detect, with easy extensibility to any Whisper-supported language
- **WebSocket streaming protocol** — lightweight JSON control messages + binary PCM audio
- **Exponential backoff reconnection** — automatic reconnection with progressive delays
- **Comprehensive test coverage** — 90% coverage enforced on both frontend and backend

## Architecture

```
Browser (SvelteKit)                    Backend (FastAPI + uvicorn)
┌────────────────────┐                 ┌──────────────────────────────┐
│ Mic → AudioWorklet │                 │ GET  /health                 │
│ (PCM 16kHz s16le)  │──WebSocket──▶   │ POST /api/transcribe         │
│                    │                 │ WS   /ws/transcribe          │
│ File Upload        │──HTTP POST──▶   │                              │
│ Transcript UI      │◀──JSON──────   │ mlx-whisper engine           │
│ Waveform (local)   │                 │  macOS ARM64 → MPS           │
└────────────────────┘                 └──────────────────────────────┘
```

## Quick Start

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.13.1 | Managed via [pyenv](https://github.com/pyenv/pyenv) (pinned in `.python-version`) |
| Bun | latest | Or Node.js 20+ for the SvelteKit frontend |

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/jakub-hajek/stt_local.git
cd stt_local

# 2. Install all dependencies (frontend + backend)
make install

# 3. Start both servers
make dev
```

Or step by step:

```bash
# Backend setup
make install-be   # Creates venv, installs deps

# Frontend setup
cd frontend
bun install

# Start both services
./start.sh
```

The application will be available at:
- **Frontend:** http://localhost:5173/stt
- **Backend:** http://localhost:8765
- **Health check:** http://localhost:8765/health

## Configuration

All backend settings use the `STT_` prefix as environment variables:

| Variable | Default | Description |
|---|---|---|
| `STT_HOST` | `0.0.0.0` | Server bind address |
| `STT_PORT` | `8765` | Server port |
| `STT_MODEL_SIZE` | `large-v3-turbo` | Whisper model name (see Model Sizes below) |
| `STT_LANGUAGE` | `cs` | Default language code |
| `STT_CORS_ORIGINS` | `["http://localhost:5173", ...]` | Allowed CORS origins |
| `STT_LOG_LEVEL` | `info` | Python logging level |

### Model Sizes

| Short Name | HuggingFace Repo |
|---|---|
| `tiny` | `mlx-community/whisper-tiny` |
| `base` | `mlx-community/whisper-base` |
| `small` | `mlx-community/whisper-small` |
| `medium` | `mlx-community/whisper-medium` |
| `large` / `large-v3` | `mlx-community/whisper-large-v3` |
| `large-v3-turbo` | `mlx-community/whisper-large-v3-turbo` |

Example:

```bash
STT_MODEL_SIZE=medium STT_LANGUAGE=en make dev
```

## Usage

1. Open http://localhost:5173/stt in your browser
2. Click **Connect** to establish a connection with the backend
3. Select your language (CS, SK, EN, or Auto)
4. Click the microphone button to start recording
5. Speak — partial transcriptions appear in real-time
6. Click the microphone button again to stop — final transcription is committed
7. Or use **File Upload** to transcribe an audio file
8. Use the **Copy** button to copy the transcript to clipboard, or **Clear** to reset

## Testing

```bash
# Run all tests (frontend + backend)
make test

# Frontend only (Vitest + jsdom)
make test-fe

# Backend only (pytest + pytest-asyncio)
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
├── API.md                       # Full API reference
├── README.md                    # This file
│
├── backend/                     # Python FastAPI backend
│   ├── pyproject.toml           # Dependencies, pytest config, coverage
│   ├── scripts/
│   │   └── install_backend.sh   # Automated venv + deps setup
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan handler
│   │   ├── config.py            # Pydantic Settings (STT_* env vars), model repo map
│   │   ├── models.py            # WebSocket protocol Pydantic schemas
│   │   ├── routes/
│   │   │   ├── health.py        # GET /health
│   │   │   ├── upload.py        # POST /api/transcribe (file upload)
│   │   │   └── websocket.py     # WS /ws/transcribe
│   │   ├── engine/
│   │   │   └── factory.py       # Singleton TranscriptionEngine (mlx-whisper)
│   │   └── audio/
│   │       └── normalizer.py    # PCM int16 → float32
│   └── tests/                   # pytest test suite
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
│   │       ├── components/      # UI components (7 total)
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
- **mlx-whisper** — Whisper inference on Apple Silicon (MPS)
- **Pydantic** — Data validation and settings management
- **NumPy** — Audio array processing
- **librosa** — Audio file decoding and resampling

### Frontend
- **SvelteKit 2** — Meta-framework with static adapter
- **Svelte 5** — Component framework using Runes (`$state`, `$derived`, `$effect`)
- **TypeScript 5** — Type safety
- **Vite 6** — Build tool and dev server
- **Vitest 3** — Test framework with V8 coverage
- **Catppuccin Mocha** — Color theme

## API Reference

See [API.md](API.md) for the full API reference, including REST endpoints, WebSocket protocol, and message schemas.

## Further Reading

- [ARCHITECTURE.md](ARCHITECTURE.md) — Detailed architecture and developer guide
- [backend/README.md](backend/README.md) — Backend-specific setup and engine documentation
- [frontend/README.md](frontend/README.md) — Frontend-specific setup, component guide, and audio pipeline details
- [CONTRIBUTING.md](CONTRIBUTING.md) — Contributing guidelines, code style, and development workflow

## License

This project is licensed under the [MIT License](LICENSE).
