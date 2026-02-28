/**
 * Info modal store — allows any component to open the InfoModal on a specific tab.
 */

export type InfoTab = 'about' | 'technology' | 'general' | 'preprocessing' | 'processing' | 'blocks' | 'customblocks' | 'export' | 'shortcuts' | 'faq';

function createInfoModalStore() {
	let open = $state(false);
	let tab = $state<InfoTab>('about');

	return {
		get open() { return open; },
		set open(v: boolean) { open = v; },
		get tab() { return tab; },
		set tab(v: InfoTab) { tab = v; },

		/** Open the info modal on a specific tab */
		openTab(t: InfoTab) {
			tab = t;
			open = true;
		},

		close() {
			open = false;
		}
	};
}

export const infoModal = createInfoModalStore();
