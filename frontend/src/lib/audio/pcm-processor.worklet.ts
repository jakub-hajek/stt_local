declare abstract class AudioWorkletProcessor {
	readonly port: MessagePort;
	abstract process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean;
}
declare function registerProcessor(name: string, ctor: new () => AudioWorkletProcessor): void;

/**
 * AudioWorkletProcessor that collects PCM samples and posts them
 * to the main thread in fixed-size buffers.
 *
 * Runs inside an AudioWorklet context at 16 kHz sample rate
 * (set by the AudioContext that loads this processor).
 */
class PcmProcessor extends AudioWorkletProcessor {
	private buffer: Float32Array;
	private offset = 0;

	/** ~100ms at 16 kHz = 1600 samples */
	private readonly BUFFER_SIZE = 1600;

	constructor() {
		super();
		this.buffer = new Float32Array(this.BUFFER_SIZE);
	}

	process(inputs: Float32Array[][]): boolean {
		const input = inputs[0];
		if (!input || input.length === 0) return true;

		const channel = input[0];
		if (!channel) return true;

		let i = 0;
		while (i < channel.length) {
			const remaining = this.BUFFER_SIZE - this.offset;
			const toCopy = Math.min(remaining, channel.length - i);

			this.buffer.set(channel.subarray(i, i + toCopy), this.offset);
			this.offset += toCopy;
			i += toCopy;

			if (this.offset >= this.BUFFER_SIZE) {
				this.port.postMessage(this.buffer.slice());
				this.offset = 0;
			}
		}

		return true;
	}
}

registerProcessor('pcm-processor', PcmProcessor);
