<script module>
	// Module-level state that persists across modal open/close cycles
	interface CachedEntry {
		ditherMethod: string;
		ditherName: string;
		colorSpace: string;
		csLabel: string;
		brightness: number;
		contrast: number;
		saturation: number;
		dataUrl: string | null;
		fidelity: number | null;
	}

	interface CachedComparison {
		key: string;
		results: CachedEntry[];
		progress: number;
		total: number;
		done: boolean;
	}

	let _compareCache: CachedComparison | null = null;

	// Track if a background generation is running
	let _bgGenerating = false;
	let _bgCancelled = false;
	let _bgPaused = false;
	let _bgResumeResolve: (() => void) | null = null;

	// ── Persisted UI settings (survive modal close/reopen) ──
	let _savedRenderMode: 'full' | 'preview' = 'preview';
	let _savedPreviewSize = 1;
	let _savedThumbSize = 220;
	let _savedAdvancedExpanded = false;
	let _savedSweepBrightness = { enabled: false, range: 10, step: 5 };
	let _savedSweepContrast = { enabled: false, range: 10, step: 5 };
	let _savedSweepSaturation = { enabled: false, range: 10, step: 5 };
	let _savedFixDither = false;
	let _savedFixColorSpace = false;
	let _savedSortByFidelity = true;
	let _savedMaxWorkers = 0; // 0 = use getPoolSize() default on first open
</script>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getAppState } from '$lib/stores/index.js';
	import { compareProgress } from '$lib/stores/compareProgress.svelte.js';
	import { buildActivePalette, getToneKeysForStaircasing } from '$lib/palette/colours.js';
	import { getSourcePixels } from '$lib/processor/crop.js';
	import { processAsync, getPoolSize } from '$lib/processor/backend.js';
	import { DITHER_METHODS } from '$lib/dither/index.js';
	import { computePerceptualFidelity } from '$lib/utils/fidelity.js';
	import type { ProcessorSettings } from '$lib/processor/types.js';
	import type { ColorSpace } from '$lib/types/settings.js';

	interface Props {
		onSelect: (ditherMethod: string, colorSpace: ColorSpace, bcs?: { brightness: number; contrast: number; saturation: number }) => void;
		onClose: () => void;
	}

	let { onSelect, onClose }: Props = $props();

	const app = getAppState();

	const COLOR_SPACES: ColorSpace[] = ['oklab', 'oklch', 'lab', 'ycbcr', 'rgb', 'hsl'];
	const CS_LABEL: Record<ColorSpace, string> = {
		oklab: 'Oklab',
		oklch: 'Oklch',
		lab: 'CIELAB',
		ycbcr: 'YCbCr',
		rgb: 'RGB',
		hsl: 'HSL',
	};

	// Filter out 'none' dither for comparisons
	const methods = DITHER_METHODS.filter((m) => m.id !== 'none');

	// ── BCS Sweep types ──
	interface SweepConfig {
		enabled: boolean;
		range: number;   // ± offset from current value
		step: number;    // step size in %
	}

	type RenderMode = 'full' | 'preview';

	interface ComboResult {
		ditherMethod: string;
		ditherName: string;
		colorSpace: ColorSpace;
		csLabel: string;
		brightness: number;
		contrast: number;
		saturation: number;
		dataUrl: string | null;
		fidelity: number | null;
	}

	// ── State ──
	let dialogEl: HTMLDialogElement | undefined = $state();
	let renderMode = $state<RenderMode>(_savedRenderMode);
	let previewSize = $state(_savedPreviewSize);
	let started = $state(false);
	let progress = $state(0);
	let paused = $state(_bgPaused);
	let thumbSize = $state(_savedThumbSize);
	let activeWorkers = $state(0);

	// Advanced BCS sweep — restored from module-level persisted state
	let advancedExpanded = $state(_savedAdvancedExpanded);
	let sweepBrightness = $state<SweepConfig>({ ..._savedSweepBrightness });
	let sweepContrast = $state<SweepConfig>({ ..._savedSweepContrast });
	let sweepSaturation = $state<SweepConfig>({ ..._savedSweepSaturation });
	let fixDither = $state(_savedFixDither);
	let fixColorSpace = $state(_savedFixColorSpace);
	let sortByFidelity = $state(_savedSortByFidelity);
	/** Default to ~70 % of logical cores — leaves headroom for the browser UI thread */
	function getDefaultWorkers(): number {
		if (typeof navigator === 'undefined') return 1;
		const cores = navigator.hardwareConcurrency || 4;
		return Math.max(1, Math.round(cores * 0.7));
	}
	let maxWorkers = $state(_savedMaxWorkers || getDefaultWorkers());

	// Flat results list
	let results = $state<ComboResult[]>([]);

	// ── Helpers ──

	/** Generate an array of values centered at `center`, from center−range to center+range, step by `step` */
	function rangeValues(center: number, range: number, step: number, minBound: number, maxBound: number): number[] {
		const values: number[] = [];
		const from = Math.max(minBound, Math.round(center - range));
		const to = Math.min(maxBound, Math.round(center + range));
		for (let v = from; v <= to + 0.001; v += step) {
			const rounded = Math.round(v);
			if (!values.includes(rounded)) values.push(rounded);
		}
		// Ensure center is always included
		const c = Math.round(center);
		if (!values.includes(c) && c >= minBound && c <= maxBound) {
			values.push(c);
			values.sort((a, b) => a - b);
		}
		return values;
	}

	let hasBCSSweep = $derived(sweepBrightness.enabled || sweepContrast.enabled || sweepSaturation.enabled);

	let totalCombos = $derived.by(() => {
		const ditherCount = fixDither ? 1 : methods.length;
		const csCount = fixColorSpace ? 1 : COLOR_SPACES.length;
		const bCount = sweepBrightness.enabled
			? rangeValues(app.brightness, sweepBrightness.range, sweepBrightness.step, 50, 150).length
			: 1;
		const cCount = sweepContrast.enabled
			? rangeValues(app.contrast, sweepContrast.range, sweepContrast.step, 50, 150).length
			: 1;
		const sCount = sweepSaturation.enabled
			? rangeValues(app.saturation, sweepSaturation.range, sweepSaturation.step, 0, 200).length
			: 1;
		return ditherCount * csCount * bCount * cCount * sCount;
	});

	/** Build a flat list of all combos to process */
	function buildComboList(): ComboResult[] {
		const dithers = fixDither
			? [methods.find((m) => m.id === app.ditherMethodId) ?? methods[0]]
			: methods;
		const spaces: ColorSpace[] = fixColorSpace ? [app.colorSpace] : COLOR_SPACES;

		const bValues = sweepBrightness.enabled
			? rangeValues(app.brightness, sweepBrightness.range, sweepBrightness.step, 50, 150)
			: [app.brightness];
		const cValues = sweepContrast.enabled
			? rangeValues(app.contrast, sweepContrast.range, sweepContrast.step, 50, 150)
			: [app.contrast];
		const sValues = sweepSaturation.enabled
			? rangeValues(app.saturation, sweepSaturation.range, sweepSaturation.step, 0, 200)
			: [app.saturation];

		const combos: ComboResult[] = [];
		for (const d of dithers) {
			for (const cs of spaces) {
				for (const b of bValues) {
					for (const c of cValues) {
						for (const s of sValues) {
							combos.push({
								ditherMethod: d.id,
								ditherName: d.name,
								colorSpace: cs,
								csLabel: CS_LABEL[cs],
								brightness: b,
								contrast: c,
								saturation: s,
								dataUrl: null,
								fidelity: null,
							});
						}
					}
				}
			}
		}
		return combos;
	}

	// ── Cache ──

	function buildCacheKey(mode: RenderMode, pSize: number): string {
		return JSON.stringify({
			mapX: mode === 'full' ? app.mapSizeX : pSize,
			mapZ: mode === 'full' ? app.mapSizeZ : pSize,
			mode,
			modeId: app.modeId,
			staircasingId: app.staircasingId,
			cropMode: mode === 'full' ? app.cropMode : 'center',
			cropZoom: mode === 'full' ? app.cropZoom : 1,
			cropOffsetX: mode === 'full' ? app.cropOffsetX : 50,
			cropOffsetY: mode === 'full' ? app.cropOffsetY : 50,
			// When BCS sweep is active, BCS values are part of the comparison
			// and shouldn't invalidate cache when user applies a combo
			brightness: hasBCSSweep ? 'sweep' : app.brightness,
			contrast: hasBCSSweep ? 'sweep' : app.contrast,
			saturation: hasBCSSweep ? 'sweep' : app.saturation,
			transparencyEnabled: app.transparencyEnabled,
			transparencyTolerance: app.transparencyTolerance,
			backgroundMode: app.backgroundMode,
			backgroundColour: app.backgroundColour,
			selectedBlocks: app.selectedBlocks,
			sourceFile: app.sourceFileName,
			// Advanced config
			fixDither,
			fixColorSpace,
			sweepBrightness: sweepBrightness.enabled ? sweepBrightness : null,
			sweepContrast: sweepContrast.enabled ? sweepContrast : null,
			sweepSaturation: sweepSaturation.enabled ? sweepSaturation : null,
			// Filter settings
			bilateralEnabled: app.bilateralEnabled,
			bilateralSigmaSpace: app.bilateralEnabled ? app.bilateralSigmaSpace : 0,
			bilateralSigmaColor: app.bilateralEnabled ? app.bilateralSigmaColor : 0,
			bilateralRadius: app.bilateralEnabled ? app.bilateralRadius : 0,
			edgeMaskEnabled: app.edgeMaskEnabled,
			edgeMaskThreshold: app.edgeMaskEnabled ? app.edgeMaskThreshold : 0,
			luminanceWeight: app.luminanceWeight,
		});
	}

	function saveCacheSnapshot() {
		const key = buildCacheKey(renderMode, previewSize);
		const flat = results.map((r) => ({
			ditherMethod: r.ditherMethod,
			ditherName: r.ditherName,
			colorSpace: r.colorSpace as string,
			csLabel: r.csLabel,
			brightness: r.brightness,
			contrast: r.contrast,
			saturation: r.saturation,
			dataUrl: r.dataUrl,
			fidelity: r.fidelity,
		}));
		_compareCache = { key, results: flat, progress, total: results.length, done: progress >= results.length };
	}

	function restoreFromCache(): boolean {
		if (!_compareCache) return false;
		const key = buildCacheKey(renderMode, previewSize);
		if (_compareCache.key !== key) return false;

		// Rebuild results from cache
		results = _compareCache.results.map((r) => ({
			ditherMethod: r.ditherMethod,
			ditherName: r.ditherName,
			colorSpace: r.colorSpace as ColorSpace,
			csLabel: r.csLabel,
			brightness: r.brightness,
			contrast: r.contrast,
			saturation: r.saturation,
			dataUrl: r.dataUrl,
			fidelity: r.fidelity,
		}));
		progress = _compareCache.progress;
		return true;
	}

	// ── Lifecycle ──

	// Sync progress to shared store for external display
	$effect(() => {
		compareProgress.progress = progress;
		compareProgress.total = total;
		if (progress > 0 && progress >= total) {
			compareProgress.running = false;
		}
	});

	onMount(() => {
		dialogEl?.showModal();

		if (_compareCache) {
			// Try to match cache with various render modes
			for (const mode of ['preview', 'full'] as RenderMode[]) {
				for (const ps of [1, 2, 3]) {
					const key = buildCacheKey(mode, ps);
					if (_compareCache.key === key) {
						renderMode = mode;
						previewSize = ps;
						started = true;
						restoreFromCache();
						return;
					}
				}
			}
		}
	});

	onDestroy(() => {
		// Persist UI settings so they survive modal close/reopen
		_savedRenderMode = renderMode;
		_savedPreviewSize = previewSize;
		_savedThumbSize = thumbSize;
		_savedAdvancedExpanded = advancedExpanded;
		_savedSweepBrightness = { ...sweepBrightness };
		_savedSweepContrast = { ...sweepContrast };
		_savedSweepSaturation = { ...sweepSaturation };
		_savedFixDither = fixDither;
		_savedFixColorSpace = fixColorSpace;
		_savedSortByFidelity = sortByFidelity;
		_savedMaxWorkers = maxWorkers;
	});

	// ── Generation ──

	function startGeneration() {
		results = buildComboList();
		started = true;

		if (restoreFromCache()) return;

		_bgCancelled = true;
		setTimeout(() => {
			_bgCancelled = false;
			compareProgress.running = true;
			compareProgress.progress = 0;
			compareProgress.total = results.length;
			generateAll();
		}, 10);
	}

	function stopGeneration() {
		_bgCancelled = true;
		_bgPaused = false;
		paused = false;
		_bgGenerating = false;
		compareProgress.running = false;
		// Resolve any waiting pause promises so chains can exit
		if (_bgResumeResolve) {
			_bgResumeResolve();
			_bgResumeResolve = null;
		}
		// Show partial results as completed gallery
		progress = results.length;
	}

	function pauseGeneration() {
		_bgPaused = true;
		paused = true;
	}

	function resumeGeneration() {
		_bgPaused = false;
		paused = false;
		if (_bgResumeResolve) {
			_bgResumeResolve();
			_bgResumeResolve = null;
		}
	}

	/** Wait while paused. Each worker chain calls this before picking the next combo. */
	function waitIfPaused(): Promise<void> {
		if (!_bgPaused) return Promise.resolve();
		return new Promise<void>((resolve) => {
			const prev = _bgResumeResolve;
			_bgResumeResolve = () => {
				prev?.();
				resolve();
			};
		});
	}

	function computeFidelity(
		processed: Uint8ClampedArray,
		source: Uint8ClampedArray,
		width: number,
		height: number,
	): number {
		return computePerceptualFidelity(processed, source, width, height);
	}

	async function generateAll() {
		if (!app.sourceImage) return;
		_bgGenerating = true;

		const toneKeys = getToneKeysForStaircasing(app.staircasingId, app.mapModes);
		const palette = buildActivePalette(app.coloursJSON, app.selectedBlocks, toneKeys);
		if (palette.length === 0) {
			_bgGenerating = false;
			return;
		}

		const mapX = renderMode === 'full' ? app.mapSizeX : previewSize;
		const mapZ = renderMode === 'full' ? app.mapSizeZ : previewSize;

		const baseSettings: ProcessorSettings = {
			mapSizeX: mapX,
			mapSizeZ: mapZ,
			cropMode: renderMode === 'full' ? app.cropMode : 'center',
			cropZoom: renderMode === 'full' ? app.cropZoom : 1,
			cropOffsetX: renderMode === 'full' ? app.cropOffsetX : 50,
			cropOffsetY: renderMode === 'full' ? app.cropOffsetY : 50,
			ditherMethod: '',
			colorSpace: 'rgb',
			brightness: app.brightness,
			contrast: app.contrast,
			saturation: app.saturation,
			modeId: app.modeId,
			staircasingId: app.staircasingId,
			transparencyEnabled: app.transparencyEnabled,
			transparencyTolerance: app.transparencyTolerance,
			backgroundMode: app.backgroundMode,
			backgroundColour: app.backgroundColour,
			whereSupportBlocks: app.whereSupportBlocks,
			bilateralEnabled: app.bilateralEnabled,
			bilateralSigmaSpace: app.bilateralSigmaSpace,
			bilateralSigmaColor: app.bilateralSigmaColor,
			bilateralRadius: app.bilateralRadius,
			edgeMaskEnabled: app.edgeMaskEnabled,
			edgeMaskThreshold: app.edgeMaskThreshold,
			luminanceWeight: app.luminanceWeight,
		};

		// Source reference for fidelity comparison:
		// If BCS sweep → compare against neutral BCS (100/100/100) = original image
		// Otherwise → compare against current BCS values (quantization fidelity)
		const refSettings: ProcessorSettings = {
			...baseSettings,
			ditherMethod: 'none',
			colorSpace: 'rgb',
			...(hasBCSSweep ? { brightness: 100, contrast: 100, saturation: 100 } : {}),
		};
		const sourceRef = getSourcePixels(app.sourceImage, refSettings);

		// When BCS is constant (no sweep), all combos use the same source pixels.
		// Pre-compute once to avoid redundant canvas work.
		const constBCS = !hasBCSSweep;
		let sharedSource: { data: Uint8ClampedArray; width: number; height: number } | null = null;
		if (constBCS) {
			const srcSettings: ProcessorSettings = {
				...baseSettings,
				ditherMethod: 'none',
				colorSpace: 'rgb',
			};
			sharedSource = getSourcePixels(app.sourceImage, srcSettings);
		}

		// ── Parallel processing using the worker pool ──
		const poolSize = getPoolSize();
		const effectiveWorkers = Math.max(1, Math.min(maxWorkers, poolSize));
		const concurrency = Math.min(effectiveWorkers, results.length);
		let nextIdx = 0;

		const processCombo = async (combo: ComboResult, i: number) => {
			if (_bgCancelled) return;

			activeWorkers++;
			try {
				let sourceData: { data: Uint8ClampedArray; width: number; height: number };
				if (sharedSource) {
					sourceData = sharedSource;
				} else {
					const comboSettings: ProcessorSettings = {
						...baseSettings,
						ditherMethod: combo.ditherMethod,
						colorSpace: combo.colorSpace,
						brightness: combo.brightness,
						contrast: combo.contrast,
						saturation: combo.saturation,
					};
					sourceData = getSourcePixels(app.sourceImage!, comboSettings);
				}

				const comboSettings: ProcessorSettings = {
					...baseSettings,
					ditherMethod: combo.ditherMethod,
					colorSpace: combo.colorSpace,
					brightness: combo.brightness,
					contrast: combo.contrast,
					saturation: combo.saturation,
				};

				const result = await processAsync(
					{
						rgbaData: sourceData.data,
						width: sourceData.width,
						height: sourceData.height,
						palette,
						settings: comboSettings,
						selectedBlocks: app.selectedBlocks,
					},
					{ mode: app.processingMode, skipStaleCheck: true },
				);

				if (!result || _bgCancelled) {
					progress++;
					return;
				}

				// Render dataUrl — each chain needs its own canvas (no shared mutable state)
				const cvs = document.createElement('canvas');
				cvs.width = sourceData.width;
				cvs.height = sourceData.height;
				const ctx = cvs.getContext('2d')!;
				const imgData = new ImageData(new Uint8ClampedArray(result.rgbaData), sourceData.width, sourceData.height);
				ctx.putImageData(imgData, 0, 0);
				combo.dataUrl = cvs.toDataURL('image/png');

				progress++;
				saveCacheSnapshot();

				combo.fidelity = computeFidelity(result.rgbaData, sourceRef.data, sourceData.width, sourceData.height);
				saveCacheSnapshot();
			} catch (e) {
				console.error('Compare error:', e);
				progress++;
			} finally {
				activeWorkers--;
			}
		};

		// Chain pattern: N concurrent chains, each picks the next unprocessed combo
		const runChain = async () => {
			while (!_bgCancelled) {
				await waitIfPaused();
				if (_bgCancelled) break;
				const i = nextIdx++;
				if (i >= results.length) break;
				await processCombo(results[i], i);
			}
		};

		const chains = Array.from(
			{ length: Math.max(1, concurrency) },
			() => runChain(),
		);
		await Promise.all(chains);

		_bgGenerating = false;
		compareProgress.running = false;
		if (!_bgCancelled) saveCacheSnapshot();
	}

	function select(combo: ComboResult) {
		const bcs = hasBCSSweep
			? { brightness: combo.brightness, contrast: combo.contrast, saturation: combo.saturation }
			: undefined;
		onSelect(combo.ditherMethod, combo.colorSpace, bcs);
		// Don't close — let user browse/apply multiple combos freely
	}

	function close() {
		dialogEl?.close();
		onClose();
	}

	function handleDialogClose() {
		onClose();
	}

	function reconfigure() {
		_bgCancelled = true;
		_bgGenerating = false;
		compareProgress.running = false;
		started = false;
		progress = 0;
		results = [];
	}

	// ── Derived ──

	let totalPixels = $derived(
		renderMode === 'full'
			? app.mapSizeX * 128 * (app.mapSizeZ * 128)
			: previewSize * 128 * (previewSize * 128),
	);

	let maxThumbSize = $derived(
		renderMode === 'full'
			? Math.max(app.mapSizeX, app.mapSizeZ) * 128
			: previewSize * 128,
	);

	let sortedResults = $derived.by(() => {
		if (!sortByFidelity) return results;
		return [...results].sort((a, b) => {
			if (a.fidelity === null && b.fidelity === null) return 0;
			if (a.fidelity === null) return 1;
			if (b.fidelity === null) return -1;
			return b.fidelity - a.fidelity;
		});
	});

	let bestFidelityIdx = $derived.by(() => {
		if (sortedResults.length > 0 && sortedResults[0].fidelity !== null) return 0;
		return -1;
	});

	let total = $derived(results.length);

	// BCS preview values for the config panel
	let bcsPreviewB = $derived(sweepBrightness.enabled ? rangeValues(app.brightness, sweepBrightness.range, sweepBrightness.step, 50, 150) : [app.brightness]);
	let bcsPreviewC = $derived(sweepContrast.enabled ? rangeValues(app.contrast, sweepContrast.range, sweepContrast.step, 50, 150) : [app.contrast]);
	let bcsPreviewS = $derived(sweepSaturation.enabled ? rangeValues(app.saturation, sweepSaturation.range, sweepSaturation.step, 0, 200) : [app.saturation]);

	let poolSize = $derived(getPoolSize());
	let isFirefox = $derived(typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent));
</script>

<dialog
	bind:this={dialogEl}
	onclose={handleDialogClose}
	class="fixed inset-0 m-auto overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-0 text-[var(--color-text)] backdrop:bg-black/70 z-50"
	style="width: 95vw; max-width: 80rem; max-height: 90vh;"
>
	<!-- Header -->
	<div
		class="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-4"
	>
		<div class="min-w-0">
			<h2 class="text-lg font-semibold">Compare Combinations</h2>
			<p class="mt-0.5 text-xs text-[var(--color-muted)]">
				{#if !started}
					Configure render mode and start
				{:else if progress < total && paused}
					Paused — {progress}/{total}
				{:else if progress < total}
					Generating {progress}/{total} ({activeWorkers} workers)
				{:else}
					{total} combinations — click to apply
				{/if}
			</p>
		</div>

		{#if started && progress < total}
			<div class="flex flex-shrink-0 items-center gap-3">
				<div class="h-1.5 w-32 overflow-hidden rounded-full bg-[var(--color-border)]">
					<div
						class="h-full rounded-full transition-all duration-150 bg-[var(--color-primary)] {paused ? 'opacity-50' : ''}"
						style="width: {(progress / total) * 100}%"
					></div>
				</div>
				<span class="text-xs tabular-nums text-[var(--color-muted)]">{Math.round((progress / total) * 100)}%</span>
				{#if !paused}
					<svg
						class="h-4 w-4 animate-spin text-[var(--color-primary)]"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M21 12a9 9 0 1 1-6.219-8.56" stroke-linecap="round" />
					</svg>
				{:else}
					<span class="text-xs font-medium text-[var(--color-primary)]">Paused</span>
				{/if}
				<button
					onclick={paused ? resumeGeneration : pauseGeneration}
					class="rounded-lg bg-[var(--color-primary)] px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
				>
					{paused ? 'Resume' : 'Pause'}
				</button>
				{#if paused}
					<button
						onclick={stopGeneration}
						class="rounded-lg bg-[var(--color-danger)] px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
					>
						Stop
					</button>
				{/if}
			</div>
		{/if}

		<div class="flex flex-shrink-0 items-center gap-2">
			{#if started}
				<label class="flex items-center gap-1.5 text-xs text-[var(--color-muted)] cursor-pointer select-none mr-4">
					<input type="checkbox" bind:checked={sortByFidelity} class="accent-[var(--color-primary)]" />
					Sort by Fidelity
				</label>
				<div class="flex items-center gap-2">
					<input
						type="range"
						min="80"
						max={maxThumbSize}
						step="10"
						bind:value={thumbSize}
						class="h-1 w-24 accent-[var(--color-primary)] cursor-pointer"
					/>
					<span class="text-[10px] text-[var(--color-muted)] tabular-nums w-12">{thumbSize}px</span>
				</div>
			{/if}

			{#if started && progress >= total}
				<button
					onclick={reconfigure}
					class="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs transition-colors hover:bg-white/5"
				>
					Reconfigure
				</button>
			{/if}

			<button
				onclick={close}
				aria-label="Close"
				class="rounded-lg p-2 transition-colors hover:bg-white/5"
			>
				<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6 6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</button>
		</div>
	</div>

	{#if !started}
		<!-- Configuration step -->
		<div class="p-6">
			<div class="mx-auto max-w-lg space-y-4">
				<!-- Render Mode -->
				<div class="space-y-3">
					<label class="block">
						<span class="mb-1 block text-xs font-semibold text-[var(--color-muted)]">Render Mode</span>
						<div class="flex gap-2">
							<button
								class="flex-1 rounded border px-3 py-2 text-sm transition-colors {renderMode === 'preview'
									? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
									: 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-white/5'}"
								onclick={() => (renderMode = 'preview')}
							>
								Preview Square
							</button>
							<button
								class="flex-1 rounded border px-3 py-2 text-sm transition-colors {renderMode === 'full'
									? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
									: 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] hover:bg-white/5'}"
								onclick={() => (renderMode = 'full')}
							>
								Full Image
							</button>
						</div>
					</label>

					{#if renderMode === 'preview'}
						<label class="block">
							<span class="mb-1 block text-xs text-[var(--color-muted)]">Preview Size</span>
							<select
								class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
								bind:value={previewSize}
							>
								<option value={1}>128 × 128 (1 map)</option>
								<option value={2}>256 × 256 (4 maps)</option>
								<option value={3}>384 × 384 (9 maps)</option>
							</select>
						</label>
					{/if}

					<p class="text-xs text-[var(--color-muted)]">
						{#if renderMode === 'full'}
							Will render full {app.mapSizeX * 128}×{app.mapSizeZ * 128} image per combo.
							{#if app.mapSizeX * app.mapSizeZ > 4}
								<br />
								<strong class="text-yellow-400">Warning: Large image — this may take a while.</strong>
							{/if}
						{:else}
							Will render a {previewSize * 128}×{previewSize * 128} center crop per combo.
						{/if}
					</p>
				</div>

				<!-- Advanced: BCS Parameter Sweep -->
				<div class="rounded-lg border border-[var(--color-border)] overflow-hidden">
					<button
						onclick={() => (advancedExpanded = !advancedExpanded)}
						class="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors hover:bg-white/5"
					>
						<span>Advanced — BCS Sweep {hasBCSSweep ? '(active)' : ''}</span>
						<svg
							class="h-4 w-4 transition-transform {advancedExpanded ? 'rotate-180' : ''}"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="m6 9 6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</button>

					{#if advancedExpanded}
						<div class="space-y-3 border-t border-[var(--color-border)] px-4 py-3">
							<p class="text-xs text-[var(--color-muted)]">
								Search for optimal brightness, contrast, and saturation by sweeping ranges around the current values.
								{#if hasBCSSweep}
									Fidelity is measured against the original image (neutral BCS).
								{/if}
							</p>

							<!-- Fix dither / color space -->
							<div class="flex gap-4">
								<label class="flex items-center gap-2 text-xs">
									<input type="checkbox" bind:checked={fixDither} class="accent-[var(--color-primary)]" />
									Fix dither to current ({app.ditherMethodId})
								</label>
								<label class="flex items-center gap-2 text-xs">
									<input type="checkbox" bind:checked={fixColorSpace} class="accent-[var(--color-primary)]" />
									Fix color space to current ({app.colorSpace})
								</label>
							</div>

							<!-- Brightness sweep -->
							<div class="space-y-1">
								<label class="flex items-center gap-2 text-xs font-medium">
									<input type="checkbox" bind:checked={sweepBrightness.enabled} class="accent-[var(--color-primary)]" />
									Brightness
									<span class="text-[var(--color-muted)]">
										(current: {app.brightness}% | {bcsPreviewB.length} values: {bcsPreviewB[0]}–{bcsPreviewB[bcsPreviewB.length - 1]}%)
									</span>
								</label>
								{#if sweepBrightness.enabled}
									<div class="flex items-center gap-3 pl-6">
										<label class="flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
											±<input
												type="number"
												min="1"
												max="50"
												bind:value={sweepBrightness.range}
												class="w-12 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1 py-0.5 text-center text-[11px]"
											/>%
										</label>
										<label class="flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
											Step<input
												type="number"
												min="1"
												max="25"
												bind:value={sweepBrightness.step}
												class="w-12 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1 py-0.5 text-center text-[11px]"
											/>%
										</label>
									</div>
								{/if}
							</div>

							<!-- Contrast sweep -->
							<div class="space-y-1">
								<label class="flex items-center gap-2 text-xs font-medium">
									<input type="checkbox" bind:checked={sweepContrast.enabled} class="accent-[var(--color-primary)]" />
									Contrast
									<span class="text-[var(--color-muted)]">
										(current: {app.contrast}% | {bcsPreviewC.length} values: {bcsPreviewC[0]}–{bcsPreviewC[bcsPreviewC.length - 1]}%)
									</span>
								</label>
								{#if sweepContrast.enabled}
									<div class="flex items-center gap-3 pl-6">
										<label class="flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
											±<input
												type="number"
												min="1"
												max="50"
												bind:value={sweepContrast.range}
												class="w-12 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1 py-0.5 text-center text-[11px]"
											/>%
										</label>
										<label class="flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
											Step<input
												type="number"
												min="1"
												max="25"
												bind:value={sweepContrast.step}
												class="w-12 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1 py-0.5 text-center text-[11px]"
											/>%
										</label>
									</div>
								{/if}
							</div>

							<!-- Saturation sweep -->
							<div class="space-y-1">
								<label class="flex items-center gap-2 text-xs font-medium">
									<input type="checkbox" bind:checked={sweepSaturation.enabled} class="accent-[var(--color-primary)]" />
									Saturation
									<span class="text-[var(--color-muted)]">
										(current: {app.saturation}% | {bcsPreviewS.length} values: {bcsPreviewS[0]}–{bcsPreviewS[bcsPreviewS.length - 1]}%)
									</span>
								</label>
								{#if sweepSaturation.enabled}
									<div class="flex items-center gap-3 pl-6">
										<label class="flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
											±<input
												type="number"
												min="1"
												max="100"
												bind:value={sweepSaturation.range}
												class="w-12 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1 py-0.5 text-center text-[11px]"
											/>%
										</label>
										<label class="flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
											Step<input
												type="number"
												min="1"
												max="50"
												bind:value={sweepSaturation.step}
												class="w-12 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1 py-0.5 text-center text-[11px]"
											/>%
										</label>
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>

				<!-- Summary & Start -->
				<div class="space-y-2">
					<p class="text-xs text-[var(--color-muted)]">
						{#if hasBCSSweep}
							{@const ditherCount = fixDither ? 1 : methods.length}
							{@const csCount = fixColorSpace ? 1 : COLOR_SPACES.length}
							{ditherCount} dither{ditherCount > 1 ? 's' : ''} × {csCount} space{csCount > 1 ? 's' : ''}
							× BCS sweep
						{:else}
							{methods.length} dithers × {COLOR_SPACES.length} spaces
						{/if}
					</p>

					{#if totalCombos > 1000}
						<p class="text-xs font-medium text-yellow-400">
							Warning: {totalCombos.toLocaleString()} combinations — this will take a long time.
							Consider using Preview mode or fixing dither/color space.
						</p>
					{:else if totalCombos > 300}
						<p class="text-xs text-yellow-400/70">
							{totalCombos.toLocaleString()} combinations — may take a few minutes.
						</p>
					{/if}
				</div>

				<!-- Pool info & Worker count -->
				<div class="space-y-1.5">
					<div class="flex items-center gap-3">
						<label class="flex items-center gap-2 text-xs text-[var(--color-muted)]">
							Workers
							<input
								type="number"
								min="1"
								max="128"
								bind:value={maxWorkers}
								class="w-16 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-center text-xs"
							/>
						</label>
						<span class="text-[10px] text-[var(--color-muted)]">
							{navigator?.hardwareConcurrency ?? '?'} cores — {maxWorkers > poolSize ? `capped at ${poolSize}` : `${maxWorkers} worker${maxWorkers > 1 ? 's' : ''}`}
						</span>
					</div>
					<p class="text-[10px] text-[var(--color-muted)] leading-relaxed">
						<svg class="inline-block h-3 w-3 -mt-0.5 mr-0.5 text-orange-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke-linecap="round" stroke-linejoin="round" />
							<line x1="12" y1="9" x2="12" y2="13" stroke-linecap="round" />
							<line x1="12" y1="17" x2="12.01" y2="17" />
						</svg>
						Using too many workers may cause the browser to lag. Default is ~70 % of your cores.
					</p>
					{#if isFirefox}
						<p class="text-xs text-orange-400/80">
							<svg class="inline-block h-3.5 w-3.5 -mt-0.5 mr-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke-linecap="round" stroke-linejoin="round" />
								<line x1="12" y1="9" x2="12" y2="13" stroke-linecap="round" />
								<line x1="12" y1="17" x2="12.01" y2="17" />
							</svg>
							Firefox limits <code class="font-mono">hardwareConcurrency</code> to 8 cores. Use Chrome/Chromium for full multi-core performance.
						</p>
					{/if}
				</div>

				<button
					onclick={startGeneration}
					class="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
				>
					Start Comparison ({totalCombos.toLocaleString()} combos)
				</button>
			</div>
		</div>
	{:else}
		<!-- Gallery body -->
		<div class="overflow-auto p-6" style="max-height: calc(90vh - 72px);">
			<div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax({thumbSize}px, 1fr));">
				{#each sortedResults as combo, idx}
					{@const isCurrent =
						combo.ditherMethod === app.ditherMethodId &&
						combo.colorSpace === app.colorSpace &&
						combo.brightness === app.brightness &&
						combo.contrast === app.contrast &&
						combo.saturation === app.saturation}
					{@const isBest = idx === bestFidelityIdx && combo.fidelity !== null}
					<button
						onclick={() => select(combo)}
						disabled={!combo.dataUrl}
						class="group relative overflow-hidden rounded-lg border-2 transition-all
							{isBest
							? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/40'
							: isCurrent
								? 'ring-2'
								: 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'}
							{combo.dataUrl ? 'cursor-pointer' : 'cursor-wait'}"
						style={isCurrent && !isBest ? 'border-color: color-mix(in srgb, var(--color-primary) 55%, #000); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent);' : ''}
					>
						<div class="overflow-hidden bg-[var(--color-surface)]">
							{#if combo.dataUrl}
								<img
									src={combo.dataUrl}
									alt="{combo.ditherName} + {combo.csLabel}"
									class="w-full object-contain"
									style="image-rendering: pixelated;"
								/>
								<div
									class="absolute inset-0 bottom-auto flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20"
								>
									<span
										class="text-xs font-medium text-white opacity-0 drop-shadow-lg transition-opacity group-hover:opacity-100"
									>
										Apply
									</span>
								</div>
								{#if isCurrent}
									<div class="absolute top-1 right-1 rounded-full bg-[var(--color-primary)] p-0.5">
										<svg
											class="h-2.5 w-2.5 text-white"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="3"
										>
											<path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round" />
										</svg>
									</div>
								{/if}
							{:else}
								<div class="flex aspect-square w-full items-center justify-center">
									<svg
										class="h-3.5 w-3.5 animate-spin text-[var(--color-muted)]"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
									>
										<path d="M21 12a9 9 0 1 1-6.219-8.56" stroke-linecap="round" />
									</svg>
								</div>
							{/if}
						</div>

						<!-- Label below image -->
						<div class="border-t border-[var(--color-border)] px-2 py-1.5 text-center">
							<p class="text-[11px] font-medium leading-tight text-[var(--color-text)]">
								{combo.ditherName}
							</p>
							<p class="text-[10px] text-[var(--color-muted)]">
								{combo.csLabel}
							</p>
							{#if hasBCSSweep}
								<p class="text-[9px] tabular-nums text-[var(--color-muted)]">
									B:{combo.brightness}% C:{combo.contrast}% S:{combo.saturation}%
								</p>
							{/if}
							{#if combo.fidelity !== null}
								<p class="mt-0.5 text-[11px] font-semibold {isBest ? 'text-[var(--color-primary)]' : 'text-[var(--color-muted)]'}">
									{combo.fidelity?.toFixed(3)}% fidelity
								</p>
							{/if}
						</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</dialog>
