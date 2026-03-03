/**
 * Info modal store — allows any component to open the InfoModal on a specific tab.
 */

export type InfoTab = 'about' | 'changelog' | 'technology' | 'general' | 'preprocessing' | 'processing' | 'blocks' | 'customblocks' | 'export' | 'shortcuts' | 'faq';

function createInfoModalStore() {
	let open = $state(false);
	let tab = $state<InfoTab>('about');
	let anchor = $state<string | null>(null);

	return {
		get open() { return open; },
		set open(v: boolean) { open = v; },
		get tab() { return tab; },
		set tab(v: InfoTab) { tab = v; },
		get anchor() { return anchor; },
		set anchor(v: string | null) { anchor = v; },

		/** Open the info modal on a specific tab, optionally scrolling to an anchor */
		openTab(t: InfoTab, a?: string) {
			tab = t;
			anchor = a ?? null;
			open = true;
		},

		close() {
			open = false;
			anchor = null;
		}
	};
}

export const infoModal = createInfoModalStore();
