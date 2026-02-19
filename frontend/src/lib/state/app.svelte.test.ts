import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { appState } from './app.svelte';

describe('AppState', () => {
	beforeEach(() => {
		appState.setLanguage('cs');
		appState.setChunkInterval(5000);
		appState.isRecording = false;
		appState.modelStatus = 'idle';
		appState.modelError = null;
		appState.settingsOpen = false;
		appState.connectionStatus = 'disconnected';
		appState.serverBackend = '';
		appState.serverDevice = '';
		appState.serverModel = '';
		appState.serverUrl = 'ws://localhost:8765';
	});

	it('has correct default values', () => {
		expect(appState.language).toBe('cs');
		expect(appState.chunkInterval).toBe(5000);
		expect(appState.isRecording).toBe(false);
		expect(appState.modelStatus).toBe('idle');
		expect(appState.modelError).toBeNull();
		expect(appState.settingsOpen).toBe(false);
		expect(appState.connectionStatus).toBe('disconnected');
		expect(appState.serverUrl).toBe('ws://localhost:8765');
	});

	it('setLanguage updates language', () => {
		appState.setLanguage('en');
		expect(appState.language).toBe('en');
		appState.setLanguage('auto');
		expect(appState.language).toBe('auto');
	});

	it('setChunkInterval clamps to [3000, 15000]', () => {
		appState.setChunkInterval(10000);
		expect(appState.chunkInterval).toBe(10000);

		appState.setChunkInterval(1000);
		expect(appState.chunkInterval).toBe(3000);

		appState.setChunkInterval(20000);
		expect(appState.chunkInterval).toBe(15000);

		appState.setChunkInterval(3000);
		expect(appState.chunkInterval).toBe(3000);

		appState.setChunkInterval(15000);
		expect(appState.chunkInterval).toBe(15000);
	});

	it('toggleRecording flips isRecording', () => {
		expect(appState.isRecording).toBe(false);
		appState.toggleRecording();
		expect(appState.isRecording).toBe(true);
		appState.toggleRecording();
		expect(appState.isRecording).toBe(false);
	});

	it('toggleSettings flips settingsOpen', () => {
		expect(appState.settingsOpen).toBe(false);
		appState.toggleSettings();
		expect(appState.settingsOpen).toBe(true);
		appState.toggleSettings();
		expect(appState.settingsOpen).toBe(false);
	});

	it('setModelStatus updates status', () => {
		appState.setModelStatus('checking');
		expect(appState.modelStatus).toBe('checking');
		appState.setModelStatus('ready');
		expect(appState.modelStatus).toBe('ready');
	});

	it('setModelError updates error', () => {
		appState.setModelError('Something went wrong');
		expect(appState.modelError).toBe('Something went wrong');
		appState.setModelError(null);
		expect(appState.modelError).toBeNull();
	});

	describe('error auto-clear', () => {
		beforeEach(() => vi.useFakeTimers());
		afterEach(() => vi.useRealTimers());

		it('clears error status after 3 seconds', () => {
			appState.setModelError('Connection failed');
			appState.setModelStatus('error');
			expect(appState.modelStatus).toBe('error');

			vi.advanceTimersByTime(3000);
			expect(appState.modelStatus).toBe('idle');
			expect(appState.modelError).toBeNull();
		});

		it('clears server_offline status after 3 seconds', () => {
			appState.setModelStatus('server_offline');
			expect(appState.modelStatus).toBe('server_offline');

			vi.advanceTimersByTime(3000);
			expect(appState.modelStatus).toBe('idle');
		});

		it('cancels auto-clear when status changes to non-error', () => {
			appState.setModelStatus('error');
			appState.setModelStatus('ready');

			vi.advanceTimersByTime(3000);
			expect(appState.modelStatus).toBe('ready');
		});
	});

	it('setConnectionStatus updates connectionStatus', () => {
		appState.setConnectionStatus('connecting');
		expect(appState.connectionStatus).toBe('connecting');
		appState.setConnectionStatus('ready');
		expect(appState.connectionStatus).toBe('ready');
	});

	it('setServerInfo updates server info', () => {
		appState.setServerInfo('mlx-whisper', 'mps', 'large-v3-turbo');
		expect(appState.serverBackend).toBe('mlx-whisper');
		expect(appState.serverDevice).toBe('mps');
		expect(appState.serverModel).toBe('large-v3-turbo');
	});

	it('setServerUrl updates serverUrl', () => {
		appState.setServerUrl('ws://example.com:9000');
		expect(appState.serverUrl).toBe('ws://example.com:9000');
	});

	it('httpServerUrl converts ws to http', () => {
		appState.setServerUrl('ws://localhost:8765');
		expect(appState.httpServerUrl).toBe('http://localhost:8765');
	});
});
