<script lang="ts">
	import { getAppState } from '$lib/stores/index.js';
	import { infoModal } from '$lib/stores/infoModal.svelte.js';
	import { locale } from '$lib/stores/locale.svelte.js';

	const app = getAppState();
	const t = locale.t;

	let fileInput: HTMLInputElement;
	let isDragOver = $state(false);
	let fileSize = $state(0);

	function handleNewImage() {
		fileInput.click();
	}

	function formatSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function gcd(a: number, b: number): number {
		return b === 0 ? a : gcd(b, a % b);
	}

	function aspectRatio(w: number, h: number): string {
		const d = gcd(w, h);
		const rw = w / d;
		const rh = h / d;

		// If already simple enough, show exact ratio
		if (rw <= 20 && rh <= 20) return `${rw}:${rh}`;

		// Find best simple approximation (max denominator 16)
		const ratio = w / h;
		let bestN = 1, bestD = 1, bestErr = Infinity;
		for (let den = 1; den <= 16; den++) {
			const num = Math.round(ratio * den);
			if (num < 1) continue;
			const err = Math.abs(num / den - ratio);
			if (err < bestErr - 0.001 || (Math.abs(err - bestErr) <= 0.001 && num + den < bestN + bestD)) {
				bestErr = err;
				bestN = num;
				bestD = den;
			}
		}
		const g = gcd(bestN, bestD);
		return `≈${bestN / g}:${bestD / g}`;
	}

	function loadImageFile(file: File) {
		if (!file.type.startsWith('image/')) return;
		fileSize = file.size;
		const reader = new FileReader();
		reader.onload = () => {
			const img = new Image();
			img.onload = () => {
				app.sourceImage = img;
				app.sourceFileName = file.name;
				app.resultImageData = null;
				app.resultPixelEntries = null;
				app.resultMaps = null;
			};
			img.src = reader.result as string;
		};
		reader.readAsDataURL(file);
	}

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) loadImageFile(file);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		const file = e.dataTransfer?.files[0];
		if (file) loadImageFile(file);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragOver = true;
	}

	let thumbUrl = $derived.by(() => {
		if (!app.sourceImage) return null;
		return app.sourceImage.src;
	});

	let expanded = $state(true);
</script>

<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<div class="flex w-full items-center gap-2">
		<h3 class="flex-1 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">{t('file.title')}</h3>
		<button
			class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-[var(--color-muted)] opacity-50 transition-all hover:opacity-100 hover:text-[var(--color-primary)] hover:bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
			onclick={(e) => { e.stopPropagation(); infoModal.openTab('general'); }}
			title={t('file.help')}
		>?</button>
		<button
			class="flex items-center justify-center"
			onclick={() => (expanded = !expanded)}
		>
			<span class="text-xs text-[var(--color-muted)] transition-transform" class:rotate-90={expanded}>▶</span>
		</button>
	</div>

	{#if expanded}
	<div class="mt-3">
	<!-- Drop zone / thumbnail -->
	<button
		class="group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors
			{isDragOver
			? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
			: thumbUrl
				? 'border-transparent bg-black/20'
				: 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-muted)]'}
			{thumbUrl ? 'aspect-video' : 'py-6'}"
		onclick={handleNewImage}
		ondrop={handleDrop}
		ondragover={handleDragOver}
		ondragleave={() => (isDragOver = false)}
	>
		{#if thumbUrl}
			<img
				src={thumbUrl}
				alt="Source"
				class="h-full w-full object-contain"
			/>
			<!-- Hover overlay -->
			<div class="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
				<span class="text-xs font-medium text-white opacity-0 drop-shadow-lg transition-opacity group-hover:opacity-100">
					Change Image
				</span>
			</div>
		{:else}
			<svg class="mb-2 h-8 w-8 text-[var(--color-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
				<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke-linecap="round" stroke-linejoin="round"/>
				<polyline points="17 8 12 3 7 8" stroke-linecap="round" stroke-linejoin="round"/>
				<line x1="12" y1="3" x2="12" y2="15" stroke-linecap="round"/>
			</svg>
			<span class="text-xs text-[var(--color-muted)]">
				{t('file.dropzone')}
			</span>
		{/if}
	</button>

	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		class="hidden"
		onchange={handleFileChange}
	/>

	{#if app.sourceImage}
		<div class="mt-2 space-y-0.5 text-xs text-[var(--color-muted)]">
			{#if app.sourceFileName}
				<div class="flex justify-between">
					<span class="opacity-60">{t('file.name')}</span>
					<span class="truncate ml-2 text-right text-[var(--color-text)]" title={app.sourceFileName}>{app.sourceFileName}</span>
				</div>
			{/if}
			{#if fileSize > 0}
				<div class="flex justify-between">
					<span class="opacity-60">{t('file.size')}</span>
					<span class="text-[var(--color-text)]">{formatSize(fileSize)}</span>
				</div>
			{/if}
			<div class="flex justify-between">
				<span class="opacity-60">{t('file.resolution')}</span>
				<span class="text-[var(--color-text)]">{app.sourceImage.naturalWidth}×{app.sourceImage.naturalHeight}</span>
			</div>
			<div class="flex justify-between">
				<span class="opacity-60">{t('file.ratio')}</span>
				<span class="text-[var(--color-text)]">{aspectRatio(app.sourceImage.naturalWidth, app.sourceImage.naturalHeight)}</span>
			</div>
		</div>
	{/if}

	<!-- Load Image button -->
	<button
		class="mt-2 w-full rounded bg-[var(--color-primary)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)]"
		onclick={handleNewImage}
	>
		{t('file.loadImage')}
	</button>
	</div>
	{/if}
</div>
