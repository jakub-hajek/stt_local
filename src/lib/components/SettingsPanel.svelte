<script lang="ts">
	import { appState } from '$lib/state/app.svelte';
	import type { WhisperModel } from '$lib/whisper/types';

	const models: { value: WhisperModel; label: string; size: string }[] = [
		{ value: 'tiny', label: 'Tiny', size: '~75 MB' },
		{ value: 'tiny.en', label: 'Tiny (EN)', size: '~75 MB' },
		{ value: 'base', label: 'Base', size: '~142 MB' },
		{ value: 'base.en', label: 'Base (EN)', size: '~142 MB' },
		{ value: 'small', label: 'Small', size: '~466 MB' },
		{ value: 'small.en', label: 'Small (EN)', size: '~466 MB' },
	];
</script>

{#if appState.settingsOpen}
	<div class="settings-panel">
		<div class="settings-header">
			<h3>Settings</h3>
			<button class="close-btn" onclick={() => appState.toggleSettings()} aria-label="Close settings">
				✕
			</button>
		</div>

		<div class="setting-group">
			<label for="model-select">Model</label>
			<select
				id="model-select"
				value={appState.model}
				onchange={(e) => appState.setModel(e.currentTarget.value as WhisperModel)}
				disabled={appState.isRecording}
			>
				{#each models as m}
					<option value={m.value}>{m.label} ({m.size})</option>
				{/each}
			</select>
		</div>

		<div class="setting-group">
			<label for="threads-input">Threads ({appState.threads})</label>
			<input
				id="threads-input"
				type="range"
				min="1"
				max="16"
				value={appState.threads}
				oninput={(e) => appState.setThreads(parseInt(e.currentTarget.value))}
			/>
		</div>

		<div class="setting-group">
			<label for="chunk-input">Chunk interval ({appState.chunkInterval / 1000}s)</label>
			<input
				id="chunk-input"
				type="range"
				min="3000"
				max="15000"
				step="1000"
				value={appState.chunkInterval}
				oninput={(e) => appState.setChunkInterval(parseInt(e.currentTarget.value))}
			/>
		</div>
	</div>
{/if}

<style>
	.settings-panel {
		background: var(--mantle);
		border-radius: var(--radius-lg);
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.settings-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	h3 {
		font-size: 1rem;
		font-weight: 600;
		color: var(--text);
	}

	.close-btn {
		width: 28px;
		height: 28px;
		border-radius: var(--radius);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--subtext0);
		transition: all var(--transition);
	}

	.close-btn:hover {
		background: var(--surface0);
		color: var(--text);
	}

	.setting-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	label {
		font-size: 0.875rem;
		color: var(--subtext0);
	}

	select, input[type="range"] {
		background: var(--surface0);
		color: var(--text);
		border: 1px solid var(--surface1);
		border-radius: var(--radius);
		padding: 8px;
		font-size: 0.875rem;
	}

	select:focus, input:focus {
		outline: 2px solid var(--blue);
		outline-offset: 2px;
	}

	input[type="range"] {
		accent-color: var(--blue);
		padding: 4px 0;
		border: none;
	}
</style>
