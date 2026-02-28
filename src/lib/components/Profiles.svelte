<script lang="ts">
	import { onMount } from 'svelte';
	import { getAppState, type AppState } from '$lib/stores/index.js';
	import { infoModal } from '$lib/stores/infoModal.svelte.js';
	import { modal } from '$lib/stores/modal.svelte.js';
	import { locale } from '$lib/stores/locale.svelte.js';

	const app = getAppState();
	const t = locale.t;
	const PROFILES_KEY = 'mapartcraft_profiles';

	// Fields to save in a profile
	const PROFILE_FIELDS: (keyof AppState)[] = [
		'selectedVersion', 'selectedBlocks',
		'mapSizeX', 'mapSizeZ', 'modeId', 'staircasingId',
		'ditherMethodId', 'colorSpace',
		'cropMode', 'cropZoom', 'cropOffsetX', 'cropOffsetY',
		'brightness', 'contrast', 'saturation',
		'transparencyEnabled', 'transparencyTolerance',
		'whereSupportBlocks', 'backgroundMode', 'backgroundColour', 'supportBlock',
		'processingMode',
		'bilateralEnabled', 'bilateralSigmaSpace', 'bilateralSigmaColor', 'bilateralRadius',
		'edgeMaskEnabled', 'edgeMaskThreshold', 'luminanceWeight',
	];

	interface Profile {
		name: string;
		data: Record<string, any>;
		createdAt: number;
	}

	let expanded = $state(true);
	let profiles = $state<Profile[]>([]);
	let selectedProfileName = $state('');

	const DEFAULT_PROFILE_NAME = 'Default';

	function ensureDefaultProfile() {
		if (profiles.length === 0) {
			const defaultProfile: Profile = {
				name: DEFAULT_PROFILE_NAME,
				data: captureProfile(),
				createdAt: Date.now(),
			};
			profiles = [defaultProfile];
			selectedProfileName = DEFAULT_PROFILE_NAME;
			persistProfiles();
		}
	}

	function loadProfiles() {
		try {
			const raw = localStorage.getItem(PROFILES_KEY);
			if (raw) {
				profiles = JSON.parse(raw);
				if (profiles.length > 0) selectedProfileName = profiles[0].name;
			}
		} catch {}
		ensureDefaultProfile();
	}

	function persistProfiles() {
		localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
	}

	function captureProfile(): Record<string, any> {
		const data: Record<string, any> = {};
		for (const key of PROFILE_FIELDS) {
			const val = app[key];
			data[key] = typeof val === 'object' && val !== null ? JSON.parse(JSON.stringify(val)) : val;
		}
		return data;
	}

	function applyProfile(data: Record<string, any>) {
		for (const key of PROFILE_FIELDS) {
			if (key in data) {
				(app as any)[key] = typeof data[key] === 'object' && data[key] !== null
					? JSON.parse(JSON.stringify(data[key]))
					: data[key];
			}
		}
	}

	async function handleSaveClick() {
		const saveToCurrent = await modal.showConfirm(
			t('profiles.saveConfirm', { name: selectedProfileName }),
			t('profiles.saveTitle'),
			t('profiles.currentProfile'),
			t('profiles.newProfile')
		);
		if (saveToCurrent) {
			const idx = profiles.findIndex(p => p.name === selectedProfileName);
			if (idx >= 0) {
				profiles[idx] = { name: selectedProfileName, data: captureProfile(), createdAt: Date.now() };
				profiles = [...profiles];
				persistProfiles();
			}
		} else {
			const newName = await modal.showPrompt(t('profiles.saveAsNewPrompt'), '', t('profiles.saveAsNew'));
			if (newName && newName.trim()) {
				const name = newName.trim();
				const existing = profiles.findIndex(p => p.name === name);
				const profile: Profile = { name, data: captureProfile(), createdAt: Date.now() };
				if (existing >= 0) {
					profiles[existing] = profile;
				} else {
					profiles.push(profile);
				}
				profiles = [...profiles];
				persistProfiles();
				selectedProfileName = name;
			}
		}
	}

	async function loadSelectedProfile() {
		const confirmed = await modal.showConfirm(
			t('profiles.loadConfirm', { name: selectedProfileName }),
			t('profiles.loadTitle'),
			t('profiles.loadBtn'),
			t('profiles.cancelBtn')
		);
		if (!confirmed) return;
		const p = profiles.find(p => p.name === selectedProfileName);
		if (p) applyProfile(p.data);
	}

	async function deleteSelectedProfile() {
		const confirmed = await modal.showConfirm(
			t('profiles.deleteConfirm', { name: selectedProfileName }),
			t('profiles.deleteTitle'),
			t('profiles.deleteBtn'),
			t('profiles.cancelBtn')
		);
		if (!confirmed) return;
		profiles = profiles.filter(p => p.name !== selectedProfileName);
		ensureDefaultProfile();
		persistProfiles();
		selectedProfileName = profiles.length > 0 ? profiles[0].name : '';
	}

	function exportProfiles() {
		const blob = new Blob([JSON.stringify(profiles, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'damaparts_profiles.json';
		a.click();
		URL.revokeObjectURL(url);
	}

	function importProfiles() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = () => {
			const file = input.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = () => {
				try {
					const imported: Profile[] = JSON.parse(reader.result as string);
					if (Array.isArray(imported)) {
						for (const imp of imported) {
							if (!imp.name || !imp.data) continue;
							const idx = profiles.findIndex(p => p.name === imp.name);
							if (idx >= 0) profiles[idx] = imp;
							else profiles.push(imp);
						}
						profiles = [...profiles];
						persistProfiles();
						if (profiles.length > 0 && !selectedProfileName) {
							selectedProfileName = profiles[0].name;
						}
					}
				} catch {}
			};
			reader.readAsText(file);
		};
		input.click();
	}

	onMount(loadProfiles);
</script>

<div class="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
	<div class="flex w-full items-center gap-2">
		<h3 class="flex-1 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">{t('profiles.title')}</h3>
		<button
			class="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-[var(--color-muted)] opacity-50 transition-all hover:opacity-100 hover:text-[var(--color-primary)] hover:bg-[color-mix(in_srgb,var(--color-primary)_12%,transparent)]"
			onclick={(e) => { e.stopPropagation(); infoModal.openTab('general'); }}
			title={t('profiles.help')}
		>?</button>
		<button
			class="flex items-center justify-center"
			onclick={() => (expanded = !expanded)}
		>
			<span class="text-xs text-[var(--color-muted)] transition-transform" class:rotate-90={expanded}>▶</span>
		</button>
	</div>

	{#if expanded}
		<div class="mt-3 space-y-2">
			<!-- Profile selector -->
			<div class="flex items-center gap-1.5">
				<select
					class="flex-1 rounded border border-[var(--color-border)] bg-[var(--color-bg-input)] px-2 py-1.5 text-xs text-[var(--color-text)]"
					bind:value={selectedProfileName}
				>
					{#each profiles as p}
						<option value={p.name}>{p.name}</option>
					{/each}
				</select>

				<!-- Load -->
				<button
					class="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded bg-[var(--color-primary)] text-white transition-colors hover:bg-[var(--color-primary-hover)]"
					onclick={loadSelectedProfile}
					title={t('profiles.load')}
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
					</svg>
				</button>

				<!-- Delete -->
				<button
					class="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded bg-[var(--color-danger)] text-white transition-colors hover:opacity-80"
					onclick={deleteSelectedProfile}
					title={t('profiles.delete')}
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
					</svg>
				</button>

				<!-- Save -->
				<button
					class="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded bg-[var(--color-primary)] text-white transition-colors hover:bg-[var(--color-primary-hover)]"
					onclick={handleSaveClick}
					title={t('profiles.save')}
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" />
					</svg>
				</button>
			</div>

			<!-- Import / Export -->
			<div class="flex gap-1.5">
				<button
						class="flex-1 rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-xs text-[var(--color-text)] transition-colors hover:border-[var(--color-text-muted)]"
						onclick={importProfiles}
					>{t('profiles.import')}</button>
					<button
						class="flex-1 rounded border border-[var(--color-border)] bg-transparent px-2 py-1.5 text-xs text-[var(--color-text)] transition-colors hover:border-[var(--color-text-muted)]"
					onclick={exportProfiles}
					disabled={profiles.length === 0}
				>{t('profiles.export')}</button>
			</div>
		</div>
	{/if}
</div>
