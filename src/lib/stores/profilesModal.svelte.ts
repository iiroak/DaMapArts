/**
 * Profiles modal store — controls the full-screen profiles manager modal.
 */

function createProfilesModalStore() {
	let open = $state(false);
	let initialTab = $state<'profiles' | 'customblocks'>('profiles');

	return {
		get open() { return open; },
		set open(v: boolean) { open = v; },

		get initialTab() { return initialTab; },

		show(tab?: 'profiles' | 'customblocks') {
			initialTab = tab ?? 'profiles';
			open = true;
		},
		close() { open = false; },
		toggle() { open = !open; },
	};
}

export const profilesModal = createProfilesModalStore();
