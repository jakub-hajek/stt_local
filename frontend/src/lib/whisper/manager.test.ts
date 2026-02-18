import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhisperManager } from './manager';
import type { HealthCheckCallbacks } from './manager';

describe('WhisperManager', () => {
	let manager: WhisperManager;
	let callbacks: HealthCheckCallbacks;

	beforeEach(() => {
		vi.clearAllMocks();
		manager = new WhisperManager();
		callbacks = {
			onStatusChange: vi.fn(),
			onServerInfo: vi.fn(),
			onError: vi.fn()
		};
	});

	describe('checkHealth', () => {
		it('returns true and fires callbacks on success', async () => {
			vi.mocked(globalThis.fetch).mockResolvedValueOnce({
				ok: true,
				json: () =>
					Promise.resolve({
						status: 'ok',
						backend: 'mlx-whisper',
						device: 'mps',
						model: 'large-v3-turbo',
						version: '0.1.0'
					})
			} as any);

			const result = await manager.checkHealth('http://localhost:8765', callbacks);

			expect(result).toBe(true);
			expect(callbacks.onStatusChange).toHaveBeenCalledWith('checking');
			expect(callbacks.onStatusChange).toHaveBeenCalledWith('ready');
			expect(callbacks.onServerInfo).toHaveBeenCalledWith({
				backend: 'mlx-whisper',
				device: 'mps',
				model: 'large-v3-turbo'
			});
		});

		it('returns false when server returns error status', async () => {
			vi.mocked(globalThis.fetch).mockResolvedValueOnce({
				ok: false,
				status: 500
			} as any);

			const result = await manager.checkHealth('http://localhost:8765', callbacks);

			expect(result).toBe(false);
			expect(callbacks.onStatusChange).toHaveBeenCalledWith('server_offline');
			expect(callbacks.onError).toHaveBeenCalledWith('Server returned 500');
		});

		it('returns false when fetch fails (network error)', async () => {
			vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error('Network error'));

			const result = await manager.checkHealth('http://localhost:8765', callbacks);

			expect(result).toBe(false);
			expect(callbacks.onStatusChange).toHaveBeenCalledWith('server_offline');
			expect(callbacks.onError).toHaveBeenCalledWith('Cannot reach server');
		});
	});
});
