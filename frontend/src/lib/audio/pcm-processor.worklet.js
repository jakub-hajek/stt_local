/**
 * AudioWorkletProcessor that collects PCM samples and posts them
 * to the main thread in fixed-size buffers.
 *
 * Runs inside an AudioWorklet context at 16 kHz sample rate
 * (set by the AudioContext that loads this processor).
 */
class PcmProcessor extends AudioWorkletProcessor {
	/** @type {Float32Array} */
	buffer;
	offset = 0;

	/** ~100ms at 16 kHz = 1600 samples */
	BUFFER_SIZE = 1600;

	constructor() {
		super();
		this.buffer = new Float32Array(this.BUFFER_SIZE);
	}

	process(inputs) {
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
