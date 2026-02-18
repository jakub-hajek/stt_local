<script lang="ts">
  import { appState } from '$lib/state/app.svelte';

  const languages = [
    { code: 'cs' as const, label: 'CS' },
    { code: 'en' as const, label: 'EN' },
  ];
</script>

<div class="language-selector" role="radiogroup" aria-label="Language">
  {#each languages as lang}
    <button
      role="radio"
      aria-checked={appState.language === lang.code}
      class:active={appState.language === lang.code}
      onclick={() => appState.setLanguage(lang.code)}
      disabled={appState.isRecording}
    >
      {lang.label}
    </button>
  {/each}
</div>

<style>
  .language-selector {
    display: flex;
    gap: 4px;
    background: var(--surface0);
    border-radius: var(--radius);
    padding: 4px;
  }

  button {
    padding: 6px 16px;
    border-radius: calc(var(--radius) - 2px);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--subtext0);
    transition: all var(--transition);
  }

  button.active {
    background: var(--blue);
    color: var(--base);
  }

  button:hover:not(.active):not(:disabled) {
    color: var(--text);
    background: var(--surface1);
  }
</style>
