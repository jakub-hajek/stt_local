# STT Local — Architecture & Developer Guide

Privacy-first speech-to-text using a Python backend with [mlx-whisper](https://github.com/ml-explore/mlx-examples/tree/main/whisper) for real-time streaming transcription on macOS Apple Silicon. Czech is the primary language.

## System Architecture

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

- **Python 3.13.1** via pyenv (pinned in `.python-version`)
- **Bun** (or Node.js 20+) for the SvelteKit frontend

### Setup

```bash
# 1. Clone and enter
git clone https://github.com/jakub-hajek/stt_local.git
cd stt_local

# 2. Install all dependencies
make install

# 3. Run both servers
make dev
```

### Running Tests

```bash
# All tests
make test

# Frontend (Vitest + jsdom, >90% coverage)
make test-fe

# Backend (pytest, >90% coverage)
make test-be
```

---

## Directory Structure

```
stt_local/
├── .python-version              # pyenv: 3.13.1
├── start.sh                     # Launch both backend + frontend
├── Makefile                     # Root Makefile for all common tasks
├── frontend/
│   ├── package.json
│   ├── vite.config.ts           # Vite + CSP headers
│   ├── vitest.config.ts         # Test config, 90% coverage threshold
│   ├── svelte.config.js         # SvelteKit static adapter
│   ├── tsconfig.json
│   ├── src/
│   │   ├── hooks.server.ts      # CSP headers (ws://localhost:8765 allowed)
│   │   ├── routes/
│   │   │   └── +page.svelte     # Main UI orchestrator
│   │   └── lib/
│   │       ├── audio/
│   │       │   ├── pcm-processor.worklet.ts  # AudioWorklet: 1600-sample buffers @16kHz
│   │       │   ├── capture.ts                # AudioWorklet + AnalyserNode
│   │       │   ├── chunker.ts                # RMS calculation, silence detection
│   │       │   └── types.ts
│   │       ├── whisper/
│   │       │   ├── transcriber.ts   # WebSocket client + reconnect backoff
│   │       │   ├── manager.ts       # Health check via fetch('/health')
│   │       │   └── types.ts         # ConnectionStatus, ServerMessage, etc.
│   │       ├── state/
│   │       │   ├── app.svelte.ts    # Reactive state (Svelte 5 $state)
│   │       │   └── transcript.svelte.ts  # Entries + partial/final streaming
│   │       ├── components/
│   │       │   ├── FileUpload.svelte       # Audio file upload
│   │       │   ├── ModelStatus.svelte      # Server connection status
│   │       │   ├── SettingsPanel.svelte    # Server URL, chunk interval
│   │       │   ├── MicControl.svelte       # Record button
│   │       │   ├── Waveform.svelte         # Canvas frequency viz
│   │       │   ├── LanguageSelector.svelte # CS/EN toggle
│   │       │   └── TranscriptDisplay.svelte
│   │       ├── theme/
│   │       │   └── catppuccin.ts   # Catppuccin Mocha color palette
│   │       └── utils/
│   │           └── format.ts       # Time/duration formatting, text cleaning
│   └── tests/
│       └── setup.ts             # Vitest: mock WebSocket, AudioWorklet, fetch
├── backend/
│   ├── .python-version          # pyenv: 3.13.1
│   ├── pyproject.toml           # Python deps, pytest config, coverage config
│   ├── scripts/
│   │   └── install_backend.sh   # Automated venv + deps setup
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, lifespan (model load)
│   │   ├── config.py            # Pydantic Settings (STT_* env vars), MODEL_REPO_MAP
│   │   ├── models.py            # WS protocol Pydantic schemas
│   │   ├── routes/
│   │   │   ├── health.py        # GET /health
│   │   │   ├── upload.py        # POST /api/transcribe
│   │   │   └── websocket.py     # WS /ws/transcribe
│   │   ├── engine/
│   │   │   └── factory.py       # Singleton TranscriptionEngine (mlx-whisper)
│   │   └── audio/
│   │       └── normalizer.py    # PCM int16 → float32
│   └── tests/
│       ├── conftest.py          # Mock mlx_whisper module
│       ├── test_factory.py
│       ├── test_main.py
│       ├── test_normalizer.py
│       ├── test_upload.py
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
  |<── {"type":"partial",          |   every 2s of new audio
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
| `STT_MODEL_SIZE` | `large-v3-turbo` | Whisper model name (mapped via `MODEL_REPO_MAP`) |
| `STT_LANGUAGE` | `cs` | Default language code |
| `STT_CORS_ORIGINS` | `["http://localhost:5173", ...]` | Allowed CORS origins |
| `STT_LOG_LEVEL` | `info` | Python logging level |

Example:
```bash
STT_MODEL_SIZE=medium STT_LANGUAGE=en make dev
```

### Model Repo Mapping

`config.py` maps short model names to HuggingFace repos via `MODEL_REPO_MAP`:

| Short Name | Repo |
|---|---|
| `tiny` | `mlx-community/whisper-tiny` |
| `base` | `mlx-community/whisper-base` |
| `small` | `mlx-community/whisper-small` |
| `medium` | `mlx-community/whisper-medium` |
| `large` / `large-v3` | `mlx-community/whisper-large-v3` |
| `large-v3-turbo` | `mlx-community/whisper-large-v3-turbo` |

---

## Engine Architecture

### TranscriptionEngine (Singleton)

`app/engine/factory.py` — Thread-safe singleton that:
1. **Loads once** at startup via a warm-up transcription on 1 second of silence
2. **Wraps `mlx_whisper.transcribe()`** with model repo and language defaults
3. **Serializes all MLX calls** through a single-thread executor to prevent Metal GPU memory corruption

```python
engine = TranscriptionEngine.get_instance()
engine.load(model_repo="mlx-community/whisper-large-v3-turbo", language="cs")

# Synchronous (for tests/scripts):
result = engine.transcribe(audio_array)

# Async (for route handlers):
result = await engine.transcribe_async(audio_array, language="en")
```

### WebSocket Streaming (`app/routes/websocket.py`)

Buffers incoming PCM audio and transcribes every 2 seconds of new data, sending `partial` results. Force-finalizes and resets the buffer at 5 seconds. On `stop`, transcribes the remaining buffer and sends `final` + `done`.

### File Upload (`app/routes/upload.py`)

`POST /api/transcribe` accepts multipart audio files. Decodes with librosa (supports WAV, MP3, FLAC, OGG, etc.), resamples to 16kHz mono, and runs a single transcription call.

### Audio Normalizer (`app/audio/normalizer.py`)

Converts raw PCM bytes from WebSocket to NumPy arrays:

```python
from app.audio.normalizer import pcm_to_float32

float32_audio = pcm_to_float32(raw_bytes)
# Input:  bytes (int16 little-endian PCM)
# Output: np.ndarray float32 in range [-1.0, 1.0]
```

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
├── FileUpload          — Audio file upload for batch transcription
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
- **Mocks:** `mlx_whisper` module stubbed via `conftest.py` (autouse fixture)
- **Pattern:** Test files in `tests/` directory, fixtures in `conftest.py`

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
STT_MODEL_SIZE=medium make dev
# or
STT_MODEL_SIZE=tiny make dev
```

### Adding a New Whisper Model

Add the short name → HuggingFace repo mapping to `MODEL_REPO_MAP` in `backend/app/config.py`.
