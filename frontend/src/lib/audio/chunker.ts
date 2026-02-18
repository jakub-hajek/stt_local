export interface ChunkerOptions {
	silenceThreshold?: number;
	minChunkDuration?: number;
}

/**
 * Calculate RMS (Root Mean Square) of audio samples
 */
export function calculateRMS(samples: Float32Array): number {
	if (samples.length === 0) return 0;
	let sum = 0;
	for (let i = 0; i < samples.length; i++) {
		sum += samples[i] * samples[i];
	}
	return Math.sqrt(sum / samples.length);
}

/**
 * Detect if audio chunk is silence based on RMS
 */
export function isSilent(samples: Float32Array, threshold = 0.01): boolean {
	return calculateRMS(samples) < threshold;
}

/**
 * Find the best split point in audio samples near silence
 * Returns the sample index to split at, or -1 if no good split found
 */
export function findSilenceSplitPoint(
	samples: Float32Array,
	windowSize = 1600,
	threshold = 0.01
): number {
	for (let i = samples.length - windowSize; i >= samples.length / 2; i -= windowSize) {
		const window = samples.slice(i, i + windowSize);
		if (isSilent(window, threshold)) {
			return i;
		}
	}
	return -1;
}
