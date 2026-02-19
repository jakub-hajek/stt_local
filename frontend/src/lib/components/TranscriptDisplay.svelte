<script lang="ts">
  import { transcriptState } from '$lib/state/transcript.svelte';
  import { tick } from 'svelte';
  let copied = $state(false);
  let contentEl: HTMLDivElement;

  $effect(() => {
    transcriptState.entries.length;
    tick().then(() => {
      if (contentEl) {
        contentEl.scrollTop = contentEl.scrollHeight;
      }
    });
  });

  async function copyAll() {
    const text = transcriptState.fullText;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  function clearAll() {
    transcriptState.clear();
  }
</script>

<div class="transcript-panel">
  <div class="transcript-header">
    <h2>Transcript</h2>
    <div class="transcript-actions">
      <button
        class="action-btn"
        onclick={copyAll}
        disabled={transcriptState.entries.length === 0}
        aria-label="Copy transcript"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <button
        class="action-btn"
        onclick={clearAll}
        disabled={transcriptState.entries.length === 0}
        aria-label="Clear transcript"
      >
        Clear
      </button>
    </div>
  </div>

  <div class="transcript-content" role="log" aria-live="polite" bind:this={contentEl}>
    {#if transcriptState.entries.length === 0}
      <p class="empty-state">Transcript will appear here...</p>
    {:else}
      {#each transcriptState.entries as entry (entry.id)}
        <div class="transcript-entry">
          <span class="timestamp">{new Date(entry.timestamp).toLocaleTimeString()}</span>
          <span class="entry-text">{entry.text}</span>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .transcript-panel {
    background: var(--mantle);
    border-radius: var(--radius-lg);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 400px;
  }

  .transcript-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  h2 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
  }

  .transcript-actions {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    padding: 4px 12px;
    border-radius: var(--radius);
    font-size: 0.75rem;
    background: var(--surface0);
    color: var(--subtext0);
    transition: all var(--transition);
  }

  .action-btn:hover:not(:disabled) {
    background: var(--surface1);
    color: var(--text);
  }

  .transcript-content {
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    scroll-behavior: smooth;
  }

  .empty-state {
    color: var(--overlay0);
    font-style: italic;
    text-align: center;
    padding: 24px;
  }

  .transcript-entry {
    display: flex;
    gap: 8px;
    align-items: baseline;
  }

  .timestamp {
    font-size: 0.75rem;
    color: var(--overlay1);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  .entry-text {
    color: var(--text);
    line-height: 1.5;
  }
</style>
