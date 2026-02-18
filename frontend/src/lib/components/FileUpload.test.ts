import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import FileUpload from './FileUpload.svelte';
import { appState } from '../state/app.svelte';

describe('FileUpload', () => {
	const onfile = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		appState.setModelStatus('ready');
		if (appState.isRecording) appState.toggleRecording();
		appState.setProcessingFile(false);
	});

	afterEach(() => {
		cleanup();
	});

	it('renders upload button', () => {
		render(FileUpload, { props: { onfile } });

		expect(screen.getByRole('button', { name: 'Upload audio file' })).toBeInTheDocument();
	});

	it('is disabled when model is not ready', () => {
		appState.setModelStatus('idle');
		render(FileUpload, { props: { onfile } });

		expect(screen.getByRole('button')).toBeDisabled();
	});

	it('is disabled when recording', () => {
		appState.toggleRecording();
		render(FileUpload, { props: { onfile } });

		expect(screen.getByRole('button')).toBeDisabled();
	});

	it('is disabled when processing file', () => {
		appState.setProcessingFile(true);
		render(FileUpload, { props: { onfile } });

		expect(screen.getByRole('button')).toBeDisabled();
	});

	it('is enabled when model is ready and not recording or processing', () => {
		render(FileUpload, { props: { onfile } });

		expect(screen.getByRole('button')).not.toBeDisabled();
	});

	it('shows processing label when processing file', () => {
		appState.setProcessingFile(true);
		render(FileUpload, { props: { onfile } });

		expect(screen.getByRole('button', { name: 'Processing file' })).toBeInTheDocument();
	});
});
