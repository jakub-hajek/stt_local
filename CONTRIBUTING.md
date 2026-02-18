# Contributing to STT Local

## Development Environment

### Prerequisites

| Tool | Version | Installation |
|---|---|---|
| pyenv | latest | [pyenv installer](https://github.com/pyenv/pyenv#installation) |
| Python | 3.13.1 | `pyenv install 3.13.1` (auto-selected via `.python-version`) |
| Bun | latest | [bun.sh](https://bun.sh/) |
| SimulStreaming | latest | `git clone https://github.com/ufal/SimulStreaming.git` |

### First-Time Setup

```bash
# 1. Clone the repository
git clone <repo-url> stt_local
cd stt_local

# 2. Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# 3. SimulStreaming
git clone https://github.com/ufal/SimulStreaming.git /path/to/SimulStreaming
export PYTHONPATH="/path/to/SimulStreaming:$PYTHONPATH"
pip install -r /path/to/SimulStreaming/requirements_whisper.txt

# 4. Frontend
cd ../frontend
bun install

# 5. Verify everything works
cd ..
make test
```

## Development Workflow

### Running the Application

```bash
# Both servers
make dev

# Individual servers
make dev-fe   # Frontend at :5173
make dev-be   # Backend at :8765
```

### Running Tests

```bash
# All tests
make test

# Individual
make test-fe    # Frontend (Vitest)
make test-be    # Backend (pytest)

# With coverage
make coverage
```

### Type Checking

```bash
make check   # Frontend TypeScript checking via svelte-check
```

## Code Organization

### Backend (`backend/`)

- **`app/`** — Application source code
  - `main.py` — FastAPI app setup, CORS, lifespan handler
  - `config.py` — Pydantic Settings with `STT_` env prefix
  - `models.py` — WebSocket protocol Pydantic schemas
  - `routes/` — HTTP and WebSocket route handlers
  - `engine/` — Transcription engine (detection, factory, session processor)
  - `audio/` — Audio processing utilities
- **`tests/`** — pytest test suite

### Frontend (`frontend/`)

- **`src/lib/`** — Shared library code
  - `audio/` — AudioWorklet capture, PCM processing, silence detection
  - `whisper/` — WebSocket client, health checking, protocol types
  - `state/` — Svelte 5 reactive state stores
  - `components/` — Svelte UI components
  - `theme/` — Color palette
  - `utils/` — Formatting utilities
- **`src/routes/`** — SvelteKit pages
- **`tests/`** — Test setup and browser API mocks

## Testing Guidelines

### Coverage Requirements

Both frontend and backend enforce a **90% coverage threshold**. PRs that drop coverage below 90% will fail CI.

### Backend Testing

- All test files go in `backend/tests/`
- Use `pytest-asyncio` for async tests (auto mode enabled)
- The `conftest.py` autouse fixture mocks SimulStreaming, so tests don't require ML dependencies
- Use `httpx.AsyncClient` for HTTP endpoint testing

```python
# Example test
import pytest
from app.audio.normalizer import pcm_to_float32

def test_pcm_to_float32_silence():
    silence = b'\x00\x00' * 100
    result = pcm_to_float32(silence)
    assert all(result == 0.0)
```

### Frontend Testing

- Co-locate test files with source: `module.ts` → `module.test.ts`
- Use `@testing-library/svelte` for component tests
- The `tests/setup.ts` file provides browser API mocks (AudioContext, WebSocket, etc.)
- Excluded from coverage: `types.ts`, `theme/`, `pcm-processor.worklet.ts`

```typescript
// Example test
import { describe, it, expect } from 'vitest';
import { formatTimestamp } from './format';

describe('formatTimestamp', () => {
  it('formats milliseconds as MM:SS', () => {
    expect(formatTimestamp(65000)).toBe('01:05');
  });
});
```

## Code Style

### Backend (Python)

- Follow PEP 8
- Type hints on all function signatures
- Docstrings on public classes and functions
- Pydantic models for all data structures

### Frontend (TypeScript/Svelte)

- Strict TypeScript (`strict: true`)
- Svelte 5 Runes API (`$state`, `$derived`, `$effect`) — no legacy `let` reactivity
- Explicit types for function parameters and return values
- Semantic HTML with ARIA attributes for accessibility

## WebSocket Protocol Changes

When modifying the WebSocket protocol:

1. Update Pydantic models in `backend/app/models.py`
2. Update TypeScript types in `frontend/src/lib/whisper/types.ts`
3. Update the WebSocket handler in `backend/app/routes/websocket.py`
4. Update the Transcriber client in `frontend/src/lib/whisper/transcriber.ts`
5. Update protocol documentation in `ARCHITECTURE.md`
6. Add tests for both backend and frontend

## Adding a New Language

1. Add to the `Language` type in `frontend/src/lib/whisper/types.ts`
2. Add a radio button in `frontend/src/lib/components/LanguageSelector.svelte`
3. Add corresponding test cases
4. The backend accepts any Whisper-supported language code — no backend changes needed

## Common Issues

### "Python venv not found"

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### "SimulStreaming module not found"

Ensure SimulStreaming is on your `PYTHONPATH`:

```bash
export PYTHONPATH="/path/to/SimulStreaming:$PYTHONPATH"
```

### "Backend did not respond within 30s" on startup

The first startup may take longer as the Whisper model downloads. Check backend logs for download progress.

### Tests fail with import errors

Ensure you've installed dev dependencies:

```bash
# Backend
cd backend && pip install -e ".[dev]"

# Frontend
cd frontend && bun install
```
