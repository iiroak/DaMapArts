// Modal dialog service — replaces native alert/confirm/prompt

export type ModalType = 'alert' | 'confirm' | 'prompt';

interface ModalState {
	open: boolean;
	type: ModalType;
	title: string;
	message: string;
	placeholder: string;
	defaultValue: string;
	confirmLabel: string;
	cancelLabel: string;
	resolve: ((value: string | boolean | null) => void) | null;
}

function createModalStore() {
	let state = $state<ModalState>({
		open: false,
		type: 'alert',
		title: '',
		message: '',
		placeholder: '',
		defaultValue: '',
		confirmLabel: 'OK',
		cancelLabel: 'Cancel',
		resolve: null
	});

	function showAlert(message: string, title = 'Notice'): Promise<true> {
		return new Promise((resolve) => {
			state.open = true;
			state.type = 'alert';
			state.title = title;
			state.message = message;
			state.confirmLabel = 'OK';
			state.cancelLabel = 'Cancel';
			state.placeholder = '';
			state.defaultValue = '';
			state.resolve = () => resolve(true);
		});
	}

	function showConfirm(
		message: string,
		title = 'Confirm',
		confirmLabel = 'OK',
		cancelLabel = 'Cancel'
	): Promise<boolean> {
		return new Promise((resolve) => {
			state.open = true;
			state.type = 'confirm';
			state.title = title;
			state.message = message;
			state.confirmLabel = confirmLabel;
			state.cancelLabel = cancelLabel;
			state.placeholder = '';
			state.defaultValue = '';
			state.resolve = (v) => resolve(v as boolean);
		});
	}

	function showPrompt(
		message: string,
		defaultValue = '',
		title = 'Input',
		placeholder = ''
	): Promise<string | null> {
		return new Promise((resolve) => {
			state.open = true;
			state.type = 'prompt';
			state.title = title;
			state.message = message;
			state.placeholder = placeholder;
			state.defaultValue = defaultValue;
			state.confirmLabel = 'OK';
			state.cancelLabel = 'Cancel';
			state.resolve = (v) => resolve(v as string | null);
		});
	}

	function confirm(value: string | boolean) {
		state.resolve?.(value);
		state.open = false;
		state.resolve = null;
	}

	function cancel() {
		if (state.type === 'confirm') {
			state.resolve?.(false);
		} else if (state.type === 'prompt') {
			state.resolve?.(null);
		} else {
			state.resolve?.(true);
		}
		state.open = false;
		state.resolve = null;
	}

	return {
		get state() {
			return state;
		},
		showAlert,
		showConfirm,
		showPrompt,
		confirm,
		cancel
	};
}

export const modal = createModalStore();
