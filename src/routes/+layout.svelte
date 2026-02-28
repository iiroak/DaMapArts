<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { setAppState } from '$lib/stores/index.js';
	import Modal from '$lib/components/Modal.svelte';
	import BetaNotice from '$lib/components/BetaNotice.svelte';

	let { children } = $props();

	const state = setAppState();

	onMount(() => {
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
	});
</script>

<svelte:head>
	<link rel="icon" href={`${base}/images/damapart.png`} />
	<title>DaMapArts</title>
</svelte:head>

<div class="h-screen overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]">
	{@render children()}
</div>

<Modal />
<BetaNotice />
