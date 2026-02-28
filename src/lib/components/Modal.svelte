<script lang="ts">
	import { modal } from '$lib/stores/modal.svelte.js';
	import { onMount } from 'svelte';

	let inputValue = $state('');
	let inputEl: HTMLInputElement | undefined = $state(undefined);
	let dialogEl: HTMLDialogElement | undefined = $state(undefined);

	$effect(() => {
		if (modal.state.open) {
			inputValue = modal.state.defaultValue;
			dialogEl?.showModal();
			// Auto-focus input on prompt, confirm button otherwise
			setTimeout(() => {
				if (modal.state.type === 'prompt' && inputEl) {
					inputEl.focus();
					inputEl.select();
				}
			}, 50);
		} else {
			dialogEl?.close();
		}
	});

	function handleConfirm() {
		if (modal.state.type === 'prompt') {
			modal.confirm(inputValue);
		} else if (modal.state.type === 'confirm') {
			modal.confirm(true);
		} else {
			modal.confirm(true);
		}
	}

	function handleCancel() {
		modal.cancel();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			handleCancel();
		} else if (e.key === 'Enter' && modal.state.type !== 'prompt') {
			e.preventDefault();
			handleConfirm();
		}
	}

	function handleInputKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleConfirm();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === dialogEl) {
			handleCancel();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialogEl}
	class="modal-dialog"
	onkeydown={handleKeydown}
	onclick={handleBackdropClick}
>
	{#if modal.state.open}
		<div class="modal-content">
			<!-- Header -->
			<div class="modal-header">
				<h3 class="modal-title">{modal.state.title}</h3>
			</div>

			<!-- Body -->
			<div class="modal-body">
				<p class="modal-message">{modal.state.message}</p>

				{#if modal.state.type === 'prompt'}
					<input
						bind:this={inputEl}
						bind:value={inputValue}
						class="modal-input"
						placeholder={modal.state.placeholder}
						onkeydown={handleInputKeydown}
						type="text"
					/>
				{/if}
			</div>

			<!-- Footer -->
			<div class="modal-footer">
				{#if modal.state.type !== 'alert'}
					<button class="modal-btn modal-btn--cancel" onclick={handleCancel}>
						{modal.state.cancelLabel}
					</button>
				{/if}
				<button class="modal-btn modal-btn--confirm" onclick={handleConfirm}>
					{modal.state.confirmLabel}
				</button>
			</div>
		</div>
	{/if}
</dialog>

<style>
	.modal-dialog {
		border: none;
		background: transparent;
		padding: 0;
		max-width: 440px;
		width: 90vw;
		outline: none;
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		margin: 0;
	}

	.modal-dialog::backdrop {
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
	}

	.modal-content {
		background: var(--color-bg-card, #1a1a1a);
		border: 1px solid var(--color-border, #2a2a2a);
		border-radius: 12px;
		overflow: hidden;
		box-shadow:
			0 20px 60px rgba(0, 0, 0, 0.5),
			0 0 0 1px rgba(255, 255, 255, 0.05) inset;
		animation: modal-in 0.2s ease-out;
	}

	@keyframes modal-in {
		from {
			opacity: 0;
			transform: scale(0.95);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.modal-header {
		padding: 16px 20px 0;
	}

	.modal-title {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
		color: var(--color-text, #e5e5e5);
		letter-spacing: 0.01em;
	}

	.modal-body {
		padding: 12px 20px 16px;
	}

	.modal-message {
		margin: 0;
		font-size: 13px;
		color: var(--color-text-muted, #888);
		line-height: 1.5;
	}

	.modal-input {
		display: block;
		width: 100%;
		margin-top: 12px;
		padding: 8px 12px;
		font-size: 13px;
		color: var(--color-text, #e5e5e5);
		background: var(--color-bg-input, #222);
		border: 1px solid var(--color-border, #2a2a2a);
		border-radius: 6px;
		outline: none;
		transition: border-color 0.15s;
		box-sizing: border-box;
	}

	.modal-input:focus {
		border-color: var(--color-primary, #6366f1);
		box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 0 20px 16px;
	}

	.modal-btn {
		padding: 7px 16px;
		font-size: 13px;
		font-weight: 500;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.15s;
		border: none;
	}

	.modal-btn--cancel {
		background: transparent;
		color: var(--color-text-muted, #888);
		border: 1px solid var(--color-border, #2a2a2a);
	}

	.modal-btn--cancel:hover {
		background: var(--color-bg-input, #222);
		color: var(--color-text, #e5e5e5);
	}

	.modal-btn--confirm {
		background: var(--color-primary, #6366f1);
		color: white;
	}

	.modal-btn--confirm:hover {
		background: var(--color-primary-hover, #818cf8);
	}
</style>
