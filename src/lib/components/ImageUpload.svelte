<script lang="ts">
	import { getAppState } from '$lib/stores/index.js';

	const app = getAppState();

	let isDragging = $state(false);
	let fileInput: HTMLInputElement;

	function handleFile(file: File) {
		if (!file.type.startsWith('image/')) return;

		const reader = new FileReader();
		reader.onload = () => {
			const img = new Image();
			img.onload = () => {
				app.sourceImage = img;
				app.sourceFileName = file.name;
			};
			img.src = reader.result as string;
		};
		reader.readAsDataURL(file);
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		const file = e.dataTransfer?.files[0];
		if (file) handleFile(file);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleInputChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) handleFile(file);
	}

	function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (const item of items) {
			if (item.type.startsWith('image/')) {
				const file = item.getAsFile();
				if (file) handleFile(file);
				break;
			}
		}
	}
</script>

<svelte:window onpaste={handlePaste} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="flex flex-col items-center justify-center gap-6 rounded-xl border-2 border-dashed p-12 transition-colors"
	class:border-[var(--color-primary)]={isDragging}
	class:border-[var(--color-border)]={!isDragging}
	ondrop={handleDrop}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	role="region"
	aria-label="Image upload area"
>
	<img src="/images/upload.png" alt="Upload" class="h-16 w-16 opacity-50" />

	<div class="text-center">
		<h2 class="mb-2 text-2xl font-semibold">Upload an Image</h2>
		<p class="text-[var(--color-muted)]">
			Drag & drop, paste from clipboard, or click to select
		</p>
	</div>

	<button
		class="rounded-lg bg-[var(--color-primary)] px-6 py-2 font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)]"
		onclick={() => fileInput.click()}
	>
		Choose File
	</button>

	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		class="hidden"
		onchange={handleInputChange}
	/>
</div>
