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
          'Fixed UTF-8 BOM corruption that caused dithering method names to display garbled characters (e.g. Bayer 2Ã—2).',
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
