<script lang="ts">
	import { onMount } from 'svelte';
	import { getAppState } from '$lib/stores/index.js';
	import { infoModal, type InfoTab } from '$lib/stores/infoModal.svelte.js';
	import Header from '$lib/components/Header.svelte';
	import ImageUpload from '$lib/components/ImageUpload.svelte';
	import FilePanel from '$lib/components/FilePanel.svelte';
	import MapPanel from '$lib/components/MapPanel.svelte';
	import ProcessingSettings from '$lib/components/ProcessingSettings.svelte';
	import PreProcessingSettings from '$lib/components/PreProcessingSettings.svelte';
	import ImageSettings from '$lib/components/ImageSettings.svelte';
	import BlockSelection from '$lib/components/BlockSelection.svelte';
	import MapPreview from '$lib/components/MapPreview.svelte';
	import Materials from '$lib/components/Materials.svelte';
	import ExportPanel from '$lib/components/ExportPanel.svelte';
	import Profiles from '$lib/components/Profiles.svelte';
	import SettingsButton from '$lib/components/SettingsButton.svelte';

	const app = getAppState();

	onMount(() => {
		const info = new URLSearchParams(window.location.search).get('info');
		if (!info) return;

		const tabByParam: Record<string, InfoTab> = {
			about: 'about',
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

<main class="mx-auto flex-1 overflow-hidden max-w-[1800px] w-full px-4 py-4">
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
		<!-- Editor state -->
		<div class="grid h-full grid-cols-1 gap-4 lg:grid-cols-[320px_1fr_280px]">
			<!-- Left sidebar -->
			<aside class="space-y-4 overflow-y-auto">
				<FilePanel />
				<MapPanel />
				<PreProcessingSettings />
				<ProcessingSettings />
				<ImageSettings />
			</aside>

			<!-- Center: Canvas preview + Block selection below -->
			<section class="flex flex-col gap-4 overflow-y-auto">
				<MapPreview />
				<BlockSelection />
			</section>

			<!-- Right sidebar: Export + Profiles + Materials -->
			<aside class="space-y-4 overflow-y-auto">
				<ExportPanel />
				<Profiles />
				<Materials />
			</aside>
		</div>
	{/if}
</main>
</div>

<SettingsButton />
