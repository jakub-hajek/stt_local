import type { Language, ModelStatus, ConnectionStatus } from '$lib/whisper/types';

class AppState {
	language: Language = $state('cs');
	chunkInterval: number = $state(5000);
	isRecording: boolean = $state(false);
	modelStatus: ModelStatus = $state('idle');
	modelError: string | null = $state(null);
	settingsOpen: boolean = $state(false);

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

	setModelStatus(status: ModelStatus) {
		this.modelStatus = status;
	}

	setModelError(error: string | null) {
		this.modelError = error;
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
