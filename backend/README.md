# STT Local — Backend

FastAPI backend for real-time speech-to-text using [mlx-whisper](https://github.com/ml-explore/mlx-examples/tree/main/whisper) on Apple Silicon.

## Setup

### Prerequisites

- Python 3.13.1 (via [pyenv](https://github.com/pyenv/pyenv))

### Installation

```bash
# From project root
make install-be
```

This runs `backend/scripts/install_backend.sh`, which creates `backend/.venv` and installs all dependencies.

### Running

```bash
# Using the Makefile (from project root)
make dev-be

# Or directly
cd backend
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8765 --log-level info
```

The server starts at http://localhost:8765.

## Configuration

All settings use the `STT_` prefix as environment variables, managed by Pydantic Settings in `app/config.py`:

| Variable | Type | Default | Description |
|---|---|---|---|
| `STT_HOST` | `str` | `0.0.0.0` | Server bind address |
| `STT_PORT` | `int` | `8765` | Server port |
| `STT_MODEL_SIZE` | `str` | `large-v3-turbo` | Whisper model short name (see config.py `MODEL_REPO_MAP`) |
| `STT_LANGUAGE` | `str` | `cs` | Default language code |
| `STT_CORS_ORIGINS` | `list[str]` | `["http://localhost:5173", ...]` | Allowed CORS origins |
| `STT_LOG_LEVEL` | `str` | `info` | Python logging level (`debug`, `info`, `warning`, `error`) |

Example:

```bash
STT_MODEL_SIZE=medium STT_LANGUAGE=en \
  .venv/bin/uvicorn app.main:app --port 8765
```

## API Reference

### `GET /health`

Health check endpoint returning server status and engine information.

**Response (200):**
```json
{
  "status": "ok",
  "backend": "mlx-whisper",
  "device": "mps",
  "model": "large-v3-turbo",
  "version": "0.1.0"
}
```

### `POST /api/transcribe`

File upload endpoint for batch transcription. Accepts audio files via multipart upload.

**Request:**
- `file` — audio file (WAV, MP3, FLAC, OGG, etc.)
- `language` — language code (default: `cs`)

**Response (200):**
```json
{
  "text": "Transcribed text here",
  "segments": [
    { "text": "Transcribed", "start_ms": 0, "end_ms": 1200 },
    { "text": "text here", "start_ms": 1200, "end_ms": 2400 }
  ],
  "duration_ms": 2400.0
}
```

### `WS /ws/transcribe`

WebSocket endpoint for streaming audio transcription.

#### Protocol

The WebSocket protocol uses JSON for control messages and binary frames for audio data.

**1. Connection established — server sends info:**
```json
{
  "type": "connected",
  "backend": "mlx-whisper",
  "device": "mps",
  "model": "large-v3-turbo"
}
```

**2. Client configures session:**
```json
{
  "type": "configure",
  "language": "cs"
}
```

**3. Server acknowledges:**
```json
{ "type": "ready" }
```

**4. Client streams audio (binary frames):**
- Format: PCM signed 16-bit integer, little-endian (s16le)
- Sample rate: 16,000 Hz, mono
- Chunk size: 1,600 samples = 100ms = 3,200 bytes

**5. Server sends partial results (every 2s of new audio):**
```json
{
  "type": "partial",
  "text": "Ahoj svete",
  "start_ms": 0,
  "end_ms": 1200
}
```

**6. Client signals end of audio:**
```json
{ "type": "stop" }
```

**7. Server sends final results and completion signal:**
```json
{
  "type": "final",
  "text": "Ahoj světe",
  "start_ms": 0,
  "end_ms": 1860
}
```
```json
{ "type": "done" }
```

#### Message Schema Reference

All message schemas are defined as Pydantic models in `app/models.py`:

| Model | Direction | Type Field | Additional Fields |
|---|---|---|---|
| `ConnectedMessage` | Server → Client | `connected` | `backend`, `device`, `model` |
| `ReadyMessage` | Server → Client | `ready` | — |
| `PartialResult` | Server → Client | `partial` | `text`, `start_ms`, `end_ms` |
| `FinalResult` | Server → Client | `final` | `text`, `start_ms`, `end_ms` |
| `DoneMessage` | Server → Client | `done` | — |
| `ConfigureMessage` | Client → Server | `configure` | `language` |
| `StopMessage` | Client → Server | `stop` | — |

## Architecture

### TranscriptionEngine (`app/engine/factory.py`)

Thread-safe singleton that manages the mlx-whisper model:

- **Loads once** at startup via a warm-up transcription on silence
- **Provides `transcribe(audio, language)`** — synchronous wrapper around `mlx_whisper.transcribe()`
- **Provides `transcribe_async(audio, language)`** — runs transcription off the event loop via a single-thread executor (prevents Metal GPU memory corruption from concurrent access)
- **Properties:** `is_loaded`, `model_size`, `backend`, `device`

```python
engine = TranscriptionEngine.get_instance()
engine.load(model_repo="mlx-community/whisper-large-v3-turbo", language="cs")
result = engine.transcribe(audio_array)
```

### WebSocket Streaming (`app/routes/websocket.py`)

Buffers audio and transcribes every 2 seconds of new data. Force-finalizes and resets the buffer at 5 seconds.

### File Upload (`app/routes/upload.py`)

Decodes audio with librosa, calls `engine.transcribe_async()`, and converts segment times from seconds to milliseconds.

### Audio Normalizer (`app/audio/normalizer.py`)

Converts raw PCM bytes from WebSocket to NumPy arrays:

```python
from app.audio.normalizer import pcm_to_float32

float32_audio = pcm_to_float32(raw_bytes)
# Input:  bytes (int16 little-endian PCM)
# Output: np.ndarray float32 in range [-1.0, 1.0]
```

## Testing

```bash
# Run all backend tests
make test-be
# or
cd backend && .venv/bin/pytest

# With coverage report
make coverage-be
# or
cd backend && .venv/bin/pytest --cov=app --cov-report=term-missing
```

### Test Structure

| Test File | Covers |
|---|---|
| `test_factory.py` | `app/engine/factory.py` — singleton behavior, model loading, transcription |
| `test_normalizer.py` | `app/audio/normalizer.py` — PCM int16 → float32 conversion |
| `test_websocket.py` | `app/routes/websocket.py` — handshake, audio flow, error handling |
| `test_upload.py` | `app/routes/upload.py` — file upload, decoding, error cases |
| `test_main.py` | `app/main.py` — app startup/shutdown lifecycle |

### Mocking Strategy

The `tests/conftest.py` provides an autouse fixture that stubs the `mlx_whisper` module so tests run without ML dependencies.

### Coverage

Coverage threshold is set to **90%** (`fail_under = 90` in `pyproject.toml`). The CI build fails if coverage drops below this threshold.

## Dependencies

### Core

| Package | Purpose |
|---|---|
| `fastapi` | Web framework with WebSocket support |
| `uvicorn[standard]` | ASGI server |
| `websockets` | WebSocket protocol implementation |
| `numpy` | Audio array processing |
| `mlx-whisper` | Whisper inference on Apple Silicon |
| `librosa` | Audio file decoding and resampling |
| `pydantic-settings` | Environment-based configuration |
| `python-multipart` | File upload support |

### Development

| Package | Purpose |
|---|---|
| `pytest` | Test framework |
| `pytest-asyncio` | Async test support |
| `pytest-cov` | Coverage reporting |
| `httpx` | Async HTTP client for testing |
