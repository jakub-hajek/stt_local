<script lang="ts">
	import { appState } from '$lib/state/app.svelte';
	import type { WaveformData } from '$lib/audio/types';
	import { onMount } from 'svelte';

	interface Props {
		getWaveformData: () => WaveformData;
	}

	let { getWaveformData }: Props = $props();

	let canvas: HTMLCanvasElement;
	let animationId: number | null = null;

	function draw() {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const data = getWaveformData();
		const width = canvas.width;
		const height = canvas.height;

		ctx.clearRect(0, 0, width, height);

		if (data.length === 0 || !appState.isRecording) {
			ctx.strokeStyle = 'var(--surface1)';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(0, height / 2);
			ctx.lineTo(width, height / 2);
			ctx.stroke();
			return;
		}

		const barWidth = width / data.length;
		const gradient = ctx.createLinearGradient(0, 0, width, 0);
		gradient.addColorStop(0, '#89b4fa');
		gradient.addColorStop(1, '#cba6f7');

		for (let i = 0; i < data.length; i++) {
			const barHeight = (data[i] / 255) * height;
			const x = i * barWidth;
			const y = (height - barHeight) / 2;
			ctx.fillStyle = gradient;
			ctx.fillRect(x, y, barWidth - 1, barHeight);
		}

		animationId = requestAnimationFrame(draw);
	}

	$effect(() => {
		if (appState.isRecording) {
			animationId = requestAnimationFrame(draw);
		} else {
			if (animationId !== null) {
				cancelAnimationFrame(animationId);
				animationId = null;
			}
			draw();
		}
	});

	onMount(() => {
		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width || 300;
		canvas.height = rect.height || 60;
		draw();

		return () => {
			if (animationId !== null) cancelAnimationFrame(animationId);
		};
	});
</script>

<div class="waveform-container">
	<canvas bind:this={canvas} class="waveform-canvas" aria-label="Audio waveform"></canvas>
</div>

<style>
	.waveform-container {
		width: 100%;
		height: 60px;
		background: var(--mantle);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.waveform-canvas {
		width: 100%;
		height: 100%;
		display: block;
	}
</style>
