import type { Language, WhisperModel, ModelStatus } from '$lib/whisper/types';

class AppState {
	language: Language = $state('cs');
	model: WhisperModel = $state('tiny');
	chunkInterval: number = $state(5000);
	threads: number = $state(4);
	isRecording: boolean = $state(false);
	modelStatus: ModelStatus = $state('idle');
	modelProgress: number = $state(0);
	modelError: string | null = $state(null);
	isSupported: boolean | null = $state(null);
	settingsOpen: boolean = $state(false);

	setLanguage(lang: Language) {
		this.language = lang;
	}

	setModel(model: WhisperModel) {
		this.model = model;
	}

	setChunkInterval(ms: number) {
		this.chunkInterval = Math.max(3000, Math.min(15000, ms));
	}

	setThreads(n: number) {
		this.threads = Math.max(1, Math.min(16, n));
	}

	toggleRecording() {
		this.isRecording = !this.isRecording;
	}

	toggleSettings() {
		this.settingsOpen = !this.settingsOpen;
	}

	setModelStatus(status: ModelStatus) {
		this.modelStatus = status;
	}

	setModelProgress(p: number) {
		this.modelProgress = p;
	}

	setModelError(error: string | null) {
		this.modelError = error;
	}

	setSupported(supported: boolean) {
		this.isSupported = supported;
	}
}

export const appState = new AppState();
