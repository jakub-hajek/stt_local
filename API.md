# STT Local — API Reference

Complete reference for the STT Local backend API, including REST endpoints, WebSocket protocol, and message schemas.

## Base URL

```
http://localhost:8765
```

Configurable via `STT_HOST` and `STT_PORT` environment variables.

---

## REST Endpoints

### `GET /health`

Health check and server information endpoint.

**Request:**
```
GET /health HTTP/1.1
Host: localhost:8765
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "backend": "mlx-whisper",
  "device": "mps",
  "model": "large-v3-turbo",
  "version": "0.1.0"
}
```

**Response Fields:**

| Field | Type | Description |
|---|---|---|
| `status` | `string` | Always `"ok"` when the server is running |
| `backend` | `string` | ASR backend: `"mlx-whisper"` or `"faster-whisper"` |
| `device` | `string` | Compute device: `"mps"`, `"cuda"`, or `"cpu"` |
| `model` | `string` | Loaded Whisper model name |
| `version` | `string` | Application version |

**Use cases:**
- Check if the backend is running before establishing WebSocket
- Display server configuration in the UI
- Monitoring and healthcheck integrations

---

## WebSocket Endpoint

### `WS /ws/transcribe`

Full-duplex streaming transcription over WebSocket. Accepts binary audio frames and returns JSON transcription results.

**Connection URL:**
```
ws://localhost:8765/ws/transcribe
```

---

## WebSocket Protocol

### Connection Lifecycle

```
Phase 1: Handshake
  Client  ──── WS Connect ─────────────────>  Server
  Client  <─── ConnectedMessage ────────────  Server

Phase 2: Configuration
  Client  ──── ConfigureMessage ────────────>  Server
  Client  <─── ReadyMessage ───────────────  Server

Phase 3: Streaming (repeats)
  Client  ──── Binary PCM audio ────────────>  Server
  Client  <─── PartialResult ──────────────  Server

Phase 4: Finalization
  Client  ──── StopMessage ─────────────────>  Server
  Client  <─── FinalResult (0..N) ─────────  Server
  Client  <─── DoneMessage ────────────────  Server
```

### Audio Format

All binary WebSocket frames must contain PCM audio in the following format:

| Property | Value |
|---|---|
| Sample rate | 16,000 Hz |
| Encoding | Signed 16-bit integer, little-endian (s16le) |
| Channels | Mono (1 channel) |
| Recommended chunk | 1,600 samples = 100ms = 3,200 bytes |

The backend converts received PCM int16 to float32 internally via `pcm_to_float32()`.

---

## Message Schemas

### Server → Client Messages

#### ConnectedMessage

Sent immediately after the WebSocket connection is accepted. Contains server capabilities.

```json
{
  "type": "connected",
  "backend": "mlx-whisper",
  "device": "mps",
  "model": "large-v3-turbo"
}
```

| Field | Type | Description |
|---|---|---|
| `type` | `"connected"` | Message type identifier |
| `backend` | `string` | ASR backend name (`"mlx-whisper"`, `"faster-whisper"`) |
| `device` | `string` | Compute device (`"mps"`, `"cuda"`, `"cpu"`) |
| `model` | `string` | Loaded Whisper model name or path |

#### ReadyMessage

Sent after the server processes a `ConfigureMessage`. The session is now ready to receive audio.

```json
{
  "type": "ready"
}
```

| Field | Type | Description |
|---|---|---|
| `type` | `"ready"` | Message type identifier |

#### PartialResult

Intermediate transcription result. May change as more audio is processed. Sent during streaming as the AlignAtt policy emits text.

```json
{
  "type": "partial",
  "text": "Ahoj svete",
  "start_ms": 0,
  "end_ms": 1200
}
```

| Field | Type | Description |
|---|---|---|
| `type` | `"partial"` | Message type identifier |
| `text` | `string` | Transcribed text (may change in subsequent partials) |
| `start_ms` | `float` | Segment start time in milliseconds |
| `end_ms` | `float` | Segment end time in milliseconds |

#### FinalResult

Committed transcription result after the client sends a `StopMessage`. This text will not change.

```json
{
  "type": "final",
  "text": "Ahoj světe",
  "start_ms": 0,
  "end_ms": 1860
}
```

| Field | Type | Description |
|---|---|---|
| `type` | `"final"` | Message type identifier |
| `text` | `string` | Final transcribed text |
| `start_ms` | `float` | Segment start time in milliseconds |
| `end_ms` | `float` | Segment end time in milliseconds |

#### DoneMessage

Signals that all final results have been sent and the transcription segment is complete.

```json
{
  "type": "done"
}
```

| Field | Type | Description |
|---|---|---|
| `type` | `"done"` | Message type identifier |

---

### Client → Server Messages

#### ConfigureMessage

Configures the transcription session. Must be sent after receiving `ConnectedMessage` and before sending audio.

```json
{
  "type": "configure",
  "language": "cs"
}
```

| Field | Type | Description |
|---|---|---|
| `type` | `"configure"` | Message type identifier |
| `language` | `string` | Language code: `"cs"`, `"en"`, `"auto"`, or any Whisper-supported code |

#### StopMessage

Signals the end of the audio stream. The server will flush remaining audio, emit final results, and send a `DoneMessage`.

```json
{
  "type": "stop"
}
```

| Field | Type | Description |
|---|---|---|
| `type` | `"stop"` | Message type identifier |

The server also accepts the plain text string `"stop"` as an alternative.

#### Binary Audio Frame

Raw PCM audio data sent as a binary WebSocket frame. No JSON wrapping — the frame payload is the raw bytes.

| Property | Value |
|---|---|
| WebSocket opcode | Binary (0x2) |
| Payload | PCM s16le bytes |
| Recommended size | 3,200 bytes (1,600 samples at 16kHz = 100ms) |

---

## Example Session

### JavaScript Client

```javascript
const ws = new WebSocket('ws://localhost:8765/ws/transcribe');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case 'connected':
      console.log(`Backend: ${msg.backend}, Device: ${msg.device}`);
      // Configure the session
      ws.send(JSON.stringify({ type: 'configure', language: 'cs' }));
      break;

    case 'ready':
      console.log('Session ready — start sending audio');
      startStreaming();
      break;

    case 'partial':
      console.log(`[partial] ${msg.text} (${msg.start_ms}–${msg.end_ms}ms)`);
      break;

    case 'final':
      console.log(`[final] ${msg.text} (${msg.start_ms}–${msg.end_ms}ms)`);
      break;

    case 'done':
      console.log('Transcription complete');
      break;
  }
};

function startStreaming() {
  // Get audio from microphone, convert to PCM s16le, then:
  // ws.send(pcmBuffer);  // ArrayBuffer of Int16 LE samples
}

function stopStreaming() {
  ws.send(JSON.stringify({ type: 'stop' }));
}
```

### Python Client

```python
import asyncio
import json
import numpy as np
import websockets

async def transcribe():
    async with websockets.connect('ws://localhost:8765/ws/transcribe') as ws:
        # 1. Receive connected message
        msg = json.loads(await ws.recv())
        assert msg['type'] == 'connected'
        print(f"Backend: {msg['backend']}, Device: {msg['device']}")

        # 2. Configure session
        await ws.send(json.dumps({'type': 'configure', 'language': 'cs'}))
        msg = json.loads(await ws.recv())
        assert msg['type'] == 'ready'

        # 3. Send audio (example: 1 second of silence)
        silence = np.zeros(16000, dtype=np.int16)
        await ws.send(silence.tobytes())

        # 4. Stop and receive results
        await ws.send(json.dumps({'type': 'stop'}))

        while True:
            msg = json.loads(await ws.recv())
            if msg['type'] == 'final':
                print(f"Final: {msg['text']}")
            elif msg['type'] == 'done':
                break

asyncio.run(transcribe())
```

### cURL Health Check

```bash
curl -s http://localhost:8765/health | python -m json.tool
```

```json
{
    "status": "ok",
    "backend": "mlx-whisper",
    "device": "mps",
    "model": "large-v3-turbo",
    "version": "0.1.0"
}
```

---

## Error Handling

### WebSocket Errors

The server closes the WebSocket connection in case of errors:

| Scenario | Behavior |
|---|---|
| Engine not loaded | WebSocket closed with error message |
| Invalid JSON message | Ignored (binary frames are treated as audio) |
| Connection lost | Client should implement reconnection logic |

### HTTP Errors

| Status | Condition |
|---|---|
| 200 | Health check successful |
| 503 | Server starting up (engine not yet loaded) |

---

## CORS Configuration

The backend allows cross-origin requests from configured origins (default: `http://localhost:5173` and `http://localhost:4173`).

Configurable via:

```bash
STT_CORS_ORIGINS='["http://localhost:3000","https://myapp.com"]' uvicorn app.main:app
```
