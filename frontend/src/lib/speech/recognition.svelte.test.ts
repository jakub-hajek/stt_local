import { describe, it, expect, beforeEach, vi } from 'vitest';
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
		vi.clearAllMocks();
		onFinal = vi.fn();
		service = new SpeechRecognitionService(onFinal);
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

			// First event: result[0] is final
			rec.onresult(makeResultEvent([
				{ transcript: 'first', isFinal: true },
			]));
			expect(onFinal).toHaveBeenCalledTimes(1);

			// Second event: result[0] still final, result[1] is new final
			rec.onresult(makeResultEvent([
				{ transcript: 'first', isFinal: true },
				{ transcript: 'second', isFinal: true },
			]));
			// Should only emit 'second', not 'first' again
			expect(onFinal).toHaveBeenCalledTimes(2);
			expect(onFinal).toHaveBeenLastCalledWith('second');
		});

		it('catches finals that Chrome finalizes silently', () => {
			service.start('en');
			const rec = (service as any).recognition;

			// First event: result[0] is interim
			rec.onresult(makeResultEvent([
				{ transcript: 'hello', isFinal: false },
			]));
			expect(onFinal).not.toHaveBeenCalled();

			// Second event: result[0] finalized, result[1] started as interim
			// Chrome may set resultIndex=1 here, but we scan from 0
			rec.onresult(makeResultEvent(
				[
					{ transcript: 'hello world', isFinal: true },
					{ transcript: 'next', isFinal: false },
				],
				1 // resultIndex=1, but result[0] was just finalized
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

			// Simulate interim text that was never finalized
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

	describe('onerror', () => {
		it('stops permanently for not-allowed', () => {
			service.start('en');
			const rec = (service as any).recognition;
			rec.onerror({ error: 'not-allowed' });
			rec.start.mockClear();

			rec.onend();
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
