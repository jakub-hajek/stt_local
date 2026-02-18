import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resampleTo16Khz, transcribe, toCaptions } from '@remotion/whisper-web';
import { Transcriber } from './transcriber';

const mockResample = vi.mocked(resampleTo16Khz);
const mockTranscribe = vi.mocked(transcribe);
const mockToCaptions = vi.mocked(toCaptions);

function createJob(language: 'cs' | 'en' | 'auto' = 'en') {
	return {
		blob: new Blob(['audio'], { type: 'audio/webm' }),
		language,
		model: 'tiny' as const
	};
}

async function flushPromises() {
	await new Promise((r) => setTimeout(r, 0));
}

describe('Transcriber', () => {
	let transcriber: Transcriber;

	beforeEach(() => {
		vi.clearAllMocks();
		transcriber = new Transcriber();
	});

	it('enqueue adds to queue and starts processing', async () => {
		const cb = vi.fn();
		transcriber.onResult(cb);
		transcriber.enqueue(createJob());

		await flushPromises();

		expect(cb).toHaveBeenCalledTimes(1);
		expect(cb).toHaveBeenCalledWith(
			expect.objectContaining({
				text: 'Hello world',
				captions: expect.arrayContaining([
					expect.objectContaining({ text: 'Hello world', startMs: 0, endMs: 2000 })
				])
			})
		);
	});

	it('onResult callback is called with result', async () => {
		const cb = vi.fn();
		transcriber.onResult(cb);
		transcriber.enqueue(createJob());

		await flushPromises();

		expect(cb).toHaveBeenCalledTimes(1);
		const result = cb.mock.calls[0][0];
		expect(result.text).toBe('Hello world');
		expect(result.timestamp).toBeGreaterThan(0);
	});

	it('onResult returns unsubscribe function', async () => {
		const cb = vi.fn();
		const unsub = transcriber.onResult(cb);

		unsub();
		transcriber.enqueue(createJob());
		await flushPromises();

		expect(cb).not.toHaveBeenCalled();
	});

	it('clear empties the queue', () => {
		// Mock resample to hang so items stay in queue
		mockResample.mockImplementation(() => new Promise(() => {}));

		transcriber.enqueue(createJob());
		transcriber.enqueue(createJob());
		transcriber.enqueue(createJob());

		// First job is being processed, 2 remain in queue
		expect(transcriber.queueLength).toBe(2);

		transcriber.clear();
		expect(transcriber.queueLength).toBe(0);
	});

	it('queueLength and isProcessing reflect state', async () => {
		expect(transcriber.queueLength).toBe(0);
		expect(transcriber.isProcessing).toBe(false);

		let resolveResample: (v: any) => void;
		mockResample.mockImplementation(
			() => new Promise((r) => (resolveResample = r))
		);

		transcriber.enqueue(createJob());

		expect(transcriber.isProcessing).toBe(true);

		resolveResample!(new Float32Array(16000));
		await flushPromises();

		expect(transcriber.isProcessing).toBe(false);
		expect(transcriber.queueLength).toBe(0);
	});

	it('processes jobs sequentially', async () => {
		let callOrder: number[] = [];
		let resolvers: ((v: any) => void)[] = [];

		mockResample.mockImplementation(() => {
			return new Promise((r) => resolvers.push(r));
		});

		const cb = vi.fn(() => callOrder.push(callOrder.length));

		transcriber.onResult(cb);
		transcriber.enqueue(createJob());
		transcriber.enqueue(createJob());

		// Only first job is processing
		expect(transcriber.isProcessing).toBe(true);
		expect(resolvers.length).toBe(1);

		// Resolve first job
		resolvers[0](new Float32Array(16000));
		await flushPromises();

		expect(cb).toHaveBeenCalledTimes(1);

		// Second job now processing
		expect(resolvers.length).toBe(2);
		resolvers[1](new Float32Array(16000));
		await flushPromises();

		expect(cb).toHaveBeenCalledTimes(2);
	});

	it('error handling does not crash the queue', async () => {
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		mockResample.mockRejectedValueOnce(new Error('Resample failed'));
		mockResample.mockResolvedValueOnce(new Float32Array(16000));

		const cb = vi.fn();
		transcriber.onResult(cb);

		transcriber.enqueue(createJob());
		transcriber.enqueue(createJob());

		await flushPromises();
		await flushPromises();

		expect(consoleSpy).toHaveBeenCalled();
		expect(cb).toHaveBeenCalledTimes(1);

		consoleSpy.mockRestore();
	});

	it('passes language as undefined for auto', async () => {
		mockResample.mockResolvedValue(new Float32Array(16000));
		mockTranscribe.mockResolvedValue({
			transcription: [{ text: 'Hello world', timestamps: { from: '00:00:00', to: '00:00:02' } }]
		} as any);
		mockToCaptions.mockReturnValue({
			captions: [{ text: 'Hello world', startMs: 0, endMs: 2000, timestampMs: 1000, confidence: 0.95 }]
		} as any);

		transcriber.enqueue(createJob('auto'));
		await flushPromises();

		expect(mockTranscribe).toHaveBeenCalledWith(
			expect.objectContaining({ language: undefined })
		);
	});

	it('passes explicit language', async () => {
		mockResample.mockResolvedValue(new Float32Array(16000));
		mockTranscribe.mockResolvedValue({
			transcription: [{ text: 'Hello world', timestamps: { from: '00:00:00', to: '00:00:02' } }]
		} as any);
		mockToCaptions.mockReturnValue({
			captions: [{ text: 'Hello world', startMs: 0, endMs: 2000, timestampMs: 1000, confidence: 0.95 }]
		} as any);

		transcriber.enqueue(createJob('cs'));
		await flushPromises();

		expect(mockTranscribe).toHaveBeenCalledWith(
			expect.objectContaining({ language: 'cs' })
		);
	});
});
