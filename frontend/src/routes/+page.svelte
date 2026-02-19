<script lang="ts">
	import { onMount } from 'svelte';
	import { appState } from '$lib/state/app.svelte';
	import { transcriptState } from '$lib/state/transcript.svelte';
	import { audioCapture } from '$lib/audio/capture';
	import { SpeechRecognitionService } from '$lib/speech/recognition.svelte';
	import LanguageSelector from '$lib/components/LanguageSelector.svelte';
	import MicControl from '$lib/components/MicControl.svelte';
	import Waveform from '$lib/components/Waveform.svelte';
	import TranscriptDisplay from '$lib/components/TranscriptDisplay.svelte';

	const speech = new SpeechRecognitionService();

	speech.onFinal = (text) => {
		transcriptState.addEntry({
			text,
			timestamp: Date.now(),
			language: appState.language,
			isFinal: true,
		});
	};

	onMount(() => {
		const prevModelStatus = appState.modelStatus;
		const prevIsRecording = appState.isRecording;
		appState.setModelStatus('ready');
		transcriptState.clear();

		return () => {
			speech.stop();
			audioCapture.stop();
			appState.setModelStatus(prevModelStatus);
			if (prevIsRecording !== appState.isRecording) {
				appState.toggleRecording();
			}
			transcriptState.clear();
		};
	});

	async function handleStart() {
		await audioCapture.start();
		speech.start(appState.language);
		appState.toggleRecording();
	}

	function handleStop() {
		speech.stop();
		audioCapture.stop();
		appState.toggleRecording();
	}
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
			<Waveform />
			<MicControl onstart={handleStart} onstop={handleStop} />
			{#if speech.isListening}
				<span class="status-info">Listening...</span>
			{/if}
		</section>

		{#if speech.error}
			<div class="error">Speech recognition error: {speech.error}</div>
		{/if}
	{/if}

	<TranscriptDisplay />

	{#if speech.interimText}
		<div class="interim">{speech.interimText}</div>
	{/if}
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

	.error {
		text-align: center;
		padding: 12px;
		background: var(--surface0);
		border-radius: var(--radius);
		color: var(--red);
		font-size: 0.875rem;
	}

	.interim {
		padding: 8px 16px;
		color: var(--overlay1);
		font-style: italic;
		font-size: 0.875rem;
		border-left: 2px solid var(--surface1);
	}
</style>
