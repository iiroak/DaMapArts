<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { setAppState } from '$lib/stores/index.js';
	import { terminateWorker } from '$lib/processor/backend.js';
	import { disposeGL } from '$lib/processor/gpu/WebGLProcessor.js';
	import { installMemDiag, registerSource, estimateObjectSize, formatBytes } from '$lib/utils/memDiag.js';
	import Modal from '$lib/components/Modal.svelte';
	import BetaNotice from '$lib/components/BetaNotice.svelte';
	import UpdateNotice from '$lib/components/UpdateNotice.svelte';
	import { clearCompareCache } from '$lib/components/CompareModal.svelte';

	let { children } = $props();

	const state = setAppState();

	onMount(() => {
		// ── Aggressive cleanup on page unload to prevent memory accumulation ──
		const handleUnload = () => {
			// 1. Kill all Workers immediately — prevents detached worker accumulation
			terminateWorker();

			// 2. Destroy WebGL context — frees GPU memory (textures, shaders, framebuffers)
			disposeGL();

			// 3. Clear compare cache data URLs (can be MBs of base64 PNG strings)
			clearCompareCache();

			// 4. Null out ALL large data in app state so V8 can reclaim before new page loads
			state.resultImageData = null;
			state.resultPixelIndices = null;
			state.resultPalette = null;
			state.resultMaps = null;
			state.sourceImage = null;
			// Release the heavy JSON data + selected blocks proxy tree
			state.coloursJSON = {} as any;
			state.selectedBlocks = {} as any;

			// 5. Release all <canvas> backing stores by zeroing dimensions
			document.querySelectorAll('canvas').forEach((c) => {
				c.width = 0;
				c.height = 0;
				// Clear any 2D context in case it holds retained data
				const ctx = c.getContext('2d');
				if (ctx) ctx.clearRect(0, 0, 0, 0);
			});
		};
		window.addEventListener('beforeunload', handleUnload);

		// ── Memory diagnostics (dev) ──
		installMemDiag();

		// Register appState memory sources
		registerSource(() => ({
			label: 'appState.resultImageData',
			bytes: state.resultImageData ? state.resultImageData.data.byteLength : 0,
		}));
		registerSource(() => ({
			label: 'appState.resultPixelIndices',
			bytes: state.resultPixelIndices ? state.resultPixelIndices.byteLength : 0,
			detail: state.resultPixelIndices ? `${state.resultPixelIndices.length} indices (Uint16Array)` : 'null',
		}));
		registerSource(() => ({
			label: 'appState.resultMaps',
			bytes: estimateObjectSize(state.resultMaps),
			detail: state.resultMaps ? `${state.resultMaps.length}×${state.resultMaps[0]?.length ?? 0} sections` : 'null',
		}));
		registerSource(() => ({
			label: 'appState.sourceImage (decoded)',
			bytes: state.sourceImage ? state.sourceImage.naturalWidth * state.sourceImage.naturalHeight * 4 : 0,
			detail: state.sourceImage ? `${state.sourceImage.naturalWidth}×${state.sourceImage.naturalHeight}` : 'null',
		}));
		registerSource(() => ({
			label: 'appState.coloursJSON',
			bytes: estimateObjectSize(state.coloursJSON),
		}));
		registerSource(() => ({
			label: 'appState.selectedBlocks',
			bytes: estimateObjectSize(state.selectedBlocks),
		}));

		// Always load a random default image on startup
		if (!state.sourceImage) {
			const defaults = [
				`${base}/images/blaze.png`,
				`${base}/images/diamond.png`,
				`${base}/images/enderman.png`,
				`${base}/images/shulker.png`,
				`${base}/images/wolf.png`
			];
			const pick = defaults[Math.floor(Math.random() * defaults.length)];
			const img = new Image();
			img.onload = () => {
				state.sourceImage = img;
				state.sourceFileName = pick.split('/').pop() || 'default.png';
			};
			img.src = pick;
		}

		// Cleanup on component destroy (SPA navigation) + page unload
		return () => {
			window.removeEventListener('beforeunload', handleUnload);
			terminateWorker();
			disposeGL();
		};
	});
</script>

<svelte:head>
	<title>DaMapArts</title>
</svelte:head>

<div class="h-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]">
	{@render children()}
</div>

<Modal />
<BetaNotice />
<UpdateNotice />
