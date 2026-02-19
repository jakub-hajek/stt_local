import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SpeechRecognitionService } from './recognition.svelte';

function makeResultEvent(
	results: Array<{ transcript: string; isFinal: boolean }>,
	resultIndex = 0
) {
	const resultList = results.map((r) => ({
		isFinal: r.isFinal,
		0: { transcript: r.transcript, confidence: 0.9 },
	}));
	return { resultIndex, results: Object.assign(resultList, { length: resultList.length }) };
}

describe('SpeechRecognitionService', () => {
	let onFinal: ReturnType<typeof vi.fn>;
	let service: SpeechRecognitionService;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.clearAllMocks();
		onFinal = vi.fn();
		service = new SpeechRecognitionService(onFinal);
	});

	afterEach(() => {
		service.stop();
		vi.useRealTimers();
	});

	describe('constructor', () => {
		it('detects support', () => {
			expect(service.isSupported).toBe(true);
		});

		it('detects no support when unavailable', () => {
			const orig = (window as any).SpeechRecognition;
			(window as any).SpeechRecognition = undefined;
			(window as any).webkitSpeechRecognition = undefined;

			const svc = new SpeechRecognitionService(vi.fn());
			expect(svc.isSupported).toBe(false);

			(window as any).SpeechRecognition = orig;
			(window as any).webkitSpeechRecognition = orig;
		});
	});

	describe('start/stop', () => {
		it('start sets isListening and lang', () => {
			service.start('cs');
			expect(service.isListening).toBe(true);
			expect((service as any).recognition.lang).toBe('cs-CZ');
		});

		it('auto maps to empty string', () => {
			service.start('auto');
			expect((service as any).recognition.lang).toBe('');
		});

		it('stop calls recognition.stop', () => {
			service.start('en');
			service.stop();
			expect((service as any).recognition.stop).toHaveBeenCalled();
		});

		it('resets isListening if start throws', () => {
			const rec = (service as any).recognition;
			rec.start.mockImplementationOnce(() => { throw new Error(); });
			service.start('en');
			expect(service.isListening).toBe(false);
		});

		it('clears interimText on start', () => {
			(service as any).lastInterim = 'leftover';
			service.start('en');
			expect(service.interimText).toBe('');
		});
	});

	describe('onresult', () => {
		it('emits final text via onFinal', () => {
			service.start('en');
			const rec = (service as any).recognition;
			rec.onresult(makeResultEvent([{ transcript: 'hello world', isFinal: true }]));

			expect(onFinal).toHaveBeenCalledWith('hello world');
			expect(service.interimText).toBe('');
		});

		it('sets interimText for non-final results', () => {
			service.start('en');
			const rec = (service as any).recognition;
			rec.onresult(makeResultEvent([{ transcript: 'hello', isFinal: false }]));

			expect(service.interimText).toBe('hello');
			expect(onFinal).not.toHaveBeenCalled();
		});

		it('does not re-emit already emitted finals', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onresult(makeResultEvent([
				{ transcript: 'first', isFinal: true },
			]));
			expect(onFinal).toHaveBeenCalledTimes(1);

			rec.onresult(makeResultEvent([
				{ transcript: 'first', isFinal: true },
				{ transcript: 'second', isFinal: true },
			]));
			expect(onFinal).toHaveBeenCalledTimes(2);
			expect(onFinal).toHaveBeenLastCalledWith('second');
		});

		it('catches finals that Chrome finalizes silently', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onresult(makeResultEvent([
				{ transcript: 'hello', isFinal: false },
			]));
			expect(onFinal).not.toHaveBeenCalled();

			rec.onresult(makeResultEvent(
				[
					{ transcript: 'hello world', isFinal: true },
					{ transcript: 'next', isFinal: false },
				],
				1
			));
			expect(onFinal).toHaveBeenCalledWith('hello world');
			expect(service.interimText).toBe('next');
		});

		it('emits each final result separately', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onresult(makeResultEvent([
				{ transcript: 'hello', isFinal: true },
				{ transcript: 'world', isFinal: true },
			]));

			expect(onFinal).toHaveBeenCalledTimes(2);
			expect(onFinal).toHaveBeenCalledWith('hello');
			expect(onFinal).toHaveBeenCalledWith('world');
		});

		it('uses longer interim when Chrome truncates on finalization', () => {
			service.start('en');
			const rec = (service as any).recognition;

			// Chrome shows full interim text
			rec.onresult(makeResultEvent([
				{ transcript: 'this is a long sentence with many words', isFinal: false },
			]));
			expect(service.interimText).toBe('this is a long sentence with many words');

			// Chrome finalizes with truncated text
			rec.onresult(makeResultEvent([
				{ transcript: 'this is a long', isFinal: true },
			]));

			// Should use the longer interim version
			expect(onFinal).toHaveBeenCalledWith('this is a long sentence with many words');
		});

		it('uses final when it is longer than interim', () => {
			service.start('en');
			const rec = (service as any).recognition;

			// Short interim
			rec.onresult(makeResultEvent([
				{ transcript: 'hello', isFinal: false },
			]));

			// Final is longer (Chrome refined it)
			rec.onresult(makeResultEvent([
				{ transcript: 'hello world', isFinal: true },
			]));

			expect(onFinal).toHaveBeenCalledWith('hello world');
		});

		it('ignores empty transcripts', () => {
			service.start('en');
			const rec = (service as any).recognition;
			rec.onresult(makeResultEvent([{ transcript: '   ', isFinal: true }]));

			expect(onFinal).not.toHaveBeenCalled();
		});
	});

	describe('onend', () => {
		it('auto-restarts when shouldRestart is true', () => {
			service.start('en');
			const rec = (service as any).recognition;
			rec.start.mockClear();

			rec.onend();
			// No delay on first clean restart
			expect(rec.start).toHaveBeenCalledTimes(1);
		});

		it('stops when shouldRestart is false', () => {
			service.start('en');
			const rec = (service as any).recognition;
			service.stop();
			rec.start.mockClear();

			rec.onend();
			expect(rec.start).not.toHaveBeenCalled();
			expect(service.isListening).toBe(false);
		});

		it('flushes pending interim text as final on session end', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onresult(makeResultEvent([{ transcript: 'pending words', isFinal: false }]));
			expect(service.interimText).toBe('pending words');

			rec.onend();
			expect(onFinal).toHaveBeenCalledWith('pending words');
			expect(service.interimText).toBe('');
		});

		it('does not flush empty interim text', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onend();
			expect(onFinal).not.toHaveBeenCalled();
		});
	});

	describe('restart backoff', () => {
		it('delays restart on rapid consecutive onend events', () => {
			service.start('en');
			const rec = (service as any).recognition;
			rec.start.mockClear();

			// First onend — immediate restart
			rec.onend();
			expect(rec.start).toHaveBeenCalledTimes(1);
			rec.start.mockClear();

			// Second onend within 1s — should delay
			rec.onend();
			expect(rec.start).not.toHaveBeenCalled();

			// Advance past the backoff delay
			vi.advanceTimersByTime(300);
			expect(rec.start).toHaveBeenCalledTimes(1);
		});

		it('resets backoff counter after stable session', () => {
			service.start('en');
			const rec = (service as any).recognition;
			rec.start.mockClear();

			// First rapid restart
			rec.onend();
			rec.start.mockClear();

			// Advance 2 seconds (longer than 1s rapid threshold)
			vi.advanceTimersByTime(2000);
			rec.onend();

			// Should restart immediately (not rapid anymore)
			expect(rec.start).toHaveBeenCalledTimes(1);
		});
	});

	describe('network error recovery', () => {
		it('adds delay before restart after network error', () => {
			service.start('en');
			const rec = (service as any).recognition;
			rec.start.mockClear();

			rec.onerror({ error: 'network' });
			// Advance well past rapid-restart window so only network delay applies
			vi.advanceTimersByTime(2000);
			rec.onend();
			// Should not restart immediately
			expect(rec.start).not.toHaveBeenCalled();

			// Advance past network retry delay
			vi.advanceTimersByTime(2000);
			expect(rec.start).toHaveBeenCalledTimes(1);
		});

		it('clears network flag after one restart', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onerror({ error: 'network' });
			vi.advanceTimersByTime(2000);
			rec.onend();
			vi.advanceTimersByTime(2000);
			rec.start.mockClear();

			// Next onend (no error) — should restart with no extra delay
			vi.advanceTimersByTime(2000);
			rec.onend();
			expect(rec.start).toHaveBeenCalledTimes(1);
		});
	});

	describe('stale interim watchdog', () => {
		it('forces stop/restart when interim text stalls for 5s', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onresult(makeResultEvent([{ transcript: 'stuck text', isFinal: false }]));
			expect(service.interimText).toBe('stuck text');

			// Advance past stale timeout
			vi.advanceTimersByTime(5000);

			// Should have called recognition.stop() to trigger flush
			expect(rec.stop).toHaveBeenCalled();
		});

		it('does not trigger if interim text changes', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onresult(makeResultEvent([{ transcript: 'hello', isFinal: false }]));
			vi.advanceTimersByTime(3000);

			// Interim text changes — resets the watchdog
			rec.onresult(makeResultEvent([{ transcript: 'hello world', isFinal: false }]));
			vi.advanceTimersByTime(3000);

			// Only 3s since last change, should not have triggered
			expect(rec.stop).not.toHaveBeenCalled();
		});

		it('does not trigger when there is no interim text', () => {
			service.start('en');
			const rec = (service as any).recognition;

			vi.advanceTimersByTime(6000);
			expect(rec.stop).not.toHaveBeenCalled();
		});
	});

	describe('session age restart', () => {
		it('proactively restarts after session max age', () => {
			service.start('en');
			const rec = (service as any).recognition;

			vi.advanceTimersByTime(12 * 60_000);

			// Should have called stop() to trigger restart
			expect(rec.stop).toHaveBeenCalled();
		});

		it('defers restart when speech is active', () => {
			service.start('en');
			const rec = (service as any).recognition;

			// Simulate active speech near the session max age
			vi.advanceTimersByTime(11 * 60_000);
			rec.onresult(makeResultEvent([{ transcript: 'talking', isFinal: false }]));

			vi.advanceTimersByTime(60_000);
			// Should NOT stop because there's active interim text
			const stopCalls = rec.stop.mock.calls.length;

			// Finalize the speech
			rec.onresult(makeResultEvent([{ transcript: 'talking done', isFinal: true }]));

			// Advance past the deferred timer
			vi.advanceTimersByTime(12 * 60_000);
			expect(rec.stop.mock.calls.length).toBeGreaterThan(stopCalls);
		});
	});

	describe('onerror', () => {
		it('stops permanently for not-allowed', () => {
			service.start('en');
			const rec = (service as any).recognition;
			rec.onerror({ error: 'not-allowed' });
			rec.start.mockClear();

			rec.onend();
			vi.advanceTimersByTime(10000);
			expect(rec.start).not.toHaveBeenCalled();
		});

		it('ignores aborted', () => {
			service.start('en');
			const rec = (service as any).recognition;
			rec.onerror({ error: 'aborted' });
			expect(service.error).toBeNull();
		});

		it('ignores no-speech', () => {
			service.start('en');
			const rec = (service as any).recognition;
			rec.onerror({ error: 'no-speech' });
			expect(service.error).toBeNull();
		});

		it('sets error for other errors', () => {
			service.start('en');
			const rec = (service as any).recognition;
			rec.onerror({ error: 'network' });
			expect(service.error).toBe('network');
		});
	});
});
