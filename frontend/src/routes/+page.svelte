<script lang="ts">
	import { onMount } from 'svelte';
	import { appState } from '$lib/state/app.svelte';
	import { transcriptState } from '$lib/state/transcript.svelte';
	import { SpeechRecognitionService } from '$lib/speech/recognition.svelte';
	import type { WaveformData } from '$lib/audio/types';
	import LanguageSelector from '$lib/components/LanguageSelector.svelte';
	import MicControl from '$lib/components/MicControl.svelte';
	import Waveform from '$lib/components/Waveform.svelte';
	import TranscriptDisplay from '$lib/components/TranscriptDisplay.svelte';

	const DEV = import.meta.env.DEV;
	const log = DEV ? (...args: unknown[]) => console.debug('[OnlineSTT]', ...args) : () => {};

	const speech = new SpeechRecognitionService((text) => {
		transcriptState.addEntry({
			text,
			timestamp: Date.now(),
			language: appState.language,
			isFinal: true,
		});
	});

	let analyser: AnalyserNode | null = null;
	let stream: MediaStream | null = null;
	let audioCtx: AudioContext | null = null;

	function getWaveformData(): WaveformData {
		if (!analyser) return new Uint8Array(0);
		const data = new Uint8Array(analyser.frequencyBinCount);
		analyser.getByteFrequencyData(data);
		return data;
	}

	onMount(() => {
		transcriptState.clear();

		return () => {
			speech.stop();
			cleanupAudio();
			transcriptState.clear();
		};
	});

	function cleanupAudio() {
		log('cleaning up audio resources');
		analyser = null;
		stream?.getTracks().forEach((t) => t.stop());
		stream = null;
		audioCtx?.close();
		audioCtx = null;
	}

	async function handleStart() {
		log('handleStart: requesting mic access, language=%s', appState.language);
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					noiseSuppression: true,
					echoCancellation: true,
					autoGainControl: true,
				},
			});
			log('mic stream acquired: tracks=%d', stream.getTracks().length);
			audioCtx = new AudioContext();
			const source = audioCtx.createMediaStreamSource(stream);
			analyser = audioCtx.createAnalyser();
			analyser.fftSize = 256;
			source.connect(analyser);

			speech.start(appState.language);
			appState.toggleRecording();
			log('recording started');
		} catch (err) {
			cleanupAudio();
			console.error('Failed to start recording:', err);
		}
	}

	function handleStop() {
		log('handleStop: stopping recording');
		speech.stop();
		cleanupAudio();
		appState.toggleRecording();
		log('recording stopped');
	}

	let errorFading = $state(false);
	let errorTimerId: ReturnType<typeof setTimeout> | null = null;

	$effect(() => {
		if (speech.error) {
			errorFading = false;
			if (errorTimerId) clearTimeout(errorTimerId);
			// Start fade-out after 4s, then clear after 1s fade
			errorTimerId = setTimeout(() => {
				errorFading = true;
				errorTimerId = setTimeout(() => {
					speech.error = null;
					errorFading = false;
					errorTimerId = null;
				}, 1000);
			}, 4000);
		}
		return () => {
			if (errorTimerId) {
				clearTimeout(errorTimerId);
				errorTimerId = null;
			}
		};
	});
</script>

<main>
	<header>
		<div class="header-left">
			<h1>STT Online</h1>
			<span class="badge">Browser API</span>
		</div>
		<div class="header-right">
			<LanguageSelector />
		</div>
	</header>

	{#if !speech.isSupported}
		<div class="unsupported">
			Your browser does not support the SpeechRecognition API. Please use Chrome or Edge.
		</div>
	{:else}
		<section class="controls">
			<Waveform {getWaveformData} fps={10} />
			<MicControl onstart={handleStart} onstop={handleStop} disabled={!speech.isSupported} />
			{#if speech.isListening}
				<span class="status-info">Listening...</span>
			{/if}
		</section>

		{#if speech.error}
			<div class="error" class:error-fading={errorFading}>Speech recognition error: {speech.error}</div>
		{/if}
	{/if}

	{#if speech.interimText}
		<div class="interim">{speech.interimText}</div>
	{/if}

	<TranscriptDisplay />

</main>

<style>
	main {
		max-width: 640px;
		margin: 0 auto;
		padding: 24px 16px;
		display: flex;
		flex-direction: column;
		gap: 20px;
		min-height: 100dvh;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	h1 {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text);
	}

	.badge {
		font-size: 0.625rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--surface0);
		color: var(--mauve);
		font-weight: 600;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.controls {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.status-info {
		font-size: 0.75rem;
		color: var(--peach);
		animation: blink 1s ease-in-out infinite;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.unsupported {
		text-align: center;
		padding: 24px;
		background: var(--surface0);
		border-radius: var(--radius-lg);
		color: var(--yellow);
	}

	.interim {
		padding: 8px 12px;
		background: var(--surface0);
		border-radius: var(--radius);
		color: var(--subtext0);
		font-size: 0.875rem;
		font-style: italic;
		min-height: 1.5em;
	}

	.error {
		text-align: center;
		padding: 12px;
		background: var(--surface0);
		border-radius: var(--radius);
		color: var(--red);
		font-size: 0.875rem;
		opacity: 1;
		transition: opacity 1s ease-out;
	}

	.error-fading {
		opacity: 0;
	}
</style>
