# STT Local — Frontend

SvelteKit + TypeScript frontend for real-time speech-to-text transcription. Captures microphone audio, streams it to the backend over WebSocket, and displays live transcription results with waveform visualization.

## Setup

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 20+

### Installation

```bash
cd frontend
bun install
```

### Running

```bash
# Development server (port 5173)
bun run dev

# Or from project root
make dev-fe
```

### Building

```bash
bun run build    # Static site output
bun run preview  # Preview production build
```

## Technology Stack

| Technology | Version | Purpose |
|---|---|---|
| SvelteKit | 2.x | Meta-framework with static adapter |
| Svelte | 5.x | Component framework (Runes API) |
| TypeScript | 5.x | Type safety |
| Vite | 6.x | Build tool and dev server |
| Vitest | 3.x | Test framework |
| @testing-library/svelte | 5.x | Component testing utilities |
| jsdom | 25.x | Browser environment for tests |

## Architecture

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

1. **`getUserMedia`** requests microphone access (mono)
2. **`AudioContext`** is created at 16kHz for native browser resampling
3. **`MediaStreamSource`** feeds into two paths:
   - **AnalyserNode** provides frequency data for waveform visualization
   - **AudioWorkletNode** runs `pcm-processor.worklet.ts` to collect 1,600-sample buffers (~100ms)
4. The main thread converts **Float32 → Int16 LE** and sends binary frames over WebSocket

### Module Structure

```
src/lib/
├── audio/              # Audio capture and processing
│   ├── capture.ts      # AudioContext + AudioWorklet management
│   ├── chunker.ts      # RMS calculation, silence detection
│   ├── types.ts        # Audio-related types
│   └── pcm-processor.worklet.ts  # AudioWorklet: Float32 → 1600-sample buffers
│
├── whisper/            # Backend communication
│   ├── transcriber.ts  # WebSocket client + exponential backoff reconnection
│   ├── manager.ts      # Health check via fetch('/health')
│   └── types.ts        # Protocol types (ConnectionStatus, ServerMessage, etc.)
│
├── state/              # Reactive state management
│   ├── app.svelte.ts       # App-wide state (language, recording, connection)
│   └── transcript.svelte.ts # Transcript entries with partial/final streaming
│
├── components/         # UI components
│   ├── FileUpload.svelte         # Audio file upload for batch transcription
│   ├── LanguageSelector.svelte   # CS/EN language toggle
│   ├── ModelStatus.svelte        # Server status + connect/retry button
│   ├── SettingsPanel.svelte      # Server URL, chunk interval settings
│   ├── MicControl.svelte         # Record button with pulse animation
│   ├── Waveform.svelte           # Real-time frequency visualization (canvas)
│   └── TranscriptDisplay.svelte  # Transcript entries + copy/clear actions
│
├── theme/
│   └── catppuccin.ts   # Catppuccin Mocha color palette
│
└── utils/
    └── format.ts       # Time/duration formatting, text cleaning
```

### Component Hierarchy

```
+page.svelte (orchestrator)
├── LanguageSelector    — CS/EN toggle (disabled during recording)
├── SettingsPanel       — Server URL, chunk interval (conditional render)
├── ModelStatus         — Server connection status + connect/retry button
├── Waveform            — Real-time frequency visualization (canvas)
├── MicControl          — Start/stop recording button with pulse animation
├── FileUpload          — Audio file upload for batch transcription
└── TranscriptDisplay   — Transcript entries with timestamps, copy/clear
```

### Key Modules

#### AudioCapture (`lib/audio/capture.ts`)

Manages the full audio capture lifecycle:

```typescript
const capture = new AudioCapture();
capture.onPcmData((buffer: Float32Array) => {
  const int16 = float32ToInt16(buffer);
  transcriber.sendAudio(int16.buffer);
});

await capture.start();     // Request mic, create AudioContext
capture.getWaveformData(); // Uint8Array for visualization
capture.stop();            // Clean up all resources
```

#### PCM Processor Worklet (`lib/audio/pcm-processor.worklet.ts`)

Runs in the AudioWorklet thread to avoid main-thread jank:

- Accumulates incoming audio samples into a ring buffer
- Posts 1,600-sample Float32Array chunks (~100ms at 16kHz) to the main thread
- Zero-copy transfer using structured clone

#### Transcriber (`lib/whisper/transcriber.ts`)

WebSocket client with automatic reconnection:

```typescript
const transcriber = new Transcriber();

transcriber.onStatusChange((status: ConnectionStatus) => { ... });
transcriber.onResult((result: TranscriptionResult) => { ... });

await transcriber.connect('ws://localhost:8765/ws/transcribe', 'cs');
transcriber.sendAudio(pcmBuffer);  // ArrayBuffer of Int16 LE PCM
await transcriber.stop();           // Flush and wait for final results
transcriber.disconnect();           // Close, cancel reconnection
```

**Reconnection strategy:**
- Initial delay: 1 second
- Max delay: 30 seconds
- Doubles on each failed attempt
- Resets to 1s on successful connection
- Only reconnects if previously `ready` or `connected`
- `disconnect()` cancels all pending reconnection

#### WhisperManager (`lib/whisper/manager.ts`)

Health check utility:

```typescript
const isReady = await WhisperManager.checkHealth('http://localhost:8765', {
  onStatusChange: (status: ModelStatus) => { ... },
  onServerInfo: (info: ServerInfo) => { ... },
  onError: (error: Error) => { ... },
});
```

### State Management

Uses Svelte 5 Runes (`$state`, `$derived`) for reactive state:

#### AppState (`lib/state/app.svelte.ts`)

| Property | Type | Description |
|---|---|---|
| `language` | `'cs' \| 'en' \| 'auto'` | Selected language |
| `chunkInterval` | `number` | Audio chunk interval (3000–15000ms) |
| `isRecording` | `boolean` | Whether audio is being captured |
| `modelStatus` | `ModelStatus` | Server model status |
| `connectionStatus` | `ConnectionStatus` | WebSocket connection status |
| `serverUrl` | `string` | Backend URL |
| `serverBackend` | `string` | Detected backend name |
| `serverDevice` | `string` | Detected device |
| `serverModel` | `string` | Loaded model name |

#### TranscriptState (`lib/state/transcript.svelte.ts`)

| Method/Property | Description |
|---|---|
| `entries` | Array of transcript entries |
| `fullText` | All entries joined as a single string |
| `updateOrAddPartial(text, lang)` | Update current partial entry or create new one |
| `finalizePartial(text)` | Mark current partial as final |
| `clear()` | Remove all entries |

### Theme

Uses [Catppuccin Mocha](https://github.com/catppuccin/catppuccin) color palette defined in `lib/theme/catppuccin.ts`. Colors are exported as named constants for use across components.

### CSP Headers

Both `hooks.server.ts` and `vite.config.ts` configure Content Security Policy:

- `connect-src: 'self' https: http://localhost:8765 ws://localhost:8765 blob:`
- `worker-src: 'self' blob:` (required for AudioWorklet)

## Testing

```bash
# Run tests
bun run test

# Watch mode
bun run test:watch

# Coverage report
bun run test:coverage

# Or from project root
make test-fe
make coverage-fe
```

### Test Structure

Every source file has a co-located `.test.ts` file. Global test setup is in `tests/setup.ts`.

| Module | Test File | What's Tested |
|---|---|---|
| `audio/capture.ts` | `capture.test.ts` | AudioContext creation, worklet registration, PCM callback, cleanup |
| `audio/chunker.ts` | `chunker.test.ts` | RMS calculation, silence detection, split point finding |
| `whisper/transcriber.ts` | `transcriber.test.ts` | WebSocket connect/disconnect, message parsing, reconnection logic |
| `whisper/manager.ts` | `manager.test.ts` | Health check fetch, error handling, status callbacks |
| `state/app.svelte.ts` | `app.svelte.test.ts` | State initialization, property updates, derived values |
| `state/transcript.svelte.ts` | `transcript.svelte.test.ts` | Partial/final entry management, clearing, fullText |
| `components/*.svelte` | `*.test.ts` | Rendering, user interaction, prop handling, accessibility (7 components) |
| `utils/format.ts` | `format.test.ts` | Timestamp formatting, duration formatting, text cleaning |

### Mocks

The test setup (`tests/setup.ts`) provides browser API mocks:

- `AudioContext` / `AudioWorkletNode` / `AnalyserNode`
- `WebSocket`
- `fetch` / `navigator.mediaDevices`
- `MediaStream` / `MediaStreamTrack`
- `HTMLCanvasElement.getContext`

### Coverage

Coverage threshold is **90%** for all metrics (statements, branches, functions, lines), configured in `vitest.config.ts`.

Excluded from coverage:
- `**/types.ts` — Type-only files
- `**/theme/**` — Static color constants
- `**/pcm-processor.worklet.ts` — AudioWorklet context not available in jsdom

## Type Reference

### Protocol Types (`lib/whisper/types.ts`)

```typescript
type Language = 'cs' | 'en' | 'auto';
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'ready' | 'error';
type ModelStatus = 'idle' | 'checking' | 'ready' | 'error' | 'server_offline';

interface TranscriptionResult {
  text: string;
  startMs: number;
  endMs: number;
  isFinal: boolean;
  timestamp: number;
}

interface ServerInfo {
  backend: string;
  device: string;
  model: string;
}

interface HealthResponse {
  status: string;
  backend: string;
  device: string;
  model: string;
  version: string;
}
```

### Server Messages

```typescript
type ServerMessage =
  | { type: 'connected'; backend: string; device: string; model: string }
  | { type: 'ready' }
  | { type: 'partial'; text: string; start_ms: number; end_ms: number }
  | { type: 'final'; text: string; start_ms: number; end_ms: number }
  | { type: 'done' };
```

## Development Tips

### Adding a New Language

1. Add to the `Language` type in `lib/whisper/types.ts`
2. Add a button in `LanguageSelector.svelte`
3. The backend accepts any Whisper-supported language code via the `configure` message

### Adding a New Component

1. Create `lib/components/MyComponent.svelte`
2. Create `lib/components/MyComponent.test.ts` (tests are required for coverage)
3. Import and use in `+page.svelte`

### Debugging Audio

- Open browser DevTools → Application → Service Workers to check AudioWorklet registration
- Use `capture.getWaveformData()` to verify microphone input
- Check the Waveform component canvas for visual confirmation
- Monitor WebSocket frames in DevTools → Network → WS tab
