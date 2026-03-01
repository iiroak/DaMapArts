<script lang="ts">
	import { getAppState } from '$lib/stores/index.js';
	import { infoModal } from '$lib/stores/infoModal.svelte.js';
	import { locale } from '$lib/stores/locale.svelte.js';
	import {
		exportNBTJoined,
		exportNBTSplit,
		exportMapdatSplit,
		exportMapdatZip,
		type ExportSettings,
	} from '$lib/export/index.js';
	import supportedVersions from '$lib/data/supportedVersions.json';
	import type { ColoursJSON } from '$lib/types/colours.js';

	const app = getAppState();
	const t = locale.t;

	// Get available map modes
	const modes = Object.entries(app.mapModes).map(([key, val]: [string, any]) => ({
		key,
		uniqueId: val.uniqueId,
		label: val.name || key,
	}));

	let exportProgress = $state(0);
	let isExporting = $state(false);
	let mapdatFilenameUseId = $state(false);
	let mapdatFilenameIdStart = $state(0);
	let exportError = $state<string | null>(null);

	// Mode check: 0 = NBT (schematic), 1 = map.dat
	function isNBTMode(): boolean {
		return app.modeId === 0;
	}

	function getBaseFilename(): string {
		return app.sourceFileName.replace(/\.[^/.]+$/, '') || 'mapart';
	}

	function getVersion() {
		for (const v of Object.values(supportedVersions)) {
			if (v.MCVersion === app.selectedVersion) return v;
		}
		return Object.values(supportedVersions)[Object.values(supportedVersions).length - 1];
	}

	function buildExportSettings(): ExportSettings {
		return {
			coloursJSON: app.coloursJSON as unknown as ColoursJSON,
			version: getVersion(),
			staircasingId: app.staircasingId,
			whereSupportBlocks: app.whereSupportBlocks,
			supportBlock: app.supportBlock,
			waterSupportEnabled: app.waterSupportEnabled,
			normalizeExport: app.normalizeExport,
			selectedBlocks: app.selectedBlocks,
			mapSizeX: app.mapSizeX,
			mapSizeZ: app.mapSizeZ,
			filename: getBaseFilename(),
			mapdatFilenameUseId,
			mapdatFilenameIdStart,
		};
	}

	function hasResults(): boolean {
		return app.resultPixelEntries !== null && app.resultPixelEntries.length > 0;
	}

	function noBlocksSelected(): boolean {
		return Object.values(app.selectedBlocks).every((v) => v === '-1');
	}

	async function handleExport(
		exportFn: (
			entries: any,
			settings: ExportSettings,
			onProgress?: (p: number) => void,
		) => Promise<void> | void,
	) {
		if (!hasResults()) return;
		if (noBlocksSelected()) {
			alert(t('export.noBlocks'));
			return;
		}

		isExporting = true;
		exportProgress = 0;

		try {
			const settings = buildExportSettings();
			await exportFn(app.resultPixelEntries!, settings, (p) => {
				exportProgress = p;
			});
		} catch (err) {
			console.error('Export failed:', err);
			exportError = `${t('export.failed')} ${(err as Error).message}`;
		} finally {
			isExporting = false;
			exportProgress = 0;
		}
	}
	let expanded = $state(true);

	function downloadPNG() {
		if (!app.resultImageData) return;
		const canvas = document.createElement('canvas');
		canvas.width = app.resultImageData.width;
		canvas.height = app.resultImageData.height;
		const ctx = canvas.getContext('2d')!;
		ctx.putImageData(app.resultImageData, 0, 0);
		const link = document.createElement('a');
		link.download = `mapart_${app.mapSizeX}x${app.mapSizeZ}.png`;
		link.href = canvas.toDataURL('image/png');
		link.click();
	}
</script>

<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<div class="flex w-full items-center gap-2">
		<h3 class="flex-1 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">{t('export.title')}</h3>
		<button
			class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-[var(--color-muted)] opacity-50 transition-all hover:opacity-100 hover:text-[var(--color-primary)] hover:bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
			onclick={(e) => { e.stopPropagation(); infoModal.openTab('export'); }}
			title={t('export.help')}
		>?</button>
		<button
			class="flex items-center justify-center"
			onclick={() => (expanded = !expanded)}
		>
			<span class="text-xs text-[var(--color-muted)] transition-transform" class:rotate-90={expanded}>▶</span>
		</button>
	</div>

	{#if expanded}
	<div class="mt-3 space-y-3">

	<!-- Mode -->
	<label class="block">
		<span class="mb-1 block text-xs text-[var(--color-muted)]">{t('export.mode')}</span>
		<select
			class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
			bind:value={app.modeId}
		>
			{#each modes as mode}
				<option value={mode.uniqueId}>{mode.label}</option>
			{/each}
			<option disabled value={-1}>{t('export.daprintSoon')}</option>
		</select>
	</label>

	<!-- Map.dat naming options -->
	{#if !isNBTMode()}
		<div class="space-y-2">
			<label class="flex items-center gap-2 text-xs">
				<input type="checkbox" bind:checked={mapdatFilenameUseId} />
				<span class="text-[var(--color-muted)]">{t('export.useMapId')}</span>
			</label>
			{#if mapdatFilenameUseId}
				<div>
					<label class="mb-1 block text-xs text-[var(--color-muted)]" for="mapdat-id-start">
						{t('export.startingMapId')}
					</label>
					<input
						id="mapdat-id-start"
						type="number"
						min="0"
						class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm"
						bind:value={mapdatFilenameIdStart}
					/>
				</div>
			{/if}
		</div>
	{/if}

	{#if isNBTMode()}
		<label class="flex items-center gap-2 text-xs">
			<input type="checkbox" bind:checked={app.normalizeExport} />
			<span class="text-[var(--color-muted)]">{t('export.normalizeCoords')}</span>
		</label>
	{/if}

	<!-- Progress bar -->
	{#if isExporting}
		<div class="h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface)]">
			<div
				class="h-full rounded-full bg-green-500 transition-all"
				style="width: {Math.round(exportProgress * 100)}%"
			></div>
		</div>
	{/if}

	<!-- Export buttons -->
	<div class="flex flex-col gap-2">
		<!-- Download PNG (preview image) -->
		<button
			class="w-full rounded bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
			disabled={!hasResults() || isExporting}
			onclick={downloadPNG}
		>
			{t('export.downloadPNG')}
		</button>

		{#if isNBTMode()}
			<button
				class="w-full rounded bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
				disabled={!hasResults() || isExporting}
				onclick={() => handleExport(exportNBTJoined)}
			>
				{t('export.downloadNBT')}
			</button>

			{#if app.mapSizeX > 1 || app.mapSizeZ > 1}
				<button
					class="w-full rounded bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
					disabled={!hasResults() || isExporting}
					onclick={() => handleExport(exportNBTSplit)}
				>
					{t('export.downloadNBTSplit')}
				</button>
			{/if}
		{:else}
			<button
				class="w-full rounded bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
				disabled={!hasResults() || isExporting}
				onclick={() => handleExport(exportMapdatSplit)}
			>
				{t('export.downloadDAT')}
			</button>

			{#if app.mapSizeX > 1 || app.mapSizeZ > 1}
				<button
					class="w-full rounded bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
					disabled={!hasResults() || isExporting}
					onclick={() => handleExport(exportMapdatZip)}
				>
					{t('export.downloadDATSplit')}
				</button>
			{/if}
		{/if}
	</div>
	</div>
	{/if}
</div>

{#if exportError}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
		onclick={() => (exportError = null)}
		onkeydown={(e) => e.key === 'Escape' && (exportError = null)}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-2xl"
			onclick={(e) => e.stopPropagation()}
		>
			<h4 class="mb-2 text-sm font-semibold text-[var(--color-text)]">{t('export.errorTitle')}</h4>
			<p class="mb-4 text-xs text-[var(--color-muted)]">{exportError}</p>
			<div class="flex justify-end">
				<button
					class="rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-primary-hover)]"
					onclick={() => (exportError = null)}
				>
					OK
				</button>
			</div>
		</div>
	</div>
{/if}
