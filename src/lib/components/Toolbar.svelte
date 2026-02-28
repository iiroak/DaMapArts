<script lang="ts">
	import { getAppState } from '$lib/stores/index.js';
	import { locale } from '$lib/stores/locale.svelte.js';

	const app = getAppState();
	const t = locale.t;

	let fileInput: HTMLInputElement;

	function handleNewImage() {
		fileInput.click();
	}

	function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !file.type.startsWith('image/')) return;

		const reader = new FileReader();
		reader.onload = () => {
			const img = new Image();
			img.onload = () => {
				app.sourceImage = img;
				app.sourceFileName = file.name;
				// Reset results
				app.resultImageData = null;
				app.resultPixelEntries = null;
				app.resultMaps = null;
			};
			img.src = reader.result as string;
		};
		reader.readAsDataURL(file);
	}

	function downloadImage() {
		if (!app.resultImageData) return;

		const canvas = document.createElement('canvas');
		canvas.width = app.resultImageData.width;
		canvas.height = app.resultImageData.height;
		const ctx = canvas.getContext('2d')!;
		ctx.putImageData(app.resultImageData, 0, 0);

		const link = document.createElement('a');
		link.download = `mapart_${app.mapSizeX}x${app.mapSizeZ}.png`;
		link.href = canvas.toDataURL('image/png');
		link.click();
	}
</script>

<div class="flex flex-wrap items-center gap-2">
	<!-- New image -->
	<button
		class="rounded border border-[var(--color-border)] px-3 py-1.5 text-sm hover:bg-[var(--color-surface)]"
		onclick={handleNewImage}
	>
		{t('toolbar.newImage')}
	</button>
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		class="hidden"
		onchange={handleFileChange}
	/>

	<!-- Spacer -->
	<div class="flex-1"></div>

	<!-- Download -->
	<button
		class="rounded bg-[var(--color-primary)] px-4 py-1.5 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50"
		onclick={downloadImage}
		disabled={!app.resultImageData}
	>
		{t('toolbar.downloadPNG')}
	</button>
</div>
