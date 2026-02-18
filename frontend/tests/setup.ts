import { vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';

afterEach(() => {
	cleanup();
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

// Mock AudioWorkletNode
class MockAudioWorkletNode {
	port = {
		onmessage: null as ((event: MessageEvent) => void) | null,
		postMessage: vi.fn()
	};

	connect() {
		return this;
	}

	disconnect() {}
}

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
	sampleRate = 16000;

	createAnalyser(): MockAnalyserNode {
		return new MockAnalyserNode();
	}

	createMediaStreamSource() {
		return {
			connect: vi.fn(),
			disconnect: vi.fn()
		};
	}

	audioWorklet = {
		addModule: vi.fn().mockResolvedValue(undefined)
	};

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

Object.defineProperty(globalThis, 'AudioWorkletNode', {
	value: MockAudioWorkletNode,
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

// Mock WebSocket
class MockWebSocket {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSING = 2;
	static CLOSED = 3;

	readyState = MockWebSocket.OPEN;
	binaryType = 'blob';
	onopen: ((event: Event) => void) | null = null;
	onclose: ((event: CloseEvent) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;

	url: string;

	constructor(url: string) {
		this.url = url;
		// Auto-fire onopen in next tick
		setTimeout(() => this.onopen?.(new Event('open')), 0);
	}

	send = vi.fn();
	close = vi.fn(() => {
		this.readyState = MockWebSocket.CLOSED;
	});
}

Object.defineProperty(globalThis, 'WebSocket', {
	value: MockWebSocket,
	writable: true
});

// Mock fetch for health checks
globalThis.fetch = vi.fn().mockResolvedValue({
	ok: true,
	json: () =>
		Promise.resolve({
			status: 'ok',
			backend: 'faster-whisper',
			device: 'cpu',
			model: 'large-v3-turbo',
			version: '0.1.0'
		})
}) as any;
