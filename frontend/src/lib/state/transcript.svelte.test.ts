import { describe, it, expect, beforeEach, vi } from 'vitest';
import { transcriptState } from './transcript.svelte';

// Mock crypto.randomUUID
let uuidCounter = 0;
vi.stubGlobal('crypto', {
	randomUUID: () => `test-uuid-${++uuidCounter}`
});

describe('TranscriptState', () => {
	beforeEach(() => {
		transcriptState.clear();
		uuidCounter = 0;
	});

	it('starts with empty entries', () => {
		expect(transcriptState.entries).toEqual([]);
	});

	it('addEntry adds an entry with generated id', () => {
		transcriptState.addEntry({
			text: 'Hello world',
			timestamp: 1000,
			language: 'en',
			isFinal: true
		});

		expect(transcriptState.entries).toHaveLength(1);
		expect(transcriptState.entries[0].text).toBe('Hello world');
		expect(transcriptState.entries[0].timestamp).toBe(1000);
		expect(transcriptState.entries[0].language).toBe('en');
		expect(transcriptState.entries[0].isFinal).toBe(true);
		expect(transcriptState.entries[0].id).toBe('test-uuid-1');
	});

	it('addEntry adds multiple entries', () => {
		transcriptState.addEntry({
			text: 'First',
			timestamp: 1000,
			language: 'cs',
			isFinal: true
		});
		transcriptState.addEntry({
			text: 'Second',
			timestamp: 2000,
			language: 'cs',
			isFinal: true
		});

		expect(transcriptState.entries).toHaveLength(2);
		expect(transcriptState.entries[0].text).toBe('First');
		expect(transcriptState.entries[1].text).toBe('Second');
	});

	it('each entry gets a unique id', () => {
		transcriptState.addEntry({
			text: 'A',
			timestamp: 1000,
			language: 'en',
			isFinal: true
		});
		transcriptState.addEntry({
			text: 'B',
			timestamp: 2000,
			language: 'en',
			isFinal: true
		});

		expect(transcriptState.entries[0].id).not.toBe(transcriptState.entries[1].id);
	});

	it('fullText joins all entry texts', () => {
		transcriptState.addEntry({
			text: 'Hello',
			timestamp: 1000,
			language: 'en',
			isFinal: true
		});
		transcriptState.addEntry({
			text: 'world',
			timestamp: 2000,
			language: 'en',
			isFinal: true
		});

		expect(transcriptState.fullText).toBe('Hello world');
	});

	it('fullText returns empty string when no entries', () => {
		expect(transcriptState.fullText).toBe('');
	});

	it('fullText trims result', () => {
		transcriptState.addEntry({
			text: ' Hello ',
			timestamp: 1000,
			language: 'en',
			isFinal: true
		});

		expect(transcriptState.fullText).toBe('Hello');
	});

	it('clear removes all entries', () => {
		transcriptState.addEntry({
			text: 'Hello',
			timestamp: 1000,
			language: 'en',
			isFinal: true
		});
		transcriptState.addEntry({
			text: 'World',
			timestamp: 2000,
			language: 'en',
			isFinal: true
		});

		expect(transcriptState.entries).toHaveLength(2);
		transcriptState.clear();
		expect(transcriptState.entries).toEqual([]);
		expect(transcriptState.fullText).toBe('');
	});

	it('handles non-final entries', () => {
		transcriptState.addEntry({
			text: 'Partial',
			timestamp: 1000,
			language: 'cs',
			isFinal: false
		});

		expect(transcriptState.entries[0].isFinal).toBe(false);
	});
});
