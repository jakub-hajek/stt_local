import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import LanguageSelector from './LanguageSelector.svelte';
import { appState } from '$lib/state/app.svelte';

describe('LanguageSelector', () => {
	beforeEach(() => {
		appState.setLanguage('cs');
		if (appState.isRecording) appState.toggleRecording();
	});

	it('renders both language buttons', () => {
		render(LanguageSelector);

		expect(screen.getByText('CS')).toBeInTheDocument();
		expect(screen.getByText('EN')).toBeInTheDocument();
	});

	it('has radiogroup role with label', () => {
		render(LanguageSelector);

		const group = screen.getByRole('radiogroup', { name: 'Language' });
		expect(group).toBeInTheDocument();
	});

	it('marks CS as active by default', () => {
		render(LanguageSelector);

		const csBtn = screen.getByText('CS');
		const enBtn = screen.getByText('EN');

		expect(csBtn.getAttribute('aria-checked')).toBe('true');
		expect(enBtn.getAttribute('aria-checked')).toBe('false');
	});

	it('switches language when clicking EN', async () => {
		render(LanguageSelector);

		const enBtn = screen.getByText('EN');
		await fireEvent.click(enBtn);

		expect(appState.language).toBe('en');
	});

	it('updates active state after language change', async () => {
		render(LanguageSelector);

		await fireEvent.click(screen.getByText('EN'));

		expect(screen.getByText('EN').getAttribute('aria-checked')).toBe('true');
		expect(screen.getByText('CS').getAttribute('aria-checked')).toBe('false');
	});

	it('disables buttons when recording', async () => {
		appState.toggleRecording();
		render(LanguageSelector);

		const csBtn = screen.getByText('CS');
		const enBtn = screen.getByText('EN');

		expect(csBtn).toBeDisabled();
		expect(enBtn).toBeDisabled();
	});
});
