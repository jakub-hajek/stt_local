import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SpeechRecognitionService } from './recognition.svelte';

function makeResultEvent(
	results: Array<{ transcript: string; isFinal: boolean }>,
	resultIndex = 0
) {
	const resultList = results.map((r) => {
		const result: any = {
			isFinal: r.isFinal,
			length: 1,
			0: { transcript: r.transcript, confidence: 0.9 },
		};
		return result;
	});
	(resultList as any).length = resultList.length;
	return { resultIndex, results: resultList };
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
		vi.useRealTimers();
	});

	describe('constructor', () => {
		it('detects support when SpeechRecognition is available', () => {
			expect(service.isSupported).toBe(true);
		});

		it('detects no support when SpeechRecognition is unavailable', () => {
			const origSR = (window as any).SpeechRecognition;
			const origWebkit = (window as any).webkitSpeechRecognition;
			(window as any).SpeechRecognition = undefined;
			(window as any).webkitSpeechRecognition = undefined;

			const svc = new SpeechRecognitionService(vi.fn());
			expect(svc.isSupported).toBe(false);

			(window as any).SpeechRecognition = origSR;
			(window as any).webkitSpeechRecognition = origWebkit;
		});
	});

	describe('start()', () => {
		it('sets isListening and calls recognition.start()', () => {
			service.start('en');
			expect(service.isListening).toBe(true);
		});

		it('configures lang to BCP-47 code', () => {
			service.start('cs');
			const rec = (service as any).recognition;
			expect(rec.lang).toBe('cs-CZ');
		});

		it('maps each language correctly', () => {
			const rec = (service as any).recognition;

			service.start('en');
			expect(rec.lang).toBe('en-US');

			service.start('sk');
			expect(rec.lang).toBe('sk-SK');

			service.start('cs');
			expect(rec.lang).toBe('cs-CZ');
		});

		it('sets lang to empty string for auto (browser default)', () => {
			service.start('en');
			service.start('auto');
			const rec = (service as any).recognition;
			expect(rec.lang).toBe('');
		});

		it('resets isListening if recognition.start() throws', () => {
			const rec = (service as any).recognition;
			rec.start.mockImplementationOnce(() => {
				throw new Error('already started');
			});

			service.start('en');
			expect(service.isListening).toBe(false);
		});
	});

	describe('stop()', () => {
		it('sets shouldRestart to false and calls recognition.stop()', () => {
			service.start('en');
			service.stop();
			expect(service.isListening).toBe(false);

			const rec = (service as any).recognition;
			expect(rec.stop).toHaveBeenCalled();
		});
	});

	describe('onresult', () => {
		it('updates interimText for non-final results', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onresult(makeResultEvent([{ transcript: 'hello', isFinal: false }]));
			expect(service.interimText).toBe('hello');
			expect(onFinal).not.toHaveBeenCalled();
		});

		it('calls onFinal for final results', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onresult(makeResultEvent([{ transcript: 'hello world', isFinal: true }]));
			expect(onFinal).toHaveBeenCalledWith('hello world');
			expect(service.interimText).toBe('');
		});

		it('deduplicates already-emitted finals', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onresult(makeResultEvent([{ transcript: 'hello', isFinal: true }]));
			expect(onFinal).toHaveBeenCalledTimes(1);

			rec.onresult(
				makeResultEvent([
					{ transcript: 'hello', isFinal: true },
					{ transcript: 'world', isFinal: false },
				])
			);
			expect(onFinal).toHaveBeenCalledTimes(1);
			expect(service.interimText).toBe('world');
		});

		it('emits new finals after already-emitted ones', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onresult(makeResultEvent([{ transcript: 'hello', isFinal: true }]));
			expect(onFinal).toHaveBeenCalledTimes(1);

			rec.onresult(
				makeResultEvent([
					{ transcript: 'hello', isFinal: true },
					{ transcript: 'world', isFinal: true },
				])
			);
			expect(onFinal).toHaveBeenCalledTimes(2);
			expect(onFinal).toHaveBeenLastCalledWith('world');
		});
	});

	describe('results list reset detection', () => {
		it('resets emittedFinalCount when results list shrinks', () => {
			service.start('en');
			const rec = (service as any).recognition;

			// Accumulate 3 finals → emittedFinalCount = 3
			rec.onresult(
				makeResultEvent([
					{ transcript: 'a', isFinal: true },
					{ transcript: 'b', isFinal: true },
					{ transcript: 'c', isFinal: true },
				])
			);
			expect(onFinal).toHaveBeenCalledTimes(3);

			// Chrome internally resets — new results list is shorter
			rec.onresult(makeResultEvent([{ transcript: 'new text', isFinal: true }]));

			// Should emit "new text" despite index 0 < old emittedFinalCount
			expect(onFinal).toHaveBeenCalledTimes(4);
			expect(onFinal).toHaveBeenLastCalledWith('new text');
		});

		it('does not lose finals after internal reset with interim', () => {
			service.start('en');
			const rec = (service as any).recognition;

			// Build up emittedFinalCount
			rec.onresult(
				makeResultEvent([
					{ transcript: 'one', isFinal: true },
					{ transcript: 'two', isFinal: true },
				])
			);
			expect(onFinal).toHaveBeenCalledTimes(2);

			// Chrome resets, new session starts with interim
			rec.onresult(makeResultEvent([{ transcript: 'three', isFinal: false }]));
			expect(service.interimText).toBe('three');

			// Then finalizes
			rec.onresult(makeResultEvent([{ transcript: 'three four', isFinal: true }]));
			expect(onFinal).toHaveBeenCalledTimes(3);
			expect(onFinal).toHaveBeenLastCalledWith('three four');
		});
	});

	describe('stale interim flush cycle', () => {
		it('forces stop after 3s of stale interim, onend flushes and restarts', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onresult(makeResultEvent([{ transcript: 'long speech', isFinal: false }]));
			expect(service.interimText).toBe('long speech');

			// Advance past flush timeout
			vi.advanceTimersByTime(3000);

			// Should have called recognition.stop() to trigger onend cycle
			expect(rec.stop).toHaveBeenCalled();

			// Simulate Chrome firing onend after stop()
			rec.start.mockClear();
			rec.onend();

			// onend should flush the interim and restart
			expect(onFinal).toHaveBeenCalledWith('long speech');
			expect(service.interimText).toBe('');
			expect(rec.start).toHaveBeenCalledTimes(1);
		});

		it('resets timer when interim text updates', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onresult(makeResultEvent([{ transcript: 'first', isFinal: false }]));

			// Advance 2s — not yet expired
			vi.advanceTimersByTime(2000);
			expect(rec.stop).not.toHaveBeenCalled();

			// New result resets the timer
			rec.onresult(makeResultEvent([{ transcript: 'first updated', isFinal: false }]));

			// 2s more — old timer would have fired
			vi.advanceTimersByTime(2000);
			expect(rec.stop).not.toHaveBeenCalled();

			// Full 3s from last result
			vi.advanceTimersByTime(1000);
			expect(rec.stop).toHaveBeenCalled();
		});

		it('does not force flush when interim is empty', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onresult(makeResultEvent([{ transcript: 'done', isFinal: true }]));

			vi.advanceTimersByTime(5000);
			expect(rec.stop).not.toHaveBeenCalled();
		});

		it('clears timer on user stop', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onresult(makeResultEvent([{ transcript: 'pending', isFinal: false }]));
			service.stop();
			rec.stop.mockClear();

			vi.advanceTimersByTime(5000);
			// Timer was cleared — no extra stop() call from the flush timer
			expect(rec.stop).not.toHaveBeenCalled();
		});

		it('does not duplicate when final arrives before timer', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onresult(makeResultEvent([{ transcript: 'hello', isFinal: false }]));

			// Chrome finalizes before timer fires
			rec.onresult(makeResultEvent([{ transcript: 'hello world', isFinal: true }]));
			expect(onFinal).toHaveBeenCalledTimes(1);
			expect(onFinal).toHaveBeenCalledWith('hello world');

			// Timer fires but interimText is empty — no-op
			vi.advanceTimersByTime(5000);
			expect(onFinal).toHaveBeenCalledTimes(1);
		});
	});

	describe('onend', () => {
		it('flushes pending interimText as final', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onresult(makeResultEvent([{ transcript: 'pending text', isFinal: false }]));
			expect(service.interimText).toBe('pending text');

			service.stop();
			rec.onend();

			expect(onFinal).toHaveBeenCalledWith('pending text');
			expect(service.interimText).toBe('');
		});

		it('auto-restarts when shouldRestart is true', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.start.mockClear();
			rec.onend();

			expect(rec.start).toHaveBeenCalledTimes(1);
		});

		it('does not restart when shouldRestart is false', () => {
			service.start('en');
			const rec = (service as any).recognition;

			service.stop();
			rec.start.mockClear();

			rec.onend();

			expect(rec.start).not.toHaveBeenCalled();
			expect(service.isListening).toBe(false);
		});
	});

	describe('onerror', () => {
		it('stops restart permanently for not-allowed', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onerror({ error: 'not-allowed' });
			expect(service.error).toBe('not-allowed');

			rec.start.mockClear();
			rec.onend();
			expect(rec.start).not.toHaveBeenCalled();
		});

		it('ignores aborted errors', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onerror({ error: 'aborted' });
			expect(service.error).toBeNull();
		});

		it('sets error state for other errors but allows restart', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onerror({ error: 'network' });
			expect(service.error).toBe('network');

			rec.start.mockClear();
			rec.onend();
			expect(rec.start).toHaveBeenCalled();
		});
	});
});
