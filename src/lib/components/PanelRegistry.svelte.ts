/**
 * Panel registry — maps panel IDs to their Svelte components and metadata.
 *
 * Used by DockZone to dynamically render panels based on layout store.
 */
import type { Component } from 'svelte';

import FilePanel from '$lib/components/FilePanel.svelte';
import MapPanel from '$lib/components/MapPanel.svelte';
import ImageSettings from '$lib/components/ImageSettings.svelte';
import PreProcessingSettings from '$lib/components/PreProcessingSettings.svelte';
import ProcessingSettings from '$lib/components/ProcessingSettings.svelte';
import MapPreview from '$lib/components/MapPreview.svelte';
import BlockSelection from '$lib/components/BlockSelection.svelte';
import ExportPanel from '$lib/components/ExportPanel.svelte';
import Materials from '$lib/components/Materials.svelte';

export interface PanelMeta {
	component: Component;
	label: string;
	/** Icon SVG path (d attribute for a 24x24 viewBox) */
	icon: string;
}

export const panelRegistry: Record<string, PanelMeta> = {
	filePanel: {
		component: FilePanel,
		label: 'File',
		icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6',
	},
	mapPanel: {
		component: MapPanel,
		label: 'Map',
		icon: 'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z M8 2v16 M16 6v16',
	},
	imageSettings: {
		component: ImageSettings,
		label: 'Image',
		icon: 'M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2 1.586-1.586a2 2 0 0 1 2.828 0L20 14M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z',
	},
	preProcessingSettings: {
		component: PreProcessingSettings,
		label: 'Pre-Process',
		icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
	},
	processingSettings: {
		component: ProcessingSettings,
		label: 'Processing',
		icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
	},
	mapPreview: {
		component: MapPreview,
		label: 'Preview',
		icon: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
	},
	blockSelection: {
		component: BlockSelection,
		label: 'Blocks',
		icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
	},
	exportPanel: {
		component: ExportPanel,
		label: 'Export',
		icon: 'M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
	},
	materials: {
		component: Materials,
		label: 'Materials',
		icon: 'M19 11H5m14 0a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2m14 0V9a2 2 0 0 0-2-2M5 11V9a2 2 0 0 1 2-2m0 0V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2M7 7h10',
	},
};
