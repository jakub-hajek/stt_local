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
		appState.setModel('tiny');
		appState.setThreads(4);
		appState.setChunkInterval(5000);
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

	it('shows model select with all options', () => {
		appState.toggleSettings();
		render(SettingsPanel);

		const select = screen.getByLabelText('Model');
		expect(select).toBeInTheDocument();
		expect(select.tagName).toBe('SELECT');

		const options = select.querySelectorAll('option');
		expect(options).toHaveLength(6);
	});

	it('shows threads slider', () => {
		appState.toggleSettings();
		render(SettingsPanel);

		const slider = screen.getByLabelText(/Threads/);
		expect(slider).toBeInTheDocument();
		expect(slider.getAttribute('type')).toBe('range');
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

	it('changes model when select changes', async () => {
		appState.toggleSettings();
		render(SettingsPanel);

		const select = screen.getByLabelText('Model') as HTMLSelectElement;
		await fireEvent.change(select, { target: { value: 'small' } });

		expect(appState.model).toBe('small');
	});

	it('changes threads when slider changes', async () => {
		appState.toggleSettings();
		render(SettingsPanel);

		const slider = screen.getByLabelText(/Threads/) as HTMLInputElement;
		await fireEvent.input(slider, { target: { value: '8' } });

		expect(appState.threads).toBe(8);
	});

	it('changes chunk interval when slider changes', async () => {
		appState.toggleSettings();
		render(SettingsPanel);

		const slider = screen.getByLabelText(/Chunk interval/) as HTMLInputElement;
		await fireEvent.input(slider, { target: { value: '10000' } });

		expect(appState.chunkInterval).toBe(10000);
	});

	it('disables model select when recording', () => {
		appState.toggleSettings();
		appState.toggleRecording();
		render(SettingsPanel);

		const select = screen.getByLabelText('Model');
		expect(select).toBeDisabled();
	});
});
