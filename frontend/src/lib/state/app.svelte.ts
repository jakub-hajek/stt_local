import type { Language, ModelStatus, ConnectionStatus } from '$lib/whisper/types';

class AppState {
	language: Language = $state('cs');
	chunkInterval: number = $state(5000);
	isRecording: boolean = $state(false);
	isProcessingFile: boolean = $state(false);
	modelStatus: ModelStatus = $state('idle');
	modelError: string | null = $state(null);
	settingsOpen: boolean = $state(false);
	private errorTimer: ReturnType<typeof setTimeout> | null = null;

	// Server connection state
	connectionStatus: ConnectionStatus = $state('disconnected');
	serverBackend: string = $state('');
	serverDevice: string = $state('');
	serverModel: string = $state('');
	serverUrl: string = $state('ws://localhost:8765');

	setLanguage(lang: Language) {
		this.language = lang;
	}

	setChunkInterval(ms: number) {
		this.chunkInterval = Math.max(3000, Math.min(15000, ms));
	}

	toggleRecording() {
		this.isRecording = !this.isRecording;
	}

	toggleSettings() {
		this.settingsOpen = !this.settingsOpen;
	}

	setProcessingFile(value: boolean) {
		this.isProcessingFile = value;
	}

	setModelStatus(status: ModelStatus) {
		this.modelStatus = status;
		if (status === 'error' || status === 'server_offline') {
			this.scheduleErrorClear();
		} else {
			this.clearErrorTimer();
		}
	}

	setModelError(error: string | null) {
		this.modelError = error;
	}

	private scheduleErrorClear() {
		this.clearErrorTimer();
		this.errorTimer = setTimeout(() => {
			this.modelStatus = 'idle';
			this.modelError = null;
			this.errorTimer = null;
		}, 3000);
	}

	private clearErrorTimer() {
		if (this.errorTimer) {
			clearTimeout(this.errorTimer);
			this.errorTimer = null;
		}
	}

	setConnectionStatus(status: ConnectionStatus) {
		this.connectionStatus = status;
	}

	setServerInfo(backend: string, device: string, model: string) {
		this.serverBackend = backend;
		this.serverDevice = device;
		this.serverModel = model;
	}

	setServerUrl(url: string) {
		this.serverUrl = url;
	}

	get httpServerUrl(): string {
		return this.serverUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
	}
}

export const appState = new AppState();
