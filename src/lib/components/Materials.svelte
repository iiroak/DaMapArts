<script lang="ts">
	import { base } from '$app/paths';
	import { getAppState } from '$lib/stores/index.js';
	import { infoModal } from '$lib/stores/infoModal.svelte.js';
	import { locale } from '$lib/stores/locale.svelte.js';

	const app = getAppState();
	const t = locale.t;

	let showDetails = $state(false);
	let perMapMode = $state(false);
	let selectedMapX = $state(0);
	let selectedMapZ = $state(0);

	function getBlockIconStyle(colourSetId: string): string {
		const y = parseInt(colourSetId) * 32;
		return `background-image: url(${base}/images/textures.png); background-position: 0px -${y}px; background-size: 640px 2080px;`;
	}

	// Aggregate materials across all map sections
	let totalMaterials = $derived.by(() => {
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
</script>

<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<div class="flex w-full items-center gap-2">
		<h3 class="flex-1 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">{t('materials.title')}</h3>
		<button
			class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-[var(--color-muted)] opacity-50 transition-all hover:opacity-100 hover:text-[var(--color-primary)] hover:bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
			onclick={(e) => { e.stopPropagation(); infoModal.openTab('export'); }}
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
		<div class="mb-3 flex justify-between text-xs text-[var(--color-muted)]">
			<span>{t('materials.totalBlocks')} {grandTotal.toLocaleString()}</span>
			<span>{t('materials.colors')} {app.resultUniqueColors}</span>
		</div>

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
		class="relative max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl"
		onclick={(e) => e.stopPropagation()}
	>
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-3">
			<div>
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
					<label class="flex cursor-pointer items-center gap-1.5 text-[10px] text-[var(--color-muted)]">
						<input
							type="checkbox"
							bind:checked={perMapMode}
							class="accent-[var(--color-primary)]"
						/>
						{t('materials.perMap')}
					</label>
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

		<!-- Per-map selector -->
		{#if perMapMode && isMultiMap}
			<div class="flex items-center gap-2 border-b border-[var(--color-border)] px-5 py-2">
				<span class="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">{t('materials.map')}</span>
				<div class="flex flex-wrap gap-1">
					{#each Array(app.mapSizeZ) as _, z}
						{#each Array(app.mapSizeX) as _, x}
							<button
								class="rounded px-2 py-0.5 text-[10px] font-medium transition-colors"
								class:bg-[var(--color-primary)]={selectedMapX === x && selectedMapZ === z}
								class:text-white={selectedMapX === x && selectedMapZ === z}
								class:bg-[var(--color-bg-input)]={selectedMapX !== x || selectedMapZ !== z}
								class:text-[var(--color-text)]={selectedMapX !== x || selectedMapZ !== z}
								onclick={() => { selectedMapX = x; selectedMapZ = z; }}
							>({x + 1}, {z + 1})</button>
						{/each}
					{/each}
				</div>
			</div>
		{/if}

		<!-- Table -->
		<div class="overflow-auto px-5 py-3" style="max-height: calc(85vh - 120px);">
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
								<div
									class="h-6 w-6 flex-shrink-0 rounded border border-[var(--color-border)]"
									style="{getBlockIconStyle(mat.colourSetId)} width: 24px; height: 24px; image-rendering: pixelated;"
								></div>
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
	</div>
</div>
{/if}
