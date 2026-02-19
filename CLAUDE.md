# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

STT Local is a privacy-first, real-time speech-to-text app. A Python FastAPI backend uses mlx-whisper for Whisper transcription. A SvelteKit frontend captures microphone audio via AudioWorklet and streams PCM over WebSocket. Live transcription uses 2-second buffered batches.

## Commands

### Development

```bash
make dev          # Start both backend + frontend (via start.sh)
make dev-fe       # Frontend only at :5173
make dev-be       # Backend only at :8765
```

### Testing

```bash
make test         # All tests
make test-fe      # Frontend: bun run test (Vitest + jsdom)
make test-be      # Backend: pytest

# Single backend test
cd backend && .venv/bin/pytest tests/test_factory.py -v
cd backend && .venv/bin/pytest tests/test_factory.py::TestTranscribeDelegation::test_transcribe_returns_result -v

# Single frontend test
cd frontend && bun run vitest run src/lib/audio/capture.test.ts
cd frontend && bun run vitest run -t "test name pattern"

# Coverage
make coverage     # Both
make coverage-fe  # Frontend (90% threshold: statements, branches, functions, lines)
make coverage-be  # Backend (90% threshold: fail_under in pyproject.toml)
```

### Other

```bash
make install      # Install all deps (bun install + pip install -e ".[dev]")
make check        # Frontend TypeScript checking
make build        # Build frontend for production
make clean        # Remove build artifacts
```

## Architecture

### Data Flow

Browser mic → AudioWorklet (16kHz PCM s16le) → WebSocket binary frames → FastAPI backend → mlx-whisper (2s buffered batches) → JSON partial/final results back over WebSocket.

### Backend (`backend/app/`)

- **Singleton engine pattern**: `TranscriptionEngine` (factory.py) loads the mlx-whisper model once at startup via a warm-up transcription. Provides `engine.transcribe(audio, language)` wrapping `mlx_whisper.transcribe()`.
- **Model repo mapping** (config.py): `MODEL_REPO_MAP` maps short names (`tiny`, `large-v3-turbo`) to HuggingFace repos (`mlx-community/whisper-tiny`, etc.). `get_model_repo()` helper resolves them.
- **WebSocket protocol** (routes/websocket.py): `connected` → `configure` → `ready` → binary audio / `partial` results → `stop` → `final` results → `done`. Buffers audio and transcribes every 2s of new data. Force-finalizes at 30s.
- **File upload** (routes/upload.py): Decodes audio with librosa, calls `engine.transcribe()` once in a thread, converts segment times (seconds → ms).
- **Audio normalization** (audio/normalizer.py): `pcm_to_float32()` converts int16 LE bytes to float32 numpy array.
- **Config**: Pydantic Settings with `STT_` env prefix (config.py). Key vars: `STT_MODEL_SIZE`, `STT_LANGUAGE`, `STT_PORT`.

### Frontend (`frontend/src/lib/`)

- **Svelte 5 Runes** — uses `$state`, `$derived`, `$effect` exclusively (no legacy `let` reactivity).
- **Audio pipeline**: `AudioCapture` → `AudioContext(16kHz)` → AudioWorkletNode runs `pcm-processor.worklet.ts` collecting 1600-sample buffers → main thread converts Float32→Int16 LE → WebSocket binary send.
- **Transcriber** (whisper/transcriber.ts): WebSocket client with exponential backoff reconnection (1s→30s).
- **State**: `appState` (app.svelte.ts) and `transcriptState` (transcript.svelte.ts) are reactive stores. Transcript supports partial-update-in-place and finalization.
- **+page.svelte** is the orchestrator — wires audio capture, transcriber, and state together.
- **Theme**: Catppuccin Mocha palette in `theme/catppuccin.ts`.

### Testing Patterns

- **Backend**: `conftest.py` autouse fixture stubs `mlx_whisper` module so tests run without ML dependencies. Use `loaded_engine` fixture for tests needing a loaded engine. Tests use `pytest-asyncio` in auto mode.
- **Frontend**: `tests/setup.ts` mocks browser APIs (AudioContext, WebSocket, fetch, navigator.mediaDevices). Every source file has a co-located `.test.ts`. Coverage excludes `types.ts`, `theme/`, and `pcm-processor.worklet.ts` (AudioWorklet context unavailable in jsdom).

### WebSocket Message Types

Server→Client: `connected`, `ready`, `partial` (text + start_ms/end_ms), `final`, `done`.
Client→Server: `configure` (language), `stop`, binary PCM frames.
Pydantic schemas in `backend/app/models.py`, TypeScript types in `frontend/src/lib/whisper/types.ts`.

## Key Conventions

- Backend Python venv at `backend/.venv/` — `start.sh` uses it directly without activation.
- mlx-whisper is a pip dependency (no external PYTHONPATH needed).
- Audio format everywhere: 16kHz, mono, signed int16 little-endian, 1600-sample chunks (100ms, 3200 bytes).
- All Pydantic models use `model_dump()` for serialization (v2 API).
- Frontend uses `$lib` alias resolving to `src/lib/`.
- CSP headers configured in both `hooks.server.ts` and `vite.config.ts` to allow `ws://localhost:8765`.
