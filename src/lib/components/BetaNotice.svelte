<script lang="ts">
	import { onMount } from 'svelte';
	import { locale } from '$lib/stores/locale.svelte.js';

	const t = locale.t;
	const BETA_NOTICE_KEY = 'mapartcraft_beta_notice_dismissed';
	const SKIP_CHECK = false; // Set to true to always show the notice (debug)

	let show = $state(false);
	let dialogEl: HTMLDialogElement | undefined = $state(undefined);

	onMount(() => {
		if (SKIP_CHECK || !localStorage.getItem(BETA_NOTICE_KEY)) {
			show = true;
		}
	});

	$effect(() => {
		if (show && dialogEl) {
			dialogEl.showModal();
		}
	});

	function dismiss() {
		localStorage.setItem(BETA_NOTICE_KEY, 'true');
		show = false;
		dialogEl?.close();
	}
</script>

{#if show}
<dialog
	bind:this={dialogEl}
	class="beta-dialog"
	onkeydown={(e) => { if (e.key === 'Escape') { e.preventDefault(); dismiss(); } }}
>
	<div class="beta-content">
		<!-- Icon -->
		<div class="beta-icon">
			<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
				<line x1="12" y1="9" x2="12" y2="13" />
				<line x1="12" y1="17" x2="12.01" y2="17" />
			</svg>
		</div>

		<h2 class="beta-title">{t('beta.title')}</h2>

		<p class="beta-text">
			{@html t('beta.message1')}
		</p>

		<p class="beta-text">
			{t('beta.message2')}
		</p>

		<div class="beta-links">
			<a href="https://github.com/iiroaK" target="_blank" rel="noopener noreferrer" class="beta-link beta-link-github">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
					<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
				</svg>
				<span>{t('beta.github')}</span>
			</a>
			<a href="https://discord.gg/damaparts" target="_blank" rel="noopener noreferrer" class="beta-link beta-link-discord">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
					<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z"/>
				</svg>
				<span>{t('beta.discord')}</span>
			</a>
		</div>

		<button class="beta-dismiss" onclick={dismiss}>
			{t('beta.dismiss')}
		</button>
	</div>
</dialog>
{/if}

<style>
	.beta-dialog {
		padding: 0;
		border: none;
		border-radius: 12px;
		background: var(--color-bg-card);
		color: var(--color-text);
		max-width: 420px;
		width: 90vw;
		margin: auto;
		position: fixed;
		inset: 0;
		height: fit-content;
		overflow: visible;
	}

	.beta-dialog::backdrop {
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
	}

	.beta-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 28px 24px 24px;
		text-align: center;
	}

	.beta-icon {
		color: var(--color-primary);
		margin-bottom: 12px;
	}

	.beta-title {
		font-size: 1.25rem;
		font-weight: 700;
		margin: 0 0 12px;
		color: var(--color-text);
	}

	.beta-text {
		font-size: 0.85rem;
		color: var(--color-muted);
		margin: 0 0 8px;
		line-height: 1.5;
	}

	.beta-links {
		display: flex;
		gap: 10px;
		margin: 16px 0;
		flex-wrap: wrap;
		justify-content: center;
	}

	.beta-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border-radius: 8px;
		font-size: 0.8rem;
		font-weight: 600;
		text-decoration: none;
		transition: opacity 0.15s;
	}

	.beta-link:hover {
		opacity: 0.85;
	}

	.beta-link-github {
		background: #24292e;
		color: #fff;
	}

	.beta-link-discord {
		background: #5865f2;
		color: #fff;
	}

	.beta-dismiss {
		margin-top: 8px;
		padding: 10px 32px;
		border: none;
		border-radius: 8px;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		background: var(--color-primary);
		color: #fff;
		transition: background 0.15s;
	}

	.beta-dismiss:hover {
		background: var(--color-primary-hover);
	}
</style>
