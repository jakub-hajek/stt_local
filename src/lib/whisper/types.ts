export type WhisperModel = 'tiny' | 'tiny.en' | 'base' | 'base.en' | 'small' | 'small.en';
export type Language = 'cs' | 'en' | 'auto';

export interface TranscriptionJob {
	blob: Blob;
	language: Language;
	model: WhisperModel;
}

export interface TranscriptionResult {
	text: string;
	captions: Caption[];
	timestamp: number;
}

export interface Caption {
	text: string;
	startMs: number;
	endMs: number;
	timestampMs: number;
	confidence: number;
}

export type ModelStatus = 'idle' | 'checking' | 'downloading' | 'ready' | 'error' | 'unsupported';

export interface ModelState {
	status: ModelStatus;
	progress: number; // 0-1
	error: string | null;
	model: WhisperModel;
}
