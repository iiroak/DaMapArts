/**
 * TypeScript definitions for coloursJSON.json palette data.
 * Maps the full mapartcraft colour database structure.
 */

/** RGB tuple [R, G, B] with values 0-255 */
export type RGB = [number, number, number];

/** LAB tuple [L, a, b] */
export type LAB = [number, number, number];

/** Oklab tuple [L, a, b] */
export type Oklab = [number, number, number];

/** Oklch tuple [L, C, h] (cylindrical Oklab) */
export type Oklch = [number, number, number];

/** YCbCr tuple [Y, Cb, Cr] (BT.601) */
export type YCbCr = [number, number, number];

/** HSL tuple [H, S, L] — H in radians, S & L in [0,1] */
export type HSL = [number, number, number];

/** The four tone variants a colour set can have */
export interface ColourTones {
  dark: RGB;
  normal: RGB;
  light: RGB;
  unobtainable?: RGB;
}

/** Tone keys that exist on ColourTones */
export type ToneKey = 'dark' | 'normal' | 'light' | 'unobtainable';

/** NBT data for a specific MC version */
export interface BlockVersionData {
  NBTName: string;
  NBTArgs: Record<string, string>;
}

/** A single block variant inside a colour set */
export interface BlockEntry {
  /** Human name */
  displayName: string;
  /** Key = MC version string (e.g. "1.12.2"). Value is either BlockVersionData or a reference string like "&1.12.2" */
  validVersions: Record<string, BlockVersionData | string>;
  /** Whether a support block is mandatory for this block to stay in place */
  supportBlockMandatory: boolean;
  /** Whether this block can catch fire */
  flammable: boolean;
  /** Index used for preset matching */
  presetIndex: number;
}

/** One colour set with its tones and available blocks */
export interface ColourSet {
  tonesRGB: ColourTones;
  blocks: Record<string, BlockEntry>;
  /** Map data colour ID (multiplied by 4, then added 0=dark, 1=normal, 2=light, 3=unobtainable) */
  mapdatId: number;
  /** Human-readable colour name */
  colourName: string;
}

/** The full coloursJSON structure: colourSetId → ColourSet */
export type ColoursJSON = Record<string, ColourSet>;

/** A colour in the active palette (resolved for current settings) */
export interface PaletteColor {
  /** colourSetId from coloursJSON */
  colourSetId: string;
  /** Which tone this colour represents */
  toneKey: ToneKey;
  /** RGB values 0-255 */
  rgb: RGB;
  /** CIE L*a*b* for perceptual matching */
  lab: LAB;
  /** Oklab for even better perceptual matching */
  oklab: Oklab;
  /** Oklch — cylindrical Oklab (L, Chroma, Hue) */
  oklch: Oklch;
  /** YCbCr (BT.601) */
  ycbcr: YCbCr;
  /** HSL (H in radians, S & L in [0,1]) */
  hsl: HSL;
  /** CSS hex string */
  hex: string;
  /** Index in the active palette array */
  paletteIndex: number;
}
