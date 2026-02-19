<script lang="ts">
	import { appState } from '$lib/state/app.svelte';

	interface Props {
		onstart: () => void;
		onstop: () => void;
		disabled?: boolean;
	}

	let { onstart, onstop, disabled }: Props = $props();

	function handleClick() {
		if (appState.isRecording) {
			onstop();
		} else {
			onstart();
		}
	}

	const isDisabled = $derived(disabled ?? appState.modelStatus !== 'ready');
</script>

<button
	class="mic-btn"
	class:recording={appState.isRecording}
	onclick={handleClick}
	disabled={isDisabled}
	aria-label={appState.isRecording ? 'Stop recording' : 'Start recording'}
>
	<svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
		{#if appState.isRecording}
			<rect x="6" y="6" width="12" height="12" rx="2" />
		{:else}
			<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
			<path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
			<line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
			<line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
		{/if}
	</svg>
</button>

<style>
	.mic-btn {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: var(--blue);
		color: var(--base);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all var(--transition);
		position: relative;
	}

	.mic-btn:hover:not(:disabled) {
		transform: scale(1.05);
	}

	.mic-btn.recording {
		background: var(--red);
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { box-shadow: 0 0 0 0 rgba(243, 139, 168, 0.4); }
		50% { box-shadow: 0 0 0 16px rgba(243, 139, 168, 0); }
	}
</style>
