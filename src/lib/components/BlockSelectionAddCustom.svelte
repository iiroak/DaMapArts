<script lang="ts">
	import { getAppState } from '$lib/stores/index.js';
	import { modal } from '$lib/stores/modal.svelte.js';
	import { infoModal } from '$lib/stores/infoModal.svelte.js';
	import { locale } from '$lib/stores/locale.svelte.js';
	import type { ColoursJSON, BlockEntry, BlockVersionData } from '$lib/types/colours.js';

	const t = locale.t;

	const app = getAppState();

	// ── Props ──
	interface Props {
		onAddCustomBlock: (
			colourSetId: string,
			name: string,
			nbtTags: [string, string][],
			versions: Record<string, boolean>,
			needsSupport: boolean,
			flammable: boolean,
		) => void;
		onDeleteCustomBlock: (
			colourSetId: string,
			name: string,
			versions: Record<string, boolean>,
		) => void;
		lastSelectedCustomBlock: { colourSetId: string; blockId: string } | null;
	}

	let { onAddCustomBlock, onDeleteCustomBlock, lastSelectedCustomBlock }: Props = $props();

	// ── Supported versions ──
	const supportedVersions = app.supportedVersions as Record<string, { MCVersion: string }>;

	// ── Form state ──
	let blockName = $state('');
	let nbtTags = $state<[string, string][]>([['', '']]);
	let colourSetId = $state(Object.keys(app.coloursJSON as ColoursJSON)[0]);
	let needsSupport = $state(false);
	let flammable = $state(false);
	let versions = $state<Record<string, boolean>>(
		Object.keys(supportedVersions).reduce(
			(acc, key) => {
				acc[key] = false;
				return acc;
			},
			{} as Record<string, boolean>,
		),
	);

	let expanded = $state(false);

	// ── React to lastSelectedCustomBlock changes ──
	$effect(() => {
		if (lastSelectedCustomBlock) {
			loadBlockIntoForm(lastSelectedCustomBlock.colourSetId, lastSelectedCustomBlock.blockId);
		}
	});

	function loadBlockIntoForm(csId: string, blockId: string) {
		const cJSON = app.coloursJSON as unknown as ColoursJSON;
		const blockToLoad = cJSON[csId]?.blocks[blockId];
		if (!blockToLoad) return;

		// Find the first version data that's not a string reference
		const versionData = Object.values(blockToLoad.validVersions).find(
			(v): v is BlockVersionData => typeof v !== 'string',
		);
		if (!versionData) return;

		// Populate name
		blockName = versionData.NBTName;

		// Populate NBT tags
		const tags: [string, string][] = Object.entries(versionData.NBTArgs).map(
			([k, v]) => [k, v] as [string, string],
		);
		tags.push(['', '']);
		nbtTags = tags;

		// Populate colour set
		colourSetId = csId;

		// Populate flags
		needsSupport = blockToLoad.supportBlockMandatory;
		flammable = blockToLoad.flammable;

		// Populate versions
		const newVersions: Record<string, boolean> = {};
		for (const [svKey, svVal] of Object.entries(supportedVersions)) {
			newVersions[svKey] = svVal.MCVersion in blockToLoad.validVersions;
		}
		versions = newVersions;

		// Expand to show loaded block
		expanded = true;
	}

	// ── NBT tag management ──
	function onNbtTagChange(index: number, keyOrValue: 0 | 1, value: string) {
		const newTags = nbtTags.map((t) => [...t] as [string, string]);
		newTags[index][keyOrValue] = value;

		// Remove last row if both of last two are empty
		if (
			index === newTags.length - 2 &&
			newTags[newTags.length - 2].every((t) => t === '') &&
			newTags[newTags.length - 1].every((t) => t === '')
		) {
			newTags.pop();
		} else if (index === newTags.length - 1) {
			// Always keep a blank set at the end
			newTags.push(['', '']);
		}

		nbtTags = newTags;
	}

	// ── Colour helpers ──
	function getColourBg(csId: string): string {
		const cJSON = app.coloursJSON as unknown as ColoursJSON;
		const set = cJSON[csId];
		if (!set) return 'rgb(128,128,128)';
		return `rgb(${set.tonesRGB.normal.join(', ')})`;
	}

	function getColourText(csId: string): string {
		const cJSON = app.coloursJSON as unknown as ColoursJSON;
		const set = cJSON[csId];
		if (!set) return 'white';
		const [r, g, b] = set.tonesRGB.normal;
		return r * 0.299 + g * 0.587 + b * 0.114 > 186 ? 'black' : 'white';
	}

	// ── Handlers ──
	function handleAdd() {
		onAddCustomBlock(colourSetId, blockName, nbtTags, versions, needsSupport, flammable);
	}

	function handleDelete() {
		onDeleteCustomBlock(colourSetId, blockName, versions);
	}
</script>

<!-- Custom Block Section -->
<div class="mt-3 border-t border-[var(--color-border)] pt-3">
	<div class="flex items-center">
		<button
			class="flex flex-1 items-center gap-2 py-1 text-left text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
			onclick={() => (expanded = !expanded)}
		>
			<span class="inline-block transition-transform" class:rotate-90={expanded}>▶</span>
			{t('custom.title')}
			<span class="ml-auto text-[10px] opacity-60">{expanded ? t('custom.collapse') : t('custom.expand')}</span>
		</button>
		<button
			class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-[var(--color-muted)] opacity-50 transition-all hover:opacity-100 hover:text-[var(--color-primary)] hover:bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
			onclick={() => infoModal.openTab('customblocks')}
			title={t('custom.help')}
		>?</button>
	</div>

	{#if expanded}
		<div class="mt-2 space-y-3">
			<!-- Form -->
			<div class="space-y-2 rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
				<!-- Block Name -->
				<label class="block">
					<span class="mb-0.5 block text-xs font-medium text-[var(--color-muted)]">{t('custom.blockName')}</span>
					<div class="flex items-center gap-0">
						<span class="rounded-l border border-r-0 border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg)_80%,var(--color-border))] px-2 py-1 text-xs text-[var(--color-muted)]">
							minecraft:
						</span>
						<input
							type="text"
							class="flex-1 rounded-r border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
							bind:value={blockName}
						placeholder={t('custom.placeholder')}
						/>
					</div>
				</label>

				<!-- NBT Tags -->
				<div>
					<span class="mb-0.5 block text-xs font-medium text-[var(--color-muted)]">{t('custom.nbtTags')}</span>
					<div class="space-y-1">
						{#each nbtTags as [tagKey, tagValue], i}
							<div class="flex items-center gap-1">
								<input
									type="text"
									class="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
									value={tagKey}
									oninput={(e) => onNbtTagChange(i, 0, (e.target as HTMLInputElement).value)}
									placeholder={t('custom.key')}
								/>
								<span class="text-xs text-[var(--color-muted)]">:</span>
								<input
									type="text"
									class="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
									value={tagValue}
									oninput={(e) => onNbtTagChange(i, 1, (e.target as HTMLInputElement).value)}
									placeholder={t('custom.value')}
								/>
							</div>
						{/each}
					</div>
				</div>

				<!-- Colour Set -->
				<label class="block">
					<span class="mb-0.5 block text-xs font-medium text-[var(--color-muted)]">{t('custom.colourSet')}</span>
					<select
						class="w-full rounded border border-[var(--color-border)] px-2 py-1 text-xs outline-none focus:border-[var(--color-primary)]"
						style="background-color: {getColourBg(colourSetId)}; color: {getColourText(colourSetId)};"
						bind:value={colourSetId}
					>
						{#each Object.entries(app.coloursJSON as ColoursJSON) as [csId, cs]}
							<option
								value={csId}
								style="background-color: rgb({cs.tonesRGB.normal.join(', ')}); color: {cs.tonesRGB.normal[0] * 0.299 + cs.tonesRGB.normal[1] * 0.587 + cs.tonesRGB.normal[2] * 0.114 > 186 ? 'black' : 'white'};"
							>
								{cs.colourName}
							</option>
						{/each}
					</select>
				</label>

				<!-- Checkboxes row -->
				<div class="flex flex-wrap gap-4">
					<label class="flex items-center gap-1.5 text-xs text-[var(--color-text)]">
						<input
							type="checkbox"
							class="accent-[var(--color-primary)]"
							bind:checked={needsSupport}
						/>
						{t('custom.needsSupport')}
					</label>
					<label class="flex items-center gap-1.5 text-xs text-[var(--color-text)]">
						<input
							type="checkbox"
							class="accent-[var(--color-primary)]"
							bind:checked={flammable}
						/>
						{t('custom.flammable')}
					</label>
				</div>

				<!-- Versions -->
				<div>
					<span class="mb-0.5 block text-xs font-medium text-[var(--color-muted)]">{t('custom.versions')}</span>
					<div class="flex flex-wrap gap-x-3 gap-y-1">
						{#each Object.entries(supportedVersions) as [svKey, svVal]}
							<label class="flex items-center gap-1 text-xs text-[var(--color-text)]">
								<input
									type="checkbox"
									class="accent-[var(--color-primary)]"
									checked={versions[svKey]}
									onchange={() => (versions[svKey] = !versions[svKey])}
								/>
								{svVal.MCVersion}
							</label>
						{/each}
					</div>
				</div>

				<!-- Buttons -->
				<div class="flex gap-2 pt-1">
					<button
						class="flex flex-1 items-center justify-center gap-1.5 rounded bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)]"
						onclick={handleAdd}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
						</svg>
						{t('custom.addBlock')}
					</button>
					<button
						class="flex flex-1 items-center justify-center gap-1.5 rounded bg-[var(--color-danger)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-80"
						onclick={handleDelete}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
						</svg>
						{t('custom.deleteBlock')}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
