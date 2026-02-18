import { canUseWhisperWeb, downloadWhisperModel } from '@remotion/whisper-web';
import type { WhisperModel, ModelStatus } from './types';

export interface WhisperManagerCallbacks {
	onStatusChange: (status: ModelStatus) => void;
	onProgress: (progress: number) => void;
	onError: (error: string) => void;
}

export class WhisperManager {
	async checkSupport(model: WhisperModel): Promise<boolean> {
		const result = await canUseWhisperWeb(model);
		return result.supported;
	}

	async downloadModel(model: WhisperModel, callbacks: WhisperManagerCallbacks): Promise<boolean> {
		try {
			callbacks.onStatusChange('checking');

			const support = await canUseWhisperWeb(model);
			if (!support.supported) {
				callbacks.onStatusChange('unsupported');
				callbacks.onError('WebGPU is not supported in this browser');
				return false;
			}

			callbacks.onStatusChange('downloading');

			await downloadWhisperModel({
				model,
				onProgress: ({ progress }) => {
					callbacks.onProgress(progress);
				}
			});

			callbacks.onStatusChange('ready');
			return true;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			callbacks.onStatusChange('error');
			callbacks.onError(message);
			return false;
		}
	}
}

export const whisperManager = new WhisperManager();
