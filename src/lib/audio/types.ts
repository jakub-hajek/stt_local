export interface AudioChunk {
	blob: Blob;
	timestamp: number;
	duration: number;
}

export interface CaptureOptions {
	timeslice?: number; // chunk interval in ms, default 5000
	mimeType?: string;
}

export interface CaptureState {
	isRecording: boolean;
	stream: MediaStream | null;
	error: string | null;
}

export type WaveformData = Uint8Array;
