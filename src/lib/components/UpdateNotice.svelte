<script lang="ts">
	import { onMount } from 'svelte';
	import { locale } from '$lib/stores/locale.svelte.js';
	import { infoModal } from '$lib/stores/infoModal.svelte.js';
	import changelog from '$lib/data/changelog.js';

	const t = locale.t;
	const VERSION_KEY = 'mapartcraft_last_version';
	const BETA_KEY = 'mapartcraft_beta_notice_dismissed';

	/** Current version = first entry in the changelog array */
	const currentVersion = changelog[0]?.version ?? '';

	let show = $state(false);
	let dialogEl: HTMLDialogElement | undefined = $state(undefined);

	onMount(() => {
		const stored = localStorage.getItem(VERSION_KEY);

		if (!stored) {
			// First visit ever — silently store version, don't show
			// (BetaNotice already appears on first visit)
			localStorage.setItem(VERSION_KEY, currentVersion);
			return;
		}

		if (stored !== currentVersion && currentVersion) {
			// Version changed — but only show AFTER beta notice is done
			// Wait a tick so BetaNotice can claim the dialog slot first
			const betaDismissed = localStorage.getItem(BETA_KEY);
			if (betaDismissed) {
				// Beta already seen — show update notice immediately
				show = true;
			} else {
				// Beta notice is still pending — wait for it to be dismissed
				// Poll localStorage until beta is dismissed (BetaNotice writes to it on dismiss)
				const interval = setInterval(() => {
					if (localStorage.getItem(BETA_KEY)) {
						clearInterval(interval);
						// Small delay so the beta dialog closes visually first
						setTimeout(() => { show = true; }, 300);
					}
				}, 200);
				// Safety: stop polling after 60s
				setTimeout(() => clearInterval(interval), 60_000);
			}
		}
	});

	$effect(() => {
		if (show && dialogEl) {
			dialogEl.showModal();
		}
	});

	function dismiss() {
		localStorage.setItem(VERSION_KEY, currentVersion);
		show = false;
		dialogEl?.close();
	}

	function viewChangelog() {
		localStorage.setItem(VERSION_KEY, currentVersion);
		show = false;
		dialogEl?.close();
		infoModal.openTab('changelog');
	}
</script>

{#if show}
<dialog
	bind:this={dialogEl}
	class="update-dialog"
	onkeydown={(e) => { if (e.key === 'Escape') { e.preventDefault(); dismiss(); } }}
>
	<div class="update-content">
		<!-- Icon — document/list -->
		<div class="update-icon">
			<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
				<polyline points="14 2 14 8 20 8" />
				<line x1="16" y1="13" x2="8" y2="13" />
				<line x1="16" y1="17" x2="8" y2="17" />
				<polyline points="10 9 9 9 8 9" />
			</svg>
		</div>

		<h2 class="update-title">{t('update.title')}</h2>

		<p class="update-version">v{currentVersion}</p>

		<p class="update-text">{t('update.message')}</p>

		<div class="update-actions">
			<button class="update-btn update-btn-primary" onclick={viewChangelog}>
				{t('update.viewChangelog')}
			</button>
			<button class="update-btn update-btn-secondary" onclick={dismiss}>
				{t('update.skip')}
			</button>
		</div>
	</div>
</dialog>
{/if}

<style>
	.update-dialog {
		padding: 0;
		border: 1px solid var(--color-border);
		border-radius: 12px;
		background: var(--color-bg-card);
		color: var(--color-text);
		max-width: 380px;
		width: 90vw;
		margin: auto;
		position: fixed;
		inset: 0;
		height: fit-content;
		overflow: visible;
	}

	.update-dialog::backdrop {
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
	}

	.update-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 28px 24px 24px;
		text-align: center;
	}

	.update-icon {
		color: var(--color-primary);
		margin-bottom: 12px;
	}

	.update-title {
		font-size: 1.2rem;
		font-weight: 700;
		margin: 0 0 4px;
		color: var(--color-text);
	}

	.update-version {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--color-primary);
		margin: 0 0 12px;
		font-family: monospace;
	}

	.update-text {
		font-size: 0.85rem;
		color: var(--color-muted);
		margin: 0 0 20px;
		line-height: 1.5;
	}

	.update-actions {
		display: flex;
		gap: 10px;
		width: 100%;
		justify-content: center;
	}

	.update-btn {
		padding: 10px 24px;
		border: none;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s, opacity 0.15s;
	}

	.update-btn-primary {
		background: var(--color-primary);
		color: #fff;
	}

	.update-btn-primary:hover {
		background: var(--color-primary-hover);
	}

	.update-btn-secondary {
		background: var(--color-border);
		color: var(--color-text);
	}

	.update-btn-secondary:hover {
		opacity: 0.8;
	}
</style>
