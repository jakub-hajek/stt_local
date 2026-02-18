import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioCapture } from './capture';

describe('AudioCapture', () => {
	let capture: AudioCapture;

	beforeEach(() => {
		capture = new AudioCapture();
		vi.clearAllMocks();
	});

	describe('start()', () => {
		it('calls getUserMedia and creates recorder', async () => {
			await capture.start();

			expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
			expect(capture.isRecording).toBe(true);
		});

		it('uses custom options', async () => {
			await capture.start({ timeslice: 3000, mimeType: 'audio/webm' });

			expect(capture.isRecording).toBe(true);
		});

		it('throws if getUserMedia fails', async () => {
			vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValueOnce(
				new Error('Permission denied')
			);

			await expect(capture.start()).rejects.toThrow('Permission denied');
			expect(capture.isRecording).toBe(false);
		});
	});

	describe('stop()', () => {
		it('cleans up all resources', async () => {
			await capture.start();
			capture.stop();

			expect(capture.isRecording).toBe(false);
		});

		it('does not throw if called before start', () => {
			expect(() => capture.stop()).not.toThrow();
		});
	});

	describe('isRecording', () => {
		it('returns false initially', () => {
			expect(capture.isRecording).toBe(false);
		});

		it('returns true after start', async () => {
			await capture.start();
			expect(capture.isRecording).toBe(true);
		});

		it('returns false after stop', async () => {
			await capture.start();
			capture.stop();
			expect(capture.isRecording).toBe(false);
		});
	});

	describe('onChunk()', () => {
		it('registers callback and returns unsubscribe function', () => {
			const cb = vi.fn();
			const unsubscribe = capture.onChunk(cb);

			expect(typeof unsubscribe).toBe('function');
		});

		it('calls callback when recorder stops with collected data', async () => {
			const cb = vi.fn();
			capture.onChunk(cb);
			await capture.start();

			// Simulate the stop/restart cycle: ondataavailable collects, onstop emits
			const recorder = (capture as any).recorder;
			recorder.ondataavailable({ data: new Blob(['audio'], { type: 'audio/webm' }) });
			recorder.onstop();

			expect(cb).toHaveBeenCalledOnce();
			expect(cb.mock.calls[0][0]).toMatchObject({
				blob: expect.any(Blob),
				timestamp: expect.any(Number),
				duration: 5000
			});
			capture.stop();
		});

		it('does not call callback for empty blobs', async () => {
			const cb = vi.fn();
			capture.onChunk(cb);
			await capture.start();

			const recorder = (capture as any).recorder;
			recorder.ondataavailable({ data: new Blob([], { type: 'audio/webm' }) });
			recorder.onstop();

			expect(cb).not.toHaveBeenCalled();
			capture.stop();
		});

		it('unsubscribe removes the callback', async () => {
			const cb = vi.fn();
			const unsubscribe = capture.onChunk(cb);
			unsubscribe();

			await capture.start();
			const recorder = (capture as any).recorder;
			recorder.ondataavailable({ data: new Blob(['audio'], { type: 'audio/webm' }) });
			recorder.onstop();

			expect(cb).not.toHaveBeenCalled();
			capture.stop();
		});
	});

	describe('getWaveformData()', () => {
		it('returns empty Uint8Array when no analyser', () => {
			const data = capture.getWaveformData();
			expect(data).toBeInstanceOf(Uint8Array);
			expect(data.length).toBe(0);
		});

		it('returns waveform data when analyser exists', async () => {
			await capture.start();
			const data = capture.getWaveformData();

			expect(data).toBeInstanceOf(Uint8Array);
			expect(data.length).toBe(128); // frequencyBinCount from mock
			// Mock fills with 128
			expect(data[0]).toBe(128);
		});

		it('returns empty array after stop', async () => {
			await capture.start();
			capture.stop();
			const data = capture.getWaveformData();
			expect(data.length).toBe(0);
		});
	});
});
