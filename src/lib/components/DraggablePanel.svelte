<script lang="ts">
	import { layoutStore } from '$lib/stores/layoutStore.svelte.js';
	import type { PanelMeta } from './PanelRegistry.svelte.js';

	interface Props {
		panelId: string;
		meta: PanelMeta;
		children: import('svelte').Snippet;
	}

	let { panelId, meta, children }: Props = $props();

	let isDragging = $state(false);

	function handleDragStart(e: DragEvent) {
		if (!e.dataTransfer) return;
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', panelId);
		layoutStore.dragging = panelId;
		isDragging = true;

		requestAnimationFrame(() => {
			isDragging = true;
		});
	}

	function handleDragEnd() {
		layoutStore.dragging = null;
		isDragging = false;
	}
</script>

<div
	class="draggable-panel group relative"
	class:dragging={isDragging}
>
	<!-- Grip handle — overlaid on the panel's header area -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="grip-handle"
		draggable="true"
		ondragstart={handleDragStart}
		ondragend={handleDragEnd}
		title="Drag to move panel"
	>
		<svg viewBox="0 0 24 24" fill="currentColor" class="grip-dots" aria-hidden="true">
			<circle cx="8" cy="4" r="2" />
			<circle cx="16" cy="4" r="2" />
			<circle cx="8" cy="12" r="2" />
			<circle cx="16" cy="12" r="2" />
			<circle cx="8" cy="20" r="2" />
			<circle cx="16" cy="20" r="2" />
		</svg>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="grip-icon" aria-hidden="true">
			<path d={meta.icon} />
		</svg>
	</div>

	<!-- Panel content -->
	{@render children()}
</div>

<style>
	.draggable-panel {
		transition: opacity 0.2s, transform 0.2s;
	}
	.draggable-panel.dragging {
		opacity: 0.35;
		transform: scale(0.98);
	}

	/* Grip handle — sits in the panel header area */
	.grip-handle {
		position: absolute;
		left: 8px;
		top: calc(var(--layout-panel-padding, 16px) + 10px);
		transform: translateY(-50%);
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 3px;
		font-size: 0.875rem;
		line-height: 1;
		cursor: grab;
		padding: 2px 3px;
		border-radius: 3px;
		color: var(--color-muted);
		opacity: 0.45;
		transition: opacity 0.15s, background-color 0.15s, color 0.15s;
	}
	.grip-handle:active {
		cursor: grabbing;
	}
	.grip-handle:hover {
		opacity: 1;
		background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
		color: var(--color-primary);
	}

	.grip-dots {
		flex-shrink: 0;
		width: 0.9em;
		height: 0.9em;
		display: block;
	}
	.grip-icon {
		flex-shrink: 0;
		width: 0.9em;
		height: 0.9em;
		display: block;
		opacity: 0.7;
	}
</style>
