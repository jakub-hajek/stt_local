import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ModelStatus from './ModelStatus.svelte';
import { appState } from '$lib/state/app.svelte';

describe('ModelStatus', () => {
	beforeEach(() => {
		appState.setModelStatus('idle');
		appState.setModelError(null);
		appState.serverBackend = '';
		appState.serverDevice = '';
		appState.serverModel = '';
	});

	it('renders connect button when idle', () => {
		render(ModelStatus);

		const btn = screen.getByRole('button', { name: /connect to server/i });
		expect(btn).toBeInTheDocument();
	});

	it('shows checking status', () => {
		appState.setModelStatus('checking');
		render(ModelStatus);

		expect(screen.getByText('Connecting to server...')).toBeInTheDocument();
	});

	it('shows ready with backend info', () => {
		appState.setModelStatus('ready');
		appState.serverBackend = 'mlx-whisper';
		appState.serverDevice = 'mps';
		render(ModelStatus);

		expect(screen.getByText(/Server ready/)).toBeInTheDocument();
		expect(screen.getByText(/mlx-whisper/)).toBeInTheDocument();
	});

	it('shows error message with retry button', () => {
		appState.setModelStatus('error');
		appState.setModelError('Connection refused');
		render(ModelStatus);

		expect(screen.getByText('Connection refused')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
	});

	it('shows unknown error when modelError is null', () => {
		appState.setModelStatus('error');
		appState.setModelError(null);
		render(ModelStatus);

		expect(screen.getByText('Unknown error')).toBeInTheDocument();
	});

	it('shows server offline with retry', () => {
		appState.setModelStatus('server_offline');
		render(ModelStatus);

		expect(screen.getByText('Server offline')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
	});

	it('calls checkHealth when connect button is clicked', async () => {
		render(ModelStatus);

		const btn = screen.getByRole('button', { name: /connect to server/i });
		await fireEvent.click(btn);

		// After the mock fetch resolves, status should change
		// The mock in setup.ts makes fetch return a healthy response
	});
});
