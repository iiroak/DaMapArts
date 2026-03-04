<script lang="ts">
	import { base } from '$app/paths';
	import { getAppState } from '$lib/stores/index.js';
	import { infoModal } from '$lib/stores/infoModal.svelte.js';
	import { locale } from '$lib/stores/locale.svelte.js';
	import { computeRealNBTMaterialCounts, type ExportSettings } from '$lib/export/index.js';
	import supportedVersions from '$lib/data/supportedVersions.json';
	import type { ColoursJSON } from '$lib/types/colours.js';

	const app = getAppState();
	const t = locale.t;

	let showDetails = $state(false);
	let perMapMode = $state(false);
	let selectedMapX = $state(0);
	let selectedMapZ = $state(0);
	let realNbtCounts = $state<Record<string, number> | null>(null);
	let realNbtTotal = $state<number | null>(null);
	let realNbtLoading = $state(false);

	function getVersion() {
		for (const v of Object.values(supportedVersions)) {
			if (v.MCVersion === app.selectedVersion) return v;
		}
		return Object.values(supportedVersions)[Object.values(supportedVersions).length - 1];
	}

	function buildExportSettings(): ExportSettings {
		// Snapshot proxy-wrapped objects to avoid Svelte $state Proxy overhead
		// during heavy computation (coloursJSON + selectedBlocks accessed millions of times)
		return {
			coloursJSON: $state.snapshot(app.coloursJSON) as unknown as ColoursJSON,
			version: getVersion(),
			staircasingId: app.staircasingId,
			whereSupportBlocks: app.whereSupportBlocks,
			supportBlock: app.supportBlock,
			waterSupportEnabled: app.waterSupportEnabled,
			normalizeExport: app.normalizeExport,
			selectedBlocks: $state.snapshot(app.selectedBlocks),
			mapSizeX: app.mapSizeX,
			mapSizeZ: app.mapSizeZ,
			filename: 'mapart',
			mapdatFilenameUseId: false,
			mapdatFilenameIdStart: 0,
		};
	}

	function resolveColourSetFromBlockName(blockName: string): string | null {
		const colourEntries = Object.entries(app.coloursJSON as Record<string, any>);
		for (const [csId, colourSet] of colourEntries) {
			const selectedBlockId = app.selectedBlocks[csId];
			const selectedBlock = colourSet?.blocks?.[selectedBlockId];
			if (selectedBlock?.displayName === blockName) return csId;
		}
		return null;
	}

	$effect(() => {
		const indices = app.resultPixelIndices;
		const pal = app.resultPalette;
		if (!indices || indices.length === 0 || !pal || app.modeId !== 0) {
			realNbtCounts = null;
			realNbtTotal = null;
			return;
		}

		realNbtLoading = true;
		const runId = `${indices.length}-${app.staircasingId}-${app.whereSupportBlocks}-${app.supportBlock}-${app.waterSupportEnabled}-${app.mapSizeX}-${app.mapSizeZ}`;
		// Snapshot palette to avoid proxy overhead during heavy iteration
		const plainPal = $state.snapshot(pal);

		queueMicrotask(() => {
			try {
				const counts = computeRealNBTMaterialCounts(indices, plainPal, buildExportSettings());
				realNbtCounts = counts;
				const total = Object.values(counts).reduce((sum, c) => sum + c, 0);
				// Guard against stale updates if config changed during compute
				const freshRunId = `${(app.resultPixelIndices?.length ?? 0)}-${app.staircasingId}-${app.whereSupportBlocks}-${app.supportBlock}-${app.waterSupportEnabled}-${app.mapSizeX}-${app.mapSizeZ}`;
				if (freshRunId === runId) {
					realNbtCounts = counts;
					realNbtTotal = total;
				}
			} catch {
				realNbtCounts = null;
				realNbtTotal = null;
			} finally {
				realNbtLoading = false;
			}
		});
	});

	function getBlockIconStyle(colourSetId: string): string {
		const y = parseInt(colourSetId) * 24;
		return `background-image: url(${base}/images/textures.png); background-position: 0px -${y}px; background-size: 480px 1560px;`;
	}

	// Aggregate materials across all map sections (color-based fallback)
	let colorTotalMaterials = $derived.by(() => {
		if (!app.resultMaps) return [];

		const totals: Record<string, number> = {};
		for (const row of app.resultMaps) {
			for (const section of row) {
				for (const [csId, count] of Object.entries(section.materials)) {
					totals[csId] = (totals[csId] || 0) + count;
				}
			}
		}

		return Object.entries(totals)
			.filter(([_, count]) => count > 0)
			.sort((a, b) => b[1] - a[1])
			.map(([csId, count]) => {
				const colourSet = (app.coloursJSON as any)[csId];
				const blockId = app.selectedBlocks[csId];
				const block = colourSet?.blocks?.[blockId];
				const rgb = colourSet?.tonesRGB?.normal ?? [128, 128, 128];
				return {
					colourSetId: csId,
					blockName: block?.displayName ?? `Block ${csId}`,
					count,
					rgb: rgb as [number, number, number],
					stacks: Math.ceil(count / 64),
					shulkers: Math.ceil(count / (64 * 27)),
				};
			});
	});

	// Real NBT material list (from final placed blocks)
	let realTotalMaterials = $derived.by(() => {
		if (!realNbtCounts) return [];
		return Object.entries(realNbtCounts)
			.filter(([, count]) => count > 0)
			.sort((a, b) => b[1] - a[1])
			.map(([blockName, count]) => {
				const resolvedCsId = resolveColourSetFromBlockName(blockName);
				const colourSet = resolvedCsId ? (app.coloursJSON as any)[resolvedCsId] : null;
				const rgb = colourSet?.tonesRGB?.normal ?? [128, 128, 128];

				return {
					colourSetId: resolvedCsId ?? '__real__',
					blockName,
					count,
					rgb: rgb as [number, number, number],
					stacks: Math.ceil(count / 64),
					shulkers: Math.ceil(count / (64 * 27)),
				};
			});
	});

	// Use real NBT materials as standard when available in NBT mode
	let totalMaterials = $derived.by(() => {
		if (app.modeId === 0 && realTotalMaterials.length > 0) return realTotalMaterials;
		return colorTotalMaterials;
	});

	// Per-map materials for the selected map section
	let perMapMaterials = $derived.by(() => {
		if (!app.resultMaps || !perMapMode) return [];
		const section = app.resultMaps[selectedMapZ]?.[selectedMapX];
		if (!section) return [];

		return Object.entries(section.materials)
			.filter(([_, count]) => count > 0)
			.sort((a, b) => b[1] - a[1])
			.map(([csId, count]) => {
				const colourSet = (app.coloursJSON as any)[csId];
				const blockId = app.selectedBlocks[csId];
				const block = colourSet?.blocks?.[blockId];
				const rgb = colourSet?.tonesRGB?.normal ?? [128, 128, 128];
				return {
					colourSetId: csId,
					blockName: block?.displayName ?? `Block ${csId}`,
					count,
					rgb: rgb as [number, number, number],
					stacks: Math.ceil(count / 64),
					shulkers: Math.ceil(count / (64 * 27)),
				};
			});
	});

	let activeMaterials = $derived(perMapMode ? perMapMaterials : totalMaterials);
	let activeTotal = $derived(activeMaterials.reduce((sum, m) => sum + m.count, 0));
	let activeStacks = $derived(activeMaterials.reduce((sum, m) => sum + m.stacks, 0));
	let activeShulkers = $derived(activeMaterials.reduce((sum, m) => sum + m.shulkers, 0));

	let grandTotal = $derived(totalMaterials.reduce((sum, m) => sum + m.count, 0));

	let isMultiMap = $derived(app.mapSizeX > 1 || app.mapSizeZ > 1);

	let expanded = $state(true);
	let exportFormat = $state<'txt' | 'csv' | 'json'>('txt');
	let exportCopied = $state(false);
	let exportDropdownOpen = $state(false);
	let showMapPicker = $state(false);
	let mapPickerCanvas = $state<HTMLCanvasElement>(undefined!);

	type MaterialItem = { blockName: string; count: number; stacks: number; shulkers: number };

	function formatMaterialCount(count: number): string {
		if (count < 64) return `${count}`;
		const numberOfShulkers = Math.floor(count / 1728);
		const numberOfStacks = Math.floor((count % 1728) / 64);
		const remainder = count % 64;
		const sb = numberOfShulkers > 0 ? `${numberOfShulkers} SB` : '';
		const st = numberOfStacks > 0 ? `${numberOfStacks} ST` : '';
		const items = remainder > 0 ? `${remainder}` : '';
		const parts = [sb, st, items].filter(Boolean).join(' + ');
		return `${count} (${parts})`;
	}

	function buildExportTxt(materials: MaterialItem[]): string {
		const CRLF = '\r\n';
		const SEP = '  ';

		// Compute column widths
		const hBlock = 'Block';
		const hBlocks = 'Blocks';
		const hStacks = 'Stacks';
		const hShulkers = 'Shulkers';

		let nameW = hBlock.length;
		let countW = hBlocks.length;
		let stackW = hStacks.length;
		let shulkW = hShulkers.length;

		for (const m of materials) {
			nameW = Math.max(nameW, m.blockName.length);
			countW = Math.max(countW, m.count.toLocaleString().length);
			stackW = Math.max(stackW, m.stacks.toLocaleString().length);
			shulkW = Math.max(shulkW, m.shulkers.toString().length);
		}

		// Totals
		const totalCount = materials.reduce((s, m) => s + m.count, 0);
		const totalStacks = materials.reduce((s, m) => s + m.stacks, 0);
		const totalShulkers = materials.reduce((s, m) => s + m.shulkers, 0);
		countW = Math.max(countW, totalCount.toLocaleString().length);
		stackW = Math.max(stackW, totalStacks.toLocaleString().length);
		shulkW = Math.max(shulkW, totalShulkers.toString().length);

		const header = hBlock.padEnd(nameW) + SEP + hBlocks.padStart(countW) + SEP + hStacks.padStart(stackW) + SEP + hShulkers.padStart(shulkW);
		const divider = '─'.repeat(header.length);

		const lines = [header, divider];
		for (const m of materials) {
			lines.push(
				m.blockName.padEnd(nameW) + SEP +
				m.count.toLocaleString().padStart(countW) + SEP +
				m.stacks.toLocaleString().padStart(stackW) + SEP +
				m.shulkers.toString().padStart(shulkW)
			);
		}
		lines.push(divider);
		lines.push(
			'Total'.padEnd(nameW) + SEP +
			totalCount.toLocaleString().padStart(countW) + SEP +
			totalStacks.toLocaleString().padStart(stackW) + SEP +
			totalShulkers.toString().padStart(shulkW)
		);

		return lines.join(CRLF);
	}

	function buildExportCsv(materials: MaterialItem[]): string {
		const rows = ['Block,Count,Stacks,Shulkers'];
		for (const m of materials) {
			const name = m.blockName.includes(',') ? `"${m.blockName}"` : m.blockName;
			rows.push(`${name},${m.count},${m.stacks},${m.shulkers}`);
		}
		return rows.join('\r\n');
	}

	function buildExportJson(materials: MaterialItem[]): string {
		const data = materials.map((m) => ({
			block: m.blockName,
			count: m.count,
			stacks: m.stacks,
			shulkers: m.shulkers,
		}));
		return JSON.stringify(data, null, 2);
	}

	function getExportContent(): string {
		const mats = activeMaterials;
		switch (exportFormat) {
			case 'csv': return buildExportCsv(mats);
			case 'json': return buildExportJson(mats);
			default: return buildExportTxt(mats);
		}
	}

	function getExportMimeType(): string {
		switch (exportFormat) {
			case 'csv': return 'text/csv';
			case 'json': return 'application/json';
			default: return 'text/plain';
		}
	}

	function getExportExtension(): string {
		switch (exportFormat) {
			case 'csv': return 'csv';
			case 'json': return 'json';
			default: return 'txt';
		}
	}

	function copyMaterialsToClipboard() {
		const content = getExportContent();
		navigator.clipboard.writeText(content).then(() => {
			exportCopied = true;
			setTimeout(() => (exportCopied = false), 2000);
		});
	}

	function downloadMaterialsFile() {
		const content = getExportContent();
		const blob = new Blob([content], { type: getExportMimeType() });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `materials.${getExportExtension()}`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function openMapPicker() {
		showMapPicker = true;
		// Draw the result image onto the picker canvas after it mounts
		requestAnimationFrame(() => drawMapPickerCanvas());
	}

	function drawMapPickerCanvas() {
		if (!mapPickerCanvas || !app.resultImageData) return;
		const img = app.resultImageData;
		mapPickerCanvas.width = img.width;
		mapPickerCanvas.height = img.height;
		const ctx = mapPickerCanvas.getContext('2d');
		if (!ctx) return;
		ctx.putImageData(img, 0, 0);

		// Draw grid lines
		const cellW = img.width / app.mapSizeX;
		const cellH = img.height / app.mapSizeZ;
		ctx.strokeStyle = 'rgba(255,255,255,0.5)';
		ctx.lineWidth = 1;
		for (let x = 1; x < app.mapSizeX; x++) {
			ctx.beginPath();
			ctx.moveTo(x * cellW, 0);
			ctx.lineTo(x * cellW, img.height);
			ctx.stroke();
		}
		for (let z = 1; z < app.mapSizeZ; z++) {
			ctx.beginPath();
			ctx.moveTo(0, z * cellH);
			ctx.lineTo(img.width, z * cellH);
			ctx.stroke();
		}

		// Highlight selected cell
		ctx.strokeStyle = 'rgba(139,92,246,0.9)';
		ctx.lineWidth = 2;
		ctx.strokeRect(selectedMapX * cellW + 1, selectedMapZ * cellH + 1, cellW - 2, cellH - 2);

		// Draw labels
		ctx.font = `bold ${Math.max(10, Math.min(cellW, cellH) * 0.2)}px sans-serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		for (let z = 0; z < app.mapSizeZ; z++) {
			for (let x = 0; x < app.mapSizeX; x++) {
				const cx = x * cellW + cellW / 2;
				const cy = z * cellH + cellH / 2;
				const isSelected = x === selectedMapX && z === selectedMapZ;
				ctx.fillStyle = isSelected ? 'rgba(139,92,246,0.85)' : 'rgba(0,0,0,0.5)';
				ctx.fillRect(cx - cellW * 0.2, cy - cellH * 0.12, cellW * 0.4, cellH * 0.24);
				ctx.fillStyle = 'white';
				ctx.fillText(`${x + 1},${z + 1}`, cx, cy);
			}
		}
	}

	function handleMapPickerClick(e: MouseEvent) {
		if (!mapPickerCanvas || !app.resultImageData) return;
		const rect = mapPickerCanvas.getBoundingClientRect();
		const scaleX = app.resultImageData.width / rect.width;
		const scaleY = app.resultImageData.height / rect.height;
		const px = (e.clientX - rect.left) * scaleX;
		const py = (e.clientY - rect.top) * scaleY;
		const cellW = app.resultImageData.width / app.mapSizeX;
		const cellH = app.resultImageData.height / app.mapSizeZ;
		const x = Math.floor(px / cellW);
		const z = Math.floor(py / cellH);
		if (x >= 0 && x < app.mapSizeX && z >= 0 && z < app.mapSizeZ) {
			selectedMapX = x;
			selectedMapZ = z;
			perMapMode = true;
			showMapPicker = false;
		}
	}
</script>

<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<div class="flex w-full items-center gap-2 pl-8">
		<h3 class="flex-1 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">{t('materials.title')}</h3>
		<button
			class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-[var(--color-muted)] opacity-50 transition-all hover:opacity-100 hover:text-[var(--color-primary)] hover:bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
			onclick={(e) => { e.stopPropagation(); infoModal.openTab('export', 'materials'); }}
			title={t('materials.help')}
		>?</button>
		<button
			class="flex items-center justify-center"
			onclick={() => (expanded = !expanded)}
		>
			<span class="text-xs text-[var(--color-muted)] transition-transform" class:rotate-90={expanded}>▶</span>
		</button>
	</div>

	{#if expanded}
	{#if totalMaterials.length === 0}
		<p class="mt-3 text-xs text-[var(--color-muted)]">{t('materials.empty')}</p>
	{:else}
		<div class="mt-3 mb-3 flex justify-between text-xs text-[var(--color-muted)]">
			<span>{t('materials.totalBlocks')} {grandTotal.toLocaleString()}</span>
			<span>{t('materials.colors')} {app.resultUniqueColors}</span>
		</div>
		{#if app.modeId === 0 && realNbtLoading}
			<div class="mb-3 text-[11px] text-[var(--color-muted)]">
				<span>Calculating real NBT materials…</span>
			</div>
		{/if}

		<div class="max-h-[600px] space-y-1 overflow-y-auto">
			{#each totalMaterials as mat}
				<div class="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-[var(--color-bg)]">
					<span
						class="inline-block h-3 w-3 flex-shrink-0 rounded-sm border border-[var(--color-border)]"
						style="background-color: rgb({mat.rgb[0]}, {mat.rgb[1]}, {mat.rgb[2]})"
					></span>
					<span class="flex-1 truncate">{mat.blockName}</span>
					<span class="flex-shrink-0 tabular-nums text-[var(--color-muted)]">
						{mat.count.toLocaleString()}
					</span>
				</div>
			{/each}
		</div>

		<!-- Details button -->
		<button
			class="mt-3 w-full rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)]"
			onclick={() => (showDetails = true)}
		>
			{t('materials.viewDetails')}
		</button>
	{/if}
	{/if}
</div>

<!-- Details Modal -->
{#if showDetails}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
	onclick={() => (showDetails = false)}
	onkeydown={(e) => e.key === 'Escape' && (showDetails = false)}
>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl"
		onclick={(e) => e.stopPropagation()}
	>
		<!-- Header -->
		<div class="flex flex-shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
			<div class="min-w-0 flex-1">
				<h2 class="text-sm font-bold text-[var(--color-text)]">{t('materials.detailsTitle')}</h2>
				<p class="text-[10px] text-[var(--color-muted)]">
					{activeMaterials.length} materials — {activeTotal.toLocaleString()} blocks
					{#if perMapMode}
						— Map ({selectedMapX + 1}, {selectedMapZ + 1})
					{/if}
				</p>
			</div>
			<div class="flex items-center gap-2">
				{#if isMultiMap}
					<!-- Toggle switch: Total ↔ Map -->
					<div class="flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5">
						<button
							class="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-all duration-200"
							class:bg-[var(--color-primary)]={!perMapMode}
							class:text-white={!perMapMode}
							class:text-[var(--color-muted)]={perMapMode}
							onclick={() => (perMapMode = false)}
						>Total</button>
						<button
							class="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-all duration-200"
							class:bg-[var(--color-primary)]={perMapMode}
							class:text-white={perMapMode}
							class:text-[var(--color-muted)]={!perMapMode}
							onclick={() => (perMapMode = true)}
						>Map</button>
					</div>
					<!-- Visual map picker button -->
					{#if app.resultImageData}
						<button
							class="rounded p-1 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-bg)] hover:text-[var(--color-primary)]"
							onclick={openMapPicker}
							title="Select map visually"
						>
							<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
								<rect x="1" y="1" width="14" height="14" rx="1.5" />
								<path d="M1 5.5h14M1 10.5h14M5.5 1v14M10.5 1v14" />
							</svg>
						</button>
					{/if}
				{/if}
				<button
					class="rounded p-1 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
					onclick={() => (showDetails = false)}
					aria-label="Close"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Per-map selector (scrollable) -->
		{#if perMapMode && isMultiMap}
			<div class="max-h-20 flex-shrink-0 overflow-auto border-b border-[var(--color-border)] px-5 py-2">
				<div class="flex flex-wrap gap-1">
					{#each Array(app.mapSizeZ) as _, z}
						{#each Array(app.mapSizeX) as _, x}
							<button
								class="rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums transition-all duration-150"
								class:bg-[var(--color-primary)]={selectedMapX === x && selectedMapZ === z}
								class:text-white={selectedMapX === x && selectedMapZ === z}
								class:bg-[var(--color-bg-input)]={selectedMapX !== x || selectedMapZ !== z}
								class:text-[var(--color-muted)]={selectedMapX !== x || selectedMapZ !== z}
								class:hover:text-[var(--color-text)]={selectedMapX !== x || selectedMapZ !== z}
								onclick={() => { selectedMapX = x; selectedMapZ = z; }}
							>{x + 1},{z + 1}</button>
						{/each}
					{/each}
				</div>
			</div>
		{/if}

		<!-- Table (scrollable middle) -->
		<div class="min-h-0 flex-1 overflow-auto px-5 py-3">
			<table class="w-full text-xs">
				<thead>
					<tr class="border-b border-[var(--color-border)] text-left text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
						<th class="pb-2 pr-2"></th>
						<th class="pb-2 pr-2">{t('materials.block')}</th>
						<th class="pb-2 pr-2 text-right">{t('materials.blocks')}</th>
						<th class="pb-2 pr-2 text-right">{t('materials.stacks')}</th>
						<th class="pb-2 text-right">{t('materials.shulkers')}</th>
					</tr>
				</thead>
				<tbody>
					{#each activeMaterials as mat}
						<tr class="border-b border-[var(--color-border)]/30 hover:bg-[var(--color-bg)]">
							<td class="py-1.5 pr-2">
								{#if mat.colourSetId === '__real__'}
									<div
										class="h-6 w-6 flex-shrink-0 rounded border border-[var(--color-border)]"
										style="background-color: rgb({mat.rgb[0]}, {mat.rgb[1]}, {mat.rgb[2]});"
									></div>
								{:else}
									<div
										class="h-6 w-6 flex-shrink-0 rounded border border-[var(--color-border)]"
										style="{getBlockIconStyle(mat.colourSetId)} width: 24px; height: 24px; image-rendering: pixelated;"
									></div>
								{/if}
							</td>
							<td class="py-1.5 pr-2 font-medium">{mat.blockName}</td>
							<td class="py-1.5 pr-2 text-right tabular-nums text-[var(--color-muted)]">{mat.count.toLocaleString()}</td>
							<td class="py-1.5 pr-2 text-right tabular-nums text-[var(--color-muted)]">{mat.stacks.toLocaleString()}</td>
							<td class="py-1.5 text-right tabular-nums text-[var(--color-muted)]">{mat.shulkers}</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr class="border-t border-[var(--color-border)] font-semibold">
						<td class="pt-2 pr-2"></td>
						<td class="pt-2 pr-2">{t('materials.total')}</td>
						<td class="pt-2 pr-2 text-right tabular-nums">{activeTotal.toLocaleString()}</td>
						<td class="pt-2 pr-2 text-right tabular-nums">{activeStacks.toLocaleString()}</td>
						<td class="pt-2 text-right tabular-nums">{activeShulkers}</td>
					</tr>
				</tfoot>
			</table>
		</div>

		<!-- Export Footer -->
		<div class="flex flex-shrink-0 flex-wrap items-center gap-2 border-t border-[var(--color-border)] px-5 py-3">
			<span class="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{t('materials.export')}</span>

			<!-- Format dropdown -->
			<div class="relative">
				<button
					class="flex items-center gap-1.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-input)] px-2.5 py-1 text-[11px] text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)]"
					onclick={() => (exportDropdownOpen = !exportDropdownOpen)}
				>
					<span>
						{#if exportFormat === 'txt'}{t('materials.exportTxt')}{:else if exportFormat === 'csv'}{t('materials.exportCsv')}{:else}{t('materials.exportJson')}{/if}
					</span>
					<svg class="h-3 w-3 text-[var(--color-muted)]" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M3 5l3 3 3-3" />
					</svg>
				</button>
				{#if exportDropdownOpen}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="fixed inset-0 z-[60]"
						onclick={() => (exportDropdownOpen = false)}
						onkeydown={(e) => e.key === 'Escape' && (exportDropdownOpen = false)}
					></div>
					<div class="absolute bottom-full left-0 z-[61] mb-1 min-w-[140px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] py-1 shadow-lg">
						<button
							class="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] transition-colors hover:bg-[var(--color-bg)]"
							class:text-[var(--color-primary)]={exportFormat === 'txt'}
							class:font-semibold={exportFormat === 'txt'}
							class:text-[var(--color-text)]={exportFormat !== 'txt'}
							onclick={() => { exportFormat = 'txt'; exportDropdownOpen = false; }}
						>
							<svg class="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="1" width="12" height="14" rx="1.5" /><path d="M5 5h6M5 8h6M5 11h4" /></svg>
							{t('materials.exportTxt')}
						</button>
						<button
							class="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] transition-colors hover:bg-[var(--color-bg)]"
							class:text-[var(--color-primary)]={exportFormat === 'csv'}
							class:font-semibold={exportFormat === 'csv'}
							class:text-[var(--color-text)]={exportFormat !== 'csv'}
							onclick={() => { exportFormat = 'csv'; exportDropdownOpen = false; }}
						>
							<svg class="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="2" y="1" width="12" height="14" rx="1.5" /><path d="M2 5h12M2 9h12M6 1v14M10 1v14" /></svg>
							{t('materials.exportCsv')}
						</button>
						<button
							class="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] transition-colors hover:bg-[var(--color-bg)]"
							class:text-[var(--color-primary)]={exportFormat === 'json'}
							class:font-semibold={exportFormat === 'json'}
							class:text-[var(--color-text)]={exportFormat !== 'json'}
							onclick={() => { exportFormat = 'json'; exportDropdownOpen = false; }}
						>
							<svg class="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M5 2C3.5 2 3 3 3 4v2c0 1-1 1.5-1 1.5S3 8 3 9v3c0 1 .5 2 2 2M11 2c1.5 0 2 1 2 2v2c0 1 1 1.5 1 1.5s-1 .5-1 1.5v3c0 1-.5 2-2 2" /></svg>
							{t('materials.exportJson')}
						</button>
					</div>
				{/if}
			</div>

			<div class="ml-auto flex items-center gap-2">
				<!-- Copy to clipboard -->
				<button
					class="flex items-center gap-1.5 rounded bg-[var(--color-bg-input)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-text)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-primary)_15%,transparent)] hover:text-[var(--color-primary)]"
					onclick={copyMaterialsToClipboard}
				>
					{#if exportCopied}
						<svg class="h-3.5 w-3.5 text-green-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8.5l3 3 7-7" /></svg>
						<span class="text-green-400">{t('materials.exportCopied')}</span>
					{:else}
						<svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="5" y="5" width="9" height="9" rx="1.5" /><path d="M5 11H3.5A1.5 1.5 0 012 9.5v-7A1.5 1.5 0 013.5 1h7A1.5 1.5 0 0112 2.5V5" /></svg>
						{t('materials.copyClipboard')}
					{/if}
				</button>

				<!-- Download file -->
				<button
					class="flex items-center gap-1.5 rounded bg-[var(--color-primary)] px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)]"
					onclick={downloadMaterialsFile}
				>
					<svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v9M5 8l3 3 3-3M3 13h10" /></svg>
					{t('materials.downloadFile')}
				</button>
			</div>
		</div>
	</div>
</div>
{/if}

<!-- Visual Map Picker Overlay -->
{#if showMapPicker}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm"
	onclick={() => (showMapPicker = false)}
	onkeydown={(e) => e.key === 'Escape' && (showMapPicker = false)}
>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="relative max-h-[80vh] max-w-[80vw] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4 shadow-2xl"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="mb-3 flex items-center justify-between">
			<h3 class="text-xs font-semibold text-[var(--color-text)]">Select Map Section</h3>
			<button
				class="rounded p-1 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
				onclick={() => (showMapPicker = false)}
				aria-label="Close"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6 6 18M6 6l12 12" />
				</svg>
			</button>
		</div>
		<canvas
			bind:this={mapPickerCanvas}
			class="max-h-[65vh] max-w-full cursor-pointer rounded border border-[var(--color-border)]"
			style="image-rendering: pixelated;"
			onclick={handleMapPickerClick}
		></canvas>
	</div>
</div>
{/if}
