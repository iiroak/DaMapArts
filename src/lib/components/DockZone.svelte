<script lang="ts">
	import { layoutStore, type Zone } from '$lib/stores/layoutStore.svelte.js';
	import { panelRegistry } from './PanelRegistry.svelte.js';
	import DraggablePanel from './DraggablePanel.svelte';

	interface Props {
		zone: Zone;
		panelIds: string[];
		class?: string;
	}

	let { zone, panelIds, class: className = '' }: Props = $props();

	/** Visible panels (filtered by hidden state) */
	let visible = $derived(panelIds.filter((id) => !layoutStore.isHidden(id)));

	/** Index where the drop indicator should show (-1 = hidden) */
	let dropIndex = $state(-1);
	let isOver = $state(false);

	function getDropIndex(e: DragEvent, container: HTMLElement): number {
		const panelEls = Array.from(container.querySelectorAll(':scope > .dock-item'));
		const y = e.clientY;

		for (let i = 0; i < panelEls.length; i++) {
			const rect = panelEls[i].getBoundingClientRect();
			const mid = rect.top + rect.height / 2;
			if (y < mid) return i;
		}

		return panelEls.length;
	}

	function handleDragOver(e: DragEvent) {
		if (!layoutStore.dragging) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		isOver = true;
		dropIndex = getDropIndex(e, e.currentTarget as HTMLElement);
	}

	function handleDragLeave(e: DragEvent) {
		// Only reset if leaving the container itself (not entering a child)
		const related = e.relatedTarget as Node | null;
		const container = e.currentTarget as HTMLElement;
		if (related && container.contains(related)) return;
		isOver = false;
		dropIndex = -1;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		const panelId = e.dataTransfer?.getData('text/plain');
		if (!panelId) return;

		const targetIdx = getDropIndex(e, e.currentTarget as HTMLElement);

		// If dropping in same zone, adjust index for removal offset
		const fromZone = layoutStore.findZone(panelId);
		let adjustedIdx = targetIdx;
		if (fromZone === zone) {
			const currentIdx = panelIds.indexOf(panelId);
			if (currentIdx < targetIdx) adjustedIdx--;
			if (currentIdx === adjustedIdx) {
				// Same position — no-op
				isOver = false;
				dropIndex = -1;
				return;
			}
		}

		layoutStore.movePanel(panelId, zone, adjustedIdx);
		isOver = false;
		dropIndex = -1;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="dock-zone {className}"
	class:dock-zone-active={isOver && layoutStore.dragging}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	{#each visible as panelId, i (panelId)}
		{@const meta = panelRegistry[panelId]}
		{#if meta}
			<!-- Drop indicator line -->
			{#if isOver && dropIndex === i}
				<div class="drop-indicator"></div>
			{/if}

			<div class="dock-item">
				<DraggablePanel {panelId} {meta}>
					<meta.component />
				</DraggablePanel>
			</div>
		{/if}
	{/each}

	<!-- Drop indicator at the end -->
	{#if isOver && dropIndex === visible.length}
		<div class="drop-indicator"></div>
	{/if}

	<!-- Empty zone placeholder -->
	{#if visible.length === 0}
		<div class="empty-zone" class:empty-zone-active={isOver && layoutStore.dragging}>
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
				<path d="M12 5v14m-7-7h14" stroke-linecap="round" />
			</svg>
			<span>Drop panels here</span>
		</div>
	{/if}
</div>

<style>
	.dock-zone {
		min-height: 60px;
		border-radius: 8px;
		transition: background-color 0.15s, box-shadow 0.15s;
		display: flex;
		flex-direction: column;
		gap: var(--layout-panel-gap, 16px);
	}
	.dock-zone-active {
		background-color: color-mix(in srgb, var(--color-primary) 6%, transparent);
		box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-primary) 20%, transparent);
		border-radius: 8px;
	}
	.drop-indicator {
		height: 3px;
		background: var(--color-primary);
		border-radius: 2px;
		margin: 2px 8px;
		opacity: 0.8;
		animation: pulse-indicator 1s ease-in-out infinite;
	}
	@keyframes pulse-indicator {
		0%, 100% { opacity: 0.6; }
		50% { opacity: 1; }
	}
	.empty-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 24px;
		border: 2px dashed var(--color-border);
		border-radius: 8px;
		color: var(--color-muted);
		font-size: 11px;
		opacity: 0.5;
		transition: opacity 0.15s, border-color 0.15s;
	}
	.empty-zone-active {
		opacity: 1;
		border-color: var(--color-primary);
		color: var(--color-primary);
	}
</style>
