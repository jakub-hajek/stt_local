import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import SettingsPanel from './SettingsPanel.svelte';
import { appState } from '../state/app.svelte';

describe('SettingsPanel', () => {
	afterEach(() => {
		cleanup();
	});

	beforeEach(() => {
		if (appState.settingsOpen) appState.toggleSettings();
		if (appState.isRecording) appState.toggleRecording();
		appState.setChunkInterval(5000);
		appState.setServerUrl('ws://localhost:8765');
	});

	it('does not render when settingsOpen is false', () => {
		render(SettingsPanel);

		expect(screen.queryByText('Settings')).not.toBeInTheDocument();
	});

	it('renders when settingsOpen is true', () => {
		appState.toggleSettings();
		render(SettingsPanel);

		expect(screen.getByText('Settings')).toBeInTheDocument();
	});

	it('shows server URL input', () => {
		appState.toggleSettings();
		render(SettingsPanel);

		const input = screen.getByLabelText('Server URL');
		expect(input).toBeInTheDocument();
		expect(input.tagName).toBe('INPUT');
	});

	it('shows chunk interval slider', () => {
		appState.toggleSettings();
		render(SettingsPanel);

		const slider = screen.getByLabelText(/Chunk interval/);
		expect(slider).toBeInTheDocument();
		expect(slider.getAttribute('type')).toBe('range');
	});

	it('has close button that toggles settings', async () => {
		appState.toggleSettings();
		render(SettingsPanel);

		const closeBtn = screen.getByLabelText('Close settings');
		expect(closeBtn).toBeInTheDocument();

		await fireEvent.click(closeBtn);
		expect(appState.settingsOpen).toBe(false);
	});

	it('changes server URL when input changes', async () => {
		appState.toggleSettings();
		render(SettingsPanel);

		const input = screen.getByLabelText('Server URL') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: 'ws://example.com:9000' } });

		expect(appState.serverUrl).toBe('ws://example.com:9000');
	});

	it('changes chunk interval when slider changes', async () => {
		appState.toggleSettings();
		render(SettingsPanel);

		const slider = screen.getByLabelText(/Chunk interval/) as HTMLInputElement;
		await fireEvent.input(slider, { target: { value: '10000' } });

		expect(appState.chunkInterval).toBe(10000);
	});

	it('disables server URL input when recording', () => {
		appState.toggleSettings();
		appState.toggleRecording();
		render(SettingsPanel);

		const input = screen.getByLabelText('Server URL');
		expect(input).toBeDisabled();
	});
});
