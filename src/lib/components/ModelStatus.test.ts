import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ModelStatus from './ModelStatus.svelte';
import { appState } from '$lib/state/app.svelte';

describe('ModelStatus', () => {
	beforeEach(() => {
		appState.setModelStatus('idle');
		appState.setModelProgress(0);
		appState.setModelError(null);
	});

	it('renders download button when idle', () => {
		render(ModelStatus);

		const btn = screen.getByRole('button', { name: /download model/i });
		expect(btn).toBeInTheDocument();
		expect(btn.textContent).toContain('tiny');
	});

	it('shows checking status', async () => {
		appState.setModelStatus('checking');
		render(ModelStatus);

		expect(screen.getByText('Checking compatibility...')).toBeInTheDocument();
	});

	it('shows progress bar when downloading', () => {
		appState.setModelStatus('downloading');
		appState.setModelProgress(0.45);
		render(ModelStatus);

		expect(screen.getByText('45%')).toBeInTheDocument();
	});

	it('shows ready badge', () => {
		appState.setModelStatus('ready');
		render(ModelStatus);

		expect(screen.getByText('Model ready')).toBeInTheDocument();
	});

	it('shows error message with retry button', () => {
		appState.setModelStatus('error');
		appState.setModelError('Download failed');
		render(ModelStatus);

		expect(screen.getByText('Download failed')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
	});

	it('shows unknown error when modelError is null', () => {
		appState.setModelStatus('error');
		appState.setModelError(null);
		render(ModelStatus);

		expect(screen.getByText('Unknown error')).toBeInTheDocument();
	});

	it('shows unsupported message', () => {
		appState.setModelStatus('unsupported');
		render(ModelStatus);

		expect(screen.getByText('Browser not supported')).toBeInTheDocument();
	});

	it('calls downloadModel when download button is clicked', async () => {
		render(ModelStatus);

		const btn = screen.getByRole('button', { name: /download model/i });
		await fireEvent.click(btn);

		// After the mock resolves, status should have changed from idle
		// The mock in setup.ts makes canUseWhisperWeb return supported: true
		// and downloadWhisperModel resolves, so the callbacks will fire
	});
});
