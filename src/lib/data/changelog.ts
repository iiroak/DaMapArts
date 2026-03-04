/**
 * Structured changelog data.
 *
 * Version format: YY.M.D-revision  (e.g. 26.3.1-1)
 * The version itself encodes the date, so no separate date field is needed.
 *
 * Items are kept in English — only category labels are translated.
 * To add a new release, prepend an entry to the array.
 */

export interface ChangelogCategory {
  key: 'features' | 'fixes' | 'performance' | 'internal';
  items: string[];
}

export interface ChangelogRelease {
  version: string;
  categories: ChangelogCategory[];
}

const changelog: ChangelogRelease[] = [
  {
    version: '26.3.4-1',
    categories: [
      {
        key: 'features',
        items: [
          'Profile Manager modal — full-featured modal for managing settings profiles and custom block profiles with save, load, rename, duplicate, delete, and import/export.',
          'Per-field editing — each profile setting can be edited individually with user-friendly controls (dropdowns, sliders, toggles, color pickers) instead of raw data.',
          'Field lock system — individual "no overwrite" locks per field, so loading a profile skips locked fields.',
          'Section lock buttons — one-click lock/unlock all fields in a section (Map, Processing, Image, Blocks, Filters). Three visual states: unlocked (gray), partial (yellow), fully locked (red).',
          'Auto-save on section edit close — section edits save automatically when closing, removing confusion between save/cancel and auto-locking.',
          'Block Profiles — manage sets of custom blocks as named profiles with enable/disable toggles, rename, and per-block editing.',
          'Custom Blocks button — the full custom blocks section in Block Selection panel is now a compact button alongside preset tools (Delete, Save, Share, Import).',
          'Profiles icon in header — quick access to Profile Manager from the header bar.',
          'Profiles floating button — floating icon button in bottom-left corner (alongside settings and info buttons) to open Profile Manager.',
          'Profile panel removed from layout — Profiles is now a modal only, freeing right sidebar space.',
          'Dockable panel layout — panels can be dragged and reordered between left, center, and right zones with persistent layout.',
          'Layout settings — configurable zone widths, gap spacing, and content max width from settings panel.',
          'Panel visibility toggle — hide/show individual panels from the settings gear menu.',
          'Materials panel — new panel showing block count and stack requirements for the current map art.',
        ],
      },
      {
        key: 'fixes',
        items: [
          'Fixed 9 FIELD_UI value type mismatches in Profile Manager: version stored MCVersion not JSON key, dither IDs stored as kebab-case, mode/staircase stored uniqueId numbers, cropMode stored lowercase, support blocks and background mode stored uniqueId numbers, crop offsets range 0–100 not −1 to 1, map size max 20 not 128, support block is a select not text input.',
          'Fixed empty comboboxes when stored profile value didn\'t match any known option — fallback option now renders the raw value.',
          'Fixed slider values overlapping lock icons in section edit modal.',
          'Fixed IO modal (Import/Export) only accessible from one tab — moved outside tab conditional.',
        ],
      },
      {
        key: 'internal',
        items: [
          'Panel registry (PanelRegistry.svelte.ts) for dynamic panel component resolution.',
          'Layout store (layoutStore.svelte.ts) with versioned localStorage persistence.',
          'Profiles modal store (profilesModal.svelte.ts) for centralized modal state.',
          'Layout version bumped to 3 — force resets stored layout for all users.',
          'Added Spanish translations for all new Profile Manager, Block Profile, layout, and settings strings.',
        ],
      },
    ],
  },
  {
    version: '26.3.3-1',
    categories: [
      {
        key: 'fixes',
        items: [
          'CIE76 and CIEDE2000 color spaces now produce correct results — sRGB linearization was missing from rgb2lab50/rgb2lab65.',
          'Removed duplicate "CIE L*a*b*" option (was identical to MapartCraft Default).',
          'Removed duplicate "Euclidian" option (was identical to RGB).',
          'Preview container no longer resets its resized height when panning the image.',
          'Color Space selector no longer goes blank on reload — default changed from removed "lab" to "mapartcraft-default", plus legacy profile migration.',
          'Fixed UTF-8 BOM corruption that caused dithering method names to display garbled characters (e.g. Bayer 2×2).',
        ],
      },
      {
        key: 'features',
        items: [
          'Changelog tab added to the Info modal.',
          'State Bits and other MEMO controls are now sliders instead of number inputs.',
          'Help (?) buttons now scroll directly to the relevant section in the Info modal.',
          'Block textures sprite sheet updated from mapartcraft-mike2b2t.',
          'UI reorganized with pipeline stage numbers (①–⑥) and interaction hints between related settings.',
          'Left sidebar reordered to follow the processing pipeline: File → Map → Image → Pre-process → Processing.',
          'Color Space and Channel Propagation grouped into a "Color Matching" section.',
          'Memo LAB override now displays a warning when it overrides the global Color Space.',
          'Panels default collapsed except File, Map, and Export for a cleaner first-time view.',
          'Preview now has pipeline view modes — navigate between File, Image, Pre-process, and Result stages with arrow buttons.',
          'Update notification modal — returning users see a prompt when a new version is available, with a link to the changelog.',
          'All range inputs (sliders) now use a unified global style with accent gradient.',
          'Slider labels standardized: label on the left, current value on the right.',
          'Dialog modals (Beta notice, Update notice) now have a visible border for better contrast.',
        ],
      },
      {
        key: 'internal',
        items: [
          'Removed dead MapSettings.svelte component (324 lines of duplicate code).',
        ],
      },
    ],
  },
  {
    version: '26.3.1-1',
    categories: [
      {
        key: 'fixes',
        items: [
          'State Bits display now shows the correct semantic value (0 = fast / no state key, 8 = slow / full state key).',
          'LAB distance label updated to "MapartCraft LAB" to reflect the legacy rgb2lab variant actually used.',
        ],
      },
      {
        key: 'performance',
        items: [
          'Bilateral filter no longer runs twice per processing cycle — MapPreview passes pre-filtered pixels directly.',
          'Pixel storage changed from PixelEntry[] objects to Uint16Array indices — massive memory reduction for large maps.',
        ],
      },
      {
        key: 'internal',
        items: [
          'Added browser-console memory diagnostic module (window.__memDiag).',
        ],
      },
    ],
  },
];

export default changelog;
