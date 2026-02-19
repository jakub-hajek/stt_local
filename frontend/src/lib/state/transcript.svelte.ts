import type { Language } from '$lib/whisper/types';

export interface TranscriptEntry {
	id: string;
	text: string;
	timestamp: number;
	language: Language;
	isFinal: boolean;
}

class TranscriptState {
	private static MAX_ENTRIES = 500;
	entries: TranscriptEntry[] = $state([]);

	addEntry(entry: Omit<TranscriptEntry, 'id'>) {
		this.entries = [...this.entries, { ...entry, id: crypto.randomUUID() }].slice(-TranscriptState.MAX_ENTRIES);
	}

	get fullText(): string {
		return this.entries.map((e) => e.text).join(' ').trim();
	}

	clear() {
		this.entries = [];
	}
}

export const transcriptState = new TranscriptState();
