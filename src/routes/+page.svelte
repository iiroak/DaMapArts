<script lang="ts">
	import { onMount } from 'svelte';
	import { getAppState } from '$lib/stores/index.js';
	import { infoModal, type InfoTab } from '$lib/stores/infoModal.svelte.js';
	import { layoutStore } from '$lib/stores/layoutStore.svelte.js';
	import Header from '$lib/components/Header.svelte';
	import DockZone from '$lib/components/DockZone.svelte';
	import SettingsButton from '$lib/components/SettingsButton.svelte';

	const app = getAppState();

	onMount(() => {
		// Force clear old layout data if it doesn't have version field
		try {
			const raw = localStorage.getItem('damaparts-layout');
			if (raw) {
				const parsed = JSON.parse(raw);
				if (!parsed.version || parsed.version < 2) {
					localStorage.removeItem('damaparts-layout');
					location.reload();
					return;
				}
			}
		} catch { /* ignore */ }

		layoutStore.initSizingCSS();

		const info = new URLSearchParams(window.location.search).get('info');
		if (!info) return;

		const tabByParam: Record<string, InfoTab> = {
			about: 'about',
			changelog: 'changelog',
			technology: 'technology',
			general: 'general',
			preprocessing: 'preprocessing',
			processing: 'processing',
			blocks: 'blocks',
			customblocks: 'customblocks',
			export: 'export',
			shortcuts: 'shortcuts',
			faq: 'faq',
		};

		const tab = tabByParam[info];
		if (!tab) return;

		infoModal.openTab(tab);
		window.history.replaceState({}, '', window.location.pathname);
	});
</script>

<div class="flex h-screen flex-col overflow-hidden">
<Header />

<main class="mx-auto flex-1 overflow-hidden w-full px-4 py-4" style="max-width: var(--layout-content-max-width, 1800px);">
	{#if !app.sourceImage}
		<!-- Loading state -->
		<div class="flex h-full items-center justify-center">
			<div class="flex flex-col items-center gap-3 text-[var(--color-muted)]">
				<svg class="animate-spin h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
					<path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" />
				</svg>
				<span class="text-sm">Loading...</span>
			</div>
		</div>
	{:else}
		<!-- Dockable Editor Layout -->
		<div class="dock-layout-grid h-full">
			<!-- Left zone -->
			<DockZone zone="left" panelIds={layoutStore.left} class="overflow-y-auto" />

			<!-- Center zone -->
			<DockZone zone="center" panelIds={layoutStore.center} class="flex flex-col overflow-y-auto" />

			<!-- Right zone -->
			<DockZone zone="right" panelIds={layoutStore.right} class="overflow-y-auto" />
		</div>
	{/if}
</main>
</div>

<SettingsButton />

<style>
	:global(.dock-layout-grid) {
		display: grid;
		grid-template-columns: 1fr;
		gap: 16px;
		gap: var(--layout-zone-gap, 16px);
	}
	@media (min-width: 1024px) {
		:global(.dock-layout-grid) {
			grid-template-columns: 320px 1fr 280px;
			grid-template-columns: var(--layout-left-width, 320px) 1fr var(--layout-right-width, 280px);
		}
	}
</style>
