import type { WaveformData } from './types';

type PcmCallback = (buffer: ArrayBuffer) => void;

export class AudioCapture {
	private stream: MediaStream | null = null;
	private audioContext: AudioContext | null = null;
	private analyser: AnalyserNode | null = null;
	private workletNode: AudioWorkletNode | null = null;
	private pcmCallbacks: PcmCallback[] = [];
	private active = false;

	get isRecording(): boolean {
		return this.active;
	}

	async start(): Promise<void> {
		this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

		// 16 kHz context — the browser resamples for us
		this.audioContext = new AudioContext({ sampleRate: 16000 });
		const source = this.audioContext.createMediaStreamSource(this.stream);

		// Analyser for waveform visualization (unchanged)
		this.analyser = this.audioContext.createAnalyser();
		this.analyser.fftSize = 256;
		source.connect(this.analyser);

		// AudioWorklet for PCM capture
		await this.audioContext.audioWorklet.addModule(
			new URL('./pcm-processor.worklet.ts', import.meta.url)
		);
		this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');

		this.workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
			const float32 = event.data;
			const int16 = float32ToInt16(float32);
			const buffer = int16.buffer as ArrayBuffer;
			this.pcmCallbacks.forEach((cb) => cb(buffer));
		};

		source.connect(this.workletNode);
		this.active = true;
	}

	stop(): void {
		this.active = false;
		this.workletNode?.disconnect();
		this.workletNode = null;
		this.stream?.getTracks().forEach((track) => track.stop());
		this.audioContext?.close();
		this.stream = null;
		this.audioContext = null;
		this.analyser = null;
	}

	onPcmData(cb: PcmCallback): () => void {
		this.pcmCallbacks.push(cb);
		return () => {
			this.pcmCallbacks = this.pcmCallbacks.filter((c) => c !== cb);
		};
	}

	getWaveformData(): WaveformData {
		if (!this.analyser) return new Uint8Array(0);
		const data = new Uint8Array(this.analyser.frequencyBinCount);
		this.analyser.getByteFrequencyData(data);
		return data;
	}
}

/** Convert Float32 [-1, 1] samples to Int16 LE for the backend */
function float32ToInt16(float32: Float32Array): Int16Array {
	const int16 = new Int16Array(float32.length);
	for (let i = 0; i < float32.length; i++) {
		const s = Math.max(-1, Math.min(1, float32[i]));
		int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
	}
	return int16;
}

export const audioCapture = new AudioCapture();
