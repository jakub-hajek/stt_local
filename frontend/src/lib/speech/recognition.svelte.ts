import type { Language } from '$lib/whisper/types';

interface SpeechRecognitionInstance {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onresult: ((event: { resultIndex: number; results: any }) => void) | null;
	onerror: ((event: { error: string }) => void) | null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
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
	error: string | null = $state(null);
	interimText: string = $state('');

	private recognition: SpeechRecognitionInstance | null = null;
	private shouldRestart = false;
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

		recognition.onresult = (event) => {
			let finalText = '';
			let interim = '';

			// Only process results from resultIndex onward — earlier results haven't changed
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const transcript: string = event.results[i][0].transcript;
				if (event.results[i].isFinal) {
					finalText += transcript;
				} else {
					interim += transcript;
				}
			}

			if (finalText.trim()) {
				log('final:', finalText.trim());
				this.onFinal(finalText.trim());
			}
			this.interimText = interim.trim();
			if (interim.trim()) {
				log('interim:', interim.trim());
			}
		};

		recognition.onerror = (event) => {
			log('onerror:', event.error);
			if (event.error === 'aborted') return;
			this.error = event.error;
			if (event.error === 'not-allowed') {
				this.shouldRestart = false;
			}
		};

		recognition.onend = () => {
			log('onend: shouldRestart=%s', this.shouldRestart);
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
		this.interimText = '';
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
