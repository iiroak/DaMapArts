/**
 * Dockable layout store — persists panel arrangement across sessions.
 *
 * Manages which panels live in which zone (left / center / right)
 * and their order within each zone. Uses localStorage for persistence.
 * Also stores zone sizing, spacing preferences, and hidden panels.
 */

export type Zone = 'left' | 'center' | 'right';

export interface LayoutState {
	/** Layout version — bump to force reset on breaking changes */
	version: number;
	left: string[];
	center: string[];
	right: string[];
	/** Panel IDs that are currently hidden */
	hidden: string[];
}

export interface LayoutSizing {
	/** Left zone width in px (default 320) */
	leftWidth: number;
	/** Right zone width in px (default 280) */
	rightWidth: number;
	/** Max width of the full editor workspace in px (default 1800) */
	contentMaxWidth: number;
	/** Gap between zones in px (default 16 = gap-4) */
	zoneGap: number;
	/** Internal padding of panels in px (default 16 = p-4) */
	panelPadding: number;
	/** Gap between panels within a zone in px (default 16 = space-y-4 / gap-4) */
	panelGap: number;
}

const STORAGE_KEY = 'damaparts-layout';
const SIZING_KEY = 'damaparts-layout-sizing';

/** Bump this to force localStorage reset for all users */
const LAYOUT_VERSION = 3;

const DEFAULT_LAYOUT: LayoutState = {
	version: LAYOUT_VERSION,
	left: ['filePanel', 'mapPanel', 'imageSettings', 'preProcessingSettings', 'processingSettings'],
	center: ['mapPreview', 'blockSelection'],
	right: ['exportPanel', 'materials'],
	hidden: [],
};

const DEFAULT_SIZING: LayoutSizing = {
	leftWidth: 320,
	rightWidth: 280,
	contentMaxWidth: 1800,
	zoneGap: 16,
	panelPadding: 16,
	panelGap: 16,
};

/** All known panel IDs — used to validate persisted data */
const ALL_PANEL_IDS = new Set([
	'filePanel',
	'mapPanel',
	'imageSettings',
	'preProcessingSettings',
	'processingSettings',
	'mapPreview',
	'blockSelection',
	'exportPanel',
	'materials',
]);

function loadLayout(): LayoutState {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return structuredClone(DEFAULT_LAYOUT);

		const parsed = JSON.parse(raw) as LayoutState;

		// Version mismatch → force reset
		if (parsed.version !== LAYOUT_VERSION) {
			localStorage.removeItem(STORAGE_KEY);
			return structuredClone(DEFAULT_LAYOUT);
		}

		// Validate structure
		if (!parsed.left || !parsed.center || !parsed.right) {
			return structuredClone(DEFAULT_LAYOUT);
		}

		// Validate that all panels are present and no unknowns
		const allPanels = [...parsed.left, ...parsed.center, ...parsed.right];
		const panelSet = new Set(allPanels);

		// Check for duplicates or unknowns
		if (allPanels.length !== panelSet.size) return structuredClone(DEFAULT_LAYOUT);
		for (const id of allPanels) {
			if (!ALL_PANEL_IDS.has(id)) return structuredClone(DEFAULT_LAYOUT);
		}
		// Check all panels are accounted for
		for (const id of ALL_PANEL_IDS) {
			if (!panelSet.has(id)) return structuredClone(DEFAULT_LAYOUT);
		}

		// Validate hidden — only keep known IDs
		if (!Array.isArray(parsed.hidden)) parsed.hidden = [];
		parsed.hidden = parsed.hidden.filter((id: string) => ALL_PANEL_IDS.has(id));

		return parsed;
	} catch {
		return structuredClone(DEFAULT_LAYOUT);
	}
}

function loadSizing(): LayoutSizing {
	try {
		const raw = localStorage.getItem(SIZING_KEY);
		if (!raw) return { ...DEFAULT_SIZING };
		const parsed = JSON.parse(raw) as Partial<LayoutSizing>;
		return {
			leftWidth: typeof parsed.leftWidth === 'number' ? clamp(parsed.leftWidth, 180, 1400) : DEFAULT_SIZING.leftWidth,
			rightWidth: typeof parsed.rightWidth === 'number' ? clamp(parsed.rightWidth, 180, 1400) : DEFAULT_SIZING.rightWidth,
			contentMaxWidth: typeof parsed.contentMaxWidth === 'number' ? clamp(parsed.contentMaxWidth, 1200, 3600) : DEFAULT_SIZING.contentMaxWidth,
			zoneGap: typeof parsed.zoneGap === 'number' ? clamp(parsed.zoneGap, 0, 32) : DEFAULT_SIZING.zoneGap,
			panelPadding: typeof parsed.panelPadding === 'number' ? clamp(parsed.panelPadding, 0, 24) : DEFAULT_SIZING.panelPadding,
			panelGap: typeof parsed.panelGap === 'number' ? clamp(parsed.panelGap, 0, 32) : DEFAULT_SIZING.panelGap,
		};
	} catch {
		return { ...DEFAULT_SIZING };
	}
}

function clamp(v: number, min: number, max: number) {
	return Math.max(min, Math.min(max, v));
}

function createLayoutStore() {
	let layout = $state<LayoutState>(loadLayout());
	let sizing = $state<LayoutSizing>(loadSizing());

	/** Currently dragged panel ID (for drop indicator logic) */
	let dragging = $state<string | null>(null);

	function persist() {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify({
				version: LAYOUT_VERSION,
				left: layout.left,
				center: layout.center,
				right: layout.right,
				hidden: layout.hidden,
			}));
		} catch {
			// Storage full — silently ignore
		}
	}

	function persistSizing() {
		try {
			localStorage.setItem(SIZING_KEY, JSON.stringify(sizing));
		} catch {}
	}

	function findZone(panelId: string): Zone | null {
		if (layout.left.includes(panelId)) return 'left';
		if (layout.center.includes(panelId)) return 'center';
		if (layout.right.includes(panelId)) return 'right';
		return null;
	}

	/**
	 * Move a panel to a target zone at a specific index.
	 * If index is -1 or omitted, appends to the end.
	 */
	function movePanel(panelId: string, toZone: Zone, toIndex: number = -1) {
		const fromZone = findZone(panelId);
		if (!fromZone) return;

		// Remove from current zone
		layout[fromZone] = layout[fromZone].filter((id) => id !== panelId);

		// Insert at target
		const idx = toIndex < 0 || toIndex > layout[toZone].length ? layout[toZone].length : toIndex;
		layout[toZone] = [...layout[toZone].slice(0, idx), panelId, ...layout[toZone].slice(idx)];

		persist();
	}

	function resetLayout() {
		layout.left = [...DEFAULT_LAYOUT.left];
		layout.center = [...DEFAULT_LAYOUT.center];
		layout.right = [...DEFAULT_LAYOUT.right];
		layout.hidden = [];
		persist();
	}

	function resetSizing() {
		Object.assign(sizing, DEFAULT_SIZING);
		persistSizing();
		applySizingCSS(sizing);
	}

	/** Toggle panel visibility */
	function toggleHidden(panelId: string) {
		const idx = layout.hidden.indexOf(panelId);
		if (idx >= 0) {
			layout.hidden = layout.hidden.filter((id) => id !== panelId);
		} else {
			layout.hidden = [...layout.hidden, panelId];
		}
		persist();
	}

	function isHidden(panelId: string): boolean {
		return layout.hidden.includes(panelId);
	}

	/** Get visible panels for a zone (filters out hidden ones) */
	function visiblePanels(zone: Zone): string[] {
		return layout[zone].filter((id) => !layout.hidden.includes(id));
	}

	/** Apply sizing as CSS custom properties on :root */
	function applySizingCSS(s: LayoutSizing) {
		const root = document.documentElement.style;
		root.setProperty('--layout-left-width', `${s.leftWidth}px`);
		root.setProperty('--layout-right-width', `${s.rightWidth}px`);
		root.setProperty('--layout-content-max-width', `${s.contentMaxWidth}px`);
		root.setProperty('--layout-zone-gap', `${s.zoneGap}px`);
		root.setProperty('--layout-panel-padding', `${s.panelPadding}px`);
		root.setProperty('--layout-panel-gap', `${s.panelGap}px`);
	}

	function updateSizing(key: keyof LayoutSizing, value: number) {
		sizing[key] = value;
		persistSizing();
		applySizingCSS(sizing);
	}

	/** Must be called once on mount to set initial CSS vars */
	function initSizingCSS() {
		applySizingCSS(sizing);
	}

	return {
		get left() { return layout.left; },
		get center() { return layout.center; },
		get right() { return layout.right; },
		get hidden() { return layout.hidden; },
		get dragging() { return dragging; },
		set dragging(val: string | null) { dragging = val; },
		get sizing() { return sizing; },
		movePanel,
		resetLayout,
		resetSizing,
		updateSizing,
		initSizingCSS,
		findZone,
		toggleHidden,
		isHidden,
		visiblePanels,
		get allPanelIds() { return ALL_PANEL_IDS; },
	};
}

export const layoutStore = createLayoutStore();
