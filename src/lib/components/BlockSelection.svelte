<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import { getAppState } from '$lib/stores/index.js';
	import { modal } from '$lib/stores/modal.svelte.js';
	import { infoModal } from '$lib/stores/infoModal.svelte.js';
	import { locale } from '$lib/stores/locale.svelte.js';
	import type { ColoursJSON, ColourSet, BlockEntry } from '$lib/types/colours.js';
	import { isBlockAvailable } from '$lib/palette/colours.js';
	import mapModes from '$lib/data/mapModes.json';
	import defaultPresetsData from '$lib/data/defaultPresets.json';
	import coloursJSONBase from '$lib/data/coloursJSON.json';
	import BlockSelectionAddCustom from './BlockSelectionAddCustom.svelte';

	const app = getAppState();
	const t = locale.t;

	// ── Custom Blocks ──
	const CUSTOM_BLOCKS_KEY = 'mapartcraft_customBlocks';

	/** Stored custom blocks: Array of [colourSetId, BlockEntry] */
	type CustomBlock = [string, BlockEntry];
	let customBlocks = $state<CustomBlock[]>([]);
	let lastSelectedCustomBlock = $state<{ colourSetId: string; blockId: string } | null>(null);

	function loadCustomBlocks(): CustomBlock[] {
		try {
			const stored = localStorage.getItem(CUSTOM_BLOCKS_KEY);
			if (stored) return JSON.parse(stored) as CustomBlock[];
		} catch { /* ignore */ }
		return [];
	}

	function saveCustomBlocks(blocks: CustomBlock[]) {
		try {
			localStorage.setItem(CUSTOM_BLOCKS_KEY, JSON.stringify(blocks));
		} catch { /* quota exceeded */ }
	}

	/**
	 * Merge custom blocks into a fresh copy of base coloursJSON.
	 * Each custom block is appended with the next available key in its colour set.
	 */
	function getMergedColoursJSON(blocks: CustomBlock[]): ColoursJSON {
		const base = JSON.parse(JSON.stringify(coloursJSONBase)) as ColoursJSON;
		for (const [csId, customBlock] of blocks) {
			if (!(csId in base)) continue;
			const nextKey = Object.keys(base[csId].blocks).length.toString();
			base[csId].blocks[nextKey] = customBlock;
		}
		return base;
	}

	function applyCustomBlocks(blocks: CustomBlock[]) {
		customBlocks = blocks;
		saveCustomBlocks(blocks);
		app.coloursJSON = getMergedColoursJSON(blocks) as any;
	}

	const supportedVersions = app.supportedVersions as Record<string, { MCVersion: string }>;

	function handleAddCustomBlock(
		block_colourSetId: string,
		block_name: string,
		block_nbtTags: [string, string][],
		block_versions: Record<string, boolean>,
		block_needsSupport: boolean,
		block_flammable: boolean,
	) {
		const nameTrimmed = block_name.trim();
		if (nameTrimmed === '') {
			modal.showAlert(t('blocks.enterBlockName'), t('blocks.error'));
			return;
		}
		if (Object.values(block_versions).every((v) => !v)) {
			modal.showAlert(t('blocks.selectVersion'), t('blocks.error'));
			return;
		}

		const blockToAdd: BlockEntry = {
			displayName: nameTrimmed,
			validVersions: {},
			supportBlockMandatory: block_needsSupport,
			flammable: block_flammable,
			presetIndex: -999, // marker for custom
		};

		let addedFirstVersion = false;
		for (const [vKey, isSelected] of Object.entries(block_versions)) {
			if (!isSelected) continue;
			const mcVer = supportedVersions[vKey]?.MCVersion;
			if (!mcVer) continue;

			if (addedFirstVersion) {
				blockToAdd.validVersions[mcVer] = `&${Object.keys(blockToAdd.validVersions)[0]}`;
			} else {
				const args: Record<string, string> = {};
				for (const [k, v] of block_nbtTags) {
					const kt = k.trim();
					const vt = v.trim();
					if (kt !== '' || vt !== '') {
						args[kt] = vt;
					}
				}
				blockToAdd.validVersions[mcVer] = { NBTName: nameTrimmed, NBTArgs: args };
				addedFirstVersion = true;
			}
		}

		// Filter out any existing custom block with same colourSet, name, and overlapping versions
		const newCustomBlocks = customBlocks.filter(
			([csId, cb]) =>
				csId !== block_colourSetId ||
				cb.displayName !== nameTrimmed ||
				!Object.values(supportedVersions).some(
					(sv) => sv.MCVersion in cb.validVersions && sv.MCVersion in blockToAdd.validVersions,
				),
		);
		newCustomBlocks.push([block_colourSetId, blockToAdd]);

		applyCustomBlocks(newCustomBlocks);
		app.selectedBlocks[block_colourSetId] = '-1';
	}

	function handleDeleteCustomBlock(
		block_colourSetId: string,
		block_name: string,
		block_versions: Record<string, boolean>,
	) {
		const nameTrimmed = block_name.trim();
		if (nameTrimmed === '' || Object.values(block_versions).every((v) => !v)) return;

		const selectedVersions: string[] = [];
		for (const [vKey, isSelected] of Object.entries(block_versions)) {
			if (isSelected) {
				const mcVer = supportedVersions[vKey]?.MCVersion;
				if (mcVer) selectedVersions.push(mcVer);
			}
		}

		const newCustomBlocks = customBlocks.filter(
			([csId, cb]) =>
				csId !== block_colourSetId ||
				cb.displayName !== nameTrimmed ||
				!Object.values(supportedVersions).some(
					(sv) => sv.MCVersion in cb.validVersions && selectedVersions.includes(sv.MCVersion),
				),
		);

		applyCustomBlocks(newCustomBlocks);
		app.selectedBlocks[block_colourSetId] = '-1';
	}

	// ── Version list ──
	const versions = Object.entries(app.supportedVersions).map(([key, val]: [string, any]) => ({
		key,
		MCVersion: val.MCVersion as string,
		label: val.MCVersion as string,
	}));

	function handleVersionChange(e: Event) {
		app.selectedVersion = (e.target as HTMLSelectElement).value;
	}

	const STORAGE_KEY = 'mapartcraft_presets';

	// ── Preset types ──
	interface Preset {
		name: string;
		localeKey?: string;
		blocks: [number, number][]; // [colourSetId, presetIndex]
	}

	// ── Preset state ──
	let presets = $state<Preset[]>([]);
	let selectedPresetName = $state('Everything');

	// Load presets on mount
	onMount(() => {
		const defaultPresets = defaultPresetsData as Preset[];
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed: Preset[] = JSON.parse(stored);
				// Merge: update default presets to latest, keep custom ones
				const updated: Preset[] = [];
				for (const p of parsed) {
					if (p.localeKey) {
						// Default preset — use latest version from data
						const latest = defaultPresets.find((dp) => dp.localeKey === p.localeKey);
						updated.push(latest ?? p);
					} else {
						updated.push(p);
					}
				}
				// Add any new default presets not in stored
				for (const dp of defaultPresets) {
					if (!updated.find((u) => u.localeKey === dp.localeKey)) {
						updated.push(dp);
					}
				}
				presets = updated;
			} else {
				presets = [...defaultPresets];
			}
		} catch {
			presets = [...defaultPresets];
		}
		savePresetsToStorage();

		// Load custom blocks from storage and merge into coloursJSON
		customBlocks = loadCustomBlocks();
		if (customBlocks.length > 0) {
			app.coloursJSON = getMergedColoursJSON(customBlocks) as any;
		}

		// Apply the default preset on mount
		const defaultPreset = presets.find((p) => p.name === selectedPresetName);
		if (defaultPreset) applyPreset(defaultPreset);
	});

	function savePresetsToStorage() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
		} catch {
			/* quota exceeded, ignore */
		}
	}

	// ── Apply a preset ──
	function applyPreset(preset: Preset | null) {
		const cJSON = app.coloursJSON as unknown as ColoursJSON;
		// First, disable all
		for (const csId of Object.keys(cJSON)) {
			app.selectedBlocks[csId] = '-1';
		}
		if (!preset) return;

		// Enable blocks by presetIndex
		for (const [intCsId, presetIndex] of preset.blocks) {
			const csId = intCsId.toString();
			if (!(csId in cJSON)) continue;
			// Find block with matching presetIndex
			const found = Object.entries(cJSON[csId].blocks).find(
				([, block]) => block.presetIndex === presetIndex,
			);
			if (!found) continue;
			const [blockId, block] = found;
			if (isBlockAvailable(block, app.selectedVersion)) {
				app.selectedBlocks[csId] = blockId;
			}
		}
	}

	function handlePresetChange(e: Event) {
		const name = (e.target as HTMLSelectElement).value;
		selectedPresetName = name;
		if (name === 'None') {
			applyPreset(null);
		} else {
			const preset = presets.find((p) => p.name === name);
			if (preset) applyPreset(preset);
		}
	}

	function canDeletePreset(): boolean {
		if (selectedPresetName === 'None') return false;
		const defaultPresets = defaultPresetsData as Preset[];
		return !defaultPresets.find((dp) => dp.name === selectedPresetName);
	}

	async function handleDeletePreset() {
		if (!canDeletePreset()) return;
		const confirmed = await modal.showConfirm(
			t('blocks.deletePresetConfirm', { name: selectedPresetName }),
			t('blocks.deletePreset')
		);
		if (!confirmed) return;
		presets = presets.filter((p) => p.name !== selectedPresetName);
		selectedPresetName = 'None';
		savePresetsToStorage();
	}

	async function handleSavePreset() {
		const cJSON = app.coloursJSON as unknown as ColoursJSON;
		const name = await modal.showPrompt(t('blocks.savePresetPrompt'), '', t('blocks.savePresetTitle'), 'My Preset');
		if (!name) return;

		const blocks: [number, number][] = [];
		for (const [csId, blockId] of Object.entries(app.selectedBlocks)) {
			if (blockId !== '-1') {
				const block = cJSON[csId]?.blocks[blockId];
				if (block && typeof block.presetIndex === 'number') {
					blocks.push([parseInt(csId), block.presetIndex]);
				}
			}
		}

		const otherPresets = presets.filter((p) => p.name !== name);
		const newPreset: Preset = { name, blocks };
		presets = [...otherPresets, newPreset];
		selectedPresetName = name;
		savePresetsToStorage();
	}

	async function handleSharePreset() {
		const cJSON = app.coloursJSON as unknown as ColoursJSON;
		const blocks: [number, number][] = [];
		for (const [csId, blockId] of Object.entries(app.selectedBlocks)) {
			if (blockId !== '-1') {
				const block = cJSON[csId]?.blocks[blockId];
				if (block && typeof block.presetIndex === 'number') {
					blocks.push([parseInt(csId), block.presetIndex]);
				}
			}
		}
		if (blocks.length === 0) {
			await modal.showAlert(t('blocks.noBlocksSelected'), t('blocks.shareTitle'));
			return;
		}
		const presetName = selectedPresetName !== 'None' ? selectedPresetName : 'Shared Preset';
		const encoded = btoa(JSON.stringify({ name: presetName, blocks }));
		shareCode = encoded;
		shareDialogOpen = true;
	}

	async function handleImportPreset() {
		importCode = '';
		importDialogOpen = true;
	}

	async function doImport() {
		const code = importCode.trim();
		if (!code) return;
		try {
			const decoded = JSON.parse(atob(code));
			let blocks: [number, number][];
			let suggestedName = 'Imported Preset';
			if (decoded && typeof decoded === 'object' && 'blocks' in decoded) {
				blocks = decoded.blocks;
				if (decoded.name) suggestedName = decoded.name;
			} else if (Array.isArray(decoded)) {
				blocks = decoded;
			} else {
				throw new Error('Invalid format');
			}
			if (!Array.isArray(blocks) || !blocks.every((b: unknown) => Array.isArray(b) && (b as unknown[]).length === 2)) {
				throw new Error('Invalid format');
			}
			importDialogOpen = false;
			const name = await modal.showPrompt(t('blocks.importPresetName'), suggestedName, t('blocks.importTitle'));
			if (!name) return;
			const otherPresets = presets.filter((p) => p.name !== name);
			const newPreset: Preset = { name, blocks };
			presets = [...otherPresets, newPreset];
			selectedPresetName = name;
			savePresetsToStorage();
			applyPreset(newPreset);
		} catch {
			await modal.showAlert(t('blocks.importInvalid'), t('blocks.importError'));
		}
	}

	// ── Share/Import dialog state ──
	let shareDialogOpen = $state(false);
	let shareCode = $state('');
	let importDialogOpen = $state(false);
	let importCode = $state('');
	let copiedShare = $state(false);
	let blocksExpanded = $state(true);

	async function copyShareCode() {
		try {
			await navigator.clipboard.writeText(shareCode);
			copiedShare = true;
			setTimeout(() => (copiedShare = false), 2000);
		} catch { /* ignore */ }
	}

	async function pasteImportCode() {
		try {
			importCode = await navigator.clipboard.readText();
		} catch { /* ignore */ }
	}

	// ── Block list ──
	let availableSets = $derived.by(() => {
		const sets: Array<{
			id: string;
			set: ColourSet;
			blocks: Array<{ id: string; block: BlockEntry }>;
		}> = [];
		for (const [id, set] of Object.entries(app.coloursJSON as ColoursJSON)) {
			const validBlocks: Array<{ id: string; block: BlockEntry }> = [];
			for (const [blockId, block] of Object.entries(set.blocks)) {
				if (isBlockAvailable(block, app.selectedVersion)) {
					validBlocks.push({ id: blockId, block });
				}
			}
			if (validBlocks.length > 0) {
				sets.push({ id, set, blocks: validBlocks });
			}
		}
		return sets;
	});

	let enabledCount = $derived(
		availableSets.filter((s) => app.selectedBlocks[s.id] !== '-1').length,
	);

	function getColourBoxStyle(set: ColourSet): string {
		const s = app.staircasingId;
		const rgb = (arr: number[]) => `rgb(${arr[0]}, ${arr[1]}, ${arr[2]})`;
		const t = set.tonesRGB;

		if (
			s === mapModes.SCHEMATIC_NBT.staircaseModes.OFF.uniqueId ||
			s === mapModes.MAPDAT.staircaseModes.OFF.uniqueId
		)
			return `background: ${rgb(t.normal)}`;

		if (
			s === mapModes.SCHEMATIC_NBT.staircaseModes.CLASSIC.uniqueId ||
			s === mapModes.SCHEMATIC_NBT.staircaseModes.VALLEY.uniqueId ||
			s === mapModes.MAPDAT.staircaseModes.ON.uniqueId
		)
			return `background: linear-gradient(${rgb(t.dark)} 33%, ${rgb(t.normal)} 33%, ${rgb(t.normal)} 66%, ${rgb(t.light)} 66%)`;

		if (s === mapModes.MAPDAT.staircaseModes.ON_UNOBTAINABLE.uniqueId) {
			const u = t.unobtainable ?? t.dark;
			return `background: linear-gradient(${rgb(u)} 25%, ${rgb(t.dark)} 25%, ${rgb(t.dark)} 50%, ${rgb(t.normal)} 50%, ${rgb(t.normal)} 75%, ${rgb(t.light)} 75%)`;
		}

		if (
			s === mapModes.SCHEMATIC_NBT.staircaseModes.FULL_DARK.uniqueId ||
			s === mapModes.MAPDAT.staircaseModes.FULL_DARK.uniqueId
		)
			return `background: ${rgb(t.dark)}`;

		if (
			s === mapModes.SCHEMATIC_NBT.staircaseModes.FULL_LIGHT.uniqueId ||
			s === mapModes.MAPDAT.staircaseModes.FULL_LIGHT.uniqueId
		)
			return `background: ${rgb(t.light)}`;

		if (s === mapModes.MAPDAT.staircaseModes.FULL_UNOBTAINABLE.uniqueId) {
			const u = t.unobtainable ?? t.dark;
			return `background: ${rgb(u)}`;
		}

		return `background: ${rgb(t.normal)}`;
	}

	function getBlockImageStyle(colourSetId: string, blockId: string): string {
		if (blockId === '-1') {
			return `background-image: url(${base}/images/textures.png); background-position: -32px -2048px`;
		}
		// Custom blocks use a special icon (column 5, row 64) with colour-set background
		const cJSON = app.coloursJSON as unknown as ColoursJSON;
		const block = cJSON[colourSetId]?.blocks[blockId];
		if (block && block.presetIndex === -999) {
			const bgColor = `rgb(${cJSON[colourSetId].tonesRGB.normal.join(', ')})`;
			return `background-image: url(${base}/images/textures.png); background-position: -160px -2048px; background-color: ${bgColor}`;
		}
		const x = parseInt(blockId) * 32;
		const y = parseInt(colourSetId) * 32;
		return `background-image: url(${base}/images/textures.png); background-position: -${x}px -${y}px`;
	}

	function selectBlock(colourSetId: string, blockId: string) {
		app.selectedBlocks[colourSetId] = blockId;
		// Check if this is a custom block (presetIndex === -999)
		if (blockId !== '-1') {
			const cJSON = app.coloursJSON as unknown as ColoursJSON;
			const block = cJSON[colourSetId]?.blocks[blockId];
			if (block && block.presetIndex === -999) {
				lastSelectedCustomBlock = { colourSetId, blockId };
			}
		}
	}

	function enableAll() {
		for (const s of availableSets) {
			if (app.selectedBlocks[s.id] === '-1' && s.blocks.length > 0) {
				app.selectedBlocks[s.id] = s.blocks[0].id;
			}
		}
	}

	function disableAll() {
		for (const s of availableSets) {
			app.selectedBlocks[s.id] = '-1';
		}
	}
</script>

<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
	<!-- Header -->
	<div class="mb-2 flex items-center justify-between">
		<h3 class="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
			{t('blocks.title')}
		</h3>
		<div class="flex items-center gap-2">
			<span class="text-xs text-[var(--color-muted)]">{enabledCount}/{availableSets.length}</span>
			<button
				class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-[var(--color-muted)] opacity-50 transition-all hover:opacity-100 hover:text-[var(--color-primary)] hover:bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
				onclick={() => infoModal.openTab('blocks')}
				title={t('blocks.help')}
			>?</button>
		</div>
	</div>

	<!-- Minecraft Version + Presets -->
	<div class="mb-3 space-y-2 border-b border-[var(--color-border)] pb-3">
		<div class="flex flex-wrap items-center gap-2">
			<label class="text-xs font-medium text-[var(--color-muted)]" for="version-select">
				{t('blocks.version')}
			</label>
			<select
				id="version-select"
				class="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm"
				value={app.selectedVersion}
				onchange={handleVersionChange}
			>
				{#each versions as ver}
					<option value={ver.MCVersion}>{ver.label}</option>
				{/each}
			</select>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<label class="text-xs font-medium text-[var(--color-muted)]" for="preset-select">
				{t('blocks.presets')}
			</label>
			<select
				id="preset-select"
				class="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm"
				value={selectedPresetName}
				onchange={handlePresetChange}
			>
				<option value="None">{t('blocks.none')}</option>
				{#each presets as preset}
					<option value={preset.name}>{preset.name}</option>
				{/each}
			</select>
		</div>
		<div class="flex flex-wrap gap-1">
			<button
				class="rounded bg-[var(--color-danger)] px-2 py-0.5 text-xs text-white hover:opacity-80 disabled:opacity-40"
				disabled={!canDeletePreset()}
				onclick={handleDeletePreset}
			>
				{t('blocks.delete')}
			</button>
			<button
				class="rounded border border-[var(--color-border)] bg-transparent px-2 py-0.5 text-xs text-[var(--color-text)] hover:border-[var(--color-text-muted)]"
				onclick={handleSavePreset}
			>
				{t('blocks.save')}
			</button>
			<button
				class="rounded border border-[var(--color-border)] bg-transparent px-2 py-0.5 text-xs text-[var(--color-text)] hover:border-[var(--color-text-muted)]"
				onclick={handleSharePreset}
			>
				{t('blocks.share')}
			</button>
			<button
				class="rounded border border-[var(--color-border)] bg-transparent px-2 py-0.5 text-xs text-[var(--color-text)] hover:border-[var(--color-text-muted)]"
				onclick={handleImportPreset}
			>
				{t('blocks.import')}
			</button>
			<div class="flex-1"></div>
			<button
				class="rounded bg-[var(--color-primary)] px-2 py-0.5 text-xs text-white hover:bg-[var(--color-primary-hover)]"
				onclick={enableAll}
			>
				{t('blocks.enableAll')}
			</button>
			<button
				class="rounded border border-[var(--color-border)] bg-transparent px-2 py-0.5 text-xs text-[var(--color-text)] hover:border-[var(--color-text-muted)]"
				onclick={disableAll}
			>
				{t('blocks.disableAll')}
			</button>
		</div>
	</div>

	<!-- Colour sets list (collapsible) -->
	<button
		class="flex w-full items-center gap-2 py-1 text-left text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors"
		onclick={() => (blocksExpanded = !blocksExpanded)}
	>
		<span class="inline-block transition-transform" class:rotate-90={blocksExpanded}>▶</span>
		{t('blocks.colourSets')}
		<span class="ml-auto text-[10px] opacity-60">{blocksExpanded ? t('blocks.collapse') : t('blocks.expand')}</span>
	</button>

	<div class="max-h-[500px] space-y-0.5 overflow-y-auto pr-1 mt-1" class:hidden={!blocksExpanded}>
		{#each availableSets as { id, set, blocks }}
			<div class="colour-set">
				<!-- Colour swatch showing tone(s) -->
				<div class="colour-box" style={getColourBoxStyle(set)}></div>

				<!-- "None" / barrier block -->
				<button
					class="block-img"
					class:block-img--selected={app.selectedBlocks[id] === '-1'}
					style={getBlockImageStyle(id, '-1')}
					title="None"
					onclick={() => selectBlock(id, '-1')}
				></button>

				<!-- Available block options -->
				<div class="colour-set-blocks">
					{#each blocks as { id: blockId, block }}
						<button
							class="block-img"
							class:block-img--selected={app.selectedBlocks[id] === blockId}
							style={getBlockImageStyle(id, blockId)}
							title={block.displayName}
							onclick={() => selectBlock(id, blockId)}
						></button>
					{/each}
				</div>
			</div>
		{/each}
	</div>

	<!-- Custom Block Section -->
	<BlockSelectionAddCustom
		onAddCustomBlock={handleAddCustomBlock}
		onDeleteCustomBlock={handleDeleteCustomBlock}
		{lastSelectedCustomBlock}
	/>
</div>

<!-- ── Share Dialog ── -->
{#if shareDialogOpen}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="dialog-backdrop" onclick={() => (shareDialogOpen = false)} onkeydown={(e) => e.key === 'Escape' && (shareDialogOpen = false)}>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="dialog-card" onclick={(e) => e.stopPropagation()}>
		<h3 class="dialog-title">{t('blocks.shareTitle')}</h3>
		<p class="dialog-desc">{t('blocks.shareDesc')}</p>
		<textarea class="dialog-textarea" readonly rows={4}>{shareCode}</textarea>
		<div class="dialog-actions">
			<button class="dialog-btn dialog-btn--primary" onclick={copyShareCode}>
				{copiedShare ? t('blocks.copied') : t('blocks.copyClipboard')}
			</button>
			<button class="dialog-btn dialog-btn--secondary" onclick={() => (shareDialogOpen = false)}>
				{t('blocks.close')}
			</button>
		</div>
	</div>
</div>
{/if}

<!-- ── Import Dialog ── -->
{#if importDialogOpen}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="dialog-backdrop" onclick={() => (importDialogOpen = false)} onkeydown={(e) => e.key === 'Escape' && (importDialogOpen = false)}>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="dialog-card" onclick={(e) => e.stopPropagation()}>
		<h3 class="dialog-title">{t('blocks.importTitle')}</h3>
		<p class="dialog-desc">{t('blocks.importDesc')}</p>
		<textarea class="dialog-textarea" rows={4} bind:value={importCode} placeholder={t('blocks.importPlaceholder')}></textarea>
		<div class="dialog-actions">
			<button class="dialog-btn dialog-btn--secondary" onclick={pasteImportCode}>
				{t('blocks.pasteClipboard')}
			</button>
			<button class="dialog-btn dialog-btn--primary" onclick={doImport} disabled={!importCode.trim()}>
				{t('blocks.import')}
			</button>
			<button class="dialog-btn dialog-btn--secondary" onclick={() => (importDialogOpen = false)}>
				{t('blocks.cancel')}
			</button>
		</div>
	</div>
</div>
{/if}

<style>
	.colour-set {
		display: flex;
		flex-direction: row;
		align-items: flex-start;
	}

	.colour-box {
		width: 24px;
		height: 24px;
		border: 1px solid rgba(0, 0, 0, 0.2);
		margin-top: 6px;
		margin-right: 3px;
		margin-left: 3px;
		flex-shrink: 0;
	}

	.colour-set-blocks {
		display: flex;
		flex-direction: row;
		flex-wrap: wrap;
	}

	.block-img {
		width: 32px;
		height: 32px;
		margin: 3px;
		background-color: #222;
		cursor: pointer;
		transition: background-color 0.15s;
		border: none;
		padding: 0;
		flex-shrink: 0;
	}

	.block-img:hover {
		filter: brightness(1.2);
	}

	.block-img--selected {
		filter: drop-shadow(0 0 4px var(--color-primary, #6366f1));
		background-color: color-mix(in srgb, var(--color-primary, #6366f1) 40%, #222);
	}

	/* ── Share/Import Dialogs ── */
	.dialog-backdrop {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
	}

	.dialog-card {
		background: var(--color-bg-card, #1a1a1a);
		border: 1px solid var(--color-border, #2a2a2a);
		border-radius: 12px;
		padding: 20px;
		width: 90vw;
		max-width: 480px;
		box-shadow:
			0 20px 60px rgba(0, 0, 0, 0.5),
			0 0 0 1px rgba(255, 255, 255, 0.05) inset;
		animation: dialog-in 0.2s ease-out;
	}

	@keyframes dialog-in {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.dialog-title {
		margin: 0 0 4px;
		font-size: 15px;
		font-weight: 600;
		color: var(--color-text, #e5e5e5);
	}

	.dialog-desc {
		margin: 0 0 12px;
		font-size: 13px;
		color: var(--color-text-muted, #888);
	}

	.dialog-textarea {
		display: block;
		width: 100%;
		padding: 8px 12px;
		font-size: 12px;
		font-family: monospace;
		color: var(--color-text, #e5e5e5);
		background: var(--color-bg-input, #222);
		border: 1px solid var(--color-border, #2a2a2a);
		border-radius: 6px;
		resize: vertical;
		outline: none;
		box-sizing: border-box;
		word-break: break-all;
	}

	.dialog-textarea:focus {
		border-color: var(--color-primary, #6366f1);
		box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
	}

	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 14px;
		flex-wrap: wrap;
	}

	.dialog-btn {
		padding: 7px 16px;
		font-size: 13px;
		font-weight: 500;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s;
		border: none;
	}

	.dialog-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.dialog-btn--primary {
		background: var(--color-primary, #6366f1);
		color: white;
	}

	.dialog-btn--primary:hover:not(:disabled) {
		background: var(--color-primary-hover, #818cf8);
	}

	.dialog-btn--secondary {
		background: transparent;
		color: var(--color-text-muted, #888);
		border: 1px solid var(--color-border, #2a2a2a);
	}

	.dialog-btn--secondary:hover {
		background: var(--color-bg-input, #222);
		color: var(--color-text, #e5e5e5);
	}
</style>
