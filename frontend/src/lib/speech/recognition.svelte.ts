import type { Language } from '$lib/whisper/types';

// Web Speech API type declarations
interface SpeechRecognitionResult {
	readonly length: number;
	readonly isFinal: boolean;
	[index: number]: { transcript: string; confidence: number };
}

interface SpeechRecognitionResultList {
	readonly length: number;
	[index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEventLike {
	readonly resultIndex: number;
	readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEventLike {
	readonly error: string;
}

interface SpeechRecognitionInstance {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onresult: ((event: SpeechRecognitionEventLike) => void) | null;
	onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const LANG_MAP: Record<Language, string> = {
	cs: 'cs-CZ',
	en: 'en-US',
	auto: '',
};

export class SpeechRecognitionService {
	isListening = $state(false);
	isSupported = $state(false);
	error: string | null = $state(null);
	/** Current interim (not yet confirmed) text — display this live */
	interimText: string = $state('');

	private recognition: SpeechRecognitionInstance | null = null;
	private shouldRestart = false;
	/** How many results from the results list we have already emitted as final */
	private emittedFinalCount = 0;

	onFinal: (text: string) => void = () => {};

	constructor() {
		const SR: SpeechRecognitionConstructor | undefined =
			typeof window !== 'undefined'
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as SpeechRecognitionConstructor | undefined
				: undefined;
		this.isSupported = !!SR;
		if (!SR) return;

		const recognition = new SR();
		recognition.continuous = true;
		recognition.interimResults = true;

		recognition.onresult = (event: SpeechRecognitionEventLike) => {
			// Walk the full results list every time.
			// Emit newly-finalized results; collect current interim text.
			let interim = '';
			for (let i = 0; i < event.results.length; i++) {
				const result = event.results[i];
				const text = result[0].transcript.trim();
				if (!text) continue;

				if (result.isFinal) {
					// Only emit finals we haven't emitted yet
					if (i >= this.emittedFinalCount) {
						this.onFinal(text);
						this.emittedFinalCount = i + 1;
					}
				} else {
					interim = text;
				}
			}
			this.interimText = interim;
		};

		recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
			if (event.error === 'aborted') return;
			this.error = event.error;
			if (event.error === 'not-allowed') {
				this.stop();
			}
		};

		recognition.onend = () => {
			// Session ended — clear interim (it was never confirmed)
			this.interimText = '';
			if (this.shouldRestart) {
				this.emittedFinalCount = 0;
				try {
					recognition.start();
				} catch {
					this.isListening = false;
					this.shouldRestart = false;
				}
			} else {
				this.isListening = false;
			}
		};

		this.recognition = recognition;
	}

	start(lang: Language) {
		if (!this.recognition) return;
		this.error = null;
		this.interimText = '';
		this.emittedFinalCount = 0;
		const bcp47 = LANG_MAP[lang];
		if (bcp47) {
			this.recognition.lang = bcp47;
		}
		this.shouldRestart = true;
		this.isListening = true;
		try {
			this.recognition.start();
		} catch {
			this.isListening = false;
			this.shouldRestart = false;
		}
	}

	stop() {
		this.shouldRestart = false;
		this.isListening = false;
		this.interimText = '';
		this.recognition?.stop();
	}
}
