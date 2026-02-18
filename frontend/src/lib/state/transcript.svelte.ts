import type { Language } from '$lib/whisper/types';

export interface TranscriptEntry {
	id: string;
	text: string;
	timestamp: number;
	language: Language;
	isFinal: boolean;
}

class TranscriptState {
	entries: TranscriptEntry[] = $state([]);

	/** ID of the current partial entry being updated in-place */
	private partialId: string | null = null;

	addEntry(entry: Omit<TranscriptEntry, 'id'>) {
		this.entries = [...this.entries, { ...entry, id: crypto.randomUUID() }];
	}

	/** Update the current partial in-place, or add a new one */
	updateOrAddPartial(text: string, language: Language) {
		if (this.partialId) {
			this.entries = this.entries.map((e) =>
				e.id === this.partialId ? { ...e, text, timestamp: Date.now() } : e
			);
		} else {
			const id = crypto.randomUUID();
			this.partialId = id;
			this.entries = [
				...this.entries,
				{ id, text, timestamp: Date.now(), language, isFinal: false }
			];
		}
	}

	/** Mark the current partial as final */
	finalizePartial(text: string) {
		if (this.partialId) {
			this.entries = this.entries.map((e) =>
				e.id === this.partialId ? { ...e, text, isFinal: true, timestamp: Date.now() } : e
			);
			this.partialId = null;
		} else if (text) {
			this.addEntry({
				text,
				timestamp: Date.now(),
				language: 'cs',
				isFinal: true
			});
		}
	}

	get fullText(): string {
		return this.entries.map((e) => e.text).join(' ').trim();
	}

	clear() {
		this.entries = [];
		this.partialId = null;
	}
}

export const transcriptState = new TranscriptState();
