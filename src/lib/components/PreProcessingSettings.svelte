<script lang="ts">
	import { getAppState } from '$lib/stores/index.js';
	import { infoModal } from '$lib/stores/infoModal.svelte.js';
	import { locale } from '$lib/stores/locale.svelte.js';

	const app = getAppState();
	const t = locale.t;

	let expanded = $state(false);
</script>

<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<div class="flex w-full items-center gap-2">
		<h3 class="flex-1 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
			{t('preprocess.title')}
		</h3>
		<button
			class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-[var(--color-muted)] opacity-50 transition-all hover:opacity-100 hover:text-[var(--color-primary)] hover:bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
			onclick={(e) => { e.stopPropagation(); infoModal.openTab('preprocessing'); }}
			title={t('preprocess.help')}
		>?</button>
		<button
			class="flex items-center justify-center"
			onclick={() => (expanded = !expanded)}
		>
			<span class="text-xs text-[var(--color-muted)] transition-transform" class:rotate-90={expanded}>▶</span>
		</button>
	</div>

	{#if expanded}
	<div class="mt-3 space-y-2">
		<!-- Bilateral Filter -->
		<label class="flex items-center gap-2 text-xs">
			<input type="checkbox" bind:checked={app.bilateralEnabled} class="accent-[var(--color-primary)]" />
			<span>{t('preprocess.bilateral')}</span>
		</label>

		{#if app.bilateralEnabled}
			<div class="mt-1 space-y-2 pl-5">
				<label class="block">
					<span class="mb-0.5 flex items-center justify-between text-[10px] text-[var(--color-muted)]">
						<span>{t('preprocess.spatialSigma')}</span>
						<span class="font-mono">{app.bilateralSigmaSpace}</span>
					</span>
					<input
						type="range"
						min="1"
						max="10"
						step="1"
						class="w-full accent-[var(--color-primary)]"
						bind:value={app.bilateralSigmaSpace}
					/>
				</label>
				<label class="block">
					<span class="mb-0.5 flex items-center justify-between text-[10px] text-[var(--color-muted)]">
						<span>{t('preprocess.colorSigma')}</span>
						<span class="font-mono">{app.bilateralSigmaColor}</span>
					</span>
					<input
						type="range"
						min="5"
						max="100"
						step="5"
						class="w-full accent-[var(--color-primary)]"
						bind:value={app.bilateralSigmaColor}
					/>
				</label>
				<label class="block">
					<span class="mb-0.5 flex items-center justify-between text-[10px] text-[var(--color-muted)]">
						<span>{t('preprocess.kernelRadius')}</span>
						<span class="font-mono">{app.bilateralRadius}</span>
					</span>
					<input
						type="range"
						min="1"
						max="7"
						step="1"
						class="w-full accent-[var(--color-primary)]"
						bind:value={app.bilateralRadius}
					/>
				</label>
			</div>
		{/if}

		<!-- Edge-Masked Dithering -->
		<label class="mt-2 flex items-center gap-2 text-xs">
			<input type="checkbox" bind:checked={app.edgeMaskEnabled} class="accent-[var(--color-primary)]" />
			<span>{t('preprocess.edgeMask')}</span>
		</label>

		{#if app.edgeMaskEnabled}
			<div class="mt-1 pl-5">
				<label class="block">
					<span class="mb-0.5 flex items-center justify-between text-[10px] text-[var(--color-muted)]">
						<span>{t('preprocess.edgeThreshold')}</span>
						<span class="font-mono">{app.edgeMaskThreshold}</span>
					</span>
					<input
						type="range"
						min="10"
						max="150"
						step="5"
						class="w-full accent-[var(--color-primary)]"
						bind:value={app.edgeMaskThreshold}
					/>
					<div class="flex justify-between text-[10px] text-[var(--color-muted)]">
						<span>{t('preprocess.moreEdges')}</span>
						<span>{t('preprocess.fewerEdges')}</span>
					</div>
				</label>
			</div>
		{/if}

		<!-- Luminance Weight -->
		<label class="mt-2 block">
			<span class="mb-0.5 flex items-center justify-between text-xs text-[var(--color-muted)]">
				<span>{t('preprocess.luminanceWeight')}</span>
				<span class="font-mono text-[10px]">{app.luminanceWeight.toFixed(1)}</span>
			</span>
			<input
				type="range"
				min="1.0"
				max="3.0"
				step="0.1"
				class="w-full accent-[var(--color-primary)]"
				bind:value={app.luminanceWeight}
			/>
			<div class="flex justify-between text-[10px] text-[var(--color-muted)]">
				<span>{t('preprocess.neutral')}</span>
				<span>{t('preprocess.prioritizeBrightness')}</span>
			</div>
		</label>
	</div>
	{/if}
</div>
