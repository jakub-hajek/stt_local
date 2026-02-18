<script lang="ts">
	import { onMount } from 'svelte';
	import { appState } from '$lib/state/app.svelte';
	import { transcriptState } from '$lib/state/transcript.svelte';
	import { audioCapture } from '$lib/audio/capture';
	import { transcriber } from '$lib/whisper/transcriber';
	import { whisperManager } from '$lib/whisper/manager';
	import LanguageSelector from '$lib/components/LanguageSelector.svelte';
	import ModelStatus from '$lib/components/ModelStatus.svelte';
	import MicControl from '$lib/components/MicControl.svelte';
	import Waveform from '$lib/components/Waveform.svelte';
	import TranscriptDisplay from '$lib/components/TranscriptDisplay.svelte';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';

	let unsubChunk: (() => void) | null = null;
	let unsubResult: (() => void) | null = null;

	onMount(() => {
		whisperManager.checkSupport(appState.model).then((supported) => {
			appState.setSupported(supported);
		});

		unsubResult = transcriber.onResult((result) => {
			if (result.text) {
				transcriptState.addEntry({
					text: result.text,
					timestamp: result.timestamp,
					language: appState.language,
					isFinal: true
				});
			}
		});

		return () => {
			unsubChunk?.();
			unsubResult?.();
			if (appState.isRecording) {
				audioCapture.stop();
			}
		};
	});

	async function handleStart() {
		try {
			await audioCapture.start({ timeslice: appState.chunkInterval });
			appState.toggleRecording();

			unsubChunk = audioCapture.onChunk((chunk) => {
				transcriber.enqueue({
					blob: chunk.blob,
					language: appState.language,
					model: appState.model
				});
			});
		} catch (err) {
			console.error('Failed to start recording:', err);
		}
	}

	function handleStop() {
		audioCapture.stop();
		appState.toggleRecording();
		unsubChunk?.();
		unsubChunk = null;
	}

	const queueDepth = $derived(transcriber.queueLength);
</script>

<main>
	<header>
		<div class="header-left">
			<h1>STT Local</h1>
			<span class="badge">Privacy-first</span>
		</div>
		<div class="header-right">
			<LanguageSelector />
			<button
				class="settings-btn"
				onclick={() => appState.toggleSettings()}
				aria-label="Toggle settings"
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" stroke-width="2" stroke-linecap="round">
					<circle cx="12" cy="12" r="3" />
					<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
				</svg>
			</button>
		</div>
	</header>

	<SettingsPanel />

	<section class="model-section">
		<ModelStatus />
	</section>

	<section class="controls">
		<Waveform />
		<div class="mic-row">
			<MicControl onstart={handleStart} onstop={handleStop} />
			{#if transcriber.isProcessing}
				<span class="queue-info">Processing{queueDepth > 0 ? ` (${queueDepth} in queue)` : ''}...</span>
			{/if}
		</div>
	</section>

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
		color: var(--green);
		font-weight: 600;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.settings-btn {
		width: 36px;
		height: 36px;
		border-radius: var(--radius);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--subtext0);
		transition: all var(--transition);
	}

	.settings-btn:hover {
		background: var(--surface0);
		color: var(--text);
	}

	.model-section {
		display: flex;
		justify-content: center;
	}

	.controls {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
	}

	.mic-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.queue-info {
		font-size: 0.75rem;
		color: var(--peach);
		animation: blink 1s ease-in-out infinite;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}
</style>
