<script lang="ts">
	import { getAppState } from '$lib/stores/index.js';

	const app = getAppState();

	// Get available versions
	const versions = Object.entries(app.supportedVersions).map(([key, val]: [string, any]) => ({
		key,
		MCVersion: val.MCVersion,
		label: val.MCVersion,
	}));

	// Get available map modes
	const modes = Object.entries(app.mapModes).map(([key, val]: [string, any]) => ({
		key,
		uniqueId: val.uniqueId,
		label: key,
	}));

	// Get staircasing modes for current mode
	let staircaseModes = $derived.by(() => {
		const currentMode = Object.values(app.mapModes as any).find(
			(m: any) => m.uniqueId === app.modeId
		) as any;
		if (!currentMode) return [];
		return Object.entries(currentMode.staircaseModes).map(([key, val]: [string, any]) => ({
			key,
			uniqueId: val.uniqueId,
			label: key,
			toneKeys: val.toneKeys,
		}));
	});

	// Get available dither methods
	const dithers = Object.entries(app.ditherMethods).map(([key, val]: [string, any]) => ({
		key,
		uniqueId: val.uniqueId,
		name: val.name,
		id: key.toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(),
	}));

	// Map uniqueId to string id for the dither dropdown
	const ditherIdMap: Record<string, string> = {};
	for (const d of dithers) {
		ditherIdMap[d.key] = d.id;
	}

	// Additional dither methods not in original JSON
	const extraDithers = [
		{ id: 'ostromoukhov', name: 'Ostromoukhov' },
		{ id: 'blue-noise', name: 'Blue Noise' },
		{ id: 'riemersma', name: 'Riemersma (Hilbert)' },
	];

	function handleVersionChange(e: Event) {
		const select = e.target as HTMLSelectElement;
		app.selectedVersion = select.value;
	}
</script>

<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
		Map Settings
	</h3>

	<div class="space-y-3">
		<!-- MC Version -->
		<label class="block">
			<span class="mb-1 block text-xs text-[var(--color-muted)]">Minecraft Version</span>
			<select
				class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
				value={app.selectedVersion}
				onchange={handleVersionChange}
			>
				{#each versions as ver}
					<option value={ver.MCVersion}>{ver.label}</option>
				{/each}
			</select>
		</label>

		<!-- Map Size -->
		<div class="grid grid-cols-2 gap-2">
			<label class="block">
				<span class="mb-1 block text-xs text-[var(--color-muted)]">Width (maps)</span>
				<input
					type="number"
					min="1"
					max="20"
					class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
					bind:value={app.mapSizeX}
				/>
			</label>
			<label class="block">
				<span class="mb-1 block text-xs text-[var(--color-muted)]">Height (maps)</span>
				<input
					type="number"
					min="1"
					max="20"
					class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
					bind:value={app.mapSizeZ}
				/>
			</label>
		</div>

		<p class="text-xs text-[var(--color-muted)]">
			{app.mapSizeX * 128} × {app.mapSizeZ * 128} pixels
		</p>

		<!-- Mode -->
		<label class="block">
			<span class="mb-1 block text-xs text-[var(--color-muted)]">Mode</span>
			<select
				class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
				bind:value={app.modeId}
			>
				{#each modes as mode}
					<option value={mode.uniqueId}>{mode.label}</option>
				{/each}
			</select>
		</label>

		<!-- Staircasing -->
		{#if staircaseModes.length > 0}
			<label class="block">
				<span class="mb-1 block text-xs text-[var(--color-muted)]">Staircasing</span>
				<select
					class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
					bind:value={app.staircasingId}
				>
					{#each staircaseModes as stair}
						<option value={stair.uniqueId}>{stair.label}</option>
					{/each}
				</select>
			</label>
		{/if}

		<!-- Dithering -->
		<label class="block">
			<span class="mb-1 block text-xs text-[var(--color-muted)]">Dithering</span>
			<select
				class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
				bind:value={app.ditherMethodId}
			>
				<option value="none">None</option>
				<optgroup label="Error Diffusion">
					<option value="floyd-steinberg">Floyd-Steinberg</option>
					<option value="min-avg-err">MinAvgErr</option>
					<option value="burkes">Burkes</option>
					<option value="sierra-lite">Sierra-Lite</option>
					<option value="stucki">Stucki</option>
					<option value="atkinson">Atkinson</option>
					<option value="ostromoukhov">Ostromoukhov</option>
				</optgroup>
				<optgroup label="Ordered">
					<option value="bayer-4x4">Bayer (4×4)</option>
					<option value="bayer-2x2">Bayer (2×2)</option>
					<option value="ordered-3x3">Ordered (3×3)</option>
					<option value="blue-noise">Blue Noise</option>
				</optgroup>
				<optgroup label="Curve">
					<option value="riemersma">Riemersma (Hilbert)</option>
				</optgroup>
			</select>
		</label>

		<!-- Color Space -->
		<label class="block">
			<span class="mb-1 block text-xs text-[var(--color-muted)]">Color Space</span>
			<select
				class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
				bind:value={app.colorSpace}
			>
				<option value="rgb">RGB</option>
				<option value="lab">CIE L*a*b*</option>
				<option value="oklab">Oklab</option>
			</select>
		</label>

		<!-- Crop Mode -->
		<label class="block">
			<span class="mb-1 block text-xs text-[var(--color-muted)]">Crop</span>
			<select
				class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
				bind:value={app.cropMode}
			>
				<option value="off">Stretch</option>
				<option value="center">Center Crop</option>
				<option value="manual">Manual</option>
			</select>
		</label>

		{#if app.cropMode === 'manual'}
			<div class="space-y-2">
				<label class="block">
					<span class="mb-1 block text-xs text-[var(--color-muted)]">
						Zoom: {app.cropZoom.toFixed(1)}×
					</span>
					<input
						type="range"
						min="1"
						max="5"
						step="0.1"
						class="w-full"
						bind:value={app.cropZoom}
					/>
				</label>
				<label class="block">
					<span class="mb-1 block text-xs text-[var(--color-muted)]">
						Offset X: {app.cropOffsetX}%
					</span>
					<input
						type="range"
						min="0"
						max="100"
						class="w-full"
						bind:value={app.cropOffsetX}
					/>
				</label>
				<label class="block">
					<span class="mb-1 block text-xs text-[var(--color-muted)]">
						Offset Y: {app.cropOffsetY}%
					</span>
					<input
						type="range"
						min="0"
						max="100"
						class="w-full"
						bind:value={app.cropOffsetY}
					/>
				</label>
			</div>
		{/if}

		<!-- Pre-processing -->
		<details>
			<summary class="cursor-pointer text-xs font-medium text-[var(--color-muted)]">
				Pre-processing
			</summary>
			<div class="mt-2 space-y-2">
				<label class="block">
					<span class="mb-1 block text-xs text-[var(--color-muted)]">
						Brightness: {app.brightness}%
					</span>
					<input
						type="range"
						min="50"
						max="150"
						class="w-full"
						bind:value={app.brightness}
					/>
				</label>
				<label class="block">
					<span class="mb-1 block text-xs text-[var(--color-muted)]">
						Contrast: {app.contrast}%
					</span>
					<input
						type="range"
						min="50"
						max="150"
						class="w-full"
						bind:value={app.contrast}
					/>
				</label>
				<label class="block">
					<span class="mb-1 block text-xs text-[var(--color-muted)]">
						Saturation: {app.saturation}%
					</span>
					<input
						type="range"
						min="0"
						max="200"
						class="w-full"
						bind:value={app.saturation}
					/>
				</label>
			</div>
		</details>

		<!-- Transparency (map.dat) -->
		<details>
			<summary class="cursor-pointer text-xs font-medium text-[var(--color-muted)]">
				Transparency
			</summary>
			<div class="mt-2 space-y-2">
				<label class="flex items-center gap-2">
					<input type="checkbox" bind:checked={app.transparencyEnabled} />
					<span class="text-sm">Enable transparency</span>
				</label>
				{#if app.transparencyEnabled}
					<label class="block">
						<span class="mb-1 block text-xs text-[var(--color-muted)]">
							Tolerance: {app.transparencyTolerance}
						</span>
						<input
							type="range"
							min="1"
							max="255"
							class="w-full"
							bind:value={app.transparencyTolerance}
						/>
					</label>
				{/if}
			</div>
		</details>
	</div>
</div>
