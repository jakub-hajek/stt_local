import { vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';

afterEach(() => {
	cleanup();
});

// Mock MediaRecorder
class MockMediaRecorder {
	state: string = 'inactive';
	ondataavailable: ((e: { data: Blob }) => void) | null = null;
	onstop: (() => void) | null = null;
	onerror: ((e: unknown) => void) | null = null;
	onstart: (() => void) | null = null;

	constructor(
		public stream: MediaStream,
		public options?: MediaRecorderOptions
	) {}

	start(timeslice?: number) {
		this.state = 'recording';
		this.onstart?.();
	}

	stop() {
		this.state = 'inactive';
		this.onstop?.();
	}

	static isTypeSupported(mimeType: string): boolean {
		return mimeType === 'audio/webm' || mimeType === 'audio/webm;codecs=opus';
	}
}

Object.defineProperty(globalThis, 'MediaRecorder', {
	value: MockMediaRecorder,
	writable: true
});

// Mock MediaStream
class MockMediaStream {
	active = true;
	private tracks: MediaStreamTrack[] = [];

	constructor() {
		this.tracks = [
			{
				kind: 'audio',
				enabled: true,
				stop: vi.fn(),
				addEventListener: vi.fn(),
				removeEventListener: vi.fn()
			} as unknown as MediaStreamTrack
		];
	}

	getTracks(): MediaStreamTrack[] {
		return this.tracks;
	}

	getAudioTracks(): MediaStreamTrack[] {
		return this.tracks;
	}
}

Object.defineProperty(globalThis, 'MediaStream', {
	value: MockMediaStream,
	writable: true
});

// Mock navigator.mediaDevices
Object.defineProperty(globalThis.navigator, 'mediaDevices', {
	value: {
		getUserMedia: vi.fn().mockResolvedValue(new MockMediaStream())
	},
	writable: true,
	configurable: true
});

// Mock AudioContext & AnalyserNode
class MockAnalyserNode {
	fftSize = 256;
	frequencyBinCount = 128;

	getByteFrequencyData(array: Uint8Array): void {
		array.fill(128);
	}

	getByteTimeDomainData(array: Uint8Array): void {
		array.fill(128);
	}

	connect() {
		return this;
	}

	disconnect() {}
}

class MockAudioContext {
	state: string = 'running';
	sampleRate = 44100;

	createAnalyser(): MockAnalyserNode {
		return new MockAnalyserNode();
	}

	createMediaStreamSource() {
		return {
			connect: vi.fn(),
			disconnect: vi.fn()
		};
	}

	close() {
		this.state = 'closed';
		return Promise.resolve();
	}

	resume() {
		this.state = 'running';
		return Promise.resolve();
	}
}

Object.defineProperty(globalThis, 'AudioContext', {
	value: MockAudioContext,
	writable: true
});

Object.defineProperty(globalThis, 'AnalyserNode', {
	value: MockAnalyserNode,
	writable: true
});

// Mock navigator.clipboard
Object.defineProperty(globalThis.navigator, 'clipboard', {
	value: {
		writeText: vi.fn().mockResolvedValue(undefined)
	},
	writable: true,
	configurable: true
});

// Mock @remotion/whisper-web
vi.mock('@remotion/whisper-web', () => ({
	canUseWhisperWeb: vi.fn().mockResolvedValue({ supported: true }),
	downloadWhisperModel: vi.fn().mockResolvedValue({ alreadyDownloaded: false }),
	resampleTo16Khz: vi.fn().mockResolvedValue(new Float32Array(16000)),
	transcribe: vi.fn().mockResolvedValue({
		transcription: [{ text: 'Hello world', timestamps: { from: '00:00:00', to: '00:00:02' } }]
	}),
	toCaptions: vi.fn().mockReturnValue({
		captions: [
			{
				text: 'Hello world',
				startMs: 0,
				endMs: 2000,
				timestampMs: 1000,
				confidence: 0.95
			}
		]
	})
}));

// Mock HTMLCanvasElement.getContext
const mockCanvasContext = {
	clearRect: vi.fn(),
	beginPath: vi.fn(),
	moveTo: vi.fn(),
	lineTo: vi.fn(),
	stroke: vi.fn(),
	fillRect: vi.fn(),
	createLinearGradient: vi.fn(() => ({
		addColorStop: vi.fn()
	})),
	strokeStyle: '',
	fillStyle: '',
	lineWidth: 1
};

HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCanvasContext) as any;
HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
	width: 300,
	height: 60,
	top: 0,
	left: 0,
	right: 300,
	bottom: 60,
	x: 0,
	y: 0,
	toJSON: () => {}
});

// Mock requestAnimationFrame
Object.defineProperty(globalThis, 'requestAnimationFrame', {
	value: (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16),
	writable: true
});

Object.defineProperty(globalThis, 'cancelAnimationFrame', {
	value: (id: number) => clearTimeout(id),
	writable: true
});
