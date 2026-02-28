<script lang="ts">
	import { base } from '$app/paths';
	import { infoModal } from '$lib/stores/infoModal.svelte.js';
	import { locale } from '$lib/stores/locale.svelte.js';

	interface Props {
		open: boolean;
		onclose: () => void;
	}

	let { open = $bindable(), onclose }: Props = $props();

	const t = locale.t;

	const tabs: { id: string }[] = [
		{ id: 'about' },
		{ id: 'technology' },
		{ id: 'general' },
		{ id: 'preprocessing' },
		{ id: 'processing' },
		{ id: 'blocks' },
		{ id: 'customblocks' },
		{ id: 'export' },
		{ id: 'shortcuts' },
		{ id: 'faq' },
	];

	let activeTab = $state('about');
	let dialogEl: HTMLDialogElement | undefined = $state(undefined);

	// Sync with store tab when opening from external (?) buttons
	$effect(() => {
		if (open && infoModal.tab) {
			activeTab = infoModal.tab;
		}
	});

	$effect(() => {
		if (open) {
			dialogEl?.showModal();
		} else {
			dialogEl?.close();
		}
	});

	function handleClose() {
		open = false;
		onclose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === dialogEl) handleClose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			handleClose();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog
	bind:this={dialogEl}
	class="info-dialog"
	onclick={handleBackdropClick}
	onkeydown={handleKeydown}
>
	<div class="info-container">
		<!-- Header -->
		<div class="info-header">
			<h2 class="text-base font-semibold text-[var(--color-text)]">{t('info.headerTitle')}</h2>
			<button
				class="flex h-7 w-7 items-center justify-center rounded text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
				onclick={handleClose}
				title={t('info.close')}
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>

		<!-- Body -->
		<div class="info-body">
			<!-- Left: Tabs -->
			<nav class="info-tabs">
				{#each tabs as tab}
					<button
						class="info-tab"
						class:active={activeTab === tab.id}
						onclick={() => (activeTab = tab.id)}
					>
						<svg class="tab-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							{#if tab.id === 'about'}
								<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor" stroke="none" />
							{:else if tab.id === 'technology'}
								<polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
							{:else if tab.id === 'general'}
								<circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
							{:else if tab.id === 'preprocessing'}
								<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
							{:else if tab.id === 'processing'}
								<circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
							{:else if tab.id === 'blocks'}
								<rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
							{:else if tab.id === 'customblocks'}
								<path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
							{:else if tab.id === 'export'}
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
							{:else if tab.id === 'shortcuts'}
								<rect x="2" y="4" width="20" height="16" rx="2" ry="2" /><line x1="6" y1="8" x2="6.01" y2="8" /><line x1="10" y1="8" x2="10.01" y2="8" /><line x1="14" y1="8" x2="14.01" y2="8" /><line x1="18" y1="8" x2="18.01" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="6" y1="16" x2="6.01" y2="16" /><line x1="18" y1="16" x2="18.01" y2="16" />
							{:else if tab.id === 'faq'}
								<circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
							{/if}
						</svg>
						<span class="tab-label">{t(`info.tab.${tab.id}`)}</span>
					</button>
				{/each}
			</nav>

			<!-- Right: Content -->
			<div class="info-content">
				{#if activeTab === 'about'}
					<div class="content-section about-section">
						<div class="about-info">
							<p class="about-author">{t('info.about.developedBy')} <strong>iroaK</strong></p>
							<p class="about-quote">{t('info.about.quote')}</p>
							<div class="about-buttons">
								<a href="https://github.com/iiroak" target="_blank" rel="noopener noreferrer" class="about-btn about-btn-github">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
										<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
									</svg>
									<span>GitHub</span>
								</a>
								<a href="https://buymeacoffee.com/iroak" target="_blank" rel="noopener noreferrer" class="about-btn about-btn-coffee">
									<svg width="18" height="18" viewBox="0 0 24 24" role="img" fill="currentColor">
										<path d="m20.216 6.415-.132-.666c-.119-.598-.388-1.163-1.001-1.379-.197-.069-.42-.098-.57-.241-.152-.143-.196-.366-.231-.572-.065-.378-.125-.756-.192-1.133-.057-.325-.102-.69-.25-.987-.195-.4-.597-.634-.996-.788a5.723 5.723 0 0 0-.626-.194c-1-.263-2.05-.36-3.077-.416a25.834 25.834 0 0 0-3.7.062c-.915.083-1.88.184-2.75.5-.318.116-.646.256-.888.501-.297.302-.393.77-.177 1.146.154.267.415.456.692.58.36.162.737.284 1.123.366 1.075.238 2.189.331 3.287.37 1.218.05 2.437.01 3.65-.118.299-.033.598-.073.896-.119.352-.054.578-.513.474-.834-.124-.383-.457-.531-.834-.473-.466.074-.96.108-1.382.146-1.177.08-2.358.082-3.536.006a22.228 22.228 0 0 1-1.157-.107c-.086-.01-.18-.025-.258-.036-.243-.036-.484-.08-.724-.13-.111-.027-.111-.185 0-.212h.005c.277-.06.557-.108.838-.147h.002c.131-.009.263-.032.394-.048a25.076 25.076 0 0 1 3.426-.12c.674.019 1.347.067 2.017.144l.228.031c.267.04.533.088.798.145.392.085.895.113 1.07.542.055.137.08.288.111.431l.319 1.484a.237.237 0 0 1-.199.284h-.003c-.037.006-.075.01-.112.015a36.704 36.704 0 0 1-4.743.295 37.059 37.059 0 0 1-4.699-.304c-.14-.017-.293-.042-.417-.06-.326-.048-.649-.108-.973-.161-.393-.065-.768-.032-1.123.161-.29.16-.527.404-.675.701-.154.316-.199.66-.267 1-.069.34-.176.707-.135 1.056.087.753.613 1.365 1.37 1.502a39.69 39.69 0 0 0 11.343.376.483.483 0 0 1 .535.53l-.071.697-1.018 9.907c-.041.41-.047.832-.125 1.237-.122.637-.553 1.028-1.182 1.171-.577.131-1.165.2-1.756.205-.656.004-1.31-.025-1.966-.022-.699.004-1.556-.06-2.095-.58-.475-.458-.54-1.174-.605-1.793l-.731-7.013-.322-3.094c-.037-.351-.286-.695-.678-.678-.336.015-.718.3-.678.679l.228 2.185.949 9.112c.147 1.344 1.174 2.068 2.446 2.272.742.12 1.503.144 2.257.156.966.016 1.942.053 2.892-.122 1.408-.258 2.465-1.198 2.616-2.657.34-3.332.683-6.663 1.024-9.995l.215-2.087a.484.484 0 0 1 .39-.426c.402-.078.787-.212 1.074-.518.455-.488.546-1.124.385-1.766zm-1.478.772c-.145.137-.363.201-.578.233-2.416.359-4.866.54-7.308.46-1.748-.06-3.477-.254-5.207-.498-.17-.024-.353-.055-.47-.18-.22-.236-.111-.71-.054-.995.052-.26.152-.609.463-.646.484-.057 1.046.148 1.526.22.577.088 1.156.159 1.737.212 2.48.226 5.002.19 7.472-.14.45-.06.899-.13 1.345-.21.399-.072.84-.206 1.08.206.166.281.188.657.162.974a.544.544 0 0 1-.169.364zm-6.159 3.9c-.862.37-1.84.788-3.109.788a5.884 5.884 0 0 1-1.569-.217l.877 9.004c.065.78.717 1.38 1.5 1.38 0 0 1.243.065 1.658.065.447 0 1.786-.065 1.786-.065.783 0 1.434-.6 1.499-1.38l.94-9.95a3.996 3.996 0 0 0-1.322-.238c-.826 0-1.491.284-2.26.613z"/>
									</svg>
									<span>{t('info.about.coffee')}</span>
								</a>
							</div>
							<p class="about-donate-msg">{t('info.about.donateMsg')}</p>
						</div>
						<img src={`${base}/images/kaori-tree.png`} alt="Kaori Tree" class="about-img" />
					</div>

				{:else if activeTab === 'technology'}
					<div class="content-section">
						<div class="tech-logo">
							<img src={`${base}/images/damapart.png`} alt="DaMapArts" class="tech-logo-img" />
							<h3 class="tech-logo-title">DaMapArts</h3>
						</div>
						<div class="mb-3 flex justify-center">
							<a
								href="https://github.com/iiroak/DaMapArts"
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-bg)]"
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
									<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
								</svg>
								<span>{t('info.tech.repo')}</span>
							</a>
						</div>
						<p class="content-text">
							{@html t('info.tech.p1')}
						</p>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">{t('info.tech.creditsTitle')}</h4>
						<p class="content-text">
							{@html t('info.tech.p2')}
						</p>
						<p class="content-text">
							{@html t('info.tech.p3')}
						</p>
						<p class="content-text">
							{@html t('info.tech.p4')}
						</p>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">{t('info.tech.stackTitle')}</h4>
						<ul class="info-list">
							<li>{@html t('info.tech.li1')}</li>
							<li>{@html t('info.tech.li2')}</li>
							<li>{@html t('info.tech.li3')}</li>
							<li>{@html t('info.tech.li4')}</li>
							<li>{@html t('info.tech.li5')}</li>
							<li>{@html t('info.tech.li6')}</li>
						</ul>
					</div>

				{:else if activeTab === 'general'}
					<div class="content-section">
						<h3 class="content-title">{t('info.general.title')}</h3>
						<p class="content-text">
							{t('info.general.intro')}
						</p>
						<div class="info-divider"></div>
						<div class="info-step"><span class="step-number">1</span><div><h4 class="content-subtitle">{t('info.general.step1Title')}</h4><p class="content-text">{t('info.general.step1Text')}</p></div></div>
						<div class="info-step"><span class="step-number">2</span><div><h4 class="content-subtitle">{t('info.general.step2Title')}</h4><p class="content-text">{t('info.general.step2Text')}</p></div></div>
						<div class="info-step"><span class="step-number">3</span><div><h4 class="content-subtitle">{t('info.general.step3Title')}</h4><p class="content-text">{t('info.general.step3Text')}</p></div></div>
						<div class="info-step"><span class="step-number">4</span><div><h4 class="content-subtitle">{t('info.general.step4Title')}</h4><p class="content-text">{t('info.general.step4Text')}</p></div></div>
						<div class="info-step"><span class="step-number">5</span><div><h4 class="content-subtitle">{t('info.general.step5Title')}</h4><p class="content-text">{t('info.general.step5Text')}</p></div></div>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">{t('info.general.layoutTitle')}</h4>
						<ul class="info-list">
							<li>{@html t('info.general.layout1')}</li>
							<li>{@html t('info.general.layout2')}</li>
							<li>{@html t('info.general.layout3')}</li>
							<li>{@html t('info.general.layout4')}</li>
						</ul>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">{t('info.general.autoTitle')}</h4>
						<p class="content-text">
							{@html t('info.general.autoText')}
						</p>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">{t('info.general.profilesTitle')}</h4>
						<p class="content-text">
							{@html t('info.general.profilesText')}
						</p>
						<ul class="info-list">
							<li>{@html t('info.general.profilesLi1')}</li>
							<li>{@html t('info.general.profilesLi2')}</li>
							<li>{@html t('info.general.profilesLi3')}</li>
							<li>{@html t('info.general.profilesLi4')}</li>
							<li>{@html t('info.general.profilesLi5')}</li>
						</ul>
						<div class="info-divider"></div>
						<h4 class="content-subtitle">{t('info.general.dataTitle')}</h4>
						<p class="content-text">
							{t('info.general.dataText')}
						</p>
						<ul class="info-list">
							<li>{@html t('info.general.dataLi1')}</li>
							<li>{@html t('info.general.dataLi2')}</li>
							<li>{@html t('info.general.dataLi3')}</li>
						</ul>
					</div>

				{:else if activeTab === 'preprocessing'}
					<div class="content-section">
						{@html t('info.preprocessing.html')}
					</div>

				{:else if activeTab === 'processing'}
					<div class="content-section">
						{@html t('info.processing.html')}
					</div>

				{:else if activeTab === 'blocks'}
					<div class="content-section">
						{@html t('info.blocks.html')}
					</div>

				{:else if activeTab === 'customblocks'}
					<div class="content-section">
						{@html t('info.customblocks.html')}
					</div>

				{:else if activeTab === 'export'}
					<div class="content-section">
						{@html t('info.export.html')}
					</div>

				{:else if activeTab === 'shortcuts'}
					<div class="content-section">
						{@html t('info.shortcuts.html')}
					</div>

				{:else if activeTab === 'faq'}
					<div class="content-section">
						{@html t('info.faq.html')}
					</div>
				{/if}
			</div>
		</div>
	</div>
</dialog>

<style>
	.info-dialog {
		padding: 0;
		border: none;
		border-radius: 12px;
		background: var(--color-bg-card);
		color: var(--color-text);
		max-width: 680px;
		width: 90vw;
		max-height: 80vh;
		overflow: visible;
		margin: auto;
		position: fixed;
		inset: 0;
		height: fit-content;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
	}

	.info-dialog::backdrop {
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
	}

	.info-container {
		display: flex;
		flex-direction: column;
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: 12px;
		overflow: hidden;
		max-height: 80vh;
	}

	.info-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}

	.info-body {
		display: flex;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	.info-tabs {
		display: flex;
		flex-direction: column;
		width: 170px;
		flex-shrink: 0;
		border-right: 1px solid var(--color-border);
		padding: 8px;
		gap: 2px;
		overflow-y: auto;
		background: var(--color-bg);
	}

	.info-tab {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border-radius: 6px;
		border: none;
		background: transparent;
		color: var(--color-text-muted);
		font-size: 13px;
		font-family: inherit;
		letter-spacing: 0.01em;
		cursor: pointer;
		transition: all 0.15s;
		text-align: left;
		white-space: nowrap;
	}

	.info-tab:hover {
		background: var(--color-surface);
		color: var(--color-text);
	}

	.info-tab.active {
		background: var(--color-primary);
		color: white;
	}

	.tab-icon {
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}

	.tab-label {
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.info-content {
		flex: 1;
		padding: 20px 24px;
		overflow-y: auto;
		min-height: 360px;
		background: var(--color-bg-card);
	}

	.content-section {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.tech-logo {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		margin-bottom: 16px;
	}

	.tech-logo-img {
		width: 160px;
		height: 160px;
		object-fit: contain;
	}

	.tech-logo-title {
		font-size: 20px;
		font-weight: 700;
		color: var(--color-text);
		letter-spacing: -0.02em;
	}

	.content-title,
	.info-content :global(.content-title) {
		font-size: 16px;
		font-weight: 600;
		color: var(--color-text);
		margin: 0;
		letter-spacing: -0.01em;
	}

	.content-text,
	.info-content :global(.content-text) {
		font-size: 13px;
		line-height: 1.7;
		margin: 0;
		color: var(--color-text-muted);
	}

	/* About tab: kaori-tree image flush right */
	.about-section {
		position: relative;
		padding: 0 !important;
		gap: 0 !important;
		margin: -20px -24px;
		width: calc(100% + 48px);
		height: calc(100% + 40px);
		min-height: calc(360px + 40px);
		overflow: hidden;
	}

	.about-img {
		position: absolute;
		top: 0;
		right: 0;
		height: 100%;
		width: auto;
		opacity: 0.85;
	}

	.about-info {
		position: absolute;
		left: 24px;
		bottom: 32px;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.about-author {
		font-size: 16px;
		color: var(--color-text-muted);
		margin: 0;
		letter-spacing: 0.02em;
	}

	.about-author strong {
		color: var(--color-text);
		font-weight: 700;
	}

	.about-quote {
		font-size: 13px;
		color: var(--color-muted);
		font-style: italic;
		margin: 0 0 12px 0;
	}

	.about-buttons {
		display: flex;
		gap: 10px;
	}

	.about-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.about-btn-github {
		background: var(--color-surface);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.about-btn-github:hover {
		background: var(--color-bg-hover);
		border-color: var(--color-text-muted);
	}

	.about-btn-coffee {
		background: var(--color-surface);
		color: var(--color-text);
		border: 1px solid var(--color-border);
	}

	.about-btn-coffee:hover {
		background: var(--color-bg-hover);
		border-color: var(--color-text-muted);
	}

	.about-donate-msg {
		font-size: 11px;
		font-style: italic;
		opacity: 0.55;
		margin: 4px 0 0 0;
	}

	.content-subtitle,
	.info-content :global(.content-subtitle) {
		font-size: 14px;
		font-weight: 600;
		color: var(--color-text);
		margin: 0;
		letter-spacing: -0.01em;
	}

	.info-divider,
	.info-content :global(.info-divider) {
		border-top: 1px solid var(--color-border);
		margin: 8px 0;
	}

	.info-list,
	.info-content :global(.info-list) {
		margin: 4px 0 0 0;
		padding-left: 18px;
		font-size: 13px;
		line-height: 1.75;
		color: var(--color-text-muted);
		list-style: disc;
	}

	.info-list li,
	.info-content :global(.info-list li) {
		margin-bottom: 2px;
	}

	.info-content :global(.info-list li strong) {
		color: var(--color-text);
	}

	.info-content :global(.info-list li em) {
		color: var(--color-primary);
		font-style: normal;
		font-weight: 500;
	}

	.info-content :global(.info-list code) {
		font-size: 12px;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 1px 5px;
		font-family: 'Consolas', 'Monaco', monospace;
	}

	.info-content :global(.info-tip) {
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
		border-left: 3px solid var(--color-primary);
		border-radius: 0 6px 6px 0;
		padding: 8px 12px;
		font-size: 12px;
	}

	.info-step {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		margin: 10px 0;
	}

	.info-step .content-subtitle {
		margin-bottom: 2px;
	}

	.info-step .content-text {
		margin-top: 0;
	}

	.step-number {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		border-radius: 50%;
		background: var(--color-primary);
		color: white;
		font-size: 13px;
		font-weight: 700;
		line-height: 1;
		margin-top: 1px;
	}

	.info-content :global(.shortcuts-table) {
		margin-top: 8px;
	}

	.info-content :global(.shortcut-row) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 0;
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
		font-size: 13px;
		color: var(--color-text-muted);
	}

	.info-content :global(.shortcut-row:last-child) {
		border-bottom: none;
	}

	.info-content :global(.shortcut-row kbd) {
		display: inline-block;
		background: var(--color-bg-card);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 2px 8px;
		font-size: 11px;
		font-family: 'Consolas', 'Monaco', monospace;
		font-weight: 600;
		color: var(--color-text);
		box-shadow: 0 1px 0 var(--color-border);
		min-width: fit-content;
		white-space: nowrap;
	}

	.info-content :global(.shortcut-row span) {
		text-align: right;
	}

	.info-content :global(.example-block) {
		background: color-mix(in srgb, var(--color-surface) 60%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
		border-radius: 6px;
		padding: 8px 12px;
		margin: 6px 0;
	}

	.info-content :global(.example-block .content-text) {
		margin: 2px 0;
	}

	.info-content :global(.example-block .info-list) {
		margin: 2px 0 2px 16px;
	}

	.info-content :global(.faq-item) {
		margin-bottom: 12px;
	}

	.info-content :global(.faq-q) {
		display: block;
		color: var(--color-text);
		margin-bottom: 2px;
		font-size: 0.85rem;
	}

	.info-content :global(.faq-item .content-text) {
		margin-top: 2px;
	}

	.info-content :global(.faq-item a) {
		color: var(--color-primary);
		text-decoration: underline;
	}

	.info-content :global(.faq-item a:hover) {
		opacity: 0.8;
	}

	.info-content :global(.faq-item code) {
		background: color-mix(in srgb, var(--color-surface) 80%, transparent);
		padding: 1px 4px;
		border-radius: 3px;
		font-size: 0.8rem;
	}
</style>
