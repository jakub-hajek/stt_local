import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import TranscriptDisplay from './TranscriptDisplay.svelte';
import { transcriptState } from '$lib/state/transcript.svelte';

describe('TranscriptDisplay', () => {
	beforeEach(() => {
		transcriptState.clear();
		vi.mocked(navigator.clipboard.writeText).mockClear();
	});

	it('renders empty state when no entries', () => {
		render(TranscriptDisplay);

		expect(screen.getByText('Transcript will appear here...')).toBeInTheDocument();
	});

	it('renders transcript heading', () => {
		render(TranscriptDisplay);

		expect(screen.getByRole('heading', { name: 'Transcript' })).toBeInTheDocument();
	});

	it('disables copy and clear buttons when empty', () => {
		render(TranscriptDisplay);

		expect(screen.getByLabelText('Copy transcript')).toBeDisabled();
		expect(screen.getByLabelText('Clear transcript')).toBeDisabled();
	});

	it('renders entries with timestamps', () => {
		transcriptState.addEntry({
			text: 'Hello world',
			timestamp: 65000,
			language: 'en',
			isFinal: true,
		});

		render(TranscriptDisplay);

		expect(screen.getByText('Hello world')).toBeInTheDocument();
		// The component uses toLocaleTimeString() which is timezone-dependent
		const expectedTime = new Date(65000).toLocaleTimeString();
		expect(screen.getByText(expectedTime)).toBeInTheDocument();
	});

	it('enables buttons when entries exist', () => {
		transcriptState.addEntry({
			text: 'Test',
			timestamp: 0,
			language: 'cs',
			isFinal: true,
		});

		render(TranscriptDisplay);

		expect(screen.getByLabelText('Copy transcript')).not.toBeDisabled();
		expect(screen.getByLabelText('Clear transcript')).not.toBeDisabled();
	});

	it('copies full text to clipboard', async () => {
		transcriptState.addEntry({
			text: 'First',
			timestamp: 0,
			language: 'en',
			isFinal: true,
		});
		transcriptState.addEntry({
			text: 'Second',
			timestamp: 1000,
			language: 'en',
			isFinal: true,
		});

		render(TranscriptDisplay);

		await fireEvent.click(screen.getByLabelText('Copy transcript'));

		expect(navigator.clipboard.writeText).toHaveBeenCalledWith('First Second');
	});

	it('shows Copied! feedback after copy', async () => {
		transcriptState.addEntry({
			text: 'Test',
			timestamp: 0,
			language: 'en',
			isFinal: true,
		});

		render(TranscriptDisplay);

		await fireEvent.click(screen.getByLabelText('Copy transcript'));

		expect(screen.getByText('Copied!')).toBeInTheDocument();
	});

	it('clears entries when clear button is clicked', async () => {
		transcriptState.addEntry({
			text: 'To be cleared',
			timestamp: 0,
			language: 'cs',
			isFinal: true,
		});

		render(TranscriptDisplay);

		await fireEvent.click(screen.getByLabelText('Clear transcript'));

		expect(transcriptState.entries.length).toBe(0);
	});

	it('has log role with aria-live', () => {
		render(TranscriptDisplay);

		const log = screen.getByRole('log');
		expect(log).toBeInTheDocument();
		expect(log.getAttribute('aria-live')).toBe('polite');
	});
});
