<script lang="ts">
	import { getAppState } from '$lib/stores/index.js';
	import type { ColorSpace } from '$lib/types/settings.js';
	import CompareModal from './CompareModal.svelte';
	import { compareProgress } from '$lib/stores/compareProgress.svelte.js';
	import { infoModal } from '$lib/stores/infoModal.svelte.js';
	import { locale } from '$lib/stores/locale.svelte.js';

	const app = getAppState();
	const t = locale.t;

	let showCompare = $state(false);
	let expanded = $state(true);

	function handleCompareSelect(ditherMethod: string, colorSpace: ColorSpace, bcs?: { brightness: number; contrast: number; saturation: number }) {
		app.ditherMethodId = ditherMethod;
		app.colorSpace = colorSpace;
		if (bcs) {
			app.brightness = bcs.brightness;
			app.contrast = bcs.contrast;
			app.saturation = bcs.saturation;
		}
	}
</script>

<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<div class="flex w-full items-center gap-2">
		<h3 class="flex-1 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
			{t('processing.title')}
		</h3>
		<button
			class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-[var(--color-muted)] opacity-50 transition-all hover:opacity-100 hover:text-[var(--color-primary)] hover:bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
			onclick={(e) => { e.stopPropagation(); infoModal.openTab('processing'); }}
			title={t('processing.help')}
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
		<!-- Dithering -->
		<label class="block">
			<span class="mb-1 block text-xs text-[var(--color-muted)]">{t('processing.dithering')}</span>
			<select
				class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
				bind:value={app.ditherMethodId}
			>
				<option value="none">{t('processing.none')}</option>
				<optgroup label={t('processing.errorDiffusion')}>
					<option value="floyd-steinberg">Floyd-Steinberg</option>
					<option value="min-avg-err">MinAvgErr</option>
					<option value="burkes">Burkes</option>
					<option value="sierra-lite">Sierra-Lite</option>
					<option value="sierra-3">Sierra (Full)</option>
					<option value="stucki">Stucki</option>
					<option value="jarvis-judice-ninke">Jarvis-Judice-Ninke</option>
					<option value="atkinson">Atkinson</option>
					<option value="shiau-fan">Shiau-Fan</option>
					<option value="ostromoukhov">Ostromoukhov</option>
				</optgroup>
				<optgroup label={t('processing.ordered')}>
					<option value="bayer-2x2">Bayer (2×2)</option>
					<option value="bayer-4x4">Bayer (4×4)</option>
					<option value="bayer-8x8">Bayer (8×8)</option>
					<option value="ordered-3x3">Ordered (3×3)</option>
					<option value="cluster-dot">Cluster Dot (Halftone)</option>
					<option value="knoll">Knoll</option>
					<option value="blue-noise">Blue Noise</option>
				</optgroup>
				<optgroup label={t('processing.curve')}>
					<option value="riemersma">Riemersma (Hilbert)</option>
				</optgroup>
			</select>
		</label>

		<!-- Color Space -->
		<label class="block">
			<span class="mb-1 block text-xs text-[var(--color-muted)]">{t('processing.colorSpace')}</span>
			<select
				class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
				bind:value={app.colorSpace}
			>
				<optgroup label={t('processing.perceptual')}>
					<option value="oklab">Oklab</option>
					<option value="oklch">Oklch</option>
					<option value="lab">CIE L*a*b*</option>
				</optgroup>
				<optgroup label={t('processing.lumaChroma')}>
					<option value="ycbcr">YCbCr (BT.601)</option>
				</optgroup>
				<optgroup label={t('processing.basic')}>
					<option value="rgb">RGB</option>
					<option value="hsl">HSL</option>
				</optgroup>
			</select>
		</label>

		<!-- Processing Mode -->
		<label class="block">
			<span class="mb-1 block text-xs text-[var(--color-muted)]">{t('processing.processingMode')}</span>
			<select
				class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
				bind:value={app.processingMode}
			>
				<option value="auto">{t('processing.auto')}</option>
				<option value="gpu">{t('processing.gpu')}</option>
				<option value="worker">{t('processing.worker')}</option>
				<option value="main">{t('processing.main')}</option>
			</select>
		</label>

		<!-- Compare button -->
		<button
			class="w-full rounded bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
			disabled={!app.sourceImage}
			onclick={() => (showCompare = true)}
		>
			{#if compareProgress.running}
				{t('processing.compare')} ({Math.round((compareProgress.progress / compareProgress.total) * 100)}%)
			{:else}
				{t('processing.compare')}
			{/if}
		</button>

	</div>
	{/if}
</div>

{#if showCompare}
	<CompareModal
		onSelect={handleCompareSelect}
		onClose={() => (showCompare = false)}
	/>
{/if}
