<script lang="ts">
	import { untrack } from 'svelte';
	import { getAppState } from '$lib/stores/index.js';
	import { locale } from '$lib/stores/locale.svelte.js';
	import { buildActivePalette, getToneKeysForStaircasing } from '$lib/palette/colours.js';
	import { getSourcePixels } from '$lib/processor/crop.js';
	import { processAsync } from '$lib/processor/backend.js';
	import { applyBilateralFilter } from '$lib/processor/bilateralFilter.js';
	import type { ProcessorSettings } from '$lib/processor/types.js';
	import type { ToneKey } from '$lib/types/colours.js';

	const app = getAppState();
	const t = locale.t;

	let canvas = $state<HTMLCanvasElement>(undefined!);
	let gridCanvas = $state<HTMLCanvasElement>(undefined!);
	let containerRef = $state<HTMLDivElement>(undefined!);

	// Toggle between original / pre-processed / map art
	type ViewMode = 'mapart' | 'preprocess' | 'original';
	let viewMode = $state<ViewMode>('mapart');
	// Non-reactive storage for source snapshots (avoid deep proxy on ImageData)
	let _rawSource: ImageData | null = null;
	let _preProcessed: ImageData | null = null;
	let sourceVersion = $state(0); // bump to trigger redraw

	const VIEW_LABELS: Record<ViewMode, string> = {
		original: 'preview.original',
		preprocess: 'preview.preprocessed',
		mapart: 'preview.mapart',
	};
	const VIEW_CYCLE: ViewMode[] = ['original', 'preprocess', 'mapart'];

	function cycleViewMode() {
		const idx = VIEW_CYCLE.indexOf(viewMode);
		viewMode = VIEW_CYCLE[(idx + 1) % VIEW_CYCLE.length];
		if (viewMode !== 'mapart') showBlocks = false;
	}

	// Block/Color render toggle
	let showBlocks = $state(false);
	let blockCanvas = $state<HTMLCanvasElement>(undefined!);
	let _texturesImg: HTMLImageElement | null = null;
	const BLOCK_PX = 8; // pixels per block in block view

	// Load textures sprite sheet on mount
	function loadTextures(): Promise<HTMLImageElement> {
		if (_texturesImg) return Promise.resolve(_texturesImg);
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => { _texturesImg = img; resolve(img); };
			img.src = '/images/textures.png';
		});
	}

	// Pan state
	let panX = $state(0);
	let panY = $state(0);
	let isDragging = $state(false);
	let dragStartX = $state(0);
	let dragStartY = $state(0);
	let panStartX = $state(0);
	let panStartY = $state(0);

	// Derived dimensions
	let canvasWidth = $derived(app.mapSizeX * 128);
	let canvasHeight = $derived(app.mapSizeZ * 128);

	// Track the actual displayed canvas size so the grid stays in sync
	// (canvasWidth/Height update instantly on mapSize change, but the rendered
	//  result may still be from the previous size until reprocessing finishes)
	let displayWidth = $state(0);
	let displayHeight = $state(0);

	// Auto-process when settings change
	$effect(() => {
		if (!app.sourceImage) return;
		if (!app.mapSizeX || !app.mapSizeZ || app.mapSizeX < 1 || app.mapSizeZ < 1) return;

		// Touch reactive deps to trigger re-processing
		void app.mapSizeX;
		void app.mapSizeZ;
		void app.ditherMethodId;
		void app.colorSpace;
		void app.modeId;
		void app.staircasingId;
		void app.cropMode;
		void app.cropZoom;
		void app.cropOffsetX;
		void app.cropOffsetY;
		void app.brightness;
		void app.contrast;
		void app.saturation;
		void app.transparencyEnabled;
		void app.transparencyTolerance;
		void app.backgroundMode;
		void app.backgroundColour;
		void app.selectedBlocks;
		// Deep-read selectedBlocks to trigger on individual property changes
		void JSON.stringify(app.selectedBlocks);
		void app.bilateralEnabled;
		void app.bilateralSigmaSpace;
		void app.bilateralSigmaColor;
		void app.bilateralRadius;
		void app.edgeMaskEnabled;
		void app.edgeMaskThreshold;
		void app.luminanceWeight;

		// Run processing outside tracking context to avoid circular deps
		untrack(() => runProcessing());
	});

	// Draw canvas based on view mode
	$effect(() => {
		if (!canvas) return;
		void sourceVersion; // track source data changes
		if (showBlocks) return; // block canvas handles rendering
		let imgData: ImageData | null = null;
		if (viewMode === 'original') imgData = _rawSource;
		else if (viewMode === 'preprocess') imgData = _preProcessed;
		else imgData = app.resultImageData;
		if (!imgData) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		canvas.width = imgData.width;
		canvas.height = imgData.height;
		// Reset CSS overrides from block mode
		canvas.style.width = '';
		canvas.style.height = '';
		ctx.putImageData(imgData, 0, 0);
		// Sync grid dimensions with the actual rendered content
		displayWidth = imgData.width;
		displayHeight = imgData.height;
	});

	// Draw block texture view
	$effect(() => {
		if (!canvas || !showBlocks) return;
		const entries = app.resultPixelEntries;
		if (!entries || entries.length === 0) return;
		const w = canvasWidth;
		const h = canvasHeight;
		// Track display dimensions for the grid
		displayWidth = w;
		displayHeight = h;
		// Render block textures async after loading sprite sheet
		loadTextures().then((tex) => {
			const bw = w * BLOCK_PX;
			const bh = h * BLOCK_PX;
			canvas.width = bw;
			canvas.height = bh;
			// CSS display size matches color mode so zoom/position stays consistent
			canvas.style.width = w + 'px';
			canvas.style.height = h + 'px';
			const ctx = canvas.getContext('2d')!;
			ctx.imageSmoothingEnabled = false;
			for (let y = 0; y < h; y++) {
				for (let x = 0; x < w; x++) {
					const entry = entries[y * w + x];
					if (!entry || entry.colourSetId === '-1') continue;
					// Always use blockId 0 (full block like wool) for the texture preview
					const sx = 0;
					const sy = parseInt(entry.colourSetId) * 32;
					ctx.drawImage(tex, sx, sy, 32, 32, x * BLOCK_PX, y * BLOCK_PX, BLOCK_PX, BLOCK_PX);
				}
			}
		});
	});

	// Draw grid overlay — uses displayWidth/displayHeight so the grid matches
	// the actual rendered canvas, not the intended dimensions which may be ahead
	// of the result during reprocessing.
	$effect(() => {
		if (!gridCanvas) return;
		const ctx = gridCanvas.getContext('2d');
		if (!ctx) return;
		const gw = displayWidth;
		const gh = displayHeight;
		if (gw === 0 || gh === 0) return;
		gridCanvas.width = gw;
		gridCanvas.height = gh;
		// Reset CSS overrides
		gridCanvas.style.width = '';
		gridCanvas.style.height = '';
		ctx.clearRect(0, 0, gw, gh);

		if (app.showGrid) {
			const mapW = Math.round(gw / 128);
			const mapH = Math.round(gh / 128);
			ctx.strokeStyle = 'rgba(255, 50, 50, 0.6)';
			ctx.lineWidth = 0.5;

			// 128×128 map borders
			for (let x = 0; x <= mapW; x++) {
				ctx.beginPath();
				ctx.moveTo(x * 128, 0);
				ctx.lineTo(x * 128, gh);
				ctx.stroke();
			}
			for (let y = 0; y <= mapH; y++) {
				ctx.beginPath();
				ctx.moveTo(0, y * 128);
				ctx.lineTo(gw, y * 128);
				ctx.stroke();
			}
		}
	});

	function runProcessing() {
		if (!app.sourceImage) return;

		app.isProcessing = true;
		app.processingProgress = 0;

		// Get tone keys for current staircasing
		const toneKeys = getToneKeysForStaircasing(app.staircasingId, app.mapModes);

		// Build palette
		const palette = buildActivePalette(app.coloursJSON, app.selectedBlocks, toneKeys);

		if (palette.length === 0) {
			app.isProcessing = false;
			return;
		}

		const settings: ProcessorSettings = {
			mapSizeX: app.mapSizeX,
			mapSizeZ: app.mapSizeZ,
			cropMode: app.cropMode,
			cropZoom: app.cropZoom,
			cropOffsetX: app.cropOffsetX,
			cropOffsetY: app.cropOffsetY,
			ditherMethod: app.ditherMethodId,
			colorSpace: app.colorSpace,
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

		// Get source pixels (runs on main thread — uses canvas for resize)
		const { data, width, height } = getSourcePixels(app.sourceImage, settings);

		// Store raw source (after crop/BCS but before filters)
		_rawSource = new ImageData(new Uint8ClampedArray(data), width, height);

		// Store pre-processed source (with bilateral filter applied)
		if (settings.bilateralEnabled) {
			const totalPixels = width * height;
			const previewData = new Uint8ClampedArray(data);
			const rgbFloat = new Float32Array(totalPixels * 3);
			for (let i = 0; i < totalPixels; i++) {
				rgbFloat[i * 3] = previewData[i * 4];
				rgbFloat[i * 3 + 1] = previewData[i * 4 + 1];
				rgbFloat[i * 3 + 2] = previewData[i * 4 + 2];
			}
			applyBilateralFilter(
				rgbFloat, width, height,
				settings.bilateralSigmaSpace,
				settings.bilateralSigmaColor,
				settings.bilateralRadius,
			);
			for (let i = 0; i < totalPixels; i++) {
				previewData[i * 4] = Math.round(rgbFloat[i * 3]);
				previewData[i * 4 + 1] = Math.round(rgbFloat[i * 3 + 1]);
				previewData[i * 4 + 2] = Math.round(rgbFloat[i * 3 + 2]);
			}
			_preProcessed = new ImageData(previewData, width, height);
		} else {
			_preProcessed = _rawSource;
		}
		sourceVersion++;

		// Process asynchronously (GPU / Worker / Main thread depending on mode)
		processAsync(
			{
				rgbaData: data,
				width,
				height,
				palette,
				settings,
				selectedBlocks: app.selectedBlocks,
			},
			{
				mode: app.processingMode,
				onProgress: (p) => {
					app.processingProgress = p;
				},
			},
		).then((result) => {
			if (!result) return; // Superseded by newer request

			const pixelData = new Uint8ClampedArray(result.rgbaData);
			app.resultImageData = new ImageData(pixelData, width, height);
			app.resultPixelEntries = result.pixelEntries;
			app.resultMaps = result.maps;
			app.resultTotalPixels = result.totalPixels;
			app.resultUniqueColors = result.uniqueColors;
			app.isProcessing = false;
			app.processingProgress = 1;
		});
	}

	// Reset pan and auto-fit zoom when result changes
	let lastResultRef: ImageData | null = null;
	$effect(() => {
		const result = app.resultImageData;
		if (result && result !== lastResultRef) {
			lastResultRef = result;
			panX = 0;
			panY = 0;
			// Auto-fit: calculate zoom to fit canvas in container
			if (containerRef) {
				const rect = containerRef.getBoundingClientRect();
				const padX = 40;
				const padY = 40;
				const fitZoomX = (rect.width - padX) / result.width;
				const fitZoomY = (rect.height - padY) / result.height;
				const fitZoom = Math.min(fitZoomX, fitZoomY);
				app.zoomLevel = Math.max(0.25, Math.min(16, Math.round(fitZoom * 4) / 4));
			}
		}
	});

	function handleMouseDown(e: MouseEvent) {
		if (e.button !== 0) return; // left click only
		if (!containerRef) return;
		// Ignore clicks near the resize handle (bottom-right 20×20 area)
		const rect = containerRef.getBoundingClientRect();
		const relX = e.clientX - rect.left;
		const relY = e.clientY - rect.top;
		if (relX > rect.width - 20 && relY > rect.height - 20) return;

		isDragging = true;
		dragStartX = e.clientX;
		dragStartY = e.clientY;
		panStartX = panX;
		panStartY = panY;
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		panX = panStartX + (e.clientX - dragStartX);
		panY = panStartY + (e.clientY - dragStartY);
	}

	function handleMouseUp() {
		isDragging = false;
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		if (!containerRef) return;

		const rect = containerRef.getBoundingClientRect();
		// Mouse position relative to container center
		const mx = e.clientX - rect.left - rect.width / 2;
		const my = e.clientY - rect.top - rect.height / 2;

		const oldZoom = app.zoomLevel;
		const delta = e.deltaY > 0 ? -1 : 1;
		const step = 0.25;
		const newZoom = Math.max(0.25, Math.min(16, oldZoom + delta * step));

		if (newZoom !== oldZoom) {
			// Check if mouse is over the canvas image
			const halfW = (canvasWidth * oldZoom) / 2;
			const halfH = (canvasHeight * oldZoom) / 2;
			const overCanvas =
				mx >= panX - halfW && mx <= panX + halfW &&
				my >= panY - halfH && my <= panY + halfH;

			// Zoom toward mouse if over canvas, otherwise toward center
			const zx = overCanvas ? mx : 0;
			const zy = overCanvas ? my : 0;
			const scale = newZoom / oldZoom;
			panX = zx - scale * (zx - panX);
			panY = zy - scale * (zy - panY);
			app.zoomLevel = newZoom;
		}
	}

	function centerImage() {
		panX = 0;
		panY = 0;
	}

	function fitToView() {
		if (!containerRef || !app.resultImageData) return;
		const rect = containerRef.getBoundingClientRect();
		const padX = 40;
		const padY = 40;
		const fitZoomX = (rect.width - padX) / app.resultImageData.width;
		const fitZoomY = (rect.height - padY) / app.resultImageData.height;
		const fitZoom = Math.min(fitZoomX, fitZoomY);
		app.zoomLevel = Math.max(0.25, Math.min(16, Math.round(fitZoom * 4) / 4));
		panX = 0;
		panY = 0;
	}

	function toggleGrid() {
		app.showGrid = !app.showGrid;
	}
</script>

<div class="relative">
	<!-- Left overlay: Zoom + Grid -->
	<div class="absolute left-2 top-2 z-20 flex items-center gap-1">
		<button
			class="canvas-overlay-btn"
			onclick={() => (app.zoomLevel = Math.max(app.zoomLevel / 2, 0.25))}
			title={t('preview.zoomOut')}
		>
			−
		</button>
		<span class="min-w-[3rem] text-center text-[10px] tabular-nums text-[var(--color-text-muted)]">
			{Math.round(app.zoomLevel * 100)}%
		</span>
		<button
			class="canvas-overlay-btn"
			onclick={() => (app.zoomLevel = Math.min(app.zoomLevel * 2, 16))}
			title={t('preview.zoomIn')}
		>
			+
		</button>
		<button
			class="canvas-overlay-btn"
			class:canvas-overlay-btn--active={app.showGrid}
			onclick={toggleGrid}
			title={t('preview.toggleGrid')}
		>
			{t('preview.grid')}
		</button>
	</div>

	<!-- Right overlay: Fit + Center -->
	<div class="absolute right-2 top-2 z-20 flex gap-1">
		<button
			class="canvas-overlay-btn"
			onclick={fitToView}
			title={t('preview.fitToView')}
		>
			{t('preview.fit')}
		</button>
		<button
			class="canvas-overlay-btn"
			onclick={centerImage}
			title={t('preview.centerImage')}
		>
			{t('preview.center')}
		</button>
	</div>

	<!-- Bottom-left overlay: View mode toggle + Block/Color -->
	<div class="absolute bottom-2 left-2 z-20 flex gap-1">
		<button
			class="canvas-overlay-btn"
			class:canvas-overlay-btn--active={viewMode !== 'mapart'}
			onclick={cycleViewMode}
			title={t('preview.cycleView')}
			disabled={sourceVersion === 0}
		>
			{t(VIEW_LABELS[viewMode])}
		</button>
		{#if viewMode === 'mapart'}
		<button
			class="canvas-overlay-btn"
			class:canvas-overlay-btn--active={showBlocks}
			onclick={() => (showBlocks = !showBlocks)}
			title={t('preview.toggleBlocks')}
			disabled={!app.resultPixelEntries}
		>
			{showBlocks ? t('preview.block') : t('preview.color')}
		</button>
		{/if}
	</div>

	<div
		bind:this={containerRef}
		class="relative flex items-center justify-center overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]"
		style="height: 600px; min-height: 200px; resize: vertical; cursor: {isDragging ? 'grabbing' : 'grab'};"
		onmousedown={handleMouseDown}
		onmousemove={handleMouseMove}
		onmouseup={handleMouseUp}
		onmouseleave={handleMouseUp}
		onwheel={handleWheel}
		role="img"
	>
	{#if app.isProcessing}
		<div class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/50">
			<div class="h-2 w-48 overflow-hidden rounded-full bg-gray-700">
				<div
					class="h-full bg-[var(--color-primary)] transition-all"
					style="width: {app.processingProgress * 100}%"
				></div>
			</div>
			<p class="mt-2 text-sm text-white">
				{t('preview.processing')} {Math.round(app.processingProgress * 100)}%
			</p>
		</div>
	{/if}

	{#if app.resultImageData}
		<div
			class="relative"
			style="transform: translate({panX}px, {panY}px) scale({app.zoomLevel}); transform-origin: center center; pointer-events: none;"
		>
			<canvas
				bind:this={canvas}
				class="block"
				style="image-rendering: pixelated;"
			></canvas>
			<canvas
				bind:this={gridCanvas}
				class="pointer-events-none absolute left-0 top-0"
				style="image-rendering: pixelated;"
			></canvas>
		</div>
	{:else if app.sourceImage}
		<p class="text-[var(--color-muted)]">{t('preview.selectBlocks')}</p>
	{:else}
		<p class="text-[var(--color-muted)]">{t('preview.uploadImage')}</p>
	{/if}
	</div>
</div>

<style>
	.canvas-overlay-btn {
		padding: 4px 10px;
		font-size: 11px;
		font-weight: 500;
		border-radius: 4px;
		border: 1px solid var(--color-border, #2a2a2a);
		background: var(--color-bg-card, #1a1a1a);
		color: var(--color-text-muted, #888);
		cursor: pointer;
		transition: all 0.15s;
		opacity: 0.85;
	}

	.canvas-overlay-btn:hover {
		background: var(--color-bg-input, #222);
		color: var(--color-text, #e5e5e5);
		opacity: 1;
	}

	.canvas-overlay-btn--active {
		background: var(--color-primary, #6366f1);
		border-color: var(--color-primary, #6366f1);
		color: white;
		opacity: 1;
	}

	.canvas-overlay-btn--active:hover {
		background: var(--color-primary-hover, #818cf8);
	}
</style>
