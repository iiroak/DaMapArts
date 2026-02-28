<script lang="ts">
	import { base } from '$app/paths';
	import { infoModal } from '$lib/stores/infoModal.svelte.js';

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open = $bindable(), onclose }: Props = $props();

	const tabs: { id: string; label: string }[] = [
		{ id: 'about', label: 'About' },
		{ id: 'technology', label: 'Technology' },
		{ id: 'general', label: 'General' },
		{ id: 'preprocessing', label: 'Pre-Processing' },
		{ id: 'processing', label: 'Processing' },
		{ id: 'blocks', label: 'Blocks' },
		{ id: 'customblocks', label: 'Custom Blocks' },
		{ id: 'export', label: 'Export' },
		{ id: 'shortcuts', label: 'Shortcuts' },
		{ id: 'faq', label: 'FAQ' },
	];

	let activeTab = $state('about');
	let dialogEl: HTMLDialogElement | undefined = $state(undefined);

	// Sync with store tab when opening from external (?) buttons
	$effect(() => {
		if (open && infoModal.tab) {
			activeTab = infoModal.tab;
		}
	});

	$effect(() => {
		if (open) {
			dialogEl?.showModal();
		} else {
			dialogEl?.close();
		}
	});

	function handleClose() {
		open = false;
		onclose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === dialogEl) handleClose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			handleClose();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialogEl}
	class="info-dialog"
	onclick={handleBackdropClick}
	onkeydown={handleKeydown}
>
	<div class="info-container">
		<!-- Header -->
		<div class="info-header">
			<h2 class="text-base font-semibold text-[var(--color-text)]">DaMapArts Info</h2>
			<button
				class="flex h-7 w-7 items-center justify-center rounded text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
				onclick={handleClose}
				title="Close"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>

		<!-- Body -->
		<div class="info-body">
			<!-- Left: Tabs -->
			<nav class="info-tabs">
				{#each tabs as tab}
					<button
						class="info-tab"
						class:active={activeTab === tab.id}
						onclick={() => (activeTab = tab.id)}
					>
						<svg class="tab-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							{#if tab.id === 'about'}
								<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor" stroke="none" />
							{:else if tab.id === 'technology'}
								<polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
							{:else if tab.id === 'general'}
								<circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
							{:else if tab.id === 'preprocessing'}
								<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
							{:else if tab.id === 'processing'}
								<circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
							{:else if tab.id === 'blocks'}
								<rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
							{:else if tab.id === 'customblocks'}
								<path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
							{:else if tab.id === 'export'}
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
							{:else if tab.id === 'shortcuts'}
								<rect x="2" y="4" width="20" height="16" rx="2" ry="2" /><line x1="6" y1="8" x2="6.01" y2="8" /><line x1="10" y1="8" x2="10.01" y2="8" /><line x1="14" y1="8" x2="14.01" y2="8" /><line x1="18" y1="8" x2="18.01" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="6" y1="16" x2="6.01" y2="16" /><line x1="18" y1="16" x2="18.01" y2="16" />
							{:else if tab.id === 'faq'}
								<circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
							{/if}
						</svg>
						<span class="tab-label">{tab.label}</span>
					</button>
				{/each}
			</nav>

			<!-- Right: Content -->
			<div class="info-content">
				{#if activeTab === 'about'}
					<div class="content-section about-section">
						<div class="about-info">
							<p class="about-author">Developed by <strong>iroaK</strong></p>
							<p class="about-quote">"The limit is only what you can't imagine"</p>
							<div class="about-buttons">
								<a href="https://github.com/iiroak" target="_blank" rel="noopener noreferrer" class="about-btn about-btn-github">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
										<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
									</svg>
									<span>GitHub</span>
								</a>
								<a href="https://buymeacoffee.com/iroak" target="_blank" rel="noopener noreferrer" class="about-btn about-btn-coffee">
									<svg width="18" height="18" viewBox="0 0 24 24" role="img" fill="currentColor">
										<path d="m20.216 6.415-.132-.666c-.119-.598-.388-1.163-1.001-1.379-.197-.069-.42-.098-.57-.241-.152-.143-.196-.366-.231-.572-.065-.378-.125-.756-.192-1.133-.057-.325-.102-.69-.25-.987-.195-.4-.597-.634-.996-.788a5.723 5.723 0 0 0-.626-.194c-1-.263-2.05-.36-3.077-.416a25.834 25.834 0 0 0-3.7.062c-.915.083-1.88.184-2.75.5-.318.116-.646.256-.888.501-.297.302-.393.77-.177 1.146.154.267.415.456.692.58.36.162.737.284 1.123.366 1.075.238 2.189.331 3.287.37 1.218.05 2.437.01 3.65-.118.299-.033.598-.073.896-.119.352-.054.578-.513.474-.834-.124-.383-.457-.531-.834-.473-.466.074-.96.108-1.382.146-1.177.08-2.358.082-3.536.006a22.228 22.228 0 0 1-1.157-.107c-.086-.01-.18-.025-.258-.036-.243-.036-.484-.08-.724-.13-.111-.027-.111-.185 0-.212h.005c.277-.06.557-.108.838-.147h.002c.131-.009.263-.032.394-.048a25.076 25.076 0 0 1 3.426-.12c.674.019 1.347.067 2.017.144l.228.031c.267.04.533.088.798.145.392.085.895.113 1.07.542.055.137.08.288.111.431l.319 1.484a.237.237 0 0 1-.199.284h-.003c-.037.006-.075.01-.112.015a36.704 36.704 0 0 1-4.743.295 37.059 37.059 0 0 1-4.699-.304c-.14-.017-.293-.042-.417-.06-.326-.048-.649-.108-.973-.161-.393-.065-.768-.032-1.123.161-.29.16-.527.404-.675.701-.154.316-.199.66-.267 1-.069.34-.176.707-.135 1.056.087.753.613 1.365 1.37 1.502a39.69 39.69 0 0 0 11.343.376.483.483 0 0 1 .535.53l-.071.697-1.018 9.907c-.041.41-.047.832-.125 1.237-.122.637-.553 1.028-1.182 1.171-.577.131-1.165.2-1.756.205-.656.004-1.31-.025-1.966-.022-.699.004-1.556-.06-2.095-.58-.475-.458-.54-1.174-.605-1.793l-.731-7.013-.322-3.094c-.037-.351-.286-.695-.678-.678-.336.015-.718.3-.678.679l.228 2.185.949 9.112c.147 1.344 1.174 2.068 2.446 2.272.742.12 1.503.144 2.257.156.966.016 1.942.053 2.892-.122 1.408-.258 2.465-1.198 2.616-2.657.34-3.332.683-6.663 1.024-9.995l.215-2.087a.484.484 0 0 1 .39-.426c.402-.078.787-.212 1.074-.518.455-.488.546-1.124.385-1.766zm-1.478.772c-.145.137-.363.201-.578.233-2.416.359-4.866.54-7.308.46-1.748-.06-3.477-.254-5.207-.498-.17-.024-.353-.055-.47-.18-.22-.236-.111-.71-.054-.995.052-.26.152-.609.463-.646.484-.057 1.046.148 1.526.22.577.088 1.156.159 1.737.212 2.48.226 5.002.19 7.472-.14.45-.06.899-.13 1.345-.21.399-.072.84-.206 1.08.206.166.281.188.657.162.974a.544.544 0 0 1-.169.364zm-6.159 3.9c-.862.37-1.84.788-3.109.788a5.884 5.884 0 0 1-1.569-.217l.877 9.004c.065.78.717 1.38 1.5 1.38 0 0 1.243.065 1.658.065.447 0 1.786-.065 1.786-.065.783 0 1.434-.6 1.499-1.38l.94-9.95a3.996 3.996 0 0 0-1.322-.238c-.826 0-1.491.284-2.26.613z"/>
									</svg>
									<span>Buy me a Coffee</span>
								</a>
							</div>
							<p class="about-donate-msg">Hey! If you liked the project, help me skip the normal queue in 2b2t</p>
						</div>
						<img src={`${base}/images/kaori-tree.png`} alt="Kaori Tree" class="about-img" />
					</div>

				{:else if activeTab === 'technology'}
					<div class="content-section">
						<div class="tech-logo">
							<img src={`${base}/images/damapart.png`} alt="DaMapArts" class="tech-logo-img" />
							<h3 class="tech-logo-title">DaMapArts</h3>
						</div>
						<div class="mb-3 flex justify-center">
							<a
								href="https://github.com/iiroak/DaMapArts"
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg)]"
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
									<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
								</svg>
								<span>Repository</span>
							</a>
						</div>
						<p class="content-text">
							<strong>DaMapArts</strong> is an advanced Minecraft map art generator that converts any image into a Minecraft map art. It produces pixel-perfect results using a carefully tuned palette of Minecraft block colors and sophisticated dithering algorithms.
						</p>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Credits & Acknowledgements</h4>
						<p class="content-text">
							Built with <strong>SvelteKit 5</strong>, <strong>TypeScript</strong>, and <strong>WebGL 2</strong>. Uses runes-based reactive state and a modern component architecture.
						</p>
						<p class="content-text">
							Based on the original <strong>MapartCraft</strong> project. This rework adds GPU-accelerated processing, an advanced comparison engine, bilateral filtering, edge-masked dithering, profile management, and many other improvements.
						</p>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Technology Stack</h4>
						<ul class="info-list">
							<li><strong>Frontend:</strong> SvelteKit 5 with Svelte 5 runes</li>
							<li><strong>Styling:</strong> Tailwind CSS 4</li>
							<li><strong>GPU Processing:</strong> WebGL 2 shaders for ordered dithering</li>
							<li><strong>CPU Processing:</strong> Web Worker pool (multi-threaded)</li>
							<li><strong>Export:</strong> NBT schematics & map.dat files</li>
							<li><strong>Compression:</strong> pako (zlib) for NBT/GZip</li>
						</ul>
					</div>

				{:else if activeTab === 'general'}
					<div class="content-section">
						<h3 class="content-title">General Overview</h3>
						<p class="content-text">
							DaMapArts converts any image into a Minecraft-compatible map art by mapping each pixel to the closest Minecraft block color. The full workflow is:
						</p>
						<div class="info-divider"></div>
						<div class="info-step"><span class="step-number">1</span><div><h4 class="content-subtitle">Upload Image</h4><p class="content-text">Drag & drop or click to load any image (PNG, JPG, WebP, etc.). The image info (dimensions, file size, aspect ratio) is shown in the File panel.</p></div></div>
						<div class="info-step"><span class="step-number">2</span><div><h4 class="content-subtitle">Configure Settings</h4><p class="content-text">Set the map size (width × height in maps, each map = 128×128 pixels), choose a dithering algorithm, color space, and adjust image settings (brightness, contrast, saturation, crop).</p></div></div>
						<div class="info-step"><span class="step-number">3</span><div><h4 class="content-subtitle">Select Blocks</h4><p class="content-text">Choose which Minecraft blocks to use. Pick a version and a preset (e.g., Carpets, Full Blocks), or manually select blocks per colour set.</p></div></div>
						<div class="info-step"><span class="step-number">4</span><div><h4 class="content-subtitle">Preview & Adjust</h4><p class="content-text">The preview renders automatically when settings change. Toggle between Original, Pre-processed, and Map Art views. Enable the block texture view to see actual Minecraft textures. Use zoom, pan, and grid overlays.</p></div></div>
						<div class="info-step"><span class="step-number">5</span><div><h4 class="content-subtitle">Export</h4><p class="content-text">Export as an NBT schematic (.nbt/.schem) for building tools like Litematica or WorldEdit, or as map.dat files for direct placement in a Minecraft save.</p></div></div>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Layout Overview</h4>
						<ul class="info-list">
							<li><strong>Left Sidebar:</strong> File panel, Pre-Processing, Processing settings, Image adjustments</li>
							<li><strong>Center:</strong> Map preview canvas with pan/zoom, and Block Selection grid below</li>
							<li><strong>Right Sidebar:</strong> Export options, Profiles, Materials list</li>
							<li><strong>Bottom-Left:</strong> Info button (this dialog) and Settings (accent color, scrollbar)</li>
						</ul>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Auto-Processing</h4>
						<p class="content-text">
							The preview updates <strong>automatically</strong> whenever any setting changes — no need to press a "process" button. The processing pipeline detects the optimal backend (GPU or CPU Worker) and renders the result in real time.
						</p>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Profiles</h4>
						<p class="content-text">
							Profiles let you <strong>save and restore</strong> your complete configuration — block selection, map size, dithering method, color space, image adjustments, pre-processing settings — all in a single click. Stored in your browser's <strong>localStorage</strong>.
						</p>
						<ul class="info-list">
							<li><strong>Save:</strong> Captures all current settings as a named profile.</li>
							<li><strong>Load:</strong> Restores all settings from a saved profile instantly.</li>
							<li><strong>Delete:</strong> Removes a saved profile permanently.</li>
							<li><strong>Export:</strong> Downloads all your profiles as a <strong>.json file</strong> — human-readable, editable, and portable.</li>
							<li><strong>Import:</strong> Upload a previously exported .json file to restore profiles on another browser or device.</li>
						</ul>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Import/Export & Data Formats</h4>
						<p class="content-text">
							DaMapArts uses different formats depending on the type of data being shared:
						</p>
						<ul class="info-list">
							<li><strong>Base64 (Block Preset Sharing):</strong> When you share a block preset, the selection is encoded as a Base64 string — a text-safe, compact, copy-pasteable format. It is <strong>not encryption</strong>; anyone with the code can decode it. It's simply the safest way to share data as plain text (Discord, forums, chat).</li>
							<li><strong>JSON (Profiles Export):</strong> Profiles are exported as standard <strong>.json files</strong>. Human-readable, universally supported, and editable with any text editor.</li>
							<li><strong>localStorage (Browser Persistence):</strong> All data (profiles, custom presets) is stored in your browser's localStorage. Persists between sessions but is tied to your browser. Clearing browser data erases it — always use export features to back up.</li>
						</ul>
					</div>

				{:else if activeTab === 'preprocessing'}
					<div class="content-section">
						<h3 class="content-title">Pre-Processing</h3>
						<p class="content-text">
							Pre-processing applies filters to the source image <strong>before</strong> dithering. This step helps improve the quality of the final map art by reducing noise, preserving edges, and controlling luminance perception.
						</p>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Bilateral Filter</h4>
						<p class="content-text">
							A <strong>bilateral filter</strong> smooths flat areas of the image while preserving sharp edges. Unlike a simple blur, it considers both spatial distance and color similarity, so edges remain crisp.
						</p>
						<ul class="info-list">
							<li><strong>Spatial Sigma (1–10):</strong> Controls the blur radius. Higher values = more smoothing in flat areas.</li>
							<li><strong>Color Sigma (5–100):</strong> Controls edge sensitivity. Lower values preserve more edges; higher values blur across more color boundaries.</li>
							<li><strong>Kernel Radius (1–7):</strong> The pixel radius of the filter kernel. Larger = slower but more thorough smoothing.</li>
						</ul>
						<p class="content-text info-tip">
							<strong>Tip:</strong> Enable this when your source image has noise or JPEG artifacts. Start with Spatial Sigma 3, Color Sigma 25, Kernel Radius 3.
						</p>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Edge-Masked Dithering</h4>
						<p class="content-text">
							When enabled, the system detects edges in the source image using a <strong>Sobel operator</strong>. On detected edges, the dithering is suppressed (using the nearest solid color), while flat areas receive the full dithering pattern.
						</p>
						<ul class="info-list">
							<li><strong>Edge Threshold (10–150):</strong> Controls edge detection sensitivity. Lower values = more edges detected (solid color on more pixels). Higher values = fewer edges detected.</li>
						</ul>
						<p class="content-text info-tip">
							<strong>Tip:</strong> This is particularly effective with error-diffusion dithering methods that can create messy patterns along edges. A threshold of 50–80 is a good starting point.
						</p>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Luminance Weight</h4>
						<p class="content-text">
							Adjusts how much <strong>brightness perception</strong> is prioritized when matching colors to the palette. The human eye is more sensitive to luminance differences than to chrominance differences.
						</p>
						<ul class="info-list">
							<li><strong>1.0 (Neutral):</strong> Standard color matching, equal weight to all channels.</li>
							<li><strong>1.5–2.0:</strong> Slightly prioritizes brightness accuracy. Good for most images.</li>
							<li><strong>2.5–3.0:</strong> Strongly prioritizes brightness. Useful for images with important light/dark contrasts (e.g., portraits, landscapes).</li>
						</ul>
					</div>

				{:else if activeTab === 'processing'}
					<div class="content-section">
						<h3 class="content-title">Processing Settings</h3>
						<p class="content-text">
							These are the core settings that control how your image is converted into a Minecraft map art.
						</p>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Map Size</h4>
						<p class="content-text">
							Specifies the final map art dimensions in Minecraft maps. Each map is <strong>128×128 pixels</strong>. For example, a 2×2 map art is 256×256 pixels and requires 4 maps in-game.
						</p>
						<ul class="info-list">
							<li><strong>Width (maps):</strong> Horizontal map count (1–20)</li>
							<li><strong>Height (maps):</strong> Vertical map count (1–20)</li>
							<li><strong>Swap button (⇄):</strong> Quickly swap width and height dimensions</li>
						</ul>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Dithering — Error Diffusion</h4>
						<p class="content-text">
							Scans the image pixel-by-pixel, spreading the "error" (difference between desired and chosen color) to neighboring pixels. Produces natural-looking results.
						</p>
						<ul class="info-list">
							<li><strong>Floyd-Steinberg:</strong> The classic and most popular algorithm. Good balance of quality and speed. Distributes error to 4 neighbors.</li>
							<li><strong>MinAvgErr:</strong> Minimizes average error. Smoother gradients than Floyd-Steinberg.</li>
							<li><strong>Burkes:</strong> Extended error distribution (6 neighbors). Less grainy than Floyd-Steinberg.</li>
							<li><strong>Sierra-Lite:</strong> Simplified Sierra. Lighter dithering, faster processing.</li>
							<li><strong>Sierra (Full):</strong> Distributes error over a 3-row, 5-column area. Smooth gradients, minimal banding.</li>
							<li><strong>Stucki:</strong> Wide distribution kernel (12 neighbors). Very smooth but can soften detail.</li>
							<li><strong>Jarvis-Judice-Ninke:</strong> Large kernel (12 neighbors, 3 rows). Smooth gradients, slightly slow.</li>
							<li><strong>Atkinson:</strong> Only distributes 3/4 of the error. Preserves highlights and shadows, classic "Macintosh" look.</li>
							<li><strong>Shiau-Fan:</strong> Optimized asymmetric kernel. Good edge preservation.</li>
							<li><strong>Ostromoukhov:</strong> Variable coefficients based on pixel intensity. Adapts error distribution per-pixel for optimal results.</li>
						</ul>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Dithering — Ordered</h4>
						<p class="content-text">
							Uses a fixed threshold matrix to decide dithering. Produces regular, patterned results. <strong>GPU-accelerated</strong> for instant processing.
						</p>
						<ul class="info-list">
							<li><strong>Bayer (2×2, 4×4, 8×8):</strong> Classic crosshatch patterns. Larger matrices = finer patterns.</li>
							<li><strong>Ordered (3×3):</strong> 3×3 threshold matrix. Compact pattern.</li>
							<li><strong>Cluster Dot (Halftone):</strong> Simulates halftone printing with dot clusters. Artistic effect.</li>
							<li><strong>Knoll:</strong> Optimized ordered dither for smooth gradients.</li>
							<li><strong>Blue Noise:</strong> Random-looking yet uniform distribution. No visible grid pattern. GPU-accelerated. Often the best ordered option.</li>
						</ul>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Dithering — Curve-Based</h4>
						<ul class="info-list">
							<li><strong>Riemersma (Hilbert):</strong> Traverses pixels along a Hilbert space-filling curve, spreading error along the path. Produces organic, non-directional dithering without the typical left-to-right scanning artifacts.</li>
						</ul>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Color Spaces</h4>
						<p class="content-text">
							The color space determines <strong>how color distance is calculated</strong> when matching pixels to the palette. Perceptual color spaces produce more natural-looking results.
						</p>
						<ul class="info-list">
							<li><strong>Oklab:</strong> Modern perceptually uniform color space. Best overall accuracy. <em>Recommended</em>.</li>
							<li><strong>Oklch:</strong> Oklch variant with cylindrical coordinates (lightness, chroma, hue). Good for saturated colors.</li>
							<li><strong>CIE L*a*b*:</strong> Classic perceptual color space. Well-tested, slightly less uniform than Oklab.</li>
							<li><strong>YCbCr (BT.601):</strong> Luma/chroma separation. Fast computation, good for video-like content.</li>
							<li><strong>RGB:</strong> Raw RGB Euclidean distance. Fast but perceptually inaccurate — dark blues and greens may look wrong.</li>
							<li><strong>HSL:</strong> Hue-Saturation-Lightness. Can produce vibrant results but struggles with color boundaries.</li>
						</ul>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Processing Mode</h4>
						<p class="content-text">
							Controls which processing backend is used for the dithering computation:
						</p>
						<ul class="info-list">
							<li><strong>Auto (GPU + Worker):</strong> Automatically selects the best backend. Uses <strong>WebGL 2 GPU shaders</strong> for ordered/blue-noise dithering and <strong>Web Workers</strong> for error diffusion. <em>Recommended</em>.</li>
							<li><strong>GPU (WebGL 2):</strong> Forces GPU processing. Falls back to Worker if the selected dither method is not GPU-compatible.</li>
							<li><strong>Worker (CPU off-thread):</strong> Uses a pool of Web Workers (one per CPU core − 1). Runs off the main thread so the UI stays responsive.</li>
							<li><strong>Main Thread (legacy):</strong> Processes on the main thread. Blocks the UI during processing. Only use for debugging.</li>
						</ul>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Compare All Combos</h4>
						<p class="content-text">
							Opens a comparison modal that renders your image with <strong>every combination</strong> of dithering algorithm × color space. Thumbnails are generated in parallel using the Worker pool. A <strong>perceptual fidelity score</strong> (SSIM-based) ranks results so you can quickly find the best settings. You can also sweep brightness, contrast, and saturation ranges for advanced optimization.
						</p>
					</div>

				{:else if activeTab === 'blocks'}
					<div class="content-section">
						<h3 class="content-title">Block Selection</h3>
						<p class="content-text">
							This panel controls which Minecraft blocks are available for the palette. Each block belongs to a <strong>colour set</strong> — a group of similar colors that Minecraft uses for map rendering.
						</p>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Minecraft Version</h4>
						<p class="content-text">
							Select the target Minecraft version. This determines which blocks and colour sets are available. Newer versions have more colour sets (e.g., 1.21 has deepslate, mangrove, cherry, etc.).
						</p>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Block Presets</h4>
						<p class="content-text">
							Presets are predefined block selections optimized for different use cases:
						</p>
						<ul class="info-list">
							<li><strong>Carpets:</strong> Only carpet blocks. Easy to build flat (1 block thick) map arts.</li>
							<li><strong>Full Blocks:</strong> Standard full blocks (wool, concrete, terracotta, etc.).</li>
							<li><strong>Concrete:</strong> Only concrete blocks. Vivid, solid colors.</li>
							<li><strong>Wool:</strong> Only wool blocks. Classic map art material.</li>
							<li><strong>Glass:</strong> Stained glass blocks. Transparent blocks for creative builds.</li>
							<li><strong>Cheapest:</strong> Selects the easiest-to-obtain block for each colour set (for survival mode).</li>
							<li><strong>None:</strong> Disables all blocks (clears the palette).</li>
						</ul>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Manual Block Selection</h4>
						<p class="content-text">
							Below the presets, you'll see a grid of all colour sets. Each colour set has a dropdown to choose which block to use, or disable it entirely. The colour swatch shows the map color for that set.
						</p>
						<ul class="info-list">
							<li><strong>Search:</strong> Filter blocks by name to quickly find specific blocks.</li>
							<li><strong>Select All / Deselect All:</strong> Batch enable/disable all colour sets.</li>
							<li><strong>Colour swatch:</strong> The small square shows the base color Minecraft uses for that colour set on maps.</li>
						</ul>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Custom Presets</h4>
						<p class="content-text">
							You can save your current block selection as a custom preset, give it a name, and load it later. Custom presets are stored in your browser's localStorage.
						</p>
						<ul class="info-list">
							<li><strong>Save:</strong> Saves the current block selection as a named preset.</li>
							<li><strong>Delete:</strong> Removes a custom preset (built-in presets cannot be deleted).</li>
							<li><strong>Share:</strong> Generates a <strong>Base64</strong> share code that encodes your block selection. Copy and share.</li>
							<li><strong>Import:</strong> Paste a Base64 share code to import someone else's block preset.</li>
						</ul>
						<p class="content-text info-tip">
							<strong>About Base64:</strong> The share code uses Base64 encoding — a standard text-safe format that converts your block selection into a compact, copy-pasteable string. It is <strong>not encryption</strong>. Anyone with the code can decode it. It's simply the safest way to share data as plain text (in Discord, forums, chat, etc.) without special characters breaking the message.
						</p>
					</div>

				{:else if activeTab === 'customblocks'}
					<div class="content-section">
						<h3 class="content-title">Custom Blocks</h3>
						<p class="content-text">
							At the bottom of the Block Selection panel you'll find the <strong>Add Custom Block</strong> section. This lets you add blocks that aren't in the built-in palette — useful for modded blocks, blocks from newer snapshots, or block variants with specific NBT tags (like stairs or slabs).
						</p>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Form Fields</h4>
						<ul class="info-list">
							<li><strong>Block Name:</strong> The Minecraft block ID without the <code>minecraft:</code> prefix (e.g. <code>birch_stairs</code>).</li>
							<li><strong>NBT Tags:</strong> Key-value pairs for block state data. For example <code>facing: north|east|south|west</code> and <code>half: top|bottom</code>. Use pipe <code>|</code> to separate multiple possible values. A new empty row appears as you type.</li>
							<li><strong>Colour Set:</strong> Which colour set this block should belong to. The block will appear in that colour set's row in the block selection grid, with that set's map colour.</li>
							<li><strong>Needs Support:</strong> Check this if the block requires a support block underneath (e.g. stairs, slabs, carpet).</li>
							<li><strong>Flammable:</strong> Check this if the block can catch fire (important for survival builds near lava).</li>
							<li><strong>Versions:</strong> Check which Minecraft versions this block is valid for. Different versions may use different block IDs or NBT formats.</li>
						</ul>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Adding &amp; Removing</h4>
						<p class="content-text">
							After filling in the form, click <strong>Add Custom Block</strong> to add it. The block will appear in its colour set's row with a special icon coloured to match the set. Click a custom block in the selection grid to load its details back into the form for editing.
						</p>
						<p class="content-text">
							To remove a custom block, fill in its name and select its versions, then click <strong>Delete Custom Block</strong>.
						</p>
						<p class="content-text info-tip">
							<strong>Tip:</strong> Custom blocks are saved in your browser's localStorage and persist between sessions.
						</p>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Examples</h4>
						<p class="content-text">
							Below are common block types you can add as custom blocks:
						</p>
						<div class="info-divider" style="margin: 8px 0;"></div>
						<h4 class="content-subtitle" style="font-size: 13px;">Stairs</h4>
						<div class="example-block">
							<p class="content-text"><strong>Block:</strong> <code>birch_stairs</code></p>
							<p class="content-text"><strong>NBT Tags:</strong></p>
							<ul class="info-list">
								<li><code>facing</code>: <code>north|east|south|west</code></li>
								<li><code>half</code>: <code>top|bottom</code></li>
							</ul>
							<p class="content-text"><strong>Versions:</strong> 1.12.2, 1.13.2, 1.14.4, 1.15.2, 1.16.5, 1.17.1</p>
						</div>
						<div class="info-divider" style="margin: 8px 0;"></div>
						<h4 class="content-subtitle" style="font-size: 13px;">Slabs</h4>
						<div class="example-block">
							<p class="content-text"><strong>1.12.2:</strong> <code>stone_slab</code></p>
							<ul class="info-list">
								<li><code>variant</code>: <code>cobblestone</code></li>
								<li><code>half</code>: <code>top|bottom</code></li>
							</ul>
							<p class="content-text" style="margin-top: 6px;"><strong>1.13.2+:</strong> <code>cobblestone_slab</code></p>
							<ul class="info-list">
								<li><code>type</code>: <code>top|bottom</code></li>
							</ul>
							<p class="content-text info-tip" style="margin-top: 4px;">
								Note how the block name and NBT tags changed between versions.
							</p>
						</div>
						<div class="info-divider" style="margin: 8px 0;"></div>
						<h4 class="content-subtitle" style="font-size: 13px;">'Alpha Slabs' (Petrified Oak Slab)</h4>
						<div class="example-block">
							<p class="content-text"><strong>1.12.2:</strong> <code>stone_slab</code></p>
							<ul class="info-list">
								<li><code>variant</code>: <code>wood_old</code></li>
								<li><code>half</code>: <code>top|bottom</code></li>
							</ul>
							<p class="content-text" style="margin-top: 6px;"><strong>1.13.2+:</strong> <code>petrified_oak_slab</code></p>
							<ul class="info-list">
								<li><code>type</code>: <code>top|bottom</code></li>
							</ul>
						</div>
					</div>

				{:else if activeTab === 'export'}
					<div class="content-section">
						<h3 class="content-title">Export</h3>
						<p class="content-text">
							After processing your image, export it as a Minecraft-compatible file. Two main export modes are supported.
						</p>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">NBT Schematic Mode</h4>
						<p class="content-text">
							Exports an <strong>.nbt schematic file</strong> that can be loaded in building tools:
						</p>
						<ul class="info-list">
							<li><strong>Litematica:</strong> Place the .nbt file in your Litematica schematics folder and use the hologram to build it block-by-block.</li>
							<li><strong>WorldEdit:</strong> Load with <code>//schem load</code> and paste with <code>//paste</code>.</li>
							<li><strong>Joined:</strong> Exports the entire map art as a single schematic file.</li>
							<li><strong>Split:</strong> Exports each 128×128 map section as a separate schematic file (zipped).</li>
						</ul>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Staircasing</h4>
						<p class="content-text">
							Minecraft map colors have 3 brightness tones per colour set: <strong>dark</strong>, <strong>normal</strong>, and <strong>light</strong>. The tone depends on the Y-level difference between adjacent blocks. Staircasing places blocks at different heights to achieve these tones.
						</p>
						<ul class="info-list">
							<li><strong>Flat (No Staircasing):</strong> All blocks at the same Y-level. Only uses the "normal" tone. Simplest to build but fewer colors.</li>
							<li><strong>Full Staircasing:</strong> Uses all 3 tones by varying block heights. Triples the color palette but harder to build.</li>
							<li><strong>Values Based:</strong> Optimized staircasing that minimizes height changes while maximizing color accuracy.</li>
						</ul>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Support Blocks</h4>
						<p class="content-text">
							When staircasing is enabled, some blocks need "support" underneath to maintain height differences. Choose which block to use:
						</p>
						<ul class="info-list">
							<li><strong>Netherrack</strong> (default), <strong>Cobblestone</strong>, <strong>Stone</strong>, <strong>Dirt</strong>, <strong>Oak Planks</strong></li>
						</ul>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Map.dat Mode</h4>
						<p class="content-text">
							Exports <strong>map_X.dat</strong> files that go directly into your Minecraft world's <code>data/</code> folder. This bypasses building entirely — the map items in-game will display your image directly.
						</p>
						<ul class="info-list">
							<li><strong>Split:</strong> Downloads each map section as a separate .dat file.</li>
							<li><strong>Zip:</strong> Downloads all .dat files in a single .zip archive.</li>
							<li><strong>Use map ID:</strong> Enable to name files with specific map IDs (e.g., map_1000.dat) so they replace existing maps.</li>
							<li><strong>Starting map ID:</strong> The first map ID number when using custom IDs.</li>
						</ul>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Download PNG</h4>
						<p class="content-text">
							You can also download the rendered map art as a <strong>PNG image</strong> using the download button in the File panel or Toolbar. Useful for previewing the result outside DaMapArts.
						</p>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Materials List</h4>
						<p class="content-text">
							After processing, the <strong>Materials</strong> panel (right sidebar) shows a complete breakdown of every block used in your map art. Use it as a shopping list when gathering resources in survival mode.
						</p>
						<ul class="info-list">
							<li><strong>Block Name:</strong> The Minecraft block used (e.g., White Wool, Light Blue Concrete).</li>
							<li><strong>Count:</strong> Exact number of each block required.</li>
							<li><strong>Stacks:</strong> Count converted to Minecraft stacks (64 items per stack) for easier gathering.</li>
							<li><strong>Total Blocks:</strong> Grand total across all maps.</li>
							<li><strong>Unique Colors:</strong> Number of distinct palette colors in the final result.</li>
						</ul>
						<p class="content-text">
							The list recomputes automatically whenever settings or block selections change.
						</p>
					</div>

				{:else if activeTab === 'shortcuts'}
					<div class="content-section">
						<h3 class="content-title">Keyboard Shortcuts</h3>
						<p class="content-text">
							Use these keyboard shortcuts for faster navigation and editing in the map preview.
						</p>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Map Preview</h4>
						<div class="shortcuts-table">
							<div class="shortcut-row"><span>Pan the map preview</span><kbd>Click + Drag</kbd></div>
							<div class="shortcut-row"><span>Zoom in/out on the preview</span><kbd>Scroll Wheel</kbd></div>
							<div class="shortcut-row"><span>Cycle view mode (Original → Pre-processed → Map Art)</span><kbd>V</kbd></div>
							<div class="shortcut-row"><span>Toggle grid overlay (shows 128×128 map borders)</span><kbd>G</kbd></div>
							<div class="shortcut-row"><span>Toggle block texture view</span><kbd>B</kbd></div>
						</div>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">General</h4>
						<div class="shortcuts-table">
							<div class="shortcut-row"><span>Close any open dialog or modal</span><kbd>Escape</kbd></div>
						</div>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Panels</h4>
						<div class="shortcuts-table">
							<div class="shortcut-row"><span>Expand or collapse any panel section</span><kbd>Click header ▶</kbd></div>
						</div>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">Mouse Controls</h4>
						<div class="shortcuts-table">
							<div class="shortcut-row"><span>Pan the map preview canvas</span><kbd>Left Click + Drag</kbd></div>
							<div class="shortcut-row"><span>Zoom in and out, centered on cursor</span><kbd>Scroll Wheel</kbd></div>
							<div class="shortcut-row"><span>Change block for a colour set</span><kbd>Click colour set</kbd></div>
						</div>
					</div>

				{:else if activeTab === 'faq'}
					<div class="content-section">
						<h3 class="content-title">Frequently Asked Questions</h3>

						<div class="info-divider"></div>
						<h4 class="content-subtitle">General</h4>

						<div class="faq-item">
							<strong class="faq-q">How do I get started?</strong>
							<p class="content-text">Upload an image, configure your map size and settings, select the blocks you want, and export. The preview updates automatically as you change settings.</p>
						</div>

						<div class="faq-item">
							<strong class="faq-q">Why does the output change with the same image and settings?</strong>
							<p class="content-text">JPEG decoding and scaling algorithms vary between browsers and may change with updates. To ensure consistency, right-click the <em>Map preview</em>, choose <em>Save image as...</em>, and use that saved image next time.</p>
						</div>

						<div class="faq-item">
							<strong class="faq-q">My image is stretched!</strong>
							<p class="content-text">Change your map size to match the aspect ratio, enable the crop option, or edit your image with an image editor before uploading.</p>
						</div>

						<div class="info-divider"></div>
						<h4 class="content-subtitle">Schematic (.nbt)</h4>

						<div class="faq-item">
							<strong class="faq-q">What do I do with the NBT file?</strong>
							<p class="content-text">Use it like a .schematic file. You can load it with tools like
								<a href="https://cubical.xyz/" target="_blank" rel="noopener noreferrer">cubical.xyz</a>,
								<a href="https://www.mcedit-unified.net/" target="_blank" rel="noopener noreferrer">MCEdit</a>,
								or mods like
								<a href="https://minecraft.curseforge.com/projects/litematica" target="_blank" rel="noopener noreferrer">Litematica</a> /
								<a href="https://minecraft.curseforge.com/projects/schematica" target="_blank" rel="noopener noreferrer">Schematica</a>.
								You can also import directly with a structure block (may need a redstone signal).
							</p>
						</div>

						<div class="faq-item">
							<strong class="faq-q">I need a .schematic file!</strong>
							<p class="content-text">Import the NBT into <a href="https://cubical.xyz/" target="_blank" rel="noopener noreferrer">cubical.xyz</a> or <a href="https://www.mcedit-unified.net/" target="_blank" rel="noopener noreferrer">MCEdit Unified</a> and export as .schematic. <em>If using MCEdit or Cubical, export as 1.12.2.</em> For Baritone, use Schematica with the "#schematica" command.</p>
						</div>

						<div class="faq-item">
							<strong class="faq-q">MCEdit doesn't work!</strong>
							<p class="content-text">Make sure you're using <a href="https://www.mcedit-unified.net/" target="_blank" rel="noopener noreferrer">MCEdit Unified</a> and <strong>importing the NBT as a schematic</strong>, NOT loading it as a world. Alternatively, use Cubical.</p>
						</div>

						<div class="faq-item">
							<strong class="faq-q">Why is there a row of extra blocks (noobline)?</strong>
							<p class="content-text">The shade a block shows on the map is determined by the block to the North. If the Northern block is higher → darker tone; lower → lighter tone; same → normal tone. An extra row (the "noobline") is needed at the top to shade the first row properly.</p>
						</div>

						<div class="faq-item">
							<strong class="faq-q">How do I align the schematic in-game?</strong>
							<p class="content-text">Maps in Minecraft align to a fixed 128×128 grid. Find a suitable location (e.g. above an ocean), open a map to find the bottom-left corner for alignment. North is always up — no rotation needed.</p>
						</div>

						<div class="info-divider"></div>
						<h4 class="content-subtitle">Datafile (.dat)</h4>

						<div class="faq-item">
							<strong class="faq-q">What is a map.dat file?</strong>
							<p class="content-text"><code>.dat</code> is the native format Minecraft uses to store map data. It lets you import maps into your worlds without building a physical structure, and enables a fourth extra shade of color not accessible in survival.</p>
						</div>

						<div class="faq-item">
							<strong class="faq-q">How do I use the map.dat file?</strong>
							<p class="content-text">Works in singleplayer or on a server you own. Create a new map in-game, navigate to your world's save file → <code>data</code> folder, and replace the corresponding <code>map_xxx.dat</code> files.</p>
						</div>

						<div class="info-divider"></div>
						<h4 class="content-subtitle">Settings</h4>

						<div class="faq-item">
							<strong class="faq-q">Map size?</strong>
							<p class="content-text">Defines how many maps your picture will span. For larger maps with staircasing, split into multiple 1×1 schematics to avoid hitting the world height limit. Use the "Download as 1×1 Split" export option.</p>
						</div>

						<div class="faq-item">
							<strong class="faq-q">What is 'Staircasing'?</strong>
							<p class="content-text">Staircasing makes your map 3D, giving 3× the color palette for much richer results — but it's harder to build. <strong>Classic</strong> and <strong>Valley</strong> modes produce the same map image, but Valley avoids downwards staircases (easier for survival building).</p>
						</div>

						<div class="faq-item">
							<strong class="faq-q">What is dithering?</strong>
							<p class="content-text">Dithering adds controlled grain to create smoother gradients. <strong>Floyd-Steinberg</strong> is the most accurate; <strong>Ordered/Bayer</strong> has fewer artifacts and a unique style. Disable dithering for flat-colored artwork.</p>
						</div>

						<div class="faq-item">
							<strong class="faq-q">What is "Add blocks under"?</strong>
							<p class="content-text">Lets you choose a support block placed under blocks that need one (e.g. carpets, sand, pressure plates) or under all blocks. This block is also used for the noobline, which cannot be disabled.</p>
						</div>

						<div class="info-divider"></div>
						<h4 class="content-subtitle">DaMapArts Features</h4>

						<div class="faq-item">
							<strong class="faq-q">What is the Bilateral Filter?</strong>
							<p class="content-text">A pre-processing filter that smooths flat areas while keeping edges sharp. Useful for reducing noise in photos before dithering. Adjust Spatial Sigma, Color Sigma, and Radius to control the effect.</p>
						</div>

						<div class="faq-item">
							<strong class="faq-q">What is Edge-Masked Dithering?</strong>
							<p class="content-text">A pre-processing technique that reduces dithering strength near detected edges, keeping outlines crisp while still diffusing gradients in flat areas. Adjust the threshold to control edge sensitivity.</p>
						</div>

						<div class="faq-item">
							<strong class="faq-q">How do Profiles work?</strong>
							<p class="content-text">Profiles save your complete configuration (map size, blocks, dithering, image adjustments, etc.). Use the save icon to overwrite the current profile or create a new one. Import/Export lets you move profiles between browsers or share them.</p>
						</div>

						<div class="faq-item">
							<strong class="faq-q">How do Custom Blocks work?</strong>
							<p class="content-text">Custom blocks let you add any Minecraft block to a colour set. See the <strong>Custom Blocks</strong> tab for full documentation and examples. Custom blocks are persisted in localStorage and survive page reloads.</p>
						</div>

						<div class="faq-item">
							<strong class="faq-q">Where is my data stored?</strong>
							<p class="content-text">All data (profiles, custom blocks, presets) is stored in your browser's <strong>localStorage</strong>. It persists between sessions but is tied to your browser. Clearing browser data erases it — always export/backup important configurations.</p>
						</div>

						<div class="faq-item">
							<strong class="faq-q">What processing modes are available?</strong>
							<p class="content-text">DaMapArts supports <strong>GPU (WebGL 2)</strong> for fast ordered dithering and <strong>CPU Workers</strong> (multi-threaded) for error-diffusion algorithms like Floyd-Steinberg. The system auto-selects the best backend.</p>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</dialog>

<style>
	.info-dialog {
		padding: 0;
		border: none;
		border-radius: 12px;
		background: var(--color-bg-card);
		color: var(--color-text);
		max-width: 680px;
		width: 90vw;
		max-height: 80vh;
		overflow: visible;
		margin: auto;
		position: fixed;
		inset: 0;
		height: fit-content;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
	}

	.info-dialog::backdrop {
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
	}

	.info-container {
		display: flex;
		flex-direction: column;
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		overflow: hidden;
		max-height: 80vh;
	}

	.info-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.info-body {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.info-tabs {
		display: flex;
		flex-direction: column;
		width: 170px;
		flex-shrink: 0;
		border-right: 1px solid var(--color-border);
		padding: 8px;
		gap: 2px;
		overflow-y: auto;
		background: var(--color-bg);
	}

	.info-tab {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 13px;
		font-family: inherit;
		letter-spacing: 0.01em;
		cursor: pointer;
		transition: all 0.15s;
		text-align: left;
		white-space: nowrap;
	}

	.info-tab:hover {
		background: var(--color-surface);
		color: var(--color-text);
	}

	.info-tab.active {
		background: var(--color-primary);
		color: white;
	}

	.tab-icon {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}

	.tab-label {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.info-content {
		flex: 1;
		padding: 20px 24px;
		overflow-y: auto;
		min-height: 360px;
		background: var(--color-bg-card);
	}

	.content-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.tech-logo {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		margin-bottom: 16px;
	}

	.tech-logo-img {
		width: 160px;
		height: 160px;
		object-fit: contain;
	}

	.tech-logo-title {
		font-size: 20px;
		font-weight: 700;
		color: var(--color-text);
		letter-spacing: -0.02em;
	}

	.content-title {
		font-size: 16px;
		font-weight: 600;
		color: var(--color-text);
		margin: 0;
		letter-spacing: -0.01em;
	}

	.content-text {
		font-size: 13px;
		line-height: 1.7;
		margin: 0;
		color: var(--color-text-muted);
	}

	/* About tab: kaori-tree image flush right */
	.about-section {
		position: relative;
		padding: 0 !important;
		gap: 0 !important;
		margin: -20px -24px;
		width: calc(100% + 48px);
		height: calc(100% + 40px);
		min-height: calc(360px + 40px);
		overflow: hidden;
	}

	.about-img {
		position: absolute;
		top: 0;
		right: 0;
		height: 100%;
		width: auto;
		opacity: 0.85;
	}

	.about-info {
		position: absolute;
		left: 24px;
		bottom: 32px;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.about-author {
		font-size: 16px;
		color: var(--color-text-muted);
		margin: 0;
		letter-spacing: 0.02em;
	}

	.about-author strong {
		color: var(--color-text);
		font-weight: 700;
	}

	.about-quote {
		font-size: 13px;
		color: var(--color-muted);
		font-style: italic;
		margin: 0 0 12px 0;
	}

	.about-buttons {
		display: flex;
		gap: 10px;
	}

	.about-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.about-btn-github {
		background: var(--color-surface);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.about-btn-github:hover {
		background: var(--color-bg-hover);
		border-color: var(--color-text-muted);
	}

	.about-btn-coffee {
		background: var(--color-surface);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.about-btn-coffee:hover {
		background: var(--color-bg-hover);
		border-color: var(--color-text-muted);
	}

	.about-donate-msg {
		font-size: 11px;
		font-style: italic;
		opacity: 0.55;
		margin: 4px 0 0 0;
	}

	.content-subtitle {
		font-size: 14px;
		font-weight: 600;
		color: var(--color-text);
		margin: 0;
		letter-spacing: -0.01em;
	}

	.info-divider {
		border-top: 1px solid var(--color-border);
		margin: 8px 0;
	}

	.info-list {
		margin: 4px 0 0 0;
		padding-left: 18px;
		font-size: 13px;
		line-height: 1.75;
		color: var(--color-text-muted);
		list-style: disc;
	}

	.info-list li {
		margin-bottom: 2px;
	}

	.info-list li strong {
		color: var(--color-text);
	}

	.info-list li em {
		color: var(--color-primary);
		font-style: normal;
		font-weight: 500;
	}

	.info-list code {
		font-size: 12px;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 1px 5px;
		font-family: 'Consolas', 'Monaco', monospace;
	}

	.info-tip {
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
		border-left: 3px solid var(--color-primary);
		border-radius: 0 6px 6px 0;
		padding: 8px 12px;
		font-size: 12px;
	}

	.info-step {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		margin: 10px 0;
	}

	.info-step .content-subtitle {
		margin-bottom: 2px;
	}

	.info-step .content-text {
		margin-top: 0;
	}

	.step-number {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--color-primary);
		color: white;
		font-size: 13px;
		font-weight: 700;
		line-height: 1;
		margin-top: 1px;
	}

	.shortcuts-table {
		margin-top: 8px;
	}

	.shortcut-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 0;
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
		font-size: 13px;
		color: var(--color-text-muted);
	}

	.shortcut-row:last-child {
		border-bottom: none;
	}

	.shortcut-row kbd {
		display: inline-block;
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 2px 8px;
		font-size: 11px;
		font-family: 'Consolas', 'Monaco', monospace;
		font-weight: 600;
		color: var(--color-text);
		box-shadow: 0 1px 0 var(--color-border);
		min-width: fit-content;
		white-space: nowrap;
	}

	.shortcut-row span {
		text-align: right;
	}

	.example-block {
		background: color-mix(in srgb, var(--color-surface) 60%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
		border-radius: 6px;
		padding: 8px 12px;
		margin: 6px 0;
	}

	.example-block .content-text {
		margin: 2px 0;
	}

	.example-block .info-list {
		margin: 2px 0 2px 16px;
	}

	.faq-item {
		margin-bottom: 12px;
	}

	.faq-q {
		display: block;
		color: var(--color-text);
		margin-bottom: 2px;
		font-size: 0.85rem;
	}

	.faq-item .content-text {
		margin-top: 2px;
	}

	.faq-item a {
		color: var(--color-primary);
		text-decoration: underline;
	}

	.faq-item a:hover {
		opacity: 0.8;
	}

	.faq-item code {
		background: color-mix(in srgb, var(--color-surface) 80%, transparent);
		padding: 1px 4px;
		border-radius: 3px;
		font-size: 0.8rem;
	}
</style>
