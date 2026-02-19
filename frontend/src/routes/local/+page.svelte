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
	import FileUpload from '$lib/components/FileUpload.svelte';
	import Waveform from '$lib/components/Waveform.svelte';
	import TranscriptDisplay from '$lib/components/TranscriptDisplay.svelte';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';

	let unsubPcm: (() => void) | null = null;
	let unsubResult: (() => void) | null = null;
	let unsubStatus: (() => void) | null = null;
	let interimText = $state('');

	onMount(() => {
		// Check server health on load
		whisperManager.checkHealth(appState.httpServerUrl, {
			onStatusChange: (status) => appState.setModelStatus(status),
			onServerInfo: (info) => appState.setServerInfo(info.backend, info.device, info.model),
			onError: (error) => appState.setModelError(error)
		});

		unsubResult = transcriber.onResult((result) => {
			if (result.isFinal) {
				if (result.text) {
					transcriptState.addEntry({
						text: result.text,
						timestamp: Date.now(),
						language: appState.language,
						isFinal: true,
					});
				}
				interimText = '';
			} else {
				if (result.text) {
					interimText = result.text;
				}
			}
		});

		unsubStatus = transcriber.onStatusChange((status) => {
			appState.setConnectionStatus(status);
		});

		return () => {
			unsubPcm?.();
			unsubResult?.();
			unsubStatus?.();
			if (appState.isRecording) {
				audioCapture.stop();
				transcriber.disconnect();
			}
		};
	});

	async function handleStart() {
		try {
			// Connect transcriber WebSocket
			await transcriber.connect(
				`${appState.serverUrl}/ws/transcribe`,
				appState.language
			);

			// Start audio capture
			await audioCapture.start();
			appState.toggleRecording();

			// Pipe PCM data to transcriber
			unsubPcm = audioCapture.onPcmData((buffer) => {
				transcriber.sendAudio(buffer);
			});
		} catch (err) {
			console.error('Failed to start recording:', err);
		}
	}

	async function handleStop() {
		appState.toggleRecording();
		unsubPcm?.();
		unsubPcm = null;

		// Tell server we're done, wait for final results
		await transcriber.stop();
		audioCapture.stop();
		transcriber.disconnect();
		interimText = '';
	}

	async function handleFileUpload(file: File) {
		appState.setProcessingFile(true);
		try {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('language', appState.language);

			const resp = await fetch(`${appState.httpServerUrl}/api/transcribe`, {
				method: 'POST',
				body: formData,
			});

			if (!resp.ok) {
				const err = await resp.json().catch(() => ({ detail: 'Upload failed' }));
				console.error('Transcription failed:', err.detail);
				return;
			}

			const data = await resp.json();
			if (data.text) {
				transcriptState.addEntry({
					text: data.text,
					timestamp: Date.now(),
					language: appState.language,
					isFinal: true,
				});
			}
		} catch (err) {
			console.error('File upload failed:', err);
		} finally {
			appState.setProcessingFile(false);
		}
	}
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
			<FileUpload onfile={handleFileUpload} />
		</div>
		{#if appState.connectionStatus === 'ready' && appState.isRecording}
			<span class="status-info">Streaming...</span>
		{/if}
	</section>

	<TranscriptDisplay />

	{#if interimText}
		<div class="interim">{interimText}</div>
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

	.status-info {
		font-size: 0.75rem;
		color: var(--peach);
		animation: blink 1s ease-in-out infinite;
	}

	@keyframes blink {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.interim {
		padding: 8px 16px;
		color: var(--overlay1);
		font-style: italic;
		font-size: 0.875rem;
		border-left: 2px solid var(--surface1);
	}

</style>
