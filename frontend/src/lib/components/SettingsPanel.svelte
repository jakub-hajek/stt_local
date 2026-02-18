<script lang="ts">
	import { appState } from '$lib/state/app.svelte';
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
			<label for="server-url-input">Server URL</label>
			<input
				id="server-url-input"
				type="text"
				value={appState.serverUrl}
				oninput={(e) => appState.setServerUrl(e.currentTarget.value)}
				disabled={appState.isRecording}
				placeholder="ws://localhost:8765"
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

	input[type="text"] {
		background: var(--surface0);
		color: var(--text);
		border: 1px solid var(--surface1);
		border-radius: var(--radius);
		padding: 8px;
		font-size: 0.875rem;
	}

	input[type="range"] {
		accent-color: var(--blue);
		padding: 4px 0;
		border: none;
		background: transparent;
	}

	input:focus {
		outline: 2px solid var(--blue);
		outline-offset: 2px;
	}
</style>
