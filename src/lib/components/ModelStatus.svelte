<script lang="ts">
  import { appState } from '$lib/state/app.svelte';
  import { whisperManager } from '$lib/whisper/manager';

  async function handleDownload() {
    await whisperManager.downloadModel(appState.model, {
      onStatusChange: (status) => appState.setModelStatus(status),
      onProgress: (progress) => appState.setModelProgress(progress),
      onError: (error) => appState.setModelError(error),
    });
  }
</script>

<div class="model-status">
  {#if appState.modelStatus === 'idle'}
    <button class="download-btn" onclick={handleDownload}>
      Download Model ({appState.model})
    </button>
  {:else if appState.modelStatus === 'checking'}
    <span class="status checking">Checking compatibility...</span>
  {:else if appState.modelStatus === 'downloading'}
    <div class="progress-container">
      <div class="progress-bar" style="width: {appState.modelProgress * 100}%"></div>
    </div>
    <span class="progress-text">{Math.round(appState.modelProgress * 100)}%</span>
  {:else if appState.modelStatus === 'ready'}
    <span class="status ready">Model ready</span>
  {:else if appState.modelStatus === 'error'}
    <span class="status error">{appState.modelError ?? 'Unknown error'}</span>
    <button class="retry-btn" onclick={handleDownload}>Retry</button>
  {:else if appState.modelStatus === 'unsupported'}
    <span class="status error">Browser not supported</span>
  {/if}
</div>

<style>
  .model-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .download-btn {
    background: var(--blue);
    color: var(--base);
    padding: 8px 16px;
    border-radius: var(--radius);
    font-weight: 600;
    transition: opacity var(--transition);
  }

  .download-btn:hover {
    opacity: 0.9;
  }

  .status {
    font-size: 0.875rem;
    font-weight: 500;
  }

  .status.ready {
    color: var(--green);
  }

  .status.checking {
    color: var(--peach);
  }

  .status.error {
    color: var(--red);
  }

  .progress-container {
    flex: 1;
    height: 6px;
    background: var(--surface0);
    border-radius: 3px;
    overflow: hidden;
    min-width: 100px;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--blue), var(--mauve));
    border-radius: 3px;
    transition: width 200ms ease;
  }

  .progress-text {
    font-size: 0.75rem;
    color: var(--subtext0);
    min-width: 36px;
    text-align: right;
  }

  .retry-btn {
    background: var(--surface0);
    color: var(--text);
    padding: 4px 12px;
    border-radius: var(--radius);
    font-size: 0.875rem;
  }
</style>
