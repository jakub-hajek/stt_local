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

/** How long interim text can sit unchanged before we force a stop/restart cycle (ms). */
const STALE_INTERIM_TIMEOUT = 5_000;

/** Proactively restart session after this long to prevent Chrome degradation (ms). */
const SESSION_MAX_AGE = 12 * 60_000;

/** Base delay between rapid restarts (ms). Doubles on each consecutive rapid restart. */
const RESTART_BASE_DELAY = 200;

/** Max backoff delay for restarts (ms). */
const RESTART_MAX_DELAY = 5_000;

/** Extra delay before restarting after a network error (ms). */
const NETWORK_RETRY_DELAY = 2_000;

export class SpeechRecognitionService {
	isListening = $state(false);
	isSupported = $state(false);
	interimText = $state('');
	error: string | null = $state(null);

	private recognition: SpeechRecognitionInstance | null = null;
	private shouldRestart = false;
	private lastInterim = '';
	private emittedUpTo = 0;
	// Track the best interim text seen per result index so we can detect
	// when Chrome truncates on finalization and use the longer interim instead.
	private bestInterimByIndex = new Map<number, string>();
	private readonly onFinal: (text: string) => void;

	// Stale interim watchdog: forces stop/restart if interim text doesn't change
	private staleTimer: ReturnType<typeof setTimeout> | null = null;
	private lastInterimSnapshot = '';

	// Session age restart: proactively refresh long-running sessions
	private sessionTimer: ReturnType<typeof setTimeout> | null = null;
	private sessionStartedAt = 0;

	// Restart backoff: prevent hot-spinning restart loops
	private lastEndTime = 0;
	private consecutiveRapidRestarts = 0;
	private restartTimer: ReturnType<typeof setTimeout> | null = null;

	// Network error tracking
	private lastErrorWasNetwork = false;

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
						const finalText = event.results[i][0].transcript.trim();
						const bestInterim = (this.bestInterimByIndex.get(i) ?? '').trim();
						// Chrome sometimes truncates text on finalization — the final
						// transcript is shorter than the interim that was displayed.
						// Use the longer version to avoid losing captured text.
						const text = bestInterim.length > finalText.length ? bestInterim : finalText;
						if (text) {
							if (bestInterim.length > finalText.length) {
								log('final [%d]: using interim (final truncated: "%s" → "%s")', i, finalText, text);
							} else {
								log('final [%d]:', i, text);
							}
							this.onFinal(text);
						}
						this.bestInterimByIndex.delete(i);
						this.emittedUpTo = i + 1;
					}
				} else {
					const currentInterim = event.results[i][0].transcript;
					interim += currentInterim;
					// Track the longest interim seen for this result index
					const prev = this.bestInterimByIndex.get(i) ?? '';
					if (currentInterim.length > prev.length) {
						this.bestInterimByIndex.set(i, currentInterim);
					}
				}
			}
			this.lastInterim = interim;
			this.interimText = interim;
			if (interim) {
				log('interim:', interim);
			}
			this.resetStaleWatchdog();
		};

		recognition.onerror = (event) => {
			log('onerror:', event.error);
			if (event.error === 'aborted' || event.error === 'no-speech') return;
			this.error = event.error;
			this.lastErrorWasNetwork = event.error === 'network';
			if (event.error === 'not-allowed') {
				this.shouldRestart = false;
			}
		};

		recognition.onend = () => {
			log('onend: shouldRestart=%s, pendingInterim="%s"', this.shouldRestart, this.lastInterim);

			this.clearStaleWatchdog();
			this.clearSessionTimer();

			// Chrome can terminate a continuous session at any time (long silence,
			// internal timeout, network hiccup) without finalizing the last interim
			// result. Flush whatever interim text we have so it isn't lost.
			if (this.lastInterim.trim()) {
				log('flushing interim as final:', this.lastInterim.trim());
				this.onFinal(this.lastInterim.trim());
				this.lastInterim = '';
				this.interimText = '';
			}

			// Reset counters — Chrome starts a fresh results list on restart
			this.emittedUpTo = 0;
			this.bestInterimByIndex.clear();

			if (this.shouldRestart) {
				const delay = this.computeRestartDelay();
				if (delay > 0) {
					log('delaying restart by %dms', delay);
					this.restartTimer = setTimeout(() => {
						this.restartTimer = null;
						this.doRestart(recognition);
					}, delay);
				} else {
					this.doRestart(recognition);
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
		this.bestInterimByIndex.clear();
		this.consecutiveRapidRestarts = 0;
		this.lastErrorWasNetwork = false;
		this.recognition.lang = LANG_MAP[lang];
		this.shouldRestart = true;
		this.isListening = true;
		log('start: lang=%s', LANG_MAP[lang] || '(auto)');
		try {
			this.recognition.start();
			this.sessionStartedAt = Date.now();
			this.startSessionTimer();
			this.resetStaleWatchdog();
		} catch {
			this.isListening = false;
			this.shouldRestart = false;
		}
	}

	stop() {
		log('stop');
		this.shouldRestart = false;
		this.clearStaleWatchdog();
		this.clearSessionTimer();
		this.clearRestartTimer();
		this.recognition?.stop();
	}

	// ── Restart with backoff ──────────────────────────────────────────

	private doRestart(recognition: SpeechRecognitionInstance) {
		try {
			recognition.start();
			this.sessionStartedAt = Date.now();
			this.startSessionTimer();
			this.resetStaleWatchdog();
			log('restarted');
		} catch {
			this.isListening = false;
			this.shouldRestart = false;
		}
	}

	/**
	 * Compute how long to wait before restarting. Combines:
	 * - Exponential backoff for rapid restarts (onend firing within 1s of each other)
	 * - Extra delay after network errors to avoid hammering Google's servers
	 */
	private computeRestartDelay(): number {
		const now = Date.now();
		const sinceLastEnd = now - this.lastEndTime;
		this.lastEndTime = now;

		// Track rapid restarts (onend within 1 second of last onend)
		if (sinceLastEnd < 1000) {
			this.consecutiveRapidRestarts++;
		} else {
			this.consecutiveRapidRestarts = 0;
		}

		let delay = 0;

		// Exponential backoff for rapid restart loops
		if (this.consecutiveRapidRestarts > 0) {
			delay = Math.min(
				RESTART_BASE_DELAY * Math.pow(2, this.consecutiveRapidRestarts - 1),
				RESTART_MAX_DELAY
			);
			log('rapid restart #%d, backoff=%dms', this.consecutiveRapidRestarts, delay);
		}

		// Extra delay after network errors
		if (this.lastErrorWasNetwork) {
			delay = Math.max(delay, NETWORK_RETRY_DELAY);
			this.lastErrorWasNetwork = false;
			log('network error recovery delay=%dms', delay);
		}

		return delay;
	}

	private clearRestartTimer() {
		if (this.restartTimer !== null) {
			clearTimeout(this.restartTimer);
			this.restartTimer = null;
		}
	}

	// ── Stale interim watchdog ────────────────────────────────────────

	/**
	 * If interim text hasn't changed for STALE_INTERIM_TIMEOUT, Chrome may have
	 * stalled without firing onend. Force a stop() which triggers onend → flush
	 * → restart cycle, recovering the stuck interim text.
	 */
	private resetStaleWatchdog() {
		this.clearStaleWatchdog();
		if (!this.shouldRestart) return;
		this.lastInterimSnapshot = this.lastInterim;
		this.staleTimer = setTimeout(() => {
			this.staleTimer = null;
			if (!this.shouldRestart || !this.lastInterim.trim()) return;
			if (this.lastInterim === this.lastInterimSnapshot) {
				log('stale interim detected ("%s"), forcing stop/restart', this.lastInterim.trim());
				// stop() sets shouldRestart=false, but we want to restart after flush
				this.recognition?.stop();
				// shouldRestart is still true here (we didn't call this.stop())
			}
		}, STALE_INTERIM_TIMEOUT);
	}

	private clearStaleWatchdog() {
		if (this.staleTimer !== null) {
			clearTimeout(this.staleTimer);
			this.staleTimer = null;
		}
	}

	// ── Session age restart ───────────────────────────────────────────

	/**
	 * Chrome's continuous mode degrades over very long sessions (60+ minutes).
	 * Proactively stop and restart every SESSION_MAX_AGE to keep the session fresh.
	 * Only triggers during silence (no pending interim text) to avoid interrupting
	 * active speech.
	 */
	private startSessionTimer() {
		this.clearSessionTimer();
		this.sessionTimer = setTimeout(() => {
			this.sessionTimer = null;
			if (!this.shouldRestart) return;
			if (this.lastInterim.trim()) {
				// Active speech — defer restart, check again in 10s
				log('session age restart deferred (active speech)');
				this.startSessionTimer();
				return;
			}
			const age = Date.now() - this.sessionStartedAt;
			log('proactive session restart after %ds', Math.round(age / 1000));
			// stop() triggers onend → flush → restart
			this.recognition?.stop();
		}, SESSION_MAX_AGE);
	}

	private clearSessionTimer() {
		if (this.sessionTimer !== null) {
			clearTimeout(this.sessionTimer);
			this.sessionTimer = null;
		}
	}
}
