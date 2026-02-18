import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import MicControl from './MicControl.svelte';
import { appState } from '../state/app.svelte';

describe('MicControl', () => {
	const onstart = vi.fn();
	const onstop = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		if (appState.isRecording) appState.toggleRecording();
		appState.setModelStatus('ready');
	});

	afterEach(() => {
		cleanup();
	});

	it('renders button with start recording label', () => {
		render(MicControl, { props: { onstart, onstop } });

		expect(screen.getByRole('button', { name: 'Start recording' })).toBeInTheDocument();
	});

	it('shows stop recording label when recording', () => {
		appState.toggleRecording();
		render(MicControl, { props: { onstart, onstop } });

		expect(screen.getByRole('button', { name: 'Stop recording' })).toBeInTheDocument();
	});

	it('calls onstart when clicked while not recording', async () => {
		render(MicControl, { props: { onstart, onstop } });

		await fireEvent.click(screen.getByRole('button'));
		expect(onstart).toHaveBeenCalledOnce();
		expect(onstop).not.toHaveBeenCalled();
	});

	it('calls onstop when clicked while recording', async () => {
		appState.toggleRecording();
		render(MicControl, { props: { onstart, onstop } });

		await fireEvent.click(screen.getByRole('button'));
		expect(onstop).toHaveBeenCalledOnce();
		expect(onstart).not.toHaveBeenCalled();
	});

	it('is disabled when model is not ready', () => {
		appState.setModelStatus('idle');
		render(MicControl, { props: { onstart, onstop } });

		expect(screen.getByRole('button')).toBeDisabled();
	});

	it('is disabled when server is offline', () => {
		appState.setModelStatus('server_offline');
		render(MicControl, { props: { onstart, onstop } });

		expect(screen.getByRole('button')).toBeDisabled();
	});

	it('is enabled when model is ready', () => {
		render(MicControl, { props: { onstart, onstop } });

		expect(screen.getByRole('button')).not.toBeDisabled();
	});
});
