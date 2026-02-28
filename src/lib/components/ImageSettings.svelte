<script lang="ts">
	import { getAppState } from '$lib/stores/index.js';
	import { infoModal } from '$lib/stores/infoModal.svelte.js';
	import { locale } from '$lib/stores/locale.svelte.js';

	const app = getAppState();
	const t = locale.t;

	let expanded = $state(true);
</script>

<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<div class="flex w-full items-center gap-2">
		<h3 class="flex-1 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
			{t('image.title')}
		</h3>
		<button
			class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-[var(--color-muted)] opacity-50 transition-all hover:opacity-100 hover:text-[var(--color-primary)] hover:bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
			onclick={(e) => { e.stopPropagation(); infoModal.openTab('general'); }}
			title={t('image.help')}
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
		<!-- Crop Mode -->
		<label class="block">
			<span class="mb-1 block text-xs text-[var(--color-muted)]">{t('image.crop')}</span>
			<select
				class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
				bind:value={app.cropMode}
			>
				<option value="off">{t('image.stretch')}</option>
				<option value="center">{t('image.centerCrop')}</option>
				<option value="manual">{t('image.manual')}</option>
			</select>
		</label>

		{#if app.cropMode === 'manual'}
			<div class="space-y-2">
				<label class="block">
					<span class="mb-1 block text-xs text-[var(--color-muted)]">
						{t('image.zoom')} {app.cropZoom.toFixed(1)}×
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
						{t('image.offsetX')} {app.cropOffsetX}%
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
						{t('image.offsetY')} {app.cropOffsetY}%
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
		<div class="space-y-2">
			<span class="block text-xs font-medium text-[var(--color-muted)]">{t('image.adjustments')}</span>
			<label class="block">
				<span class="mb-1 block text-xs text-[var(--color-muted)]">
					{t('image.brightness')} {app.brightness}%
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
					{t('image.contrast')} {app.contrast}%
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
					{t('image.saturation')} {app.saturation}%
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

		<!-- Transparency -->
		<div class="space-y-2">
			<label class="flex items-center gap-2">
				<input type="checkbox" bind:checked={app.transparencyEnabled} />
				<span class="text-xs text-[var(--color-muted)]">{t('image.transparency')}</span>
			</label>
			{#if app.transparencyEnabled}
				<label class="block">
					<span class="mb-1 block text-xs text-[var(--color-muted)]">
						{t('image.tolerance')} {app.transparencyTolerance}
					</span>
					<input
						type="range"
						min="1"
						max="255"
						class="w-full"
						bind:value={app.transparencyTolerance}
					/>
				</label>
				<label class="block">
					<span class="mb-1 block text-xs text-[var(--color-muted)]">{t('image.mode')}</span>
					<select
						class="w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
						bind:value={app.backgroundMode}
					>
						<option value={0}>Clear (no blocks)</option>
						<option value={1}>Fill (dithered)</option>
						<option value={2}>Fill (smooth)</option>
					</select>
				</label>
				{#if app.backgroundMode !== 0}
					<label class="flex items-center gap-2 text-xs">
						<span class="text-[var(--color-muted)]">{t('image.fillColour')}</span>
						<input
							type="color"
							bind:value={app.backgroundColour}
							class="h-6 w-8 cursor-pointer rounded border border-[var(--color-border)]"
						/>
						<span class="font-mono text-[10px] text-[var(--color-muted)]">{app.backgroundColour}</span>
					</label>
				{/if}
			{/if}
		</div>
	</div>
	{/if}
</div>
