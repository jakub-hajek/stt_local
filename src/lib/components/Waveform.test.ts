import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import Waveform from './Waveform.svelte';
import { appState } from '../state/app.svelte';
import * as captureModule from '$lib/audio/capture';

describe('Waveform', () => {
	beforeEach(() => {
		if (appState.isRecording) appState.toggleRecording();
		vi.clearAllMocks();
	});

	it('renders canvas element', () => {
		render(Waveform);

		const canvas = screen.getByLabelText('Audio waveform');
		expect(canvas).toBeInTheDocument();
		expect(canvas.tagName).toBe('CANVAS');
	});

	it('canvas has proper aria-label', () => {
		render(Waveform);

		expect(screen.getByLabelText('Audio waveform')).toBeInTheDocument();
	});

	it('draws idle line when not recording', () => {
		render(Waveform);

		const ctx = HTMLCanvasElement.prototype.getContext('2d');
		// Draw is called on mount, should draw idle line
		expect(ctx.beginPath).toHaveBeenCalled();
	});

	it('starts animation when recording begins', async () => {
		// Mock getWaveformData to return data
		const mockData = new Uint8Array(128);
		mockData.fill(100);
		vi.spyOn(captureModule.audioCapture, 'getWaveformData').mockReturnValue(mockData);

		render(Waveform);

		appState.toggleRecording();
		await tick();

		// requestAnimationFrame should be called
		const ctx = HTMLCanvasElement.prototype.getContext('2d');
		expect(ctx.clearRect).toHaveBeenCalled();
	});

	it('stops animation when recording stops', async () => {
		render(Waveform);

		appState.toggleRecording();
		await tick();

		appState.toggleRecording();
		await tick();

		// Should have drawn idle line after stopping
		const ctx = HTMLCanvasElement.prototype.getContext('2d');
		expect(ctx.beginPath).toHaveBeenCalled();
	});

	it('draws frequency bars when recording with data', async () => {
		const mockData = new Uint8Array(128);
		mockData.fill(200);
		vi.spyOn(captureModule.audioCapture, 'getWaveformData').mockReturnValue(mockData);

		appState.toggleRecording();
		render(Waveform);
		await tick();

		// Wait for requestAnimationFrame to fire
		await new Promise((r) => setTimeout(r, 50));

		const ctx = HTMLCanvasElement.prototype.getContext('2d');
		expect(ctx.fillRect).toHaveBeenCalled();
	});

	it('handles empty waveform data while recording', async () => {
		vi.spyOn(captureModule.audioCapture, 'getWaveformData').mockReturnValue(new Uint8Array(0));

		render(Waveform);

		appState.toggleRecording();
		await tick();

		// Should still draw idle line for empty data
		const ctx = HTMLCanvasElement.prototype.getContext('2d');
		expect(ctx.beginPath).toHaveBeenCalled();
	});
});
