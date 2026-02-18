<script lang="ts">
  import { appState } from '$lib/state/app.svelte';
  import { whisperManager } from '$lib/whisper/manager';

  async function handleCheckServer() {
    await whisperManager.checkHealth(appState.httpServerUrl, {
      onStatusChange: (status) => appState.setModelStatus(status),
      onServerInfo: (info) => appState.setServerInfo(info.backend, info.device, info.model),
      onError: (error) => appState.setModelError(error),
    });
  }
</script>

<div class="model-status">
  {#if appState.modelStatus === 'idle'}
    <button class="connect-btn" onclick={handleCheckServer}>
      Connect to Server
    </button>
  {:else if appState.modelStatus === 'checking'}
    <span class="status checking">Connecting to server...</span>
  {:else if appState.modelStatus === 'ready'}
    <span class="status ready">
      Server ready — {appState.serverBackend} ({appState.serverDevice})
    </span>
  {:else if appState.modelStatus === 'error'}
    <span class="status error">{appState.modelError ?? 'Unknown error'}</span>
    <button class="retry-btn" onclick={handleCheckServer}>Retry</button>
  {:else if appState.modelStatus === 'server_offline'}
    <span class="status error">Server offline</span>
    <button class="retry-btn" onclick={handleCheckServer}>Retry</button>
  {/if}
</div>

<style>
  .model-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .connect-btn {
    background: var(--blue);
    color: var(--base);
    padding: 8px 16px;
    border-radius: var(--radius);
    font-weight: 600;
    transition: opacity var(--transition);
  }

  .connect-btn:hover {
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

  .retry-btn {
    background: var(--surface0);
    color: var(--text);
    padding: 4px 12px;
    border-radius: var(--radius);
    font-size: 0.875rem;
  }
</style>
