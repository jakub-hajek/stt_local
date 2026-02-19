<script>
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();
</script>

<h1 class="main-title">Speech to Text PoC, darek pro Nikolu :)</h1>

<nav>
	<a href="/" class:active={page.url.pathname === '/'}>Online</a>
	<a href="/local" class:active={page.url.pathname.startsWith('/local')}>Local</a>
</nav>

{@render children()}

<footer>
	<p class="tagline">No AI was harmed in the making of this transcription... but a few electrons were mildly inconvenienced.</p>
	<p class="author">
		Made with caffeine & questionable commit messages by
		<a href="https://github.com/jakub-hajek/stt_local" target="_blank" rel="noopener noreferrer">
			<svg class="github-icon" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
			Jakub Hajek
		</a>
	</p>
</footer>

<style>
	footer {
		max-width: 640px;
		margin: 0 auto;
		padding: 32px 16px 24px;
		border-top: 1px solid var(--surface0);
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 8px;
		width: 100%;
	}

	.tagline {
		font-size: 0.75rem;
		color: var(--overlay0);
		font-style: italic;
	}

	.author {
		font-size: 0.75rem;
		color: var(--overlay1);
	}

	.author a {
		color: var(--mauve);
		text-decoration: none;
		font-weight: 600;
		transition: color 0.2s;
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.github-icon {
		vertical-align: middle;
	}

	.author a:hover {
		color: var(--pink);
		text-decoration: underline;
	}
	.main-title {
		text-align: center;
		font-size: 1.75rem;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--mauve);
		background: linear-gradient(135deg, rgba(203, 166, 247, 0.12), rgba(137, 180, 250, 0.08));
		border: 1px solid rgba(203, 166, 247, 0.15);
		backdrop-filter: blur(12px);
		border-radius: 16px;
		padding: 20px 28px;
		margin: 16px auto 0;
		max-width: 640px;
		width: calc(100% - 32px);
		box-shadow:
			0 4px 24px rgba(203, 166, 247, 0.08),
			0 1px 2px rgba(0, 0, 0, 0.2),
			inset 0 1px 0 rgba(203, 166, 247, 0.1);
	}

	nav {
		display: flex;
		justify-content: center;
		gap: 4px;
		padding: 12px 16px 0;
		max-width: 640px;
		margin: 0 auto;
		width: 100%;
	}

	a {
		padding: 6px 20px;
		border-radius: var(--radius);
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--subtext0);
		text-decoration: none;
		transition: all var(--transition);
	}

	a:hover {
		color: var(--text);
		background: var(--surface0);
	}

	a.active {
		background: var(--surface0);
		color: var(--text);
	}
</style>
