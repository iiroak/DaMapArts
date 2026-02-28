/**
 * Palette builder — constructs the active colour palette from coloursJSON
 * based on selected blocks and staircasing mode.
 */
import type {
  ColoursJSON,
  ColourSet,
  BlockEntry,
  ToneKey,
  PaletteColor,
  RGB,
} from '$lib/types/colours.js';
import type { SupportedVersion, ColorSpace } from '$lib/types/settings.js';
import { rgb2lab, rgb2oklab, rgb2oklch, rgb2ycbcr, rgb2hsl, rgbToHex } from './colorSpace.js';

/**
 * Build the active palette from the current settings.
 *
 * @param coloursJSON  Full colour database
 * @param selectedBlocks  Map of colourSetId → blockId ("-1" = disabled)
 * @param toneKeys  Array of tones to include based on staircasing mode
 * @returns Array of PaletteColor entries with precomputed LAB/Oklab
 */
export function buildActivePalette(
  coloursJSON: ColoursJSON,
  selectedBlocks: Record<string, string>,
  toneKeys: ToneKey[],
): PaletteColor[] {
  const palette: PaletteColor[] = [];
  let index = 0;

  for (const [colourSetId, blockId] of Object.entries(selectedBlocks)) {
    if (blockId === '-1') continue;
    const colourSet = coloursJSON[colourSetId];
    if (!colourSet) continue;

    for (const toneKey of toneKeys) {
      const rgb = colourSet.tonesRGB[toneKey];
      if (!rgb) continue;

      palette.push({
        colourSetId,
        toneKey,
        rgb: rgb as RGB,
        lab: rgb2lab(rgb as RGB),
        oklab: rgb2oklab(rgb as RGB),
        oklch: rgb2oklch(rgb as RGB),
        ycbcr: rgb2ycbcr(rgb as RGB),
        hsl: rgb2hsl(rgb as RGB),
        hex: rgbToHex(rgb as RGB),
        paletteIndex: index++,
      });
    }
  }

  return palette;
}

/**
 * Get the tone keys for a given staircasing mode.
 */
export function getToneKeysForStaircasing(staircasingId: number, mapModes: any): ToneKey[] {
  // Search through all map modes to find the matching staircasing config
  for (const mode of Object.values(mapModes) as any[]) {
    for (const stairMode of Object.values(mode.staircaseModes) as any[]) {
      if (stairMode.uniqueId === staircasingId) {
        return stairMode.toneKeys as ToneKey[];
      }
    }
  }
  return ['normal'];
}

/**
 * Get the block NBT data for a specific MC version.
 * Handles reference strings like "&1.12.2".
 */
export function getBlockNBTData(
  block: BlockEntry,
  mcVersion: string,
): { NBTName: string; NBTArgs: Record<string, string> } | null {
  let data = block.validVersions[mcVersion];
  if (typeof data === 'string') {
    // Reference to another version: "&1.12.2"
    data = block.validVersions[data.slice(1)];
  }
  if (!data || typeof data === 'string') return null;
  return data;
}

/**
 * Check if a block is available in a given MC version.
 */
export function isBlockAvailable(block: BlockEntry, mcVersion: string): boolean {
  return getBlockNBTData(block, mcVersion) !== null;
}

/**
 * Filter coloursJSON to only include blocks valid for a given MC version.
 * Returns a new coloursJSON with only available blocks.
 */
export function filterBlocksByVersion(
  coloursJSON: ColoursJSON,
  version: SupportedVersion,
): ColoursJSON {
  const filtered: ColoursJSON = {};
  for (const [colourSetId, colourSet] of Object.entries(coloursJSON)) {
    const validBlocks: Record<string, BlockEntry> = {};
    for (const [blockId, block] of Object.entries(colourSet.blocks)) {
      if (isBlockAvailable(block, version.MCVersion)) {
        validBlocks[blockId] = block;
      }
    }
    if (Object.keys(validBlocks).length > 0) {
      filtered[colourSetId] = {
        ...colourSet,
        blocks: validBlocks,
      };
    }
  }
  return filtered;
}

/**
 * Initialize selectedBlocks with all colour sets set to "-1" (disabled).
 */
export function initSelectedBlocks(coloursJSON: ColoursJSON): Record<string, string> {
  const selected: Record<string, string> = {};
  for (const colourSetId of Object.keys(coloursJSON)) {
    selected[colourSetId] = '-1';
  }
  return selected;
}

/**
 * Initialize selectedBlocks with the Carpets preset applied.
 */
export function initSelectedBlocksWithCarpets(coloursJSON: ColoursJSON): Record<string, string> {
  const selected = initSelectedBlocks(coloursJSON);
  // Carpets preset: [colourSetId, presetIndex] pairs
  const carpetBlocks: [number, number][] = [
    [13,1],[14,1],[15,1],[16,1],[17,1],[18,1],[19,1],[20,1],
    [21,1],[22,1],[23,1],[24,1],[25,1],[26,1],[27,1],[28,1]
  ];
  for (const [csId, presetIndex] of carpetBlocks) {
    const csKey = csId.toString();
    if (!(csKey in coloursJSON)) continue;
    const found = Object.entries(coloursJSON[csKey].blocks).find(
      ([, block]) => block.presetIndex === presetIndex,
    );
    if (found) {
      selected[csKey] = found[0];
    }
  }
  return selected;
}

/**
 * Apply a preset to selectedBlocks.
 * A preset is a mapping of colourSetId → blockId.
 */
export function applyPreset(
  coloursJSON: ColoursJSON,
  preset: Record<string, string>,
  version: SupportedVersion,
): Record<string, string> {
  const selected = initSelectedBlocks(coloursJSON);
  for (const [colourSetId, blockId] of Object.entries(preset)) {
    if (colourSetId in selected) {
      const colourSet = coloursJSON[colourSetId];
      if (colourSet && blockId in colourSet.blocks) {
        const block = colourSet.blocks[blockId];
        if (isBlockAvailable(block, version.MCVersion)) {
          selected[colourSetId] = blockId;
        }
      }
    }
  }
  return selected;
}
