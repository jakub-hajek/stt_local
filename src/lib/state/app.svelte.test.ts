import { describe, it, expect, beforeEach } from 'vitest';
import { appState } from './app.svelte';

describe('AppState', () => {
	beforeEach(() => {
		// Reset to defaults
		appState.setLanguage('cs');
		appState.setModel('tiny');
		appState.setChunkInterval(5000);
		appState.setThreads(4);
		appState.isRecording = false;
		appState.modelStatus = 'idle';
		appState.modelProgress = 0;
		appState.modelError = null;
		appState.isSupported = null;
		appState.settingsOpen = false;
	});

	it('has correct default values', () => {
		expect(appState.language).toBe('cs');
		expect(appState.model).toBe('tiny');
		expect(appState.chunkInterval).toBe(5000);
		expect(appState.threads).toBe(4);
		expect(appState.isRecording).toBe(false);
		expect(appState.modelStatus).toBe('idle');
		expect(appState.modelProgress).toBe(0);
		expect(appState.modelError).toBeNull();
		expect(appState.isSupported).toBeNull();
		expect(appState.settingsOpen).toBe(false);
	});

	it('setLanguage updates language', () => {
		appState.setLanguage('en');
		expect(appState.language).toBe('en');
		appState.setLanguage('auto');
		expect(appState.language).toBe('auto');
	});

	it('setModel updates model', () => {
		appState.setModel('tiny');
		expect(appState.model).toBe('tiny');
		appState.setModel('small.en');
		expect(appState.model).toBe('small.en');
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

	it('setThreads clamps to [1, 16]', () => {
		appState.setThreads(8);
		expect(appState.threads).toBe(8);

		appState.setThreads(0);
		expect(appState.threads).toBe(1);

		appState.setThreads(-5);
		expect(appState.threads).toBe(1);

		appState.setThreads(20);
		expect(appState.threads).toBe(16);

		appState.setThreads(1);
		expect(appState.threads).toBe(1);

		appState.setThreads(16);
		expect(appState.threads).toBe(16);
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
		appState.setModelStatus('downloading');
		expect(appState.modelStatus).toBe('downloading');
		appState.setModelStatus('ready');
		expect(appState.modelStatus).toBe('ready');
	});

	it('setModelProgress updates progress', () => {
		appState.setModelProgress(0.5);
		expect(appState.modelProgress).toBe(0.5);
	});

	it('setModelError updates error', () => {
		appState.setModelError('Something went wrong');
		expect(appState.modelError).toBe('Something went wrong');
		appState.setModelError(null);
		expect(appState.modelError).toBeNull();
	});

	it('setSupported updates isSupported', () => {
		appState.setSupported(true);
		expect(appState.isSupported).toBe(true);
		appState.setSupported(false);
		expect(appState.isSupported).toBe(false);
	});
});
