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

		it('only processes from resultIndex', () => {
			service.start('en');
			const rec = (service as any).recognition;

			// First result is old final, second is new final — resultIndex=1
			rec.onresult(makeResultEvent(
				[
					{ transcript: 'old', isFinal: true },
					{ transcript: 'new', isFinal: true },
				],
				1
			));

			// Should only emit 'new', not 'old'
			expect(onFinal).toHaveBeenCalledTimes(1);
			expect(onFinal).toHaveBeenCalledWith('new');
		});

		it('concatenates multiple finals in one event', () => {
			service.start('en');
			const rec = (service as any).recognition;

			rec.onresult(makeResultEvent([
				{ transcript: 'hello ', isFinal: true },
				{ transcript: 'world', isFinal: true },
			]));

			expect(onFinal).toHaveBeenCalledWith('hello world');
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

		it('sets error for other errors', () => {
			service.start('en');
			const rec = (service as any).recognition;
			rec.onerror({ error: 'network' });
			expect(service.error).toBe('network');
		});
	});
});
