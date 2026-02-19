import type { Language } from '$lib/whisper/types';

interface SpeechRecognitionInstance {
	continuous: boolean;
	interimResults: boolean;
	maxAlternatives: number;
	lang: string;
	onresult: ((event: { resultIndex: number; results: any }) => void) | null;
	onerror: ((event: { error: string }) => void) | null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
	abort(): void;
}

const DEV = import.meta.env.DEV;
const log = DEV ? (...args: unknown[]) => console.debug('[SpeechRecognition]', ...args) : () => {};

const LANG_MAP: Record<Language, string> = {
	cs: 'cs-CZ',
	sk: 'sk-SK',
	en: 'en-US',
	auto: '',
};

export class SpeechRecognitionService {
	isListening = $state(false);
	isSupported = $state(false);
	interimText = $state('');
	error: string | null = $state(null);

	private recognition: SpeechRecognitionInstance | null = null;
	private shouldRestart = false;
	private lastInterim = '';
	private emittedUpTo = 0; // how many results we've already emitted as final
	private readonly onFinal: (text: string) => void;

	constructor(onFinal: (text: string) => void) {
		this.onFinal = onFinal;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const SR = typeof window !== 'undefined'
			? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition)
			: undefined;
		this.isSupported = !!SR;
		log('supported:', this.isSupported);
		if (!SR) return;

		const recognition: SpeechRecognitionInstance = new SR();
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.maxAlternatives = 1;

		recognition.onresult = (event) => {
			let interim = '';
			// IMPORTANT: We intentionally ignore event.resultIndex and scan from 0.
			//
			// The Web Speech API spec says resultIndex is "the lowest index that has
			// changed", so the standard pattern is to loop from resultIndex. However,
			// Chrome's implementation can finalize result[N] (promoting it from interim
			// to isFinal=true) at the same time it begins a new interim at result[N+1],
			// and set resultIndex=N+1. If we only loop from resultIndex we never see the
			// finalization at index N — the text appears as interim on screen but is
			// never committed, silently losing entire sentences.
			//
			// By scanning all results every time and tracking how far we've already
			// emitted (emittedUpTo), we catch every finalization regardless of what
			// Chrome reports as resultIndex, while still avoiding double-commits.
			for (let i = 0; i < event.results.length; i++) {
				if (event.results[i].isFinal) {
					if (i >= this.emittedUpTo) {
						const text = event.results[i][0].transcript.trim();
						if (text) {
							log('final [%d]:', i, text);
							this.onFinal(text);
						}
						this.emittedUpTo = i + 1;
					}
				} else {
					interim += event.results[i][0].transcript;
				}
			}
			this.lastInterim = interim;
			this.interimText = interim;
			if (interim) {
				log('interim:', interim);
			}
		};

		recognition.onerror = (event) => {
			log('onerror:', event.error);
			if (event.error === 'aborted' || event.error === 'no-speech') return;
			this.error = event.error;
			if (event.error === 'not-allowed') {
				this.shouldRestart = false;
			}
		};

		recognition.onend = () => {
			log('onend: shouldRestart=%s, pendingInterim="%s"', this.shouldRestart, this.lastInterim);
			// Chrome can terminate a continuous session at any time (long silence,
			// internal timeout, network hiccup) without finalizing the last interim
			// result. Flush whatever interim text we have so it isn't lost.
			if (this.lastInterim.trim()) {
				log('flushing interim as final:', this.lastInterim.trim());
				this.onFinal(this.lastInterim.trim());
				this.lastInterim = '';
				this.interimText = '';
			}
			// Reset counter — Chrome starts a fresh results list on restart
			this.emittedUpTo = 0;
			if (this.shouldRestart) {
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
		this.lastInterim = '';
		this.interimText = '';
		this.emittedUpTo = 0;
		this.recognition.lang = LANG_MAP[lang];
		this.shouldRestart = true;
		this.isListening = true;
		log('start: lang=%s', LANG_MAP[lang] || '(auto)');
		try {
			this.recognition.start();
		} catch {
			this.isListening = false;
			this.shouldRestart = false;
		}
	}

	stop() {
		log('stop');
		this.shouldRestart = false;
		this.recognition?.stop();
	}
}
