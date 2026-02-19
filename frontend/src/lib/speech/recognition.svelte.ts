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

const DEV = import.meta.env.DEV;
const log = DEV ? (...args: unknown[]) => console.debug('[SpeechRecognition]', ...args) : () => {};

const LANG_MAP: Record<Language, string> = {
	cs: 'cs-CZ',
	sk: 'sk-SK',
	en: 'en-US',
	auto: '',
};

/**
 * If interim text sits unchanged for this long, force a stop/restart cycle
 * so onend flushes it. Prevents Chrome from holding text as interim forever
 * during long uninterrupted speech.
 */
const INTERIM_FLUSH_MS = 3000;

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
	/** Timer that forces a stop/restart cycle to flush stale interim text */
	private flushTimer: ReturnType<typeof setTimeout> | null = null;

	private readonly onFinal: (text: string) => void;

	constructor(onFinal: (text: string) => void) {
		this.onFinal = onFinal;
		const SR: SpeechRecognitionConstructor | undefined =
			typeof window !== 'undefined'
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as SpeechRecognitionConstructor | undefined
				: undefined;
		this.isSupported = !!SR;
		log('supported:', this.isSupported);
		if (!SR) return;

		const recognition = new SR();
		recognition.continuous = true;
		recognition.interimResults = true;

		recognition.onresult = (event: SpeechRecognitionEventLike) => {
			let interim = '';
			log('onresult: resultIndex=%d, results.length=%d, emittedFinalCount=%d',
				event.resultIndex, event.results.length, this.emittedFinalCount);

			// Detect results list reset: Chrome can internally reconnect
			// to its servers and restart the results list from 0.
			if (event.results.length < this.emittedFinalCount) {
				log('results list reset detected (length=%d < emittedFinalCount=%d), resetting counter',
					event.results.length, this.emittedFinalCount);
				this.emittedFinalCount = 0;
			}

			for (let i = 0; i < event.results.length; i++) {
				const result = event.results[i];
				const text = result[0].transcript.trim();
				if (!text) continue;

				if (result.isFinal) {
					if (i >= this.emittedFinalCount) {
						log('final [%d] confidence=%.2f: "%s"', i, result[0].confidence, text);
						this.onFinal(text);
						this.emittedFinalCount = i + 1;
					}
				} else {
					log('interim [%d]: "%s"', i, text);
					interim = text;
				}
			}
			this.interimText = interim;
			this.resetFlushTimer();
		};

		recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
			log('onerror:', event.error);
			if (event.error === 'aborted') return;
			this.error = event.error;
			if (event.error === 'not-allowed') {
				log('permission denied — stopping permanently');
				this.shouldRestart = false;
			}
		};

		recognition.onend = () => {
			log('onend: shouldRestart=%s, pendingInterim="%s"', this.shouldRestart, this.interimText);
			this.clearFlushTimer();
			// Flush any pending interim text as final before restarting
			if (this.interimText) {
				log('flushing interim as final: "%s"', this.interimText);
				this.onFinal(this.interimText);
				this.interimText = '';
			}
			if (this.shouldRestart) {
				this.emittedFinalCount = 0;
				log('auto-restarting recognition');
				try {
					recognition.start();
				} catch {
					log('restart failed — giving up');
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
		this.recognition.lang = LANG_MAP[lang];
		this.shouldRestart = true;
		this.isListening = true;
		log('start: lang=%s (bcp47=%s)', lang, LANG_MAP[lang] || '(browser default)');
		try {
			this.recognition.start();
		} catch (err) {
			log('start failed:', err);
			this.isListening = false;
			this.shouldRestart = false;
		}
	}

	stop() {
		log('stop requested');
		this.shouldRestart = false;
		this.isListening = false;
		this.clearFlushTimer();
		// Don't clear interimText here — let onend flush it as final
		this.recognition?.stop();
	}

	/**
	 * Force a stop→onend→restart cycle so that onend flushes stale interim text.
	 * shouldRestart stays true, so onend will restart automatically.
	 */
	private forceFlush() {
		if (!this.interimText || !this.recognition) return;
		log('forcing stop/restart cycle to flush interim: "%s"', this.interimText);
		// shouldRestart remains true — onend will flush interimText and restart
		this.recognition.stop();
	}

	private resetFlushTimer() {
		this.clearFlushTimer();
		if (this.interimText) {
			this.flushTimer = setTimeout(() => this.forceFlush(), INTERIM_FLUSH_MS);
		}
	}

	private clearFlushTimer() {
		if (this.flushTimer !== null) {
			clearTimeout(this.flushTimer);
			this.flushTimer = null;
		}
	}
}
