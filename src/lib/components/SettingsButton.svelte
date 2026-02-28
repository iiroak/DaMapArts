<script lang="ts">
	import { onMount } from 'svelte';
	import InfoModal from './InfoModal.svelte';
	import { infoModal } from '$lib/stores/infoModal.svelte.js';
	import { locale } from '$lib/stores/locale.svelte.js';

	const t = locale.t;
	const SETTINGS_KEY = 'mapartcraft_settings';

	// Sync with global info modal store
	$effect(() => {
		if (infoModal.open) {
			// store was opened externally (e.g. from a (?) button)
		}
	});
	const ACCENT_COLORS: { label: string; value: string; hover: string }[] = [
		{ label: 'Indigo', value: '#6366f1', hover: '#818cf8' },
		{ label: 'Purple', value: '#8b5cf6', hover: '#a78bfa' },
		{ label: 'Blue', value: '#3b82f6', hover: '#60a5fa' },
		{ label: 'Cyan', value: '#06b6d4', hover: '#22d3ee' },
		{ label: 'Green', value: '#22c55e', hover: '#4ade80' },
		{ label: 'Rose', value: '#f43f5e', hover: '#fb7185' },
		{ label: 'Orange', value: '#f97316', hover: '#fb923c' },
		{ label: 'Amber', value: '#f59e0b', hover: '#fbbf24' },
	];

	let open = $state(false);
	let hideScrollbar = $state(false);
	let overlayScrollbar = $state(true);
	let accentIndex = $state(0);

	function loadSettings() {
		try {
			const raw = localStorage.getItem(SETTINGS_KEY);
			if (raw) {
				const s = JSON.parse(raw);
			if (typeof s.hideScrollbar === 'boolean') hideScrollbar = s.hideScrollbar;
				if (typeof s.overlayScrollbar === 'boolean') overlayScrollbar = s.overlayScrollbar;
				if (typeof s.accentIndex === 'number' && s.accentIndex < ACCENT_COLORS.length) accentIndex = s.accentIndex;
			}
		} catch {}
	}

	function saveSettings() {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify({ hideScrollbar, overlayScrollbar, accentIndex }));
	}

	function applyAccent(idx: number) {
		const c = ACCENT_COLORS[idx];
		document.documentElement.style.setProperty('--color-primary', c.value);
		document.documentElement.style.setProperty('--color-primary-hover', c.hover);
	}

	function applyScrollbar(hide: boolean) {
		document.documentElement.classList.toggle('hide-scrollbar', hide);
	}

	function applyOverlayScrollbar(overlay: boolean) {
		document.documentElement.classList.toggle('overlay-scrollbar', overlay);
	}

	function toggleScrollbar() {
		hideScrollbar = !hideScrollbar;
		if (hideScrollbar) overlayScrollbar = false;
		applyScrollbar(hideScrollbar);
		applyOverlayScrollbar(overlayScrollbar);
		saveSettings();
	}

	function toggleOverlayScrollbar() {
		overlayScrollbar = !overlayScrollbar;
		if (overlayScrollbar) hideScrollbar = false;
		applyScrollbar(hideScrollbar);
		applyOverlayScrollbar(overlayScrollbar);
		saveSettings();
	}

	function setAccent(idx: number) {
		accentIndex = idx;
		applyAccent(idx);
		saveSettings();
	}

	onMount(() => {
		loadSettings();
		applyAccent(accentIndex);
		applyScrollbar(hideScrollbar);
		applyOverlayScrollbar(overlayScrollbar);
	});
</script>

<!-- Floating buttons -->
<div class="fixed bottom-4 left-4 z-50 flex flex-col gap-2">
	<!-- Info / heart button -->
	<button
		class="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-lg transition-all hover:bg-[var(--color-bg-input)] hover:scale-110"
		onclick={() => infoModal.openTab('about')}
		title={t('settings.info')}
	>
		<svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
			<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
		</svg>
	</button>

	<!-- Gear button -->
	<button
		class="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-muted)] shadow-lg transition-all hover:bg-[var(--color-bg-input)] hover:text-[var(--color-text)]"
		onclick={() => (open = !open)}
		title={t('settings.title')}
	>
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
		</svg>
	</button>

	{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed bottom-16 left-4 w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 shadow-xl z-50"
		onkeydown={(e) => e.key === 'Escape' && (open = false)}
	>
		<h4 class="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{t('settings.title')}</h4>

		<!-- Language -->
		<div class="mb-3">
			<span class="mb-1.5 block text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{t('settings.language')}</span>
			<select
				class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-input)] px-2 py-1 text-xs text-[var(--color-text)]"
				value={locale.code}
				onchange={(e) => { locale.code = (e.target as HTMLSelectElement).value; }}
			>
				{#each locale.locales as loc}
					<option value={loc.code}>{loc.nativeName}</option>
				{/each}
			</select>
		</div>

		<!-- Hide scrollbar -->
		<label class="flex cursor-pointer items-center gap-2 text-xs">
			<input
				type="checkbox"
				checked={hideScrollbar}
				onchange={toggleScrollbar}
				class="accent-[var(--color-primary)]"
			/>
			<span>{t('settings.hideScrollbar')}</span>
		</label>

		<!-- Overlay scrollbar -->
		<label class="mt-1.5 flex cursor-pointer items-center gap-2 text-xs">
			<input
				type="checkbox"
				checked={overlayScrollbar}
				onchange={toggleOverlayScrollbar}
				class="accent-[var(--color-primary)]"
			/>
			<span>{t('settings.overlayScrollbar')}</span>
		</label>

		<!-- Accent color -->
		<div class="mt-3">
			<span class="mb-1.5 block text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">{t('settings.accentColor')}</span>
			<div class="grid grid-cols-4 gap-1.5">
				{#each ACCENT_COLORS as color, i}
					<button
						class="h-6 w-full rounded-md border-2 transition-all hover:scale-110"
						style="background-color: {color.value}; border-color: {accentIndex === i ? 'white' : 'transparent'};"
						title={color.label}
						onclick={() => setAccent(i)}
					></button>
				{/each}
			</div>
		</div>
	</div>
	{/if}
</div>

<InfoModal bind:open={infoModal.open} onclose={() => infoModal.close()} />
