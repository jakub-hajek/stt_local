import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canUseWhisperWeb, downloadWhisperModel } from '@remotion/whisper-web';
import { WhisperManager } from './manager';
import type { WhisperManagerCallbacks } from './manager';

const mockCanUse = vi.mocked(canUseWhisperWeb);
const mockDownload = vi.mocked(downloadWhisperModel);

describe('WhisperManager', () => {
	let manager: WhisperManager;
	let callbacks: WhisperManagerCallbacks;

	beforeEach(() => {
		vi.clearAllMocks();
		manager = new WhisperManager();
		callbacks = {
			onStatusChange: vi.fn(),
			onProgress: vi.fn(),
			onError: vi.fn()
		};
	});

	describe('checkSupport', () => {
		it('returns true when supported', async () => {
			mockCanUse.mockResolvedValue({ supported: true } as any);
			const result = await manager.checkSupport('tiny');
			expect(result).toBe(true);
			expect(mockCanUse).toHaveBeenCalledWith('tiny');
		});

		it('returns false when not supported', async () => {
			mockCanUse.mockResolvedValue({ supported: false } as any);
			const result = await manager.checkSupport('base');
			expect(result).toBe(false);
		});
	});

	describe('downloadModel', () => {
		it('calls callbacks in correct order on success', async () => {
			mockCanUse.mockResolvedValue({ supported: true } as any);
			mockDownload.mockResolvedValue({ alreadyDownloaded: false } as any);

			const result = await manager.downloadModel('tiny', callbacks);

			expect(result).toBe(true);
			expect(callbacks.onStatusChange).toHaveBeenCalledTimes(3);
			expect(callbacks.onStatusChange).toHaveBeenNthCalledWith(1, 'checking');
			expect(callbacks.onStatusChange).toHaveBeenNthCalledWith(2, 'downloading');
			expect(callbacks.onStatusChange).toHaveBeenNthCalledWith(3, 'ready');
		});

		it('handles unsupported case', async () => {
			mockCanUse.mockResolvedValue({ supported: false } as any);

			const result = await manager.downloadModel('tiny', callbacks);

			expect(result).toBe(false);
			expect(callbacks.onStatusChange).toHaveBeenCalledWith('checking');
			expect(callbacks.onStatusChange).toHaveBeenCalledWith('unsupported');
			expect(callbacks.onError).toHaveBeenCalledWith('WebGPU is not supported in this browser');
		});

		it('handles errors', async () => {
			mockCanUse.mockRejectedValue(new Error('Network error'));

			const result = await manager.downloadModel('tiny', callbacks);

			expect(result).toBe(false);
			expect(callbacks.onStatusChange).toHaveBeenCalledWith('error');
			expect(callbacks.onError).toHaveBeenCalledWith('Network error');
		});

		it('forwards progress callback', async () => {
			mockCanUse.mockResolvedValue({ supported: true } as any);
			mockDownload.mockImplementation(async ({ onProgress }: any) => {
				onProgress?.({ downloadedBytes: 500, totalBytes: 1000, progress: 0.5 });
				onProgress?.({ downloadedBytes: 1000, totalBytes: 1000, progress: 1.0 });
				return { alreadyDownloaded: false };
			});

			await manager.downloadModel('tiny', callbacks);

			expect(callbacks.onProgress).toHaveBeenCalledWith(0.5);
			expect(callbacks.onProgress).toHaveBeenCalledWith(1.0);
		});
	});
});
