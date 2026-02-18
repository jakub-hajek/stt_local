export function formatTimestamp(ms: number): string {
	if (ms < 0) ms = 0;

	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	const mm = String(minutes).padStart(2, '0');
	const ss = String(seconds).padStart(2, '0');

	if (hours > 0) {
		const hh = String(hours).padStart(2, '0');
		return `${hh}:${mm}:${ss}`;
	}

	return `${mm}:${ss}`;
}

export function cleanText(text: string): string {
	if (!text) return '';

	let result = text.trim();
	result = result.replace(/\s+/g, ' ');
	result = result.replace(/^[.,;:!?\-–—]+\s*/, '');
	result = result.replace(/\s*[.,;:!?\-–—]+$/, '');

	return result.trim();
}

export function formatDuration(ms: number): string {
	if (ms < 0) ms = 0;
	if (ms < 1000) return '0s';

	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	const parts: string[] = [];
	if (hours > 0) parts.push(`${hours}h`);
	if (minutes > 0) parts.push(`${minutes}m`);
	if (seconds > 0) parts.push(`${seconds}s`);

	return parts.join(' ') || '0s';
}
