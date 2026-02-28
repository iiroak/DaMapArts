<script lang="ts">
	import { getAppState } from '$lib/stores/index.js';
	import { infoModal } from '$lib/stores/infoModal.svelte.js';
	import { locale } from '$lib/stores/locale.svelte.js';
	import whereSupportBlocksModes from '$lib/data/whereSupportBlocksModes.json';

	const app = getAppState();
	const t = locale.t;

	let expanded = $state(true);

	// Format staircasing key to user-friendly label
	function formatStairLabel(key: string): string {
		return key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
	}

	// Get staircasing modes for current mode
	let staircaseModes = $derived.by(() => {
		const currentMode = Object.values(app.mapModes as any).find(
			(m: any) => m.uniqueId === app.modeId
		) as any;
		if (!currentMode) return [];
		return Object.entries(currentMode.staircaseModes)
			.map(([key, val]: [string, any]) => ({
				key,
				uniqueId: val.uniqueId,
				label: formatStairLabel(key),
			}));
	});

	// Where support blocks options
	const supportModes = Object.entries(whereSupportBlocksModes).map(([key, val]: [string, any]) => ({
		key,
		uniqueId: val.uniqueId,
		label: formatStairLabel(key),
	}));

	// Mode check: 0 = NBT (schematic)
	function isNBTMode(): boolean {
		return app.modeId === 0;
	}

	// Common support blocks
	const supportBlockOptions = [
		{ value: 'netherrack', label: 'Netherrack' },
		{ value: 'cobblestone', label: 'Cobblestone' },
		{ value: 'stone', label: 'Stone' },
		{ value: 'dirt', label: 'Dirt' },
		{ value: 'oak_planks', label: 'Oak Planks' },
		{ value: 'sand', label: 'Sand' },
		{ value: 'glass', label: 'Glass' },
		{ value: 'smooth_stone', label: 'Smooth Stone' },
	];
</script>

<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<div class="flex w-full items-center gap-2">
		<h3 class="flex-1 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">{t('map.title')}</h3>
		<button
			class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-[var(--color-muted)] opacity-50 transition-all hover:opacity-100 hover:text-[var(--color-primary)] hover:bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
			onclick={(e) => { e.stopPropagation(); infoModal.openTab('general'); }}
			title={t('map.help')}
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
		<!-- Map Size -->
		<div class="grid grid-cols-[1fr_auto_1fr] items-end gap-1">
			<label class="block">
				<span class="mb-1 block text-xs text-[var(--color-muted)]">{t('map.width')}</span>
				<input
					type="number"
					min="1"
					max="20"
					class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
					bind:value={app.mapSizeX}
				/>
			</label>
			<button
				class="mb-0.5 rounded border border-[var(--color-border)] p-1.5 text-xs hover:bg-[var(--color-surface)] active:scale-95"
				title={t('map.swap')}
				onclick={() => { const tmp = app.mapSizeX; app.mapSizeX = app.mapSizeZ; app.mapSizeZ = tmp; }}
			>
				⇄
			</button>
			<label class="block">
				<span class="mb-1 block text-xs text-[var(--color-muted)]">{t('map.height')}</span>
				<input
					type="number"
					min="1"
					max="20"
					class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
					bind:value={app.mapSizeZ}
				/>
			</label>
		</div>
		<p class="text-xs text-[var(--color-muted)]">
			{app.mapSizeX * 128} × {app.mapSizeZ * 128} {t('map.pixels')} &mdash; {app.mapSizeX * app.mapSizeZ === 1 ? t('map.mapCount', { count: 1 }) : t('map.mapCountPlural', { count: app.mapSizeX * app.mapSizeZ })}
		</p>

		<!-- Staircasing -->
		{#if staircaseModes.length > 0}
			<label class="block">
				<span class="mb-1 block text-xs text-[var(--color-muted)]">{t('map.staircasing')}</span>
				<select
					class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
					bind:value={app.staircasingId}
				>
					{#each staircaseModes as stair}
						<option value={stair.uniqueId}>{stair.label}</option>
					{/each}
				</select>
			</label>
		{/if}

		<!-- Where Support Blocks (NBT mode only) -->
		{#if isNBTMode()}
			<label class="block">
				<span class="mb-1 block text-xs text-[var(--color-muted)]">{t('map.addBlocksUnder')}</span>
				<select
					class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
					bind:value={app.whereSupportBlocks}
				>
					{#each supportModes as sm}
						<option value={sm.uniqueId}>{sm.label}</option>
					{/each}
				</select>
			</label>

			<!-- Block to add -->
			<label class="block">
				<span class="mb-1 block text-xs text-[var(--color-muted)]">{t('map.blockToAdd')}</span>
				<select
					class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
					bind:value={app.supportBlock}
				>
					{#each supportBlockOptions as sb}
						<option value={sb.value}>{sb.label}</option>
					{/each}
				</select>
			</label>
		{/if}
	</div>
	{/if}
</div>
