<script lang="ts">
	import { appState } from '$lib/state/app.svelte';

	interface Props {
		onfile: (file: File) => void;
	}

	let { onfile }: Props = $props();

	let fileInput: HTMLInputElement;

	const isDisabled = $derived(
		appState.modelStatus !== 'ready' || appState.isRecording || appState.isProcessingFile
	);

	function handleClick() {
		fileInput?.click();
	}

	function handleChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			onfile(file);
			input.value = '';
		}
	}
</script>

<input
	bind:this={fileInput}
	type="file"
	accept=".wav,.mp3,.flac,.ogg,.m4a,.webm"
	onchange={handleChange}
	hidden
/>

<button
	class="upload-btn"
	class:processing={appState.isProcessingFile}
	onclick={handleClick}
	disabled={isDisabled}
	aria-label={appState.isProcessingFile ? 'Processing file' : 'Upload audio file'}
>
	{#if appState.isProcessingFile}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="24" height="24" stroke-width="2" stroke-linecap="round">
			<circle cx="12" cy="12" r="10" stroke-dasharray="31.4 31.4" />
		</svg>
	{:else}
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="24" height="24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
			<polyline points="17 8 12 3 7 8" />
			<line x1="12" y1="3" x2="12" y2="15" />
		</svg>
	{/if}
</button>

<style>
	.upload-btn {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: var(--surface0);
		color: var(--subtext0);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all var(--transition);
	}

	.upload-btn:hover:not(:disabled) {
		background: var(--surface1);
		color: var(--text);
		transform: scale(1.05);
	}

	.upload-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.upload-btn.processing {
		color: var(--peach);
	}

	.upload-btn.processing svg {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
