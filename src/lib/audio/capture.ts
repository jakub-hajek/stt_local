import type { AudioChunk, CaptureOptions, WaveformData } from './types';

type ChunkCallback = (chunk: AudioChunk) => void;

export class AudioCapture {
	private stream: MediaStream | null = null;
	private recorder: MediaRecorder | null = null;
	private audioContext: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private chunkCallbacks: ChunkCallback[] = [];
	private recordingStartTime = 0;
	private cycleTimer: ReturnType<typeof setInterval> | null = null;
	private pendingChunks: Blob[] = [];
	private mimeType = 'audio/webm;codecs=opus';
	private timeslice = 5000;
	private active = false;

	get isRecording(): boolean {
		return this.active;
	}

	async start(options: CaptureOptions = {}): Promise<void> {
		const { timeslice = 5000, mimeType = 'audio/webm;codecs=opus' } = options;
		this.timeslice = timeslice;
		this.mimeType = mimeType;

		this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

		this.audioContext = new AudioContext();
		this.analyser = this.audioContext.createAnalyser();
		this.analyser.fftSize = 256;
		const source = this.audioContext.createMediaStreamSource(this.stream);
		source.connect(this.analyser);

		this.active = true;
		this.recordingStartTime = Date.now();
		this.startRecorder();

		// Stop and restart the recorder at each interval so every chunk
		// is a complete, self-contained audio file with proper headers.
		this.cycleTimer = setInterval(() => {
			if (!this.active || !this.stream) return;
			this.recorder?.stop(); // triggers ondataavailable + onstop
		}, this.timeslice);
	}

	stop(): void {
		this.active = false;
		if (this.cycleTimer) {
			clearInterval(this.cycleTimer);
			this.cycleTimer = null;
		}
		this.recorder?.stop();
		this.stream?.getTracks().forEach((track) => track.stop());
		this.audioContext?.close();
		this.recorder = null;
		this.stream = null;
		this.audioContext = null;
		this.analyser = null;
		this.pendingChunks = [];
	}

	private startRecorder(): void {
		if (!this.stream || !this.active) return;

		this.pendingChunks = [];
		this.recorder = new MediaRecorder(this.stream, { mimeType: this.mimeType });

		this.recorder.ondataavailable = (event: BlobEvent) => {
			if (event.data.size > 0) {
				this.pendingChunks.push(event.data);
			}
		};

		this.recorder.onstop = () => {
			if (this.pendingChunks.length > 0) {
				const blob = new Blob(this.pendingChunks, { type: this.mimeType });
				const chunk: AudioChunk = {
					blob,
					timestamp: Date.now(),
					duration: this.timeslice
				};
				this.chunkCallbacks.forEach((cb) => cb(chunk));
			}
			this.pendingChunks = [];
			// Restart for the next cycle if still active
			if (this.active) {
				this.startRecorder();
			}
		};

		this.recorder.start();
	}

	onChunk(cb: ChunkCallback): () => void {
		this.chunkCallbacks.push(cb);
		return () => {
			this.chunkCallbacks = this.chunkCallbacks.filter((c) => c !== cb);
		};
	}

	getWaveformData(): WaveformData {
		if (!this.analyser) return new Uint8Array(0);
		const data = new Uint8Array(this.analyser.frequencyBinCount);
		this.analyser.getByteFrequencyData(data);
		return data;
	}
}

export const audioCapture = new AudioCapture();
