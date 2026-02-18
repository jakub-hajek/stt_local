# STT Local — Backend

FastAPI backend for real-time speech-to-text using [SimulStreaming](https://github.com/ufal/SimulStreaming) (UFAL) with the AlignAtt simultaneous decoding policy.

## Setup

### Prerequisites

- Python 3.13.1 (via [pyenv](https://github.com/pyenv/pyenv))
- Git (to clone SimulStreaming during setup)

### Installation

```bash
# From project root
make install-be
```

This runs `backend/scripts/install_backend.sh`, which creates `backend/.venv`, installs backend dependencies (including `mps` extras automatically on Apple Silicon and `cuda` extras on Linux), clones `SimulStreaming` into the project root, installs `requirements_whisper.txt`, and patches `backend/.venv/bin/activate` to export the required `PYTHONPATH`.

### Hardware-Specific Extras

```bash
# macOS Apple Silicon (MLX)
pip install -e ".[mps]"

# Linux CUDA
pip install -e ".[cuda]"
```

### Running

```bash
# Using the Makefile (from project root)
make dev-be

# Or directly
cd backend
PYTHONPATH="../SimulStreaming:$PYTHONPATH" .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8765 --log-level info
```

The server starts at http://localhost:8765.

## Configuration

All settings use the `STT_` prefix as environment variables, managed by Pydantic Settings in `app/config.py`:

| Variable | Type | Default | Description |
|---|---|---|---|
| `STT_HOST` | `str` | `0.0.0.0` | Server bind address |
| `STT_PORT` | `int` | `8765` | Server port |
| `STT_MODEL_SIZE` | `str` | `large-v3-turbo` | Whisper model name or local path |
| `STT_LANGUAGE` | `str` | `cs` | Default language code |
| `STT_CORS_ORIGINS` | `list[str]` | `["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:4173"]` | Allowed CORS origins |
| `STT_LOG_LEVEL` | `str` | `info` | Python logging level (`debug`, `info`, `warning`, `error`) |

Example:

```bash
STT_MODEL_SIZE=medium STT_LANGUAGE=en STT_LOG_LEVEL=debug \
  uvicorn app.main:app --port 8765
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

**5. Server sends partial results:**
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

### Engine Components

#### Backend Detection (`app/engine/detector.py`)

Automatically detects the best available hardware backend:

1. **macOS ARM64 + `mlx_whisper` importable** → `("mlx-whisper", "mps")`
2. **`torch.cuda.is_available()` + `faster_whisper` importable** → `("faster-whisper", "cuda")`
3. **Fallback** → `("faster-whisper", "cpu")`

#### TranscriptionEngine (`app/engine/factory.py`)

Thread-safe singleton that manages the ASR model lifecycle:

- **Loads once** at application startup via SimulStreaming's `simul_asr_factory()`
- **Creates per-session processors** for each WebSocket connection via `create_session()`
- **Properties:** `is_loaded`, `model_size`, `backend`, `device`

```python
engine = TranscriptionEngine.get_instance()
engine.load(model_size="large-v3-turbo", language="cs", backend="mlx-whisper", device="mps")

# Per WebSocket connection:
session_processor = engine.create_session()
```

#### SessionProcessor (`app/engine/processor.py`)

Wraps a `SimulWhisperOnline` instance for a single WebSocket session:

```python
processor = SessionProcessor(engine.create_session())

# Feed audio chunks → get partial results
partials = processor.feed_audio(float32_array)
# Returns: [(text, start_ms, end_ms), ...]

# At end of speech → get final results
finals = processor.flush()
# Returns: [(text, start_ms, end_ms), ...]
```

- Converts timestamps from seconds (SimulStreaming) to milliseconds (protocol)
- Filters out empty/whitespace-only results

#### Audio Normalizer (`app/audio/normalizer.py`)

Converts raw PCM bytes from WebSocket to NumPy arrays:

```python
from app.audio.normalizer import pcm_to_float32

float32_audio = pcm_to_float32(raw_bytes)
# Input:  bytes (int16 little-endian PCM)
# Output: np.ndarray float32 in range [-1.0, 1.0]
```

### Request Lifecycle

```
WebSocket Connect
       │
       ▼
Accept connection
Send ConnectedMessage (backend, device, model info)
       │
       ▼
Receive ConfigureMessage (language)
Create SessionProcessor for this connection
Send ReadyMessage
       │
       ▼
┌─── Audio Loop ────────────────────────┐
│  Receive binary frame (PCM s16le)     │
│  pcm_to_float32() → float32 array    │
│  processor.feed_audio() → partials   │
│  Send PartialResult for each result   │
│  ◄────────────────────────────────────┘
       │
       ▼ (on "stop" message)
processor.flush() → final results
Send FinalResult for each result
Send DoneMessage
       │
       ▼
Close connection
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

| Test File | Covers | Tests |
|---|---|---|
| `test_detector.py` | `app/engine/detector.py` | 8 tests — all backend detection paths (MPS, CUDA, CPU) |
| `test_factory.py` | `app/engine/factory.py` | 7 tests — singleton behavior, model loading, double-load warning |
| `test_normalizer.py` | `app/audio/normalizer.py` | 6 tests — PCM int16 → float32 conversion accuracy |
| `test_processor.py` | `app/engine/processor.py` | 23 tests — result parsing (dict/tuple/None), feed/flush behavior |
| `test_websocket.py` | `app/routes/websocket.py` | 13 tests — handshake, audio flow, error handling |
| `test_main.py` | `app/main.py` | App startup/shutdown lifecycle |

### Mocking Strategy

The `tests/conftest.py` provides an autouse fixture that creates a fake `simulstreaming_whisper` module with a `_MockOnlineProcessor` class. This allows tests to run without the heavy ML dependencies (PyTorch models, SimulStreaming).

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
| `torch` | GPU detection, tensor operations |
| `torchaudio` | Audio processing utilities |
| `librosa` | Audio analysis |
| `pydantic-settings` | Environment-based configuration |

### Optional

| Extra | Package | Purpose |
|---|---|---|
| `mps` | `mlx-whisper` | macOS Apple Silicon acceleration |
| `cuda` | `faster-whisper` | NVIDIA GPU acceleration |

### Development

| Package | Purpose |
|---|---|
| `pytest` | Test framework |
| `pytest-asyncio` | Async test support |
| `pytest-cov` | Coverage reporting |
| `httpx` | Async HTTP client for testing |
