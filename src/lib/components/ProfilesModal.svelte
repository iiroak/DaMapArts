<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { getAppState, type AppState } from '$lib/stores/index.js';
	import { profilesModal } from '$lib/stores/profilesModal.svelte.js';
	import { modal } from '$lib/stores/modal.svelte.js';
	import { locale } from '$lib/stores/locale.svelte.js';
	import mapModes from '$lib/data/mapModes.json';
	import ditherMethods from '$lib/data/ditherMethods.json';
	import supportedVersionsData from '$lib/data/supportedVersions.json';
	import cropModes from '$lib/data/cropModes.json';
	import whereSupportBlocksModes from '$lib/data/whereSupportBlocksModes.json';
	import backgroundColourModes from '$lib/data/backgroundColourModes.json';
	import coloursJSONBase from '$lib/data/coloursJSON.json';
	import type { ColoursJSON, BlockEntry, BlockVersionData } from '$lib/types/colours.js';

	const app = getAppState();
	const t = locale.t;
	const PROFILES_KEY = 'mapartcraft_profiles';
	const CUSTOM_BLOCKS_KEY = 'mapartcraft_customBlocks';
	const BLOCK_PROFILES_KEY = 'mapartcraft_blockProfiles';

	type CustomBlock = [string, BlockEntry];

	interface BlockProfile {
		name: string;
		blocks: CustomBlock[];
		enabled: boolean;
		createdAt: number;
	}

	// Fields to save in a profile
	const PROFILE_FIELDS: (keyof AppState)[] = [
		'selectedVersion', 'selectedBlocks',
		'mapSizeX', 'mapSizeZ', 'modeId', 'staircasingId',
		'ditherMethodId', 'ditherPropagationRed', 'ditherPropagationGreen', 'ditherPropagationBlue', 'colorSpace',
		'cropMode', 'cropZoom', 'cropOffsetX', 'cropOffsetY',
		'brightness', 'contrast', 'saturation',
		'transparencyEnabled', 'transparencyTolerance',
		'whereSupportBlocks', 'backgroundMode', 'backgroundColour', 'supportBlock',
		'processingMode',
		'bilateralEnabled', 'bilateralSigmaSpace', 'bilateralSigmaColor', 'bilateralRadius',
		'edgeMaskEnabled', 'edgeMaskThreshold', 'luminanceWeight',
	];

	// Section → field keys mapping
	const SECTION_FIELDS: Record<string, (keyof AppState)[]> = {
		map: ['selectedVersion', 'mapSizeX', 'mapSizeZ', 'modeId', 'staircasingId'],
		processing: ['ditherMethodId', 'ditherPropagationRed', 'ditherPropagationGreen', 'ditherPropagationBlue', 'colorSpace', 'processingMode'],
		image: ['brightness', 'contrast', 'saturation', 'cropMode', 'cropZoom', 'cropOffsetX', 'cropOffsetY'],
		blocks: ['selectedBlocks', 'transparencyEnabled', 'transparencyTolerance', 'whereSupportBlocks', 'backgroundMode', 'backgroundColour', 'supportBlock'],
		filters: ['bilateralEnabled', 'bilateralSigmaSpace', 'bilateralSigmaColor', 'bilateralRadius', 'edgeMaskEnabled', 'edgeMaskThreshold', 'luminanceWeight'],
	};

	// ── Field UI config ──
	interface FieldUIConfig {
		label: string;
		type: 'select' | 'number' | 'range' | 'boolean' | 'color' | 'readonly' | 'text';
		options?: { value: any; label: string }[];
		min?: number;
		max?: number;
		step?: number;
		suffix?: string;
	}

	// Build option lists from JSON data
	// Version: app stores MCVersion string (e.g. "1.21.5"), not JSON key
	const versionOptions = Object.entries(supportedVersionsData as Record<string, { MCVersion: string }>)
		.map(([, v]) => ({ value: v.MCVersion, label: v.MCVersion }));

	// Mode: app stores uniqueId (number)
	const modeOptions = Object.entries(mapModes as Record<string, { uniqueId: number; name: string }>)
		.map(([, m]) => ({ value: m.uniqueId, label: m.name }));

	// Staircasing: app stores uniqueId (number). Include mode name to avoid duplicate labels.
	function fmtStairKey(key: string): string {
		return key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
	}
	const staircaseOptions: { value: number; label: string }[] = [];
	for (const [modeKey, mode] of Object.entries(mapModes as Record<string, any>)) {
		const modeShort = mode.name as string;
		for (const [key, stair] of Object.entries(mode.staircaseModes as Record<string, any>)) {
			staircaseOptions.push({ value: stair.uniqueId, label: `${fmtStairKey(key)} (${modeShort})` });
		}
	}

	// Dither: app stores kebab-case IDs matching <option value="…"> in ProcessingSettings
	const ditherOptions = [
		{ value: 'none', label: 'None' },
		{ value: 'memo-none', label: 'Memo: Limited Staircase (No Dither)' },
		{ value: 'memo-pattern-bayer4', label: 'Memo: Pattern (Bayer 4×4)' },
		{ value: 'memo-diffuse-fs', label: 'Memo: Diffusion (Floyd-Steinberg)' },
		{ value: 'floyd-steinberg', label: 'Floyd-Steinberg' },
		{ value: 'floyd-steinberg-20', label: 'Floyd-Steinberg (/20)' },
		{ value: 'floyd-steinberg-24', label: 'Floyd-Steinberg (/24)' },
		{ value: 'min-avg-err', label: 'MinAvgErr' },
		{ value: 'burkes', label: 'Burkes' },
		{ value: 'sierra-lite', label: 'Sierra-Lite' },
		{ value: 'sierra-3', label: 'Sierra (Full)' },
		{ value: 'sierra-2row', label: 'Sierra (Two-row)' },
		{ value: 'stucki', label: 'Stucki' },
		{ value: 'jarvis-judice-ninke', label: 'Jarvis-Judice-Ninke' },
		{ value: 'atkinson', label: 'Atkinson' },
		{ value: 'atkinson-6', label: 'Atkinson (/6)' },
		{ value: 'atkinson-10', label: 'Atkinson (/10)' },
		{ value: 'atkinson-12', label: 'Atkinson (/12)' },
		{ value: 'fan', label: 'Fan' },
		{ value: 'shiau-fan', label: 'Shiau-Fan' },
		{ value: 'shiau-fan-2', label: 'Shiau-Fan 2' },
		{ value: 'ostromoukhov', label: 'Ostromoukhov' },
		{ value: 'bayer-2x2', label: 'Bayer (2×2)' },
		{ value: 'bayer-3x3', label: 'Bayer (3×3)' },
		{ value: 'bayer-4x4', label: 'Bayer (4×4)' },
		{ value: 'bayer-8x8', label: 'Bayer (8×8)' },
		{ value: 'ordered-3x3', label: 'Ordered (3×3)' },
		{ value: 'cluster-dot', label: 'Cluster Dot (Halftone)' },
		{ value: 'halftone-8x8', label: 'Halftone (8×8)' },
		{ value: 'void-cluster-14x14', label: 'Void-and-cluster (14×14)' },
		{ value: 'knoll', label: 'Knoll' },
		{ value: 'blue-noise', label: 'Blue Noise' },
		{ value: 'riemersma', label: 'Riemersma (Hilbert)' },
	];

	const colorSpaceOptions: { value: string; label: string }[] = [
		{ value: 'mapartcraft-default', label: 'MapartCraft Default' },
		{ value: 'euclidian', label: 'Euclidian' },
		{ value: 'cie76-lab65', label: 'CIE76 (Lab D65)' },
		{ value: 'cie76-lab50', label: 'CIE76 (Lab D50)' },
		{ value: 'ciede2000-lab65', label: 'CIEDE2000 (Lab D65)' },
		{ value: 'ciede2000-lab50', label: 'CIEDE2000 (Lab D50)' },
		{ value: 'hct', label: 'HCT' },
		{ value: 'rgb', label: 'RGB' },
		{ value: 'lab', label: 'Lab' },
		{ value: 'oklab', label: 'OkLab' },
		{ value: 'oklch', label: 'OkLCH' },
		{ value: 'ycbcr', label: 'YCbCr' },
		{ value: 'hsl', label: 'HSL' },
	];
	const processingModeOptions = [
		{ value: 'auto', label: 'Auto' },
		{ value: 'gpu', label: 'GPU (WebGPU)' },
		{ value: 'worker', label: 'Worker' },
		{ value: 'main', label: 'Main Thread' },
	];

	// Crop mode: app stores lowercase string ('off', 'center', 'manual')
	const cropModeOptions = Object.entries(cropModes as Record<string, any>)
		.map(([key]) => ({ value: key.toLowerCase(), label: key.charAt(0) + key.slice(1).toLowerCase() }));

	// Background mode: app stores uniqueId (number)
	const bgModeOptions = Object.entries(backgroundColourModes as Record<string, any>)
		.map(([key, val]) => ({ value: (val as any).uniqueId as number, label: key.charAt(0) + key.slice(1).toLowerCase() }));

	// Where support blocks: app stores uniqueId (number)
	const supportBlocksOptions = Object.entries(whereSupportBlocksModes as Record<string, any>)
		.map(([key, val]) => ({ value: (val as any).uniqueId as number, label: fmtStairKey(key) }));

	// Support block material choices (matches MapPanel.svelte)
	const supportBlockOptions = [
		{ value: 'netherrack', label: 'Netherrack' },
		{ value: 'cobblestone', label: 'Cobblestone' },
		{ value: 'stone', label: 'Stone' },
		{ value: 'dirt', label: 'Dirt' },
		{ value: 'oak_planks', label: 'Oak Planks' },
		{ value: 'sand', label: 'Sand' },
		{ value: 'glass', label: 'Glass' },
		{ value: 'smooth_stone', label: 'Smooth Stone' },
	];

	const FIELD_UI: Record<string, FieldUIConfig> = {
		// ── Map ──
		selectedVersion: { label: 'Version', type: 'select', options: versionOptions },
		mapSizeX: { label: 'Map Width', type: 'number', min: 1, max: 20, step: 1 },
		mapSizeZ: { label: 'Map Height', type: 'number', min: 1, max: 20, step: 1 },
		modeId: { label: 'Mode', type: 'select', options: modeOptions },
		staircasingId: { label: 'Staircasing', type: 'select', options: staircaseOptions },
		// ── Processing ──
		ditherMethodId: { label: 'Dither Method', type: 'select', options: ditherOptions },
		ditherPropagationRed: { label: 'Propagation R', type: 'range', min: 0, max: 200, step: 1, suffix: '%' },
		ditherPropagationGreen: { label: 'Propagation G', type: 'range', min: 0, max: 200, step: 1, suffix: '%' },
		ditherPropagationBlue: { label: 'Propagation B', type: 'range', min: 0, max: 200, step: 1, suffix: '%' },
		colorSpace: { label: 'Color Space', type: 'select', options: colorSpaceOptions },
		processingMode: { label: 'Processing', type: 'select', options: processingModeOptions },
		// ── Image ──
		brightness: { label: 'Brightness', type: 'range', min: 0, max: 200, step: 1, suffix: '%' },
		contrast: { label: 'Contrast', type: 'range', min: 0, max: 200, step: 1, suffix: '%' },
		saturation: { label: 'Saturation', type: 'range', min: 0, max: 200, step: 1, suffix: '%' },
		cropMode: { label: 'Crop Mode', type: 'select', options: cropModeOptions },
		cropZoom: { label: 'Crop Zoom', type: 'range', min: 1, max: 10, step: 0.1 },
		cropOffsetX: { label: 'Crop Offset X', type: 'range', min: 0, max: 100, step: 1, suffix: '%' },
		cropOffsetY: { label: 'Crop Offset Y', type: 'range', min: 0, max: 100, step: 1, suffix: '%' },
		// ── Blocks ──
		selectedBlocks: { label: 'Block Selection', type: 'readonly' },
		transparencyEnabled: { label: 'Transparency', type: 'boolean' },
		transparencyTolerance: { label: 'Tolerance', type: 'range', min: 0, max: 255, step: 1 },
		whereSupportBlocks: { label: 'Support Blocks', type: 'select', options: supportBlocksOptions },
		backgroundMode: { label: 'Background', type: 'select', options: bgModeOptions },
		backgroundColour: { label: 'Background Color', type: 'color' },
		supportBlock: { label: 'Support Block', type: 'select', options: supportBlockOptions },
		// ── Filters ──
		bilateralEnabled: { label: 'Bilateral Filter', type: 'boolean' },
		bilateralSigmaSpace: { label: 'Sigma Space', type: 'range', min: 0, max: 50, step: 0.5 },
		bilateralSigmaColor: { label: 'Sigma Color', type: 'range', min: 0, max: 100, step: 1 },
		bilateralRadius: { label: 'Radius', type: 'range', min: 1, max: 20, step: 1 },
		edgeMaskEnabled: { label: 'Edge Mask', type: 'boolean' },
		edgeMaskThreshold: { label: 'Threshold', type: 'range', min: 0, max: 255, step: 1 },
		luminanceWeight: { label: 'Luminance Weight', type: 'range', min: 0, max: 5, step: 0.1 },
	};

	interface Profile {
		name: string;
		data: Record<string, any>;
		createdAt: number;
		lockedFields?: string[]; // Individual field keys that should NOT be overwritten on load
	}

	let dialogEl: HTMLDialogElement | undefined = $state(undefined);
	let profiles = $state<Profile[]>([]);
	let selectedIdx = $state(0);
	let searchQuery = $state('');
	let copiedId = $state<number | null>(null);
	let renameIdx = $state<number | null>(null);
	let renameValue = $state('');
	let activeTab = $state<'profiles' | 'customblocks'>('profiles');

	// ── Block profiles state ──
	let blockProfiles = $state<BlockProfile[]>([]);
	let bpSelectedIdx = $state(0);
	let bpCopied = $state(false);
	let bpRenameIdx = $state<number | null>(null);
	let bpRenameValue = $state('');
	let bpBlockModalOpen = $state(false);
	let bpEditingBlockIdx = $state<number | null>(null); // null = add new, number = edit existing
	let bpSearchQuery = $state('');

	// ── Import/Export modal state ──
	let ioModalOpen = $state(false);
	let ioMode = $state<'export' | 'import'>('export');
	let ioTarget = $state<'profiles' | 'blockProfiles'>('profiles');
	let ioFormat = $state<'base64' | 'json'>('base64');
	let ioExportText = $state('');
	let ioImportText = $state('');
	let ioCopied = $state(false);

	const DEFAULT_PROFILE_NAME = 'Default';

	// ── Derived ──
	let filteredProfiles = $derived(
		searchQuery.trim()
			? profiles.filter(p => p.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
			: profiles
	);

	let selectedProfile = $derived(
		filteredProfiles[selectedIdx] ?? filteredProfiles[0] ?? null
	);

	// ── Dialog open/close sync ──
	$effect(() => {
		if (profilesModal.open) {
			untrack(() => {
				activeTab = profilesModal.initialTab;
				loadProfiles();
				loadBlockProfiles();
			});
			dialogEl?.showModal();
		} else {
			dialogEl?.close();
		}
	});

	// ── Helpers ──
	function loadProfiles() {
		try {
			const raw = localStorage.getItem(PROFILES_KEY);
			if (raw) profiles = JSON.parse(raw);
		} catch {}
		if (profiles.length === 0) {
			profiles = [{ name: DEFAULT_PROFILE_NAME, data: captureProfile(), createdAt: Date.now() }];
		}
		selectedIdx = 0;
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

	function applyProfile(data: Record<string, any>, lockedFields: string[] = []) {
		if (data.colorSpace === 'lab' || data.colorSpace === 'euclidian') {
			data.colorSpace = data.colorSpace === 'lab' ? 'mapartcraft-default' : 'rgb';
		}
		const locked = new Set(lockedFields);
		for (const key of PROFILE_FIELDS) {
			if (locked.has(key)) continue;
			if (key in data) {
				(app as any)[key] = typeof data[key] === 'object' && data[key] !== null
					? JSON.parse(JSON.stringify(data[key]))
					: data[key];
			}
		}
	}

	function countActiveBlocks(data: Record<string, any>): number {
		if (!data.selectedBlocks) return 0;
		return Object.values(data.selectedBlocks).filter(v => v !== '-1').length;
	}

	// ── Lookups ──
	function getModeName(modeId: number): string {
		for (const [, mode] of Object.entries(mapModes)) {
			if ((mode as any).uniqueId === modeId) return (mode as any).name;
		}
		return `Mode ${modeId}`;
	}

	function getStaircasingName(staircasingId: number): string {
		for (const [, mode] of Object.entries(mapModes)) {
			for (const [key, stair] of Object.entries((mode as any).staircaseModes)) {
				if ((stair as any).uniqueId === staircasingId) return key.replace(/_/g, ' ');
			}
		}
		return `Staircase ${staircasingId}`;
	}

	function getDitherName(ditherMethodId: string): string {
		// Try matching by key-derived id
		for (const [key, method] of Object.entries(ditherMethods)) {
			const derivedId = key.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
			if (derivedId === ditherMethodId || key.toLowerCase() === ditherMethodId.replace(/-/g, '').toLowerCase()) {
				return (method as any).name;
			}
		}
		// fallback: try localeKey
		for (const [, method] of Object.entries(ditherMethods)) {
			if ((method as any).localeKey?.toLowerCase().includes(ditherMethodId)) {
				return (method as any).name;
			}
		}
		return ditherMethodId;
	}

	function formatDate(ts: number): string {
		return new Date(ts).toLocaleDateString(undefined, {
			year: 'numeric', month: 'short', day: 'numeric',
			hour: '2-digit', minute: '2-digit'
		});
	}

	// ── Actions ──
	async function handleLoad() {
		if (!selectedProfile) return;
		const confirmed = await modal.showConfirm(
			t('pm.loadConfirm', { name: selectedProfile.name }),
			t('pm.loadTitle'),
			t('pm.loadBtn'),
			t('pm.cancelBtn')
		);
		if (!confirmed) return;
		applyProfile(selectedProfile.data, selectedProfile.lockedFields ?? []);
		profilesModal.close();
	}

	// ── Section edit modal state ──
	let sectionEditOpen = $state(false);
	let sectionEditKey = $state('');
	let sectionEditData = $state<Record<string, any>>({});

	function openSectionEdit(sectionKey: string) {
		if (!selectedProfile) return;
		sectionEditKey = sectionKey;
		// Deep copy the relevant fields
		const fields = SECTION_FIELDS[sectionKey] ?? [];
		const data: Record<string, any> = {};
		for (const f of fields) {
			const val = selectedProfile.data[f];
			data[f] = typeof val === 'object' && val !== null ? JSON.parse(JSON.stringify(val)) : val;
		}
		sectionEditData = data;
		sectionEditOpen = true;
	}

	function closeSectionEdit() {
		// Auto-save on close
		if (selectedProfile && sectionEditOpen) {
			const realIdx = profiles.indexOf(selectedProfile);
			if (realIdx >= 0) {
				const updatedData = { ...profiles[realIdx].data };
				const fields = SECTION_FIELDS[sectionEditKey] ?? [];
				for (const f of fields) {
					if (f in sectionEditData) {
						updatedData[f] = sectionEditData[f];
					}
				}
				profiles[realIdx] = { ...profiles[realIdx], data: updatedData };
				profiles = [...profiles];
				persistProfiles();
			}
		}
		sectionEditOpen = false;
	}

	function toggleFieldLock(fieldKey: string) {
		if (!selectedProfile) return;
		const realIdx = profiles.indexOf(selectedProfile);
		if (realIdx < 0) return;
		const current = profiles[realIdx].lockedFields ?? [];
		if (current.includes(fieldKey)) {
			profiles[realIdx] = { ...profiles[realIdx], lockedFields: current.filter(f => f !== fieldKey) };
		} else {
			profiles[realIdx] = { ...profiles[realIdx], lockedFields: [...current, fieldKey] };
		}
		profiles = [...profiles];
		persistProfiles();
	}

	function isFieldLocked(fieldKey: string): boolean {
		return selectedProfile?.lockedFields?.includes(fieldKey) ?? false;
	}

	function hasSectionLockedFields(sectionKey: string): boolean {
		if (!selectedProfile?.lockedFields?.length) return false;
		const fields = SECTION_FIELDS[sectionKey] ?? [];
		return fields.some(f => selectedProfile!.lockedFields!.includes(f));
	}

	function isSectionFullyLocked(sectionKey: string): boolean {
		const fields = SECTION_FIELDS[sectionKey] ?? [];
		if (fields.length === 0) return false;
		return fields.every(f => selectedProfile?.lockedFields?.includes(f));
	}

	function toggleSectionLock(sectionKey: string) {
		if (!selectedProfile) return;
		const fields = SECTION_FIELDS[sectionKey] ?? [];
		const fullyLocked = isSectionFullyLocked(sectionKey);
		const idx = profiles.indexOf(selectedProfile);
		if (idx < 0) return;
		const current = new Set(selectedProfile.lockedFields ?? []);
		if (fullyLocked) {
			// Unlock all fields in section
			for (const f of fields) current.delete(f);
		} else {
			// Lock all fields in section
			for (const f of fields) current.add(f);
		}
		profiles[idx].lockedFields = [...current];
		saveProfiles();
	}

	function getFieldDisplayValue(fieldKey: string, val: any): string {
		if (val === undefined || val === null) return '—';
		if (typeof val === 'boolean') return val ? 'ON' : 'OFF';
		if (fieldKey === 'selectedBlocks') return `(${Array.isArray(val) ? val.length : 0} entries)`;
		return String(val);
	}

	function getFieldLabel(fieldKey: string): string {
		const labels: Record<string, string> = {
			selectedVersion: 'Version',
			mapSizeX: 'Map Size X',
			mapSizeZ: 'Map Size Z',
			modeId: 'Mode',
			staircasingId: 'Staircasing',
			ditherMethodId: 'Dither Method',
			ditherPropagationRed: 'Propagation R',
			ditherPropagationGreen: 'Propagation G',
			ditherPropagationBlue: 'Propagation B',
			colorSpace: 'Color Space',
			processingMode: 'Processing Mode',
			brightness: 'Brightness',
			contrast: 'Contrast',
			saturation: 'Saturation',
			cropMode: 'Crop Mode',
			cropZoom: 'Crop Zoom',
			cropOffsetX: 'Crop Offset X',
			cropOffsetY: 'Crop Offset Y',
			selectedBlocks: 'Selected Blocks',
			transparencyEnabled: 'Transparency',
			transparencyTolerance: 'Transparency Tol.',
			whereSupportBlocks: 'Support Blocks',
			backgroundMode: 'Background Mode',
			backgroundColour: 'Background Color',
			supportBlock: 'Support Block',
			bilateralEnabled: 'Bilateral Filter',
			bilateralSigmaSpace: 'Bilateral σ Space',
			bilateralSigmaColor: 'Bilateral σ Color',
			bilateralRadius: 'Bilateral Radius',
			edgeMaskEnabled: 'Edge Mask',
			edgeMaskThreshold: 'Edge Threshold',
			luminanceWeight: 'Luminance Weight',
		};
		return labels[fieldKey] ?? fieldKey;
	}

	function getSectionTitle(sectionKey: string): string {
		const titles: Record<string, string> = {
			map: t('pm.sectionMap'),
			processing: t('pm.sectionProcessing'),
			image: t('pm.sectionImage'),
			blocks: t('pm.sectionBlocks'),
			filters: t('pm.sectionFilters'),
		};
		return titles[sectionKey] ?? sectionKey;
	}

	async function handleSaveNew() {
		const name = await modal.showPrompt(t('pm.newNamePrompt'), '', t('pm.newTitle'));
		if (!name || !name.trim()) return;
		const trimmed = name.trim();
		const existing = profiles.findIndex(p => p.name === trimmed);
		const profile: Profile = { name: trimmed, data: captureProfile(), createdAt: Date.now() };
		if (existing >= 0) {
			profiles[existing] = profile;
		} else {
			profiles.push(profile);
		}
		profiles = [...profiles];
		persistProfiles();
		selectedIdx = filteredProfiles.findIndex(p => p.name === trimmed);
		if (selectedIdx < 0) selectedIdx = 0;
	}

	async function handleSaveCurrent() {
		if (!selectedProfile) return;
		const confirmed = await modal.showConfirm(
			t('pm.overwriteConfirm', { name: selectedProfile.name }),
			t('pm.overwriteTitle'),
			t('pm.overwriteBtn'),
			t('pm.cancelBtn')
		);
		if (!confirmed) return;
		const idx = profiles.findIndex(p => p.name === selectedProfile!.name);
		if (idx >= 0) {
			profiles[idx] = { name: selectedProfile!.name, data: captureProfile(), createdAt: Date.now() };
			profiles = [...profiles];
			persistProfiles();
		}
	}

	async function handleDelete() {
		if (!selectedProfile) return;
		const confirmed = await modal.showConfirm(
			t('pm.deleteConfirm', { name: selectedProfile.name }),
			t('pm.deleteTitle'),
			t('pm.deleteBtn'),
			t('pm.cancelBtn')
		);
		if (!confirmed) return;
		profiles = profiles.filter(p => p.name !== selectedProfile!.name);
		if (profiles.length === 0) {
			profiles = [{ name: DEFAULT_PROFILE_NAME, data: captureProfile(), createdAt: Date.now() }];
		}
		persistProfiles();
		selectedIdx = 0;
	}

	async function handleDuplicate() {
		if (!selectedProfile) return;
		const name = await modal.showPrompt(t('pm.duplicatePrompt'), `${selectedProfile.name} (copy)`, t('pm.duplicateTitle'));
		if (!name || !name.trim()) return;
		const copy: Profile = {
			name: name.trim(),
			data: JSON.parse(JSON.stringify(selectedProfile.data)),
			createdAt: Date.now(),
		};
		profiles = [...profiles, copy];
		persistProfiles();
		selectedIdx = filteredProfiles.length; // will point to new entry
	}

	function startRename(idx: number) {
		renameIdx = idx;
		renameValue = filteredProfiles[idx]?.name ?? '';
	}

	function confirmRename() {
		if (renameIdx === null || !renameValue.trim()) { renameIdx = null; return; }
		const target = filteredProfiles[renameIdx];
		if (!target) { renameIdx = null; return; }
		const globalIdx = profiles.findIndex(p => p.name === target.name);
		if (globalIdx >= 0) {
			profiles[globalIdx] = { ...profiles[globalIdx], name: renameValue.trim() };
			profiles = [...profiles];
			persistProfiles();
		}
		renameIdx = null;
	}

	function handleShareProfile() {
		if (!selectedProfile) return;
		try {
			const json = JSON.stringify([selectedProfile], null, 2);
			const encoded = btoa(unescape(encodeURIComponent(json)));
			navigator.clipboard.writeText(encoded);
			copiedId = selectedIdx;
			setTimeout(() => { copiedId = null; }, 2000);
		} catch {}
	}

	function exportSingleProfile() {
		if (!selectedProfile) return;
		const blob = new Blob([JSON.stringify([selectedProfile], null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `profile_${selectedProfile.name.replace(/\s+/g, '_')}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function exportAllProfiles() {
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
					}
				} catch {}
			};
			reader.readAsText(file);
		};
		input.click();
	}

	function importFromClipboard() {
		navigator.clipboard.readText().then(text => {
			try {
				const json = decodeURIComponent(escape(atob(text.trim())));
				const imported: Profile[] = JSON.parse(json);
				if (Array.isArray(imported)) {
					for (const imp of imported) {
						if (!imp.name || !imp.data) continue;
						const idx = profiles.findIndex(p => p.name === imp.name);
						if (idx >= 0) profiles[idx] = imp;
						else profiles.push(imp);
					}
					profiles = [...profiles];
					persistProfiles();
				}
			} catch {}
		}).catch(() => {});
	}

	function handleClose() {
		profilesModal.close();
	}

	// ── Block Profiles core ──
	function loadBlockProfiles() {
		try {
			const raw = localStorage.getItem(BLOCK_PROFILES_KEY);
			if (raw) {
				blockProfiles = JSON.parse(raw);
			} else {
				const legacy = localStorage.getItem(CUSTOM_BLOCKS_KEY);
				if (legacy) {
					try {
						const legacyBlocks: CustomBlock[] = JSON.parse(legacy);
						if (Array.isArray(legacyBlocks) && legacyBlocks.length > 0) {
							blockProfiles = [{
								name: 'Imported',
								blocks: legacyBlocks,
								enabled: true,
								createdAt: Date.now(),
							}];
						}
					} catch {}
				}
			}
		} catch {
			blockProfiles = [];
		}
		applyBlockProfiles();
		if (blockProfiles.length > 0 && bpSelectedIdx >= blockProfiles.length) bpSelectedIdx = 0;
	}

	function persistBlockProfiles() {
		localStorage.setItem(BLOCK_PROFILES_KEY, JSON.stringify(blockProfiles));
		const allBlocks = getAllEnabledBlocks();
		localStorage.setItem(CUSTOM_BLOCKS_KEY, JSON.stringify(allBlocks));
		applyBlockProfiles();
	}

	function getAllEnabledBlocks(): CustomBlock[] {
		return blockProfiles.filter(bp => bp.enabled).flatMap(bp => bp.blocks);
	}

	function applyBlockProfiles() {
		const allBlocks = getAllEnabledBlocks();
		app.coloursJSON = getMergedColoursJSON(allBlocks) as any;
	}

	function getMergedColoursJSON(blocks: CustomBlock[]): ColoursJSON {
		const base = JSON.parse(JSON.stringify(coloursJSONBase)) as ColoursJSON;
		for (const [csId, customBlock] of blocks) {
			if (!(csId in base)) continue;
			const nextKey = Object.keys(base[csId].blocks).length.toString();
			base[csId].blocks[nextKey] = customBlock;
		}
		return base;
	}

	// ── Block Profile management ──
	let filteredBlockProfiles = $derived(
		bpSearchQuery.trim()
			? blockProfiles.map((bp, i) => ({ bp, origIdx: i })).filter(({ bp }) => bp.name.toLowerCase().includes(bpSearchQuery.trim().toLowerCase()))
			: blockProfiles.map((bp, i) => ({ bp, origIdx: i }))
	);
	let selectedBlockProfile = $derived(blockProfiles[bpSelectedIdx] ?? null);
	let totalBlockCount = $derived(blockProfiles.reduce((sum, bp) => sum + bp.blocks.length, 0));

	async function handleNewBlockProfile() {
		const name = await modal.showPrompt(t('pm.bpNewNamePrompt'), '', t('pm.bpNewTitle'));
		if (!name || !name.trim()) return;
		blockProfiles = [...blockProfiles, {
			name: name.trim(),
			blocks: [],
			enabled: true,
			createdAt: Date.now(),
		}];
		persistBlockProfiles();
		bpSelectedIdx = blockProfiles.length - 1;
	}

	async function handleDeleteBlockProfile(idx: number) {
		const bp = blockProfiles[idx];
		if (!bp) return;
		const confirmed = await modal.showConfirm(
			t('pm.bpDeleteConfirm', { name: bp.name }),
			t('pm.bpDeleteTitle'),
			t('pm.deleteBtn'),
			t('pm.cancelBtn')
		);
		if (!confirmed) return;
		blockProfiles = blockProfiles.filter((_, i) => i !== idx);
		persistBlockProfiles();
		if (bpSelectedIdx >= blockProfiles.length) bpSelectedIdx = Math.max(0, blockProfiles.length - 1);
	}

	function handleToggleBlockProfile(idx: number) {
		if (!blockProfiles[idx]) return;
		blockProfiles[idx] = { ...blockProfiles[idx], enabled: !blockProfiles[idx].enabled };
		blockProfiles = [...blockProfiles];
		persistBlockProfiles();
	}

	function bpStartRename(idx: number) {
		bpRenameIdx = idx;
		bpRenameValue = blockProfiles[idx]?.name ?? '';
	}

	function bpConfirmRename() {
		if (bpRenameIdx === null || !bpRenameValue.trim()) { bpRenameIdx = null; return; }
		if (!blockProfiles[bpRenameIdx]) { bpRenameIdx = null; return; }
		blockProfiles[bpRenameIdx] = { ...blockProfiles[bpRenameIdx], name: bpRenameValue.trim() };
		blockProfiles = [...blockProfiles];
		persistBlockProfiles();
		bpRenameIdx = null;
	}

	function openBlockModal(blockIdx?: number) {
		if (blockIdx !== undefined && selectedBlockProfile) {
			loadBlockIntoForm(blockIdx);
			bpEditingBlockIdx = blockIdx;
		} else {
			resetAddForm();
			bpEditingBlockIdx = null;
		}
		bpBlockModalOpen = true;
	}

	function closeBlockModal() {
		bpBlockModalOpen = false;
		bpEditingBlockIdx = null;
		resetAddForm();
	}

	function loadBlockIntoForm(blockIdx: number) {
		if (!selectedBlockProfile) return;
		const [csId, block] = selectedBlockProfile.blocks[blockIdx];
		if (!block) return;

		const versionData = Object.values(block.validVersions).find(
			(v): v is BlockVersionData => typeof v !== 'string',
		);
		if (!versionData) return;

		cbBlockName = versionData.NBTName;
		const tags: [string, string][] = Object.entries(versionData.NBTArgs).map(
			([k, v]) => [k, v] as [string, string],
		);
		tags.push(['', '']);
		cbNbtTags = tags;
		cbColourSetId = csId;
		cbNeedsSupport = block.supportBlockMandatory;
		cbFlammable = block.flammable;

		const newVersions: Record<string, boolean> = {};
		for (const [svKey, svVal] of Object.entries(supportedVersions)) {
			newVersions[svKey] = svVal.MCVersion in block.validVersions;
		}
		cbVersions = newVersions;
	}

	// ── Add block form state ──
	const supportedVersions = app.supportedVersions as Record<string, { MCVersion: string }>;
	let cbBlockName = $state('');
	let cbNbtTags = $state<[string, string][]>([['', '']]);
	let cbColourSetId = $state(Object.keys(app.coloursJSON as ColoursJSON)[0]);
	let cbNeedsSupport = $state(false);
	let cbFlammable = $state(false);
	let cbVersions = $state<Record<string, boolean>>(
		Object.keys(supportedVersions).reduce(
			(acc, key) => { acc[key] = false; return acc; },
			{} as Record<string, boolean>,
		),
	);

	function resetAddForm() {
		cbBlockName = '';
		cbNbtTags = [['', '']];
		cbNeedsSupport = false;
		cbFlammable = false;
		cbVersions = Object.keys(supportedVersions).reduce(
			(acc, key) => { acc[key] = false; return acc; },
			{} as Record<string, boolean>,
		);
	}

	function onNbtTagChange(index: number, keyOrValue: 0 | 1, value: string) {
		const newTags = cbNbtTags.map((t) => [...t] as [string, string]);
		newTags[index][keyOrValue] = value;
		if (
			index === newTags.length - 2 &&
			newTags[newTags.length - 2].every((t) => t === '') &&
			newTags[newTags.length - 1].every((t) => t === '')
		) {
			newTags.pop();
		} else if (index === newTags.length - 1) {
			newTags.push(['', '']);
		}
		cbNbtTags = newTags;
	}

	function getColourBg(csId: string): string {
		const cJSON = app.coloursJSON as unknown as ColoursJSON;
		const set = cJSON[csId];
		if (!set) return 'rgb(128,128,128)';
		return `rgb(${set.tonesRGB.normal.join(', ')})`;
	}

	function getColourText(csId: string): string {
		const cJSON = app.coloursJSON as unknown as ColoursJSON;
		const set = cJSON[csId];
		if (!set) return 'white';
		const [r, g, b] = set.tonesRGB.normal;
		return r * 0.299 + g * 0.587 + b * 0.114 > 186 ? 'black' : 'white';
	}

	function handleSaveBlock() {
		if (!selectedBlockProfile) return;
		const nameTrimmed = cbBlockName.trim();
		if (nameTrimmed === '') {
			modal.showAlert(t('blocks.enterBlockName'), t('blocks.error'));
			return;
		}
		if (Object.values(cbVersions).every((v) => !v)) {
			modal.showAlert(t('blocks.selectVersion'), t('blocks.error'));
			return;
		}

		const blockToAdd: BlockEntry = {
			displayName: nameTrimmed,
			validVersions: {},
			supportBlockMandatory: cbNeedsSupport,
			flammable: cbFlammable,
			presetIndex: -999,
		};

		let addedFirstVersion = false;
		for (const [vKey, isSelected] of Object.entries(cbVersions)) {
			if (!isSelected) continue;
			const mcVer = supportedVersions[vKey]?.MCVersion;
			if (!mcVer) continue;
			if (addedFirstVersion) {
				blockToAdd.validVersions[mcVer] = `&${Object.keys(blockToAdd.validVersions)[0]}`;
			} else {
				const args: Record<string, string> = {};
				for (const [k, v] of cbNbtTags) {
					const kt = k.trim();
					const vt = v.trim();
					if (kt !== '' || vt !== '') args[kt] = vt;
				}
				blockToAdd.validVersions[mcVer] = { NBTName: nameTrimmed, NBTArgs: args };
				addedFirstVersion = true;
			}
		}

		let updatedBlocks: CustomBlock[];

		if (bpEditingBlockIdx !== null) {
			// Edit mode: replace the block at the editing index
			updatedBlocks = [...selectedBlockProfile.blocks];
			updatedBlocks[bpEditingBlockIdx] = [cbColourSetId, blockToAdd];
		} else {
			// Add mode: filter duplicates then push
			updatedBlocks = selectedBlockProfile.blocks.filter(
				([csId, cb]) =>
					csId !== cbColourSetId ||
					cb.displayName !== nameTrimmed ||
					!Object.values(supportedVersions).some(
						(sv) => sv.MCVersion in cb.validVersions && sv.MCVersion in blockToAdd.validVersions,
					),
			);
			updatedBlocks.push([cbColourSetId, blockToAdd]);
		}

		blockProfiles[bpSelectedIdx] = { ...blockProfiles[bpSelectedIdx], blocks: updatedBlocks };
		blockProfiles = [...blockProfiles];
		persistBlockProfiles();
		app.selectedBlocks[cbColourSetId] = '-1';
		closeBlockModal();
	}

	async function handleDeleteBlockFromProfile(blockIdx: number) {
		if (!selectedBlockProfile) return;
		const block = selectedBlockProfile.blocks[blockIdx];
		if (!block) return;
		const confirmed = await modal.showConfirm(
			t('pm.cbDeleteConfirm', { name: block[1].displayName }),
			t('pm.cbDeleteTitle'),
			t('pm.deleteBtn'),
			t('pm.cancelBtn')
		);
		if (!confirmed) return;
		const updated = selectedBlockProfile.blocks.filter((_, i) => i !== blockIdx);
		blockProfiles[bpSelectedIdx] = { ...blockProfiles[bpSelectedIdx], blocks: updated };
		blockProfiles = [...blockProfiles];
		persistBlockProfiles();
	}

	function getColourSetName(csId: string): string {
		const cJSON = app.coloursJSON as unknown as ColoursJSON;
		const set = cJSON[csId];
		return set?.colourName ?? `Set ${csId}`;
	}

	function getVersionsList(block: BlockEntry): string {
		return Object.keys(block.validVersions).join(', ');
	}

	function getMinecraftName(block: BlockEntry): string {
		const versions = Object.values(block.validVersions);
		for (const v of versions) {
			if (typeof v === 'object' && v.NBTName) return `minecraft:${v.NBTName}`;
		}
		return block.displayName;
	}

	function getVersionsArray(block: BlockEntry): string[] {
		return Object.keys(block.validVersions);
	}

	const MAX_VERSION_TAGS = 3;

	// ── Export / Import / Share (profile-level) ──
	function exportBlockProfile() {
		if (!selectedBlockProfile) return;
		const blob = new Blob([JSON.stringify(selectedBlockProfile, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `blockprofile_${selectedBlockProfile.name.replace(/\s+/g, '_')}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function importBlockProfile() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = () => {
			const file = input.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = () => {
				try {
					const raw = JSON.parse(reader.result as string);
					const items: BlockProfile[] = Array.isArray(raw) ? raw : [raw];
					for (const imp of items) {
						if (!imp.name || !Array.isArray(imp.blocks)) continue;
						const existing = blockProfiles.findIndex(bp => bp.name === imp.name);
						const profile: BlockProfile = {
							name: imp.name,
							blocks: imp.blocks,
							enabled: imp.enabled ?? true,
							createdAt: imp.createdAt ?? Date.now(),
						};
						if (existing >= 0) blockProfiles[existing] = profile;
						else blockProfiles.push(profile);
					}
					blockProfiles = [...blockProfiles];
					persistBlockProfiles();
				} catch {}
			};
			reader.readAsText(file);
		};
		input.click();
	}

	function shareBlockProfile() {
		if (!selectedBlockProfile) return;
		try {
			const json = JSON.stringify(selectedBlockProfile, null, 2);
			const encoded = btoa(unescape(encodeURIComponent(json)));
			navigator.clipboard.writeText(encoded);
			bpCopied = true;
			setTimeout(() => { bpCopied = false; }, 2000);
		} catch {}
	}

	function importBlockProfileFromClipboard() {
		navigator.clipboard.readText().then(text => {
			try {
				const json = decodeURIComponent(escape(atob(text.trim())));
				const raw = JSON.parse(json);
				const items: BlockProfile[] = Array.isArray(raw) ? raw : [raw];
				for (const imp of items) {
					if (!imp.name || !Array.isArray(imp.blocks)) continue;
					const existing = blockProfiles.findIndex(bp => bp.name === imp.name);
					const profile: BlockProfile = {
						name: imp.name,
						blocks: imp.blocks,
						enabled: imp.enabled ?? true,
						createdAt: imp.createdAt ?? Date.now(),
					};
					if (existing >= 0) blockProfiles[existing] = profile;
					else blockProfiles.push(profile);
				}
				blockProfiles = [...blockProfiles];
				persistBlockProfiles();
			} catch {}
		}).catch(() => {});
	}

	// ── Unified Import/Export Modal ──
	function openIOModal(mode: 'export' | 'import', target: 'profiles' | 'blockProfiles') {
		ioMode = mode;
		ioTarget = target;
		ioFormat = 'base64';
		ioImportText = '';
		ioCopied = false;

		if (mode === 'export') {
			generateExportText();
		} else {
			ioExportText = '';
		}
		ioModalOpen = true;
	}

	function closeIOModal() {
		ioModalOpen = false;
	}

	function generateExportText() {
		try {
			let data: any;
			if (ioTarget === 'profiles') {
				data = selectedProfile ? [selectedProfile] : profiles;
			} else {
				data = selectedBlockProfile ?? blockProfiles;
			}
			const json = JSON.stringify(data, null, 2);
			if (ioFormat === 'base64') {
				ioExportText = btoa(unescape(encodeURIComponent(json)));
			} else {
				ioExportText = json;
			}
		} catch {
			ioExportText = '';
		}
	}

	function handleIOCopy() {
		navigator.clipboard.writeText(ioExportText).then(() => {
			ioCopied = true;
			setTimeout(() => { ioCopied = false; }, 2000);
		}).catch(() => {});
	}

	function handleIODownload() {
		const isJson = ioFormat === 'json';
		const ext = isJson ? 'json' : 'txt';
		const mime = isJson ? 'application/json' : 'text/plain';
		let filename: string;
		if (ioTarget === 'profiles') {
			filename = selectedProfile
				? `profile_${selectedProfile.name.replace(/\s+/g, '_')}.${ext}`
				: `damaparts_profiles.${ext}`;
		} else {
			filename = selectedBlockProfile
				? `blockprofile_${selectedBlockProfile.name.replace(/\s+/g, '_')}.${ext}`
				: `damaparts_blockprofiles.${ext}`;
		}
		const blob = new Blob([ioExportText], { type: mime });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	function handleIOImport() {
		if (!ioImportText.trim()) return;
		try {
			let json: string;
			if (ioFormat === 'base64') {
				json = decodeURIComponent(escape(atob(ioImportText.trim())));
			} else {
				json = ioImportText.trim();
			}
			const raw = JSON.parse(json);

			if (ioTarget === 'profiles') {
				const imported: Profile[] = Array.isArray(raw) ? raw : [raw];
				for (const imp of imported) {
					if (!imp.name || !imp.data) continue;
					const idx = profiles.findIndex(p => p.name === imp.name);
					if (idx >= 0) profiles[idx] = imp;
					else profiles.push(imp);
				}
				profiles = [...profiles];
				persistProfiles();
			} else {
				const items: BlockProfile[] = Array.isArray(raw) ? raw : [raw];
				for (const imp of items) {
					if (!imp.name || !Array.isArray(imp.blocks)) continue;
					const existing = blockProfiles.findIndex(bp => bp.name === imp.name);
					const profile: BlockProfile = {
						name: imp.name,
						blocks: imp.blocks,
						enabled: imp.enabled ?? true,
						createdAt: imp.createdAt ?? Date.now(),
					};
					if (existing >= 0) blockProfiles[existing] = profile;
					else blockProfiles.push(profile);
				}
				blockProfiles = [...blockProfiles];
				persistBlockProfiles();
			}
			closeIOModal();
		} catch {}
	}

	function handleIOFileImport() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json,.txt';
		input.onchange = () => {
			const file = input.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = () => {
				ioImportText = reader.result as string;
				// Auto-detect format
				const text = ioImportText.trim();
				if (text.startsWith('{') || text.startsWith('[')) {
					ioFormat = 'json';
				} else {
					ioFormat = 'base64';
				}
			};
			reader.readAsText(file);
		};
		input.click();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === dialogEl) handleClose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			if (ioModalOpen) {
				closeIOModal();
			} else if (bpBlockModalOpen) {
				closeBlockModal();
			} else {
				handleClose();
			}
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialogEl}
	class="pm-dialog"
	onclick={handleBackdropClick}
	onkeydown={handleKeydown}
>
	<div class="pm-container">
		<!-- Header -->
		<div class="pm-header">
			<div class="flex items-center gap-3">
				<svg class="text-[var(--color-primary)]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M5.121 17.804A13.937 13.937 0 0 1 12 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
				</svg>
				<div>
					<h2 class="text-base font-semibold text-[var(--color-text)]">{t('pm.title')}</h2>
					<p class="text-xs text-[var(--color-muted)]">{t('pm.subtitle', { count: profiles.length.toString() })}</p>
				</div>
			</div>
			<!-- Tabs -->
			<div class="flex items-center gap-2">
				<div class="pm-header-tabs">
					<button
						class="pm-header-tab"
						class:active={activeTab === 'profiles'}
						onclick={() => { activeTab = 'profiles'; }}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M5.121 17.804A13.937 13.937 0 0 1 12 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
						</svg>
						{t('pm.tabProfiles')}
					</button>
					<button
						class="pm-header-tab"
						class:active={activeTab === 'customblocks'}
						onclick={() => { activeTab = 'customblocks'; }}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
						</svg>
						{t('pm.tabCustomBlocks')}
					</button>
				</div>
				<button class="pm-close-btn" onclick={handleClose} title={t('pm.close')}>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>
		</div>

		<!-- Body -->
		{#if activeTab === 'profiles'}
		<div class="pm-body">
			<!-- Left: Profile list -->
			<div class="pm-sidebar">
				<!-- Search -->
				<div class="pm-search">
					<svg class="pm-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
					</svg>
					<input
						type="text"
						class="pm-search-input"
						placeholder={t('pm.search')}
						bind:value={searchQuery}
					/>
				</div>

				<!-- Profile list -->
				<div class="pm-list">
					{#each filteredProfiles as profile, i}
						<button
							class="pm-list-item"
							class:active={selectedIdx === i}
							onclick={() => { selectedIdx = i; }}
						>
							{#if renameIdx === i}
								<!-- svelte-ignore a11y_autofocus -->
								<input
									class="pm-rename-input"
									type="text"
									bind:value={renameValue}
									onblur={confirmRename}
									onkeydown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') { renameIdx = null; } }}
								/>
							{:else}
								<div class="pm-list-item-info">
									<span class="pm-list-item-name">{profile.name}</span>
									<span class="pm-list-item-date">{formatDate(profile.createdAt)}</span>
								</div>
								<div class="pm-list-item-actions">
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<span class="pm-list-item-btn" onclick={(e: MouseEvent) => { e.stopPropagation(); startRename(i); }} title="Rename">
										<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
									</span>
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<span class="pm-list-item-btn" onclick={(e: MouseEvent) => { e.stopPropagation(); handleDuplicate(); }} title="Duplicate">
										<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
									</span>
								</div>
							{/if}
						</button>
					{/each}

					{#if filteredProfiles.length === 0}
						<div class="pm-empty">{t('pm.noProfiles')}</div>
					{/if}
				</div>

				<!-- Sidebar actions -->
				<div class="pm-sidebar-actions">
					<button class="pm-action-btn pm-action-primary" onclick={handleSaveNew} title={t('pm.newTitle')}>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
						</svg>
						{t('pm.new')}
					</button>
					<button class="pm-action-btn" onclick={() => openIOModal('import', 'profiles')} title={t('pm.importFile')}>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
						</svg>
						{t('pm.importFile')}
					</button>
				</div>
			</div>

			<!-- Right: Profile details -->
			<div class="pm-detail">
				{#if selectedProfile}
					<!-- Profile name & meta -->
					<div class="pm-detail-header">
						<h3 class="pm-detail-name">{selectedProfile.name}</h3>
						<span class="pm-detail-date">{formatDate(selectedProfile.createdAt)}</span>
					</div>

					<!-- Settings grid -->
					<div class="pm-settings-grid">
						<!-- Map section -->
						<div class="pm-settings-section">
							<h4 class="pm-settings-section-title">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z" /></svg>
								{t('pm.sectionMap')}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span class="pm-section-edit-btn" onclick={() => openSectionEdit('map')} title="Edit">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
								</span>
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span class="pm-section-lock-btn" class:locked={isSectionFullyLocked('map')} class:partial={hasSectionLockedFields('map') && !isSectionFullyLocked('map')} onclick={() => toggleSectionLock('map')} title={isSectionFullyLocked('map') ? 'Unlock all' : 'Lock all'}>
									{#if isSectionFullyLocked('map')}
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
									{:else}
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>
									{/if}
								</span>
							</h4>
							<div class="pm-setting-row" class:pm-setting-locked={isFieldLocked('selectedVersion')}>
								<span class="pm-setting-label">{t('pm.version')}</span>
								<span class="pm-setting-value">{selectedProfile.data.selectedVersion ?? '—'}</span>
							</div>
							<div class="pm-setting-row" class:pm-setting-locked={isFieldLocked('mapSizeX') || isFieldLocked('mapSizeZ')}>
								<span class="pm-setting-label">{t('pm.mapSize')}</span>
								<span class="pm-setting-value">{selectedProfile.data.mapSizeX ?? '?'}×{selectedProfile.data.mapSizeZ ?? '?'}</span>
							</div>
							<div class="pm-setting-row" class:pm-setting-locked={isFieldLocked('modeId')}>
								<span class="pm-setting-label">{t('pm.mode')}</span>
								<span class="pm-setting-value">{getModeName(selectedProfile.data.modeId)}</span>
							</div>
							<div class="pm-setting-row" class:pm-setting-locked={isFieldLocked('staircasingId')}>
								<span class="pm-setting-label">{t('pm.staircasing')}</span>
								<span class="pm-setting-value">{getStaircasingName(selectedProfile.data.staircasingId)}</span>
							</div>
						</div>

						<!-- Processing section -->
						<div class="pm-settings-section">
							<h4 class="pm-settings-section-title">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
								{t('pm.sectionProcessing')}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span class="pm-section-edit-btn" onclick={() => openSectionEdit('processing')} title="Edit">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
								</span>
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span class="pm-section-lock-btn" class:locked={isSectionFullyLocked('processing')} class:partial={hasSectionLockedFields('processing') && !isSectionFullyLocked('processing')} onclick={() => toggleSectionLock('processing')} title={isSectionFullyLocked('processing') ? 'Unlock all' : 'Lock all'}>
									{#if isSectionFullyLocked('processing')}
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
									{:else}
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>
									{/if}
								</span>
							</h4>
							<div class="pm-setting-row" class:pm-setting-locked={isFieldLocked('ditherMethodId')}>
								<span class="pm-setting-label">{t('pm.dither')}</span>
								<span class="pm-setting-value">{getDitherName(selectedProfile.data.ditherMethodId ?? 'none')}</span>
							</div>
							<div class="pm-setting-row" class:pm-setting-locked={isFieldLocked('colorSpace')}>
								<span class="pm-setting-label">{t('pm.colorSpace')}</span>
								<span class="pm-setting-value">{selectedProfile.data.colorSpace ?? '—'}</span>
							</div>
							<div class="pm-setting-row" class:pm-setting-locked={isFieldLocked('ditherPropagationRed') || isFieldLocked('ditherPropagationGreen') || isFieldLocked('ditherPropagationBlue')}>
								<span class="pm-setting-label">{t('pm.propagation')}</span>
								<span class="pm-setting-value">R:{selectedProfile.data.ditherPropagationRed ?? 100} G:{selectedProfile.data.ditherPropagationGreen ?? 100} B:{selectedProfile.data.ditherPropagationBlue ?? 100}</span>
							</div>
							<div class="pm-setting-row" class:pm-setting-locked={isFieldLocked('processingMode')}>
								<span class="pm-setting-label">{t('pm.processingMode')}</span>
								<span class="pm-setting-value">{selectedProfile.data.processingMode ?? 'auto'}</span>
							</div>
						</div>

						<!-- Image section -->
						<div class="pm-settings-section">
							<h4 class="pm-settings-section-title">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
								{t('pm.sectionImage')}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span class="pm-section-edit-btn" onclick={() => openSectionEdit('image')} title="Edit">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
								</span>
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span class="pm-section-lock-btn" class:locked={isSectionFullyLocked('image')} class:partial={hasSectionLockedFields('image') && !isSectionFullyLocked('image')} onclick={() => toggleSectionLock('image')} title={isSectionFullyLocked('image') ? 'Unlock all' : 'Lock all'}>
									{#if isSectionFullyLocked('image')}
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
									{:else}
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>
									{/if}
								</span>
							</h4>
							<div class="pm-setting-row" class:pm-setting-locked={isFieldLocked('brightness')}>
								<span class="pm-setting-label">{t('pm.brightness')}</span>
								<span class="pm-setting-value">{selectedProfile.data.brightness ?? 100}%</span>
							</div>
							<div class="pm-setting-row" class:pm-setting-locked={isFieldLocked('contrast')}>
								<span class="pm-setting-label">{t('pm.contrast')}</span>
								<span class="pm-setting-value">{selectedProfile.data.contrast ?? 100}%</span>
							</div>
							<div class="pm-setting-row" class:pm-setting-locked={isFieldLocked('saturation')}>
								<span class="pm-setting-label">{t('pm.saturation')}</span>
								<span class="pm-setting-value">{selectedProfile.data.saturation ?? 100}%</span>
							</div>
							<div class="pm-setting-row" class:pm-setting-locked={isFieldLocked('cropMode')}>
								<span class="pm-setting-label">{t('pm.crop')}</span>
								<span class="pm-setting-value">{selectedProfile.data.cropMode ?? 'center'}</span>
							</div>
						</div>

						<!-- Blocks section -->
						<div class="pm-settings-section">
							<h4 class="pm-settings-section-title">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
								{t('pm.sectionBlocks')}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span class="pm-section-edit-btn" onclick={() => openSectionEdit('blocks')} title="Edit">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
								</span>
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span class="pm-section-lock-btn" class:locked={isSectionFullyLocked('blocks')} class:partial={hasSectionLockedFields('blocks') && !isSectionFullyLocked('blocks')} onclick={() => toggleSectionLock('blocks')} title={isSectionFullyLocked('blocks') ? 'Unlock all' : 'Lock all'}>
									{#if isSectionFullyLocked('blocks')}
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
									{:else}
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>
									{/if}
								</span>
							</h4>
							<div class="pm-setting-row" class:pm-setting-locked={isFieldLocked('selectedBlocks')}>
								<span class="pm-setting-label">{t('pm.activeBlocks')}</span>
								<span class="pm-setting-value">{countActiveBlocks(selectedProfile.data)}</span>
							</div>
							<div class="pm-setting-row" class:pm-setting-locked={isFieldLocked('transparencyEnabled') || isFieldLocked('transparencyTolerance')}>
								<span class="pm-setting-label">{t('pm.transparency')}</span>
								<span class="pm-setting-value">{selectedProfile.data.transparencyEnabled ? `${t('pm.enabled')} (${selectedProfile.data.transparencyTolerance})` : t('pm.disabled')}</span>
							</div>
						</div>

						<!-- Filters section -->
						<div class="pm-settings-section">
							<h4 class="pm-settings-section-title">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" /></svg>
								{t('pm.sectionFilters')}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span class="pm-section-edit-btn" onclick={() => openSectionEdit('filters')} title="Edit">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
								</span>
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span class="pm-section-lock-btn" class:locked={isSectionFullyLocked('filters')} class:partial={hasSectionLockedFields('filters') && !isSectionFullyLocked('filters')} onclick={() => toggleSectionLock('filters')} title={isSectionFullyLocked('filters') ? 'Unlock all' : 'Lock all'}>
									{#if isSectionFullyLocked('filters')}
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
									{:else}
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>
									{/if}
								</span>
							</h4>
							<div class="pm-setting-row" class:pm-setting-locked={isFieldLocked('bilateralEnabled')}>
								<span class="pm-setting-label">{t('pm.bilateral')}</span>
								<span class="pm-setting-value">{selectedProfile.data.bilateralEnabled ? t('pm.enabled') : t('pm.disabled')}</span>
							</div>
							{#if selectedProfile.data.bilateralEnabled}
								<div class="pm-setting-row pm-setting-indent" class:pm-setting-locked={isFieldLocked('bilateralSigmaSpace') || isFieldLocked('bilateralSigmaColor') || isFieldLocked('bilateralRadius')}>
									<span class="pm-setting-label">σ space / color / radius</span>
									<span class="pm-setting-value">{selectedProfile.data.bilateralSigmaSpace} / {selectedProfile.data.bilateralSigmaColor} / {selectedProfile.data.bilateralRadius}</span>
								</div>
							{/if}
							<div class="pm-setting-row" class:pm-setting-locked={isFieldLocked('edgeMaskEnabled') || isFieldLocked('edgeMaskThreshold')}>
								<span class="pm-setting-label">{t('pm.edgeMask')}</span>
								<span class="pm-setting-value">{selectedProfile.data.edgeMaskEnabled ? `${t('pm.enabled')} (${selectedProfile.data.edgeMaskThreshold})` : t('pm.disabled')}</span>
							</div>
							<div class="pm-setting-row" class:pm-setting-locked={isFieldLocked('luminanceWeight')}>
								<span class="pm-setting-label">{t('pm.luminance')}</span>
								<span class="pm-setting-value">{selectedProfile.data.luminanceWeight ?? 1.0}</span>
							</div>
						</div>
					</div>

					<!-- Action buttons -->
					<div class="pm-detail-actions">
						<button class="pm-btn pm-btn-primary" onclick={handleLoad}>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
							</svg>
							{t('pm.loadBtn')}
						</button>

						<div style="flex:1"></div>

						<button class="pm-btn pm-btn-danger-solid" onclick={handleDelete}>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
							</svg>
							{t('pm.deleteBtn')}
						</button>
						<button class="pm-btn pm-btn-ghost" onclick={() => openIOModal('export', 'profiles')}>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
							</svg>
							{t('pm.exportOne')}
						</button>
					</div>
				{:else}
					<div class="pm-no-selection">
						<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--color-muted)] opacity-30">
							<path d="M5.121 17.804A13.937 13.937 0 0 1 12 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
						</svg>
						<p class="text-sm text-[var(--color-muted)]">{t('pm.noSelection')}</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Section Edit Overlay -->
		{#if sectionEditOpen}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="pm-overlay" onclick={closeSectionEdit}>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="pm-overlay-card pm-section-edit-card" onclick={(e: MouseEvent) => e.stopPropagation()}>
					<div class="pm-overlay-header">
						<h3>{getSectionTitle(sectionEditKey)}</h3>
						<button class="pm-close-btn" onclick={closeSectionEdit} title="Close">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
						</button>
					</div>
					<div class="pm-overlay-body pm-section-edit-body">
						{#each SECTION_FIELDS[sectionEditKey] ?? [] as fieldKey}
							{@const cfg = FIELD_UI[fieldKey]}
							<div class="pm-field-edit-row" class:pm-field-locked={isFieldLocked(fieldKey)}>
								<div class="pm-field-edit-label">{cfg?.label ?? fieldKey}</div>
								<div class="pm-field-edit-value">
									{#if cfg?.type === 'readonly'}
										<span class="pm-field-readonly">{getFieldDisplayValue(fieldKey, sectionEditData[fieldKey])}</span>
									{:else if cfg?.type === 'select' && cfg.options}
										{@const currentVal = sectionEditData[fieldKey]}
										{@const hasMatch = cfg.options.some(o => String(o.value) === String(currentVal))}
										<select class="pm-field-select" bind:value={sectionEditData[fieldKey]}>
											{#if !hasMatch && currentVal != null}
												<option value={currentVal}>{String(currentVal)}</option>
											{/if}
											{#each cfg.options as opt}
												<option value={opt.value}>{opt.label}</option>
											{/each}
										</select>
									{:else if cfg?.type === 'boolean'}
										<!-- svelte-ignore a11y_click_events_have_key_events -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div class="pm-field-switch" class:active={sectionEditData[fieldKey]} onclick={() => (sectionEditData[fieldKey] = !sectionEditData[fieldKey])}>
											<div class="pm-field-switch-track">
												<div class="pm-field-switch-thumb"></div>
											</div>
											<span>{sectionEditData[fieldKey] ? 'ON' : 'OFF'}</span>
										</div>
									{:else if cfg?.type === 'range'}
										<div class="pm-field-range-wrap">
											<input class="pm-field-range" type="range" min={cfg.min} max={cfg.max} step={cfg.step} bind:value={sectionEditData[fieldKey]} />
											<span class="pm-field-range-value">{sectionEditData[fieldKey]}{cfg.suffix ?? ''}</span>
										</div>
									{:else if cfg?.type === 'color'}
										<div class="pm-field-color-wrap">
											<input class="pm-field-color" type="color" bind:value={sectionEditData[fieldKey]} />
											<span class="pm-field-color-label">{sectionEditData[fieldKey] ?? '#000000'}</span>
										</div>
									{:else if cfg?.type === 'number'}
										<input class="pm-field-input" type="number" min={cfg.min} max={cfg.max} step={cfg.step} bind:value={sectionEditData[fieldKey]} />
									{:else}
										<input class="pm-field-input" type="text" bind:value={sectionEditData[fieldKey]} />
									{/if}
								</div>
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<span class="pm-field-lock-btn" class:locked={isFieldLocked(fieldKey)} onclick={() => toggleFieldLock(fieldKey)} title={isFieldLocked(fieldKey) ? 'Unlock (will be applied)' : 'Lock (skip on load)'}>
									{#if isFieldLocked(fieldKey)}
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
									{:else}
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>
									{/if}
								</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		{:else}
		<!-- ════ Custom Blocks Tab ════ -->
		<div class="pm-body">
			<!-- Left: Block Profiles list -->
			<div class="pm-sidebar">
				<!-- Search -->
				<div class="pm-search">
					<svg class="pm-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
					</svg>
					<input
						type="text"
						class="pm-search-input"
						placeholder={t('pm.search')}
						bind:value={bpSearchQuery}
					/>
				</div>

				<div class="pm-list">
					{#each filteredBlockProfiles as { bp, origIdx }}
						<button
							class="pm-list-item"
							class:active={bpSelectedIdx === origIdx}
							onclick={() => { bpSelectedIdx = origIdx; bpBlockModalOpen = false; }}
							ondblclick={() => bpStartRename(origIdx)}
						>
							{#if bpRenameIdx === origIdx}
								<input
									class="pm-rename-input"
									type="text"
									bind:value={bpRenameValue}
									onblur={bpConfirmRename}
									onkeydown={(e) => { if (e.key === 'Enter') bpConfirmRename(); if (e.key === 'Escape') { bpRenameIdx = null; } }}
								/>
							{:else}
								<div class="flex items-center gap-2 min-w-0 w-full">
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<input
										type="checkbox"
										class="accent-[var(--color-primary)] shrink-0 cursor-pointer"
										checked={bp.enabled}
										onclick={(e: MouseEvent) => { e.stopPropagation(); handleToggleBlockProfile(origIdx); }}
									/>
									<div class="pm-list-item-info">
										<span class="pm-list-item-name-row">
											<span class="pm-list-item-name">{bp.name}</span>
											{#if bp.enabled}
												<span class="pm-bp-tag pm-bp-tag-on">ON</span>
											{/if}
										</span>
										<span class="pm-list-item-date">{bp.blocks.length} {bp.blocks.length === 1 ? 'block' : 'blocks'}</span>
									</div>
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<span class="pm-bp-rename-btn" onclick={(e: MouseEvent) => { e.stopPropagation(); bpStartRename(origIdx); }} title="Rename">
										<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
										</svg>
									</span>
								</div>
							{/if}
						</button>
					{/each}

					{#if filteredBlockProfiles.length === 0}
						<div class="pm-empty">{bpSearchQuery.trim() ? t('pm.noResults') : t('pm.cbEmptyHint')}</div>
					{/if}
				</div>

				<!-- Sidebar actions -->
				<div class="pm-sidebar-actions">
					<button class="pm-action-btn pm-action-primary" onclick={handleNewBlockProfile}>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
						</svg>
						{t('pm.bpNew')}
					</button>
					<button class="pm-action-btn" onclick={() => openIOModal('import', 'blockProfiles')}>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
						</svg>
						{t('pm.importFile')}
					</button>
				</div>
			</div>

			<!-- Right: Profile detail -->
			<div class="pm-detail">
				{#if selectedBlockProfile}
					<!-- Profile header -->
					<div class="pm-detail-header">
						<div class="flex items-center justify-between w-full">
							<h3 class="pm-detail-name">{selectedBlockProfile.name}</h3>
							<span class="pm-detail-date italic">
								{selectedBlockProfile.blocks.length} {selectedBlockProfile.blocks.length === 1 ? 'block' : 'blocks'}
								&middot; {selectedBlockProfile.enabled ? t('pm.enabled') : t('pm.disabled')}
							</span>
							<button class="pm-btn pm-btn-primary pm-btn-sm" onclick={() => openBlockModal()}>
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
								</svg>
								{t('pm.cbAddTitle')}
							</button>
						</div>
					</div>

					<!-- ── Block list ── -->
					<div class="pm-bp-block-list">
						{#each selectedBlockProfile.blocks as [csId, block], blockIdx}
							<button class="pm-bp-block-item" onclick={() => openBlockModal(blockIdx)}>
								<div class="flex items-center gap-2.5 min-w-0">
									<div class="pm-cb-colour-swatch" style="background: {getColourBg(csId)};"></div>
									<div class="pm-list-item-info">
										<span class="pm-list-item-name-row">
											<span class="pm-list-item-name text-[13px]">{getMinecraftName(block)}</span>
											{#each getVersionsArray(block).slice(0, MAX_VERSION_TAGS) as ver}
												<span class="pm-bp-tag pm-bp-tag-on">{ver}</span>
											{/each}
											{#if getVersionsArray(block).length > MAX_VERSION_TAGS}
												<span class="pm-bp-tag pm-bp-tag-more">+{getVersionsArray(block).length - MAX_VERSION_TAGS}</span>
											{/if}
										</span>
										<span class="pm-list-item-date">{getColourSetName(csId)}{#if block.supportBlockMandatory} &nbsp;&middot;&nbsp; Needs Support{/if}{#if block.flammable} &nbsp;&middot;&nbsp; Flammable{/if}</span>
									</div>
								</div>
								<div class="flex items-center gap-2">
									<!-- Edit icon -->
									<span class="pm-bp-block-edit">
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
										</svg>
									</span>
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<span class="pm-bp-block-delete" onclick={(e: MouseEvent) => { e.stopPropagation(); handleDeleteBlockFromProfile(blockIdx); }} title={t('pm.deleteBtn')}>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
										</svg>
									</span>
								</div>
							</button>
						{/each}

						{#if selectedBlockProfile.blocks.length === 0}
							<div class="pm-empty">{t('pm.cbEmptyHint')}</div>
						{/if}
					</div>

					<!-- Actions -->
					<div class="pm-detail-actions" style="justify-content: flex-end;">
						<button class="pm-btn pm-btn-primary" onclick={() => openIOModal('export', 'blockProfiles')} disabled={selectedBlockProfile.blocks.length === 0}>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
							</svg>
							{t('pm.exportOne')}
						</button>
						<button class="pm-btn pm-btn-ghost" onclick={() => handleDeleteBlockProfile(bpSelectedIdx)}>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
							</svg>
							{t('pm.deleteBtn')}
						</button>
					</div>
				{:else}
					<!-- No profile selected -->
					<div class="pm-no-selection">
						<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--color-muted)] opacity-30">
							<path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
						</svg>
						<p class="text-sm text-[var(--color-muted)]">{t('pm.cbSelectHint')}</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- ── Block Add/Edit Overlay Modal ── -->
		{#if bpBlockModalOpen}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="pm-overlay" onclick={closeBlockModal}>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="pm-overlay-card" onclick={(e: MouseEvent) => e.stopPropagation()}>
					<!-- Header -->
					<div class="pm-overlay-header">
						<h3 class="pm-detail-name">
							{bpEditingBlockIdx !== null ? t('pm.cbEditTitle') : t('pm.cbAddTitle')}
						</h3>
						<button class="pm-close-btn" onclick={closeBlockModal}>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
							</svg>
						</button>
					</div>

					<!-- Form -->
					<div class="pm-overlay-body">
						<div class="pm-cb-form-grid">
							<!-- Block Name -->
							<div class="pm-cb-field">
								<span class="pm-cb-field-label">{t('custom.blockName')}</span>
								<div class="pm-cb-name-group">
									<span class="pm-cb-name-prefix">minecraft:</span>
									<input
										type="text"
										class="pm-cb-input pm-cb-name-input"
										bind:value={cbBlockName}
										placeholder={t('custom.placeholder')}
									/>
								</div>
							</div>

							<!-- Colour Set -->
							<div class="pm-cb-field">
								<span class="pm-cb-field-label">{t('custom.colourSet')}</span>
								<div class="flex items-center gap-2">
									<div class="pm-cb-colour-preview" style="background: {getColourBg(cbColourSetId)};"></div>
									<select
										class="pm-cb-select flex-1"
										style="background-color: {getColourBg(cbColourSetId)}; color: {getColourText(cbColourSetId)};"
										bind:value={cbColourSetId}
									>
										{#each Object.entries(app.coloursJSON as ColoursJSON) as [csId, cs]}
											<option
												value={csId}
												style="background-color: rgb({cs.tonesRGB.normal.join(', ')}); color: {cs.tonesRGB.normal[0] * 0.299 + cs.tonesRGB.normal[1] * 0.587 + cs.tonesRGB.normal[2] * 0.114 > 186 ? 'black' : 'white'};"
											>
												{cs.colourName}
											</option>
										{/each}
									</select>
								</div>
							</div>

							<!-- NBT Tags -->
							<div class="pm-cb-field">
								<span class="pm-cb-field-label">{t('custom.nbtTags')}</span>
								<div class="space-y-1">
									{#each cbNbtTags as [tagKey, tagValue], i}
										<div class="grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-1">
											<input type="text" class="pm-cb-input" value={tagKey} oninput={(e) => onNbtTagChange(i, 0, (e.target as HTMLInputElement).value)} placeholder={t('custom.key')} />
											<span class="text-xs text-[var(--color-muted)]">:</span>
											<input type="text" class="pm-cb-input" value={tagValue} oninput={(e) => onNbtTagChange(i, 1, (e.target as HTMLInputElement).value)} placeholder={t('custom.value')} />
										</div>
									{/each}
								</div>
							</div>

							<!-- Checkboxes -->
							<div class="pm-cb-field">
								<span class="pm-cb-field-label">{t('pm.cbProperties')}</span>
								<div class="flex flex-wrap gap-4">
									<label class="flex items-center gap-1.5 text-xs text-[var(--color-text)]">
										<input type="checkbox" class="accent-[var(--color-primary)]" bind:checked={cbNeedsSupport} />
										{t('custom.needsSupport')}
									</label>
									<label class="flex items-center gap-1.5 text-xs text-[var(--color-text)]">
										<input type="checkbox" class="accent-[var(--color-primary)]" bind:checked={cbFlammable} />
										{t('custom.flammable')}
									</label>
								</div>
							</div>

							<!-- Versions -->
							<div class="pm-cb-field">
								<span class="pm-cb-field-label">{t('custom.versions')}</span>
								<div class="flex flex-wrap gap-x-3 gap-y-1">
									{#each Object.entries(supportedVersions) as [svKey, svVal]}
										<label class="flex items-center gap-1 text-xs text-[var(--color-text)]">
											<input type="checkbox" class="accent-[var(--color-primary)]" checked={cbVersions[svKey]} onchange={() => (cbVersions[svKey] = !cbVersions[svKey])} />
											{svVal.MCVersion}
										</label>
									{/each}
								</div>
							</div>
						</div>
					</div>

					<!-- Footer -->
					<div class="pm-overlay-footer">
						<button class="pm-btn pm-btn-primary" onclick={handleSaveBlock}>
							{bpEditingBlockIdx !== null ? t('pm.cbSaveEdit') : t('custom.addBlock')}
						</button>
						<button class="pm-btn pm-btn-ghost" onclick={closeBlockModal}>
							{t('pm.cancelBtn')}
						</button>
					</div>
				</div>
			</div>
		{/if}

		{/if}

		<!-- ── Import/Export Modal ── -->
		{#if ioModalOpen}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="pm-overlay" onclick={closeIOModal}>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="pm-overlay-card" onclick={(e: MouseEvent) => e.stopPropagation()}>
					<!-- Header -->
					<div class="pm-overlay-header">
						<h3 class="pm-detail-name">
							{ioMode === 'export' ? t('pm.ioExportTitle') : t('pm.ioImportTitle')}
						</h3>
						<button class="pm-close-btn" onclick={closeIOModal} title="Close">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
							</svg>
						</button>
					</div>

					<!-- Body -->
					<div class="pm-overlay-body">
						<!-- Format selector -->
						<div class="pm-io-format-row">
							<span class="pm-cb-field-label">{t('pm.ioFormat')}</span>
							<div class="pm-io-format-btns">
								<button
									class="pm-io-format-btn"
									class:active={ioFormat === 'base64'}
									onclick={() => { ioFormat = 'base64'; if (ioMode === 'export') generateExportText(); }}
								>Base64</button>
								<button
									class="pm-io-format-btn"
									class:active={ioFormat === 'json'}
									onclick={() => { ioFormat = 'json'; if (ioMode === 'export') generateExportText(); }}
								>JSON</button>
							</div>
						</div>

						{#if ioMode === 'export'}
							<!-- Export: show text + copy -->
							<textarea
								class="pm-io-textarea"
								readonly
								value={ioExportText}
								onclick={(e) => (e.target as HTMLTextAreaElement).select()}
							></textarea>
						{:else}
							<!-- Import: paste or file -->
							<textarea
								class="pm-io-textarea"
								bind:value={ioImportText}
								placeholder={ioFormat === 'base64' ? t('pm.ioPasteBase64') : t('pm.ioPasteJSON')}
							></textarea>
							<button class="pm-btn pm-btn-ghost pm-btn-sm" style="margin-top: 6px;" onclick={handleIOFileImport}>
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
								</svg>
								{t('pm.ioLoadFile')}
							</button>
						{/if}
					</div>

					<!-- Footer -->
					<div class="pm-overlay-footer">
						{#if ioMode === 'export'}
							<button class="pm-btn {ioFormat === 'base64' ? 'pm-btn-primary' : 'pm-btn-ghost'}" onclick={handleIOCopy}>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
								</svg>
								{ioCopied ? t('pm.copied') : t('pm.ioCopy')}
							</button>
							<button class="pm-btn {ioFormat === 'json' ? 'pm-btn-primary' : 'pm-btn-ghost'}" onclick={handleIODownload}>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
								</svg>
								{t('pm.ioDownload')}
							</button>
						{:else}
							<button class="pm-btn pm-btn-primary" onclick={handleIOImport} disabled={!ioImportText.trim()}>
								{t('pm.ioImportBtn')}
							</button>
						{/if}
						<button class="pm-btn pm-btn-ghost" style="margin-left: auto;" onclick={closeIOModal}>
							{t('pm.cancelBtn')}
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</dialog>

<style>
	.pm-dialog {
		padding: 0;
		border: none;
		border-radius: 14px;
		background: var(--color-bg-card);
		color: var(--color-text);
		max-width: 860px;
		width: 92vw;
		max-height: 82vh;
		overflow: visible;
		margin: auto;
		position: fixed;
		inset: 0;
		height: fit-content;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
	}

	.pm-dialog::backdrop {
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
	}

	.pm-container {
		display: flex;
		flex-direction: column;
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: 14px;
		overflow: hidden;
		max-height: 82vh;
		position: relative;
	}

	.pm-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 18px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.pm-close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
		transition: all 0.15s;
	}

	.pm-close-btn:hover {
		background: var(--color-surface);
		color: var(--color-text);
	}

	.pm-body {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	/* ── Sidebar ── */
	.pm-sidebar {
		display: flex;
		flex-direction: column;
		width: 260px;
		flex-shrink: 0;
		border-right: 1px solid var(--color-border);
		background: var(--color-bg);
	}

	.pm-search {
		position: relative;
		padding: 10px 12px;
		border-bottom: 1px solid var(--color-border);
	}

	.pm-search-icon {
		position: absolute;
		left: 20px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--color-muted);
		pointer-events: none;
	}

	.pm-search-input {
		width: 100%;
		padding: 6px 8px 6px 28px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: var(--color-bg-input);
		color: var(--color-text);
		font-size: 12px;
		outline: none;
		transition: border-color 0.15s;
	}

	.pm-search-input:focus {
		border-color: var(--color-primary);
	}

	.pm-list {
		flex: 1;
		overflow-y: auto;
		padding: 6px;
	}

	.pm-list-item {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 8px 10px;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 12px;
		cursor: pointer;
		transition: all 0.12s;
		text-align: left;
	}

	.pm-list-item:hover {
		background: var(--color-surface);
		color: var(--color-text);
	}

	.pm-list-item.active {
		background: color-mix(in srgb, var(--color-primary) 15%, transparent);
		color: var(--color-text);
		border-left: 2px solid var(--color-primary);
	}

	.pm-list-item-info {
		display: flex;
		flex-direction: column;
		gap: 1px;
		flex: 1;
		min-width: 0;
	}

	.pm-list-item-name {
		font-weight: 600;
		font-size: 13px;
		color: inherit;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pm-list-item-date {
		font-size: 10px;
		color: var(--color-muted);
	}

	.pm-list-item-badges {
		display: flex;
		gap: 4px;
		margin-top: 2px;
	}

	.pm-list-item-actions {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
		margin-left: auto;
	}

	.pm-list-item:hover .pm-list-item-actions {
		/* always visible */
	}

	.pm-list-item-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 4px;
		cursor: pointer;
		color: var(--color-primary);
		transition: all 0.12s;
	}

	.pm-list-item-btn:hover {
		background: color-mix(in srgb, var(--color-primary) 15%, transparent);
	}

	.pm-badge {
		padding: 1px 5px;
		border-radius: 3px;
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		color: var(--color-primary);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.pm-rename-input {
		width: 100%;
		padding: 4px 6px;
		border: 1px solid var(--color-primary);
		border-radius: 4px;
		background: var(--color-bg-input);
		color: var(--color-text);
		font-size: 13px;
		font-weight: 600;
		outline: none;
	}

	.pm-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		color: var(--color-muted);
		font-size: 12px;
	}

	.pm-sidebar-actions {
		padding: 8px;
		border-top: 1px solid var(--color-border);
		display: flex;
		gap: 4px;
	}

	.pm-action-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 6px 8px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 11px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}

	.pm-action-btn:hover {
		background: var(--color-surface);
		color: var(--color-text);
	}

	.pm-action-btn.pm-action-primary {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: white;
	}

	.pm-action-btn.pm-action-primary:hover {
		opacity: 0.9;
	}

	/* ── Detail ── */
	.pm-detail {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow-y: auto;
		padding: 16px 20px;
		gap: 14px;
	}

	.pm-detail-header {
		display: flex;
		align-items: baseline;
		gap: 12px;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--color-border);
	}

	.pm-detail-name {
		font-size: 18px;
		font-weight: 700;
		color: var(--color-text);
		margin: 0;
	}

	.pm-detail-date {
		font-size: 11px;
		color: var(--color-muted);
	}

	.pm-settings-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
	}

	.pm-settings-section {
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 10px 12px;
		transition: opacity 0.15s;
	}

	.pm-settings-section-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-primary);
		margin: 0 0 8px 0;
	}

	.pm-section-lock-indicator {
		color: var(--color-danger);
		opacity: 0.7;
		flex-shrink: 0;
	}

	.pm-section-edit-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 4px;
		cursor: pointer;
		margin-left: auto;
		color: var(--color-muted);
		transition: all 0.15s;
	}

	.pm-section-edit-btn:hover {
		background: color-mix(in srgb, var(--color-primary) 15%, transparent);
		color: var(--color-primary);
	}

	.pm-section-lock-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 4px;
		cursor: pointer;
		color: var(--color-muted);
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.pm-section-lock-btn:hover {
		background: color-mix(in srgb, var(--color-primary) 15%, transparent);
		color: var(--color-primary);
	}

	.pm-section-lock-btn.locked {
		color: var(--color-danger);
		background: color-mix(in srgb, var(--color-danger) 10%, transparent);
	}

	.pm-section-lock-btn.partial {
		color: var(--color-warning, #f59e0b);
		opacity: 0.8;
	}

	/* ── Section Edit Modal ── */
	.pm-section-edit-card {
		max-width: 480px;
	}

	.pm-section-edit-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.pm-field-edit-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border-radius: 6px;
		transition: background 0.12s;
	}

	.pm-field-edit-row:hover {
		background: color-mix(in srgb, var(--color-primary) 5%, transparent);
	}

	.pm-field-edit-row.pm-field-locked {
		opacity: 0.5;
	}

	.pm-field-edit-label {
		flex: 0 0 140px;
		font-size: 12px;
		font-weight: 600;
		color: var(--color-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pm-field-edit-value {
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.pm-field-input {
		width: 100%;
		padding: 4px 8px;
		font-size: 12px;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		background: var(--color-bg);
		color: var(--color-text);
		outline: none;
		transition: border-color 0.15s;
	}

	.pm-field-input:focus {
		border-color: var(--color-primary);
	}

	.pm-field-readonly {
		font-size: 12px;
		color: var(--color-muted);
		font-style: italic;
	}

	.pm-field-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		font-size: 12px;
		color: var(--color-text);
	}

	.pm-field-toggle input[type="checkbox"] {
		accent-color: var(--color-primary);
	}

	.pm-field-lock-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 4px;
		cursor: pointer;
		color: var(--color-muted);
		flex-shrink: 0;
		transition: all 0.15s;
	}

	.pm-field-lock-btn:hover {
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
		color: var(--color-primary);
	}

	.pm-field-lock-btn.locked {
		color: var(--color-danger);
		background: color-mix(in srgb, var(--color-danger) 10%, transparent);
	}

	/* Select dropdown */
	.pm-field-select {
		width: 100%;
		padding: 5px 8px;
		font-size: 12px;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		background: var(--color-bg);
		color: var(--color-text);
		outline: none;
		cursor: pointer;
		transition: border-color 0.15s;
	}

	.pm-field-select:focus {
		border-color: var(--color-primary);
	}

	/* Toggle switch */
	.pm-field-switch {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 600;
		color: var(--color-muted);
		user-select: none;
	}

	.pm-field-switch.active {
		color: var(--color-primary);
	}

	.pm-field-switch-track {
		width: 32px;
		height: 18px;
		border-radius: 9px;
		background: var(--color-border);
		position: relative;
		transition: background 0.2s;
		flex-shrink: 0;
	}

	.pm-field-switch.active .pm-field-switch-track {
		background: var(--color-primary);
	}

	.pm-field-switch-thumb {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: white;
		position: absolute;
		top: 2px;
		left: 2px;
		transition: transform 0.2s;
	}

	.pm-field-switch.active .pm-field-switch-thumb {
		transform: translateX(14px);
	}

	/* Range slider */
	.pm-field-range-wrap {
		display: flex;
		align-items: center;
		gap: 6px;
		overflow: hidden;
	}

	.pm-field-range {
		flex: 1;
		min-width: 0;
		height: 4px;
		accent-color: var(--color-primary);
		cursor: pointer;
	}

	.pm-field-range-value {
		font-size: 10px;
		font-weight: 600;
		color: var(--color-text);
		min-width: 32px;
		max-width: 48px;
		text-align: right;
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Color picker */
	.pm-field-color-wrap {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.pm-field-color {
		width: 28px;
		height: 28px;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 1px;
		cursor: pointer;
		background: none;
	}

	.pm-field-color-label {
		font-size: 11px;
		color: var(--color-muted);
		font-family: monospace;
	}

	.pm-setting-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 3px 0;
		font-size: 12px;
		gap: 4px;
	}

	.pm-setting-row.pm-setting-locked {
		opacity: 0.45;
		text-decoration: line-through;
	}

	.pm-setting-row.pm-setting-indent {
		padding-left: 12px;
	}

	.pm-setting-label {
		color: var(--color-muted);
	}

	.pm-setting-value {
		color: var(--color-text);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		text-align: right;
		max-width: 60%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* ── Action buttons ── */
	.pm-detail-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding-top: 10px;
		border-top: 1px solid var(--color-border);
	}

	.pm-actions-divider {
		width: 1px;
		align-self: stretch;
		background: var(--color-border);
	}

	.pm-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 6px 12px;
		border: none;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		white-space: nowrap;
	}

	.pm-btn-primary {
		background: var(--color-primary);
		color: white;
	}

	.pm-btn-primary:hover {
		opacity: 0.9;
	}

	.pm-btn-sm {
		padding: 4px 10px;
		font-size: 0.72rem;
		gap: 4px;
	}

	.pm-btn-secondary {
		background: var(--color-surface);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.pm-btn-secondary:hover {
		background: var(--color-bg);
	}

	.pm-btn-danger-solid {
		background: var(--color-danger);
		color: white;
	}

	.pm-btn-danger-solid:hover {
		opacity: 0.9;
	}

	.pm-btn-ghost {
		background: transparent;
		color: var(--color-text-muted);
		border: 1px solid var(--color-border);
	}

	.pm-btn-ghost:hover {
		background: var(--color-surface);
		color: var(--color-text);
	}

	.pm-no-selection {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
	}

	/* ── Responsive ── */
	@media (max-width: 640px) {
		.pm-body {
			flex-direction: column;
		}

		.pm-sidebar {
			width: 100%;
			max-height: 35vh;
			border-right: none;
			border-bottom: 1px solid var(--color-border);
		}

		.pm-settings-grid {
			grid-template-columns: 1fr;
		}

		.pm-header-tabs {
			display: none;
		}
	}

	/* ── Header Tabs ── */
	.pm-header-tabs {
		display: flex;
		gap: 2px;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 2px;
	}

	.pm-header-tab {
		display: flex;
		align-items: center;
		gap: 5px;
		padding: 5px 12px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		white-space: nowrap;
	}

	.pm-header-tab:hover {
		color: var(--color-text);
		background: var(--color-surface);
	}

	.pm-header-tab.active {
		background: var(--color-primary);
		color: white;
	}

	.pm-tab-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: 8px;
		background: color-mix(in srgb, currentColor 20%, transparent);
		font-size: 10px;
		font-weight: 700;
		line-height: 1;
	}

	/* ── Custom Blocks Tab ── */
	.pm-cb-colour-swatch {
		width: 20px;
		height: 20px;
		border-radius: 4px;
		border: 1px solid rgba(255, 255, 255, 0.15);
		flex-shrink: 0;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}

	.pm-cb-colour-preview {
		width: 28px;
		height: 28px;
		border-radius: 6px;
		border: 2px solid rgba(255, 255, 255, 0.1);
		flex-shrink: 0;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
	}

	.pm-cb-form-grid {
		flex: 1;
		overflow-y: auto;
		padding: 4px 0;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.pm-cb-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.pm-cb-field-label {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-muted);
	}

	.pm-cb-input {
		width: 100%;
		padding: 6px 10px;
		font-size: 12px;
		color: var(--color-text);
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		outline: none;
		transition: border-color 0.15s;
		box-sizing: border-box;
	}

	.pm-cb-input:focus {
		border-color: var(--color-primary);
	}

	.pm-cb-name-group {
		display: flex;
		align-items: stretch;
	}

	.pm-cb-name-prefix {
		display: flex;
		align-items: center;
		padding: 0 8px;
		font-size: 12px;
		color: var(--color-muted);
		background: color-mix(in srgb, var(--color-bg) 80%, var(--color-border));
		border: 1px solid var(--color-border);
		border-right: none;
		border-radius: 6px 0 0 6px;
		flex-shrink: 0;
		white-space: nowrap;
	}

	.pm-cb-name-input {
		border-radius: 0 6px 6px 0 !important;
		flex: 1;
		min-width: 0;
	}

	.pm-cb-select {
		padding: 6px 10px;
		font-size: 12px;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		outline: none;
		cursor: pointer;
	}

	.pm-cb-select:focus {
		border-color: var(--color-primary);
	}

	.pm-badge-warn {
		background: color-mix(in srgb, #e8722e 15%, transparent);
		color: #e8722e;
	}

	.pm-badge-support {
		background: color-mix(in srgb, #d4a017 15%, transparent);
		color: #d4a017;
	}

	.pm-bp-rename-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 4px;
		color: var(--color-primary);
		cursor: pointer;
		flex-shrink: 0;
		margin-left: auto;
		transition: all 0.15s;
	}

	.pm-bp-rename-btn:hover {
		background: color-mix(in srgb, var(--color-primary) 15%, transparent);
	}

	/* ON/OFF tag next to profile name */
	.pm-list-item-name-row {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.pm-bp-tag {
		display: inline-flex;
		align-items: center;
		font-size: 0.6rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 1px 6px;
		border-radius: 4px;
		line-height: 1;
		flex-shrink: 0;
	}

	.pm-bp-tag-on {
		background: color-mix(in srgb, var(--color-primary) 18%, transparent);
		color: var(--color-primary);
	}

	.pm-bp-tag-more {
		background: color-mix(in srgb, var(--color-muted) 15%, transparent);
		color: var(--color-muted);
	}

	/* ── Block Profiles block list ── */
	.pm-bp-block-list {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.pm-bp-block-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 10px;
		border-radius: 6px;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		gap: 8px;
		cursor: pointer;
		text-align: left;
		width: 100%;
		font-family: inherit;
		font-size: inherit;
		color: inherit;
		transition: all 0.12s;
	}

	.pm-bp-block-item:hover {
		background: var(--color-bg);
	}

	.pm-bp-block-item:hover .pm-bp-block-delete {
		color: var(--color-danger);
	}

	.pm-bp-block-delete {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 4px;
		border: none;
		background: transparent;
		color: var(--color-danger);
		cursor: pointer;
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.pm-bp-block-delete:hover {
		background: color-mix(in srgb, var(--color-danger) 15%, transparent);
	}

	.pm-bp-block-edit {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border-radius: 4px;
		color: var(--color-muted);
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.pm-bp-block-item:hover .pm-bp-block-edit {
		color: var(--color-primary);
	}

	.pm-bp-block-edit:hover {
		color: var(--color-primary);
	}

	/* ── Overlay Modal ── */
	.pm-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(2px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1100;
	}

	.pm-overlay-card {
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		width: 460px;
		max-width: 90%;
		max-height: 80%;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		overflow: hidden;
	}

	.pm-overlay-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 18px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.pm-overlay-body {
		flex: 1;
		overflow-y: auto;
		padding: 16px 18px;
	}

	.pm-overlay-footer {
		display: flex;
		gap: 6px;
		padding: 12px 18px;
		border-top: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	/* ── I/O Modal ── */
	.pm-io-format-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}

	.pm-io-format-btns {
		display: flex;
		gap: 0;
		border: 1px solid var(--color-border);
		border-radius: 6px;
		overflow: hidden;
	}

	.pm-io-format-btn {
		padding: 4px 14px;
		font-size: 12px;
		font-weight: 600;
		background: var(--color-surface);
		color: var(--color-muted);
		border: none;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}

	.pm-io-format-btn:not(:last-child) {
		border-right: 1px solid var(--color-border);
	}

	.pm-io-format-btn.active {
		background: var(--color-primary);
		color: white;
	}

	.pm-io-textarea {
		width: 100%;
		min-height: 140px;
		max-height: 260px;
		padding: 10px 12px;
		font-size: 11px;
		font-family: monospace;
		color: var(--color-text);
		background: color-mix(in srgb, var(--color-bg-card) 25%, black);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		outline: none;
		resize: vertical;
		box-sizing: border-box;
		word-break: break-all;
	}

	.pm-io-textarea:focus {
		border-color: var(--color-primary);
	}
</style>
