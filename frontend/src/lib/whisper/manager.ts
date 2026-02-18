import type { ModelStatus, HealthResponse, ServerInfo } from './types';

export interface HealthCheckCallbacks {
	onStatusChange: (status: ModelStatus) => void;
	onServerInfo: (info: ServerInfo) => void;
	onError: (error: string) => void;
}

export class WhisperManager {
	async checkHealth(serverUrl: string, callbacks: HealthCheckCallbacks): Promise<boolean> {
		try {
			callbacks.onStatusChange('checking');

			const response = await fetch(`${serverUrl}/health`);
			if (!response.ok) {
				callbacks.onStatusChange('server_offline');
				callbacks.onError(`Server returned ${response.status}`);
				return false;
			}

			const data: HealthResponse = await response.json();

			callbacks.onServerInfo({
				backend: data.backend,
				device: data.device,
				model: data.model
			});

			callbacks.onStatusChange('ready');
			return true;
		} catch {
			callbacks.onStatusChange('server_offline');
			callbacks.onError('Cannot reach server');
			return false;
		}
	}
}

export const whisperManager = new WhisperManager();
