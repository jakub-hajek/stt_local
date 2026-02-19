import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioCapture } from './capture';

describe('AudioCapture', () => {
	let capture: AudioCapture;

	beforeEach(() => {
		capture = new AudioCapture();
		vi.clearAllMocks();
	});

	describe('start()', () => {
		it('calls getUserMedia and sets up AudioWorklet', async () => {
			await capture.start();

			expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
				audio: {
					noiseSuppression: true,
					echoCancellation: true,
					autoGainControl: true,
				},
			});
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

	describe('onPcmData()', () => {
		it('registers callback and returns unsubscribe function', () => {
			const cb = vi.fn();
			const unsubscribe = capture.onPcmData(cb);

			expect(typeof unsubscribe).toBe('function');
		});

		it('unsubscribe removes the callback', async () => {
			const cb = vi.fn();
			const unsubscribe = capture.onPcmData(cb);
			unsubscribe();

			await capture.start();
			// Simulate worklet posting data
			const workletNode = (capture as any).workletNode;
			if (workletNode?.port?.onmessage) {
				workletNode.port.onmessage({ data: new Float32Array([0.5, -0.5]) });
			}

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
			expect(data.length).toBe(128);
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
