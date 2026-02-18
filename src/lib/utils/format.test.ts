import { describe, it, expect } from 'vitest';
import { formatTimestamp, cleanText, formatDuration } from './format';

describe('formatTimestamp', () => {
	it('formats 0ms as 00:00', () => {
		expect(formatTimestamp(0)).toBe('00:00');
	});

	it('formats seconds correctly', () => {
		expect(formatTimestamp(5000)).toBe('00:05');
		expect(formatTimestamp(59000)).toBe('00:59');
	});

	it('formats minutes and seconds', () => {
		expect(formatTimestamp(60000)).toBe('01:00');
		expect(formatTimestamp(90000)).toBe('01:30');
		expect(formatTimestamp(605000)).toBe('10:05');
	});

	it('formats with hours when >= 1 hour', () => {
		expect(formatTimestamp(3600000)).toBe('01:00:00');
		expect(formatTimestamp(3661000)).toBe('01:01:01');
		expect(formatTimestamp(36000000)).toBe('10:00:00');
	});

	it('treats negative values as 0', () => {
		expect(formatTimestamp(-1000)).toBe('00:00');
		expect(formatTimestamp(-999999)).toBe('00:00');
	});

	it('handles large values', () => {
		expect(formatTimestamp(86400000)).toBe('24:00:00');
	});

	it('truncates partial seconds', () => {
		expect(formatTimestamp(1500)).toBe('00:01');
		expect(formatTimestamp(999)).toBe('00:00');
	});
});

describe('cleanText', () => {
	it('returns empty string for empty input', () => {
		expect(cleanText('')).toBe('');
	});

	it('returns empty string for null/undefined-like input', () => {
		expect(cleanText(null as unknown as string)).toBe('');
		expect(cleanText(undefined as unknown as string)).toBe('');
	});

	it('trims whitespace', () => {
		expect(cleanText('  hello  ')).toBe('hello');
	});

	it('collapses multiple spaces', () => {
		expect(cleanText('hello   world')).toBe('hello world');
	});

	it('collapses tabs and newlines', () => {
		expect(cleanText('hello\t\n  world')).toBe('hello world');
	});

	it('removes leading punctuation artifacts', () => {
		expect(cleanText('. Hello world')).toBe('Hello world');
		expect(cleanText('...Hello')).toBe('Hello');
		expect(cleanText(', test')).toBe('test');
	});

	it('removes trailing punctuation artifacts', () => {
		expect(cleanText('Hello world...')).toBe('Hello world');
		expect(cleanText('test,')).toBe('test');
	});

	it('removes both leading and trailing punctuation', () => {
		expect(cleanText('...Hello world...')).toBe('Hello world');
	});

	it('handles string with only whitespace', () => {
		expect(cleanText('   ')).toBe('');
	});

	it('handles string with only punctuation', () => {
		expect(cleanText('...')).toBe('');
	});
});

describe('formatDuration', () => {
	it('formats 0ms as 0s', () => {
		expect(formatDuration(0)).toBe('0s');
	});

	it('formats sub-second as 0s', () => {
		expect(formatDuration(500)).toBe('0s');
		expect(formatDuration(999)).toBe('0s');
	});

	it('formats seconds', () => {
		expect(formatDuration(1000)).toBe('1s');
		expect(formatDuration(5000)).toBe('5s');
		expect(formatDuration(59000)).toBe('59s');
	});

	it('formats minutes and seconds', () => {
		expect(formatDuration(60000)).toBe('1m');
		expect(formatDuration(90000)).toBe('1m 30s');
		expect(formatDuration(61000)).toBe('1m 1s');
	});

	it('formats hours, minutes, seconds', () => {
		expect(formatDuration(3600000)).toBe('1h');
		expect(formatDuration(3720000)).toBe('1h 2m');
		expect(formatDuration(3661000)).toBe('1h 1m 1s');
	});

	it('treats negative values as 0', () => {
		expect(formatDuration(-5000)).toBe('0s');
	});

	it('handles large values', () => {
		expect(formatDuration(86400000)).toBe('24h');
	});
});
