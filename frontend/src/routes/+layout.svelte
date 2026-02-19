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

<style>
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
