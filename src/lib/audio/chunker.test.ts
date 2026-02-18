import { describe, it, expect } from 'vitest';
import { calculateRMS, isSilent, findSilenceSplitPoint } from './chunker';

describe('calculateRMS', () => {
	it('returns 0 for empty array', () => {
		expect(calculateRMS(new Float32Array(0))).toBe(0);
	});

	it('returns 0 for all-zero samples', () => {
		expect(calculateRMS(new Float32Array(100))).toBe(0);
	});

	it('returns correct value for known samples', () => {
		// All values = 0.5 → RMS = 0.5
		const samples = new Float32Array(4).fill(0.5);
		expect(calculateRMS(samples)).toBeCloseTo(0.5, 5);
	});

	it('returns correct RMS for mixed values', () => {
		// [1, -1, 1, -1] → RMS = sqrt((1+1+1+1)/4) = 1
		const samples = new Float32Array([1, -1, 1, -1]);
		expect(calculateRMS(samples)).toBeCloseTo(1.0, 5);
	});
});

describe('isSilent', () => {
	it('returns true for quiet audio (zeros)', () => {
		const silence = new Float32Array(100);
		expect(isSilent(silence)).toBe(true);
	});

	it('returns true for very quiet audio below threshold', () => {
		const quiet = new Float32Array(100).fill(0.001);
		expect(isSilent(quiet, 0.01)).toBe(true);
	});

	it('returns false for loud audio', () => {
		const loud = new Float32Array(100).fill(0.5);
		expect(isSilent(loud, 0.01)).toBe(false);
	});

	it('uses default threshold of 0.01', () => {
		const belowThreshold = new Float32Array(100).fill(0.005);
		expect(isSilent(belowThreshold)).toBe(true);

		const aboveThreshold = new Float32Array(100).fill(0.05);
		expect(isSilent(aboveThreshold)).toBe(false);
	});
});

describe('findSilenceSplitPoint', () => {
	it('finds split point in audio with silence in second half', () => {
		// Create audio: first half loud, second half has a silent window
		// The function scans from (length - windowSize) backwards by windowSize steps
		// For length=8000, windowSize=1600: checks 6400, 4800
		const length = 8000;
		const windowSize = 1600;
		const samples = new Float32Array(length);
		// Fill with loud audio
		for (let i = 0; i < length; i++) {
			samples[i] = 0.5;
		}
		// Insert silence at a window-aligned position (6400)
		const silenceStart = length - windowSize; // 6400
		for (let i = silenceStart; i < silenceStart + windowSize; i++) {
			samples[i] = 0;
		}

		const splitPoint = findSilenceSplitPoint(samples, windowSize, 0.01);
		expect(splitPoint).toBeGreaterThanOrEqual(length / 2);
		expect(splitPoint).toBe(silenceStart);
	});

	it('returns -1 when no silence found', () => {
		const loud = new Float32Array(8000).fill(0.5);
		const splitPoint = findSilenceSplitPoint(loud, 1600, 0.01);
		expect(splitPoint).toBe(-1);
	});

	it('returns -1 when silence is only in the first half', () => {
		const samples = new Float32Array(8000).fill(0.5);
		// Silence only in first quarter
		for (let i = 0; i < 1600; i++) {
			samples[i] = 0;
		}

		const splitPoint = findSilenceSplitPoint(samples, 1600, 0.01);
		expect(splitPoint).toBe(-1);
	});
});
