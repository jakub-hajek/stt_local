import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	build: {
		// Prevent inlining assets as data URIs — AudioWorklet modules
		// require a proper JS file URL (data URIs get wrong MIME type).
		assetsInlineLimit: 0
	},
	server: {
		headers: {
			'Cross-Origin-Embedder-Policy': 'require-corp',
			'Cross-Origin-Opener-Policy': 'same-origin',
			'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' https: http://localhost:8765 ws://localhost:8765 blob:; img-src 'self' data: blob:"
		}
	}
});
