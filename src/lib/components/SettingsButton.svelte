<script lang="ts">
	import { onMount } from 'svelte';
	import InfoModal from './InfoModal.svelte';
	import { infoModal } from '$lib/stores/infoModal.svelte.js';
	import { locale } from '$lib/stores/locale.svelte.js';
	import { layoutStore } from '$lib/stores/layoutStore.svelte.js';
	import { profilesModal } from '$lib/stores/profilesModal.svelte.js';
	import { panelRegistry } from './PanelRegistry.svelte.js';

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

	type ThemeTokens = {
		bg: string;
		bgSidebar: string;
		bgCard: string;
		bgInput: string;
		border: string;
		text: string;
		textMuted: string;
	};

	const THEME_PRESETS: { label: string; tokens: ThemeTokens }[] = [
		{
			label: 'Dark',
			tokens: {
				bg: '#0f0f0f', bgSidebar: '#161616', bgCard: '#1a1a1a', bgInput: '#222222',
				border: '#2a2a2a', text: '#e5e5e5', textMuted: '#888888',
			},
		},
		{
			label: 'Soft Dark',
			tokens: {
				bg: '#1f2128', bgSidebar: '#242730', bgCard: '#2b2f3a', bgInput: '#323744',
				border: '#3f4556', text: '#f2f3f5', textMuted: '#b4bac7',
			},
		},
		{
			label: 'Discord',
			tokens: {
				bg: '#1e1f22',
				bgSidebar: '#2b2d31',
				bgCard: '#313338',
				bgInput: '#383a40',
				border: '#3f4147',
				text: '#f2f3f5',
				textMuted: '#b5bac1',
			},
		},
		{
			label: 'Light',
			tokens: {
				bg: '#f4f5f7', bgSidebar: '#eef0f3', bgCard: '#ffffff', bgInput: '#f6f8fb',
				border: '#d9dee7', text: '#1f2937', textMuted: '#6b7280',
			},
		},
	];

	const DEFAULT_CUSTOM_THEME: ThemeTokens = {
		bg: '#1f2128',
		bgSidebar: '#242730',
		bgCard: '#2b2f3a',
		bgInput: '#323744',
		border: '#3f4556',
		text: '#f2f3f5',
		textMuted: '#b4bac7',
	};

	const CUSTOM_THEME_INDEX = THEME_PRESETS.length;

	let open = $state(false);
	let hideScrollbar = $state(false);
	let overlayScrollbar = $state(true);
	let accentIndex = $state(0);
	let themeIndex = $state(0);
	let customTheme = $state<ThemeTokens>({ ...DEFAULT_CUSTOM_THEME });

	let layoutPercentages = $derived.by(() => {
		const maxWidth = Math.max(1, layoutStore.sizing.contentMaxWidth);
		const left = Math.max(0, Math.min(100, (layoutStore.sizing.leftWidth / maxWidth) * 100));
		const right = Math.max(0, Math.min(100, (layoutStore.sizing.rightWidth / maxWidth) * 100));
		const center = Math.max(0, 100 - left - right);
		return {
			left,
			center,
			right,
			leftLabel: left.toFixed(1),
			centerLabel: center.toFixed(1),
			rightLabel: right.toFixed(1),
		};
	});

	function isHexColor(v: string): boolean {
		return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(v);
	}

	function loadSettings() {
		try {
			const raw = localStorage.getItem(SETTINGS_KEY);
			if (raw) {
				const s = JSON.parse(raw);
			if (typeof s.hideScrollbar === 'boolean') hideScrollbar = s.hideScrollbar;
				if (typeof s.overlayScrollbar === 'boolean') overlayScrollbar = s.overlayScrollbar;
				if (typeof s.accentIndex === 'number' && s.accentIndex < ACCENT_COLORS.length) accentIndex = s.accentIndex;
				if (typeof s.themeIndex === 'number' && s.themeIndex >= 0 && s.themeIndex <= CUSTOM_THEME_INDEX) themeIndex = s.themeIndex;
				if (s.customTheme && typeof s.customTheme === 'object') {
					const c = s.customTheme as Partial<ThemeTokens>;
					customTheme.bg = typeof c.bg === 'string' && isHexColor(c.bg) ? c.bg : customTheme.bg;
					customTheme.bgSidebar = typeof c.bgSidebar === 'string' && isHexColor(c.bgSidebar) ? c.bgSidebar : customTheme.bgSidebar;
					customTheme.bgCard = typeof c.bgCard === 'string' && isHexColor(c.bgCard) ? c.bgCard : customTheme.bgCard;
					customTheme.bgInput = typeof c.bgInput === 'string' && isHexColor(c.bgInput) ? c.bgInput : customTheme.bgInput;
					customTheme.border = typeof c.border === 'string' && isHexColor(c.border) ? c.border : customTheme.border;
					customTheme.text = typeof c.text === 'string' && isHexColor(c.text) ? c.text : customTheme.text;
					customTheme.textMuted = typeof c.textMuted === 'string' && isHexColor(c.textMuted) ? c.textMuted : customTheme.textMuted;
				}
			}
		} catch {}
	}

	function saveSettings() {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify({
			hideScrollbar,
			overlayScrollbar,
			accentIndex,
			themeIndex,
			customTheme,
		}));
	}

	function applyTheme(idx: number) {
		const theme = idx === CUSTOM_THEME_INDEX ? customTheme : THEME_PRESETS[idx]?.tokens;
		if (!theme) return;
		document.documentElement.style.setProperty('--color-bg', theme.bg);
		document.documentElement.style.setProperty('--color-bg-sidebar', theme.bgSidebar);
		document.documentElement.style.setProperty('--color-bg-card', theme.bgCard);
		document.documentElement.style.setProperty('--color-bg-input', theme.bgInput);
		document.documentElement.style.setProperty('--color-border', theme.border);
		document.documentElement.style.setProperty('--color-text', theme.text);
		document.documentElement.style.setProperty('--color-text-muted', theme.textMuted);
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

	function setTheme(idx: number) {
		themeIndex = idx;
		applyTheme(idx);
		saveSettings();
	}

	function setCustomThemeColor(key: keyof ThemeTokens, value: string) {
		customTheme[key] = value;
		if (themeIndex === CUSTOM_THEME_INDEX) {
			applyTheme(themeIndex);
		}
		saveSettings();
	}

	onMount(() => {
		loadSettings();
		applyTheme(themeIndex);
		applyAccent(accentIndex);
		applyScrollbar(hideScrollbar);
		applyOverlayScrollbar(overlayScrollbar);
	});
</script>

<!-- Floating buttons -->
<div class="fixed bottom-4 left-4 z-50 flex flex-col gap-2">
	<!-- Profiles button -->
	<button
		class="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-muted)] shadow-lg transition-all hover:bg-[var(--color-bg-input)] hover:text-[var(--color-text)] hover:scale-110"
		onclick={() => profilesModal.show()}
		title={t('header.profiles')}
	>
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M5.121 17.804A13.937 13.937 0 0 1 12 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
		</svg>
	</button>

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
		class="fixed bottom-16 left-4 w-64 max-h-[80vh] overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3 shadow-xl z-50"
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

		<!-- Theme preset -->
		<div class="mt-3">
			<span class="mb-1.5 block text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Theme</span>
			<select
				class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg-input)] px-2 py-1 text-xs text-[var(--color-text)]"
				value={themeIndex}
				onchange={(e) => setTheme(+(e.target as HTMLSelectElement).value)}
			>
				{#each THEME_PRESETS as theme, i}
					<option value={i}>{theme.label}</option>
				{/each}
				<option value={CUSTOM_THEME_INDEX}>Custom</option>
			</select>
		</div>

		{#if themeIndex === CUSTOM_THEME_INDEX}
			<div class="mt-2 grid grid-cols-2 gap-2">
				<label class="text-[10px] text-[var(--color-muted)]">
					Bg
					<input type="color" value={customTheme.bg} class="mt-1 h-7 w-full rounded border border-[var(--color-border)]" oninput={(e) => setCustomThemeColor('bg', (e.target as HTMLInputElement).value)} />
				</label>
				<label class="text-[10px] text-[var(--color-muted)]">
					Sidebar
					<input type="color" value={customTheme.bgSidebar} class="mt-1 h-7 w-full rounded border border-[var(--color-border)]" oninput={(e) => setCustomThemeColor('bgSidebar', (e.target as HTMLInputElement).value)} />
				</label>
				<label class="text-[10px] text-[var(--color-muted)]">
					Card
					<input type="color" value={customTheme.bgCard} class="mt-1 h-7 w-full rounded border border-[var(--color-border)]" oninput={(e) => setCustomThemeColor('bgCard', (e.target as HTMLInputElement).value)} />
				</label>
				<label class="text-[10px] text-[var(--color-muted)]">
					Input
					<input type="color" value={customTheme.bgInput} class="mt-1 h-7 w-full rounded border border-[var(--color-border)]" oninput={(e) => setCustomThemeColor('bgInput', (e.target as HTMLInputElement).value)} />
				</label>
				<label class="text-[10px] text-[var(--color-muted)]">
					Border
					<input type="color" value={customTheme.border} class="mt-1 h-7 w-full rounded border border-[var(--color-border)]" oninput={(e) => setCustomThemeColor('border', (e.target as HTMLInputElement).value)} />
				</label>
				<label class="text-[10px] text-[var(--color-muted)]">
					Text
					<input type="color" value={customTheme.text} class="mt-1 h-7 w-full rounded border border-[var(--color-border)]" oninput={(e) => setCustomThemeColor('text', (e.target as HTMLInputElement).value)} />
				</label>
				<label class="text-[10px] text-[var(--color-muted)] col-span-2">
					Muted Text
					<input type="color" value={customTheme.textMuted} class="mt-1 h-7 w-full rounded border border-[var(--color-border)]" oninput={(e) => setCustomThemeColor('textMuted', (e.target as HTMLInputElement).value)} />
				</label>
			</div>
		{/if}

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

		<!-- ═══ Layout Section ═══ -->
		<div class="mt-3 border-t border-[var(--color-border)] pt-3">
			<span class="mb-2 block text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Layout</span>

			<!-- Left Zone Width -->
			<div class="mb-2">
				<div class="flex items-center justify-between text-[10px] text-[var(--color-muted)]">
					<span>Left Width</span>
					<span class="tabular-nums">{layoutStore.sizing.leftWidth}px</span>
				</div>
				<input
					type="range"
					min="180"
					max="1400"
					step="10"
					value={layoutStore.sizing.leftWidth}
					oninput={(e) => layoutStore.updateSizing('leftWidth', +(e.target as HTMLInputElement).value)}
					class="mt-0.5 w-full"
				/>
			</div>

			<!-- Right Zone Width -->
			<div class="mb-2">
				<div class="flex items-center justify-between text-[10px] text-[var(--color-muted)]">
					<span>Right Width</span>
					<span class="tabular-nums">{layoutStore.sizing.rightWidth}px</span>
				</div>
				<input
					type="range"
					min="180"
					max="1400"
					step="10"
					value={layoutStore.sizing.rightWidth}
					oninput={(e) => layoutStore.updateSizing('rightWidth', +(e.target as HTMLInputElement).value)}
					class="mt-0.5 w-full"
				/>
			</div>

			<!-- Workspace Max Width -->
			<div class="mb-2">
				<div class="flex items-center justify-between text-[10px] text-[var(--color-muted)]">
					<span>Workspace Max</span>
					<span class="tabular-nums">{layoutStore.sizing.contentMaxWidth}px</span>
				</div>
				<input
					type="range"
					min="1200"
					max="3600"
					step="50"
					value={layoutStore.sizing.contentMaxWidth}
					oninput={(e) => layoutStore.updateSizing('contentMaxWidth', +(e.target as HTMLInputElement).value)}
					class="mt-0.5 w-full"
				/>
			</div>

			<!-- Zone Gap -->
			<div class="mb-2">
				<div class="flex items-center justify-between text-[10px] text-[var(--color-muted)]">
					<span>Zone Gap</span>
					<span class="tabular-nums">{layoutStore.sizing.zoneGap}px</span>
				</div>
				<input
					type="range"
					min="0"
					max="32"
					step="2"
					value={layoutStore.sizing.zoneGap}
					oninput={(e) => layoutStore.updateSizing('zoneGap', +(e.target as HTMLInputElement).value)}
					class="mt-0.5 w-full"
				/>
			</div>

			<div class="rounded border border-[var(--color-border)] bg-[var(--color-bg-input)] px-2 py-2 text-[10px] text-[var(--color-muted)]">
				<div class="mb-1.5 flex items-center justify-between">
					<span class="font-semibold text-[var(--color-text-muted)]">Layout %</span>
				</div>
				<div class="mb-2 flex h-2 w-full overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]">
					<div style="width: {layoutPercentages.left}%; background: color-mix(in srgb, var(--color-text-muted) 58%, transparent);"></div>
					<div style="width: {layoutPercentages.center}%; background: color-mix(in srgb, var(--color-text-muted) 38%, transparent);"></div>
					<div style="width: {layoutPercentages.right}%; background: color-mix(in srgb, var(--color-text-muted) 22%, transparent);"></div>
				</div>
				<div class="grid grid-cols-3 gap-1 tabular-nums">
					<div class="rounded border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-input)_72%,var(--color-bg-card))] px-1.5 py-1 text-center text-[var(--color-text-muted)]">L {layoutPercentages.leftLabel}%</div>
					<div class="rounded border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-input)_72%,var(--color-bg-card))] px-1.5 py-1 text-center text-[var(--color-text-muted)]">C {layoutPercentages.centerLabel}%</div>
					<div class="rounded border border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg-input)_72%,var(--color-bg-card))] px-1.5 py-1 text-center text-[var(--color-text-muted)]">R {layoutPercentages.rightLabel}%</div>
				</div>
			</div>
		</div>

		<!-- ═══ Spacing Section ═══ -->
		<div class="mt-2 border-t border-[var(--color-border)] pt-3">
			<span class="mb-2 block text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Spacing</span>

			<!-- Panel Padding -->
			<div class="mb-2">
				<div class="flex items-center justify-between text-[10px] text-[var(--color-muted)]">
					<span>Panel Padding</span>
					<span class="tabular-nums">{layoutStore.sizing.panelPadding}px</span>
				</div>
				<input
					type="range"
					min="0"
					max="24"
					step="2"
					value={layoutStore.sizing.panelPadding}
					oninput={(e) => layoutStore.updateSizing('panelPadding', +(e.target as HTMLInputElement).value)}
					class="mt-0.5 w-full"
				/>
			</div>

			<!-- Panel Gap -->
			<div class="mb-2">
				<div class="flex items-center justify-between text-[10px] text-[var(--color-muted)]">
					<span>Panel Gap</span>
					<span class="tabular-nums">{layoutStore.sizing.panelGap}px</span>
				</div>
				<input
					type="range"
					min="0"
					max="32"
					step="2"
					value={layoutStore.sizing.panelGap}
					oninput={(e) => layoutStore.updateSizing('panelGap', +(e.target as HTMLInputElement).value)}
					class="mt-0.5 w-full"
				/>
			</div>
		</div>

		<!-- ═══ Panel Visibility ═══ -->
		<div class="mt-2 border-t border-[var(--color-border)] pt-3">
			<span class="mb-2 block text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">Panels</span>
			<div class="space-y-1">
				{#each Object.entries(panelRegistry) as [id, meta]}
					<label class="flex cursor-pointer items-center gap-2 text-xs">
						<input
							type="checkbox"
							checked={!layoutStore.isHidden(id)}
							onchange={() => layoutStore.toggleHidden(id)}
							class="accent-[var(--color-primary)]"
						/>
						<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="opacity-50">
							<path d={meta.icon} />
						</svg>
						<span class:text-[var(--color-muted)]={layoutStore.isHidden(id)}>{meta.label}</span>
					</label>
				{/each}
			</div>
		</div>

		<!-- Reset buttons -->
		<div class="mt-2 border-t border-[var(--color-border)] pt-3 flex gap-2">
			<button
				class="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-input)] px-2 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]"
				onclick={() => layoutStore.resetLayout()}
				title="Reset panel positions to default"
			>
				<span class="flex items-center justify-center gap-1">
					<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
						<path d="M3 3v5h5" />
					</svg>
					Panels
				</span>
			</button>
			<button
				class="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-input)] px-2 py-1.5 text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]"
				onclick={() => layoutStore.resetSizing()}
				title="Reset layout sizing to default"
			>
				<span class="flex items-center justify-center gap-1">
					<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
						<path d="M3 3v5h5" />
					</svg>
					Sizing
				</span>
			</button>
		</div>
	</div>
	{/if}
</div>

<InfoModal bind:open={infoModal.open} onclose={() => infoModal.close()} />
