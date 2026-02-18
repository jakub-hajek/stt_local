import { resampleTo16Khz, transcribe, toCaptions } from '@remotion/whisper-web';
import type { TranscriptionJob, TranscriptionResult } from './types';

type ResultCallback = (result: TranscriptionResult) => void;

export class Transcriber {
	private queue: TranscriptionJob[] = [];
	private processing = false;
	private callbacks: ResultCallback[] = [];

	get queueLength(): number {
		return this.queue.length;
	}

	get isProcessing(): boolean {
		return this.processing;
	}

	enqueue(job: TranscriptionJob): void {
		this.queue.push(job);
		this.processNext();
	}

	onResult(cb: ResultCallback): () => void {
		this.callbacks.push(cb);
		return () => {
			this.callbacks = this.callbacks.filter((c) => c !== cb);
		};
	}

	clear(): void {
		this.queue = [];
	}

	private async processNext(): Promise<void> {
		if (this.processing || this.queue.length === 0) return;
		this.processing = true;

		const job = this.queue.shift()!;
		try {
			const file = new File([job.blob], 'audio.webm', { type: job.blob.type });

			const channelWaveform = await resampleTo16Khz({ file });

			const whisperOutput = await transcribe({
				channelWaveform,
				model: job.model,
				language: job.language === 'auto' ? undefined : job.language
			});

			const { captions } = toCaptions({ whisperWebOutput: whisperOutput });

			const text = whisperOutput.transcription
				.map((t: any) => t.text)
				.join(' ')
				.trim();

			const result: TranscriptionResult = {
				text,
				captions,
				timestamp: Date.now()
			};

			this.callbacks.forEach((cb) => cb(result));
		} catch (error) {
			console.error('Transcription error:', error);
		} finally {
			this.processing = false;
			if (this.queue.length > 0) {
				this.processNext();
			}
		}
	}
}

export const transcriber = new Transcriber();
