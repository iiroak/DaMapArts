/**
 * Schematic NBT builder — converts colour layout data into Minecraft
 * structure block NBT format with proper staircasing, noobline, and
 * support block placement.
 *
 * Faithfully ports the original mapartcraft Map_NBT class.
 */
import { NBTWriter, TagTypes, type NBTTopLevel, type NBTCompound } from './nbt.js';
import type { ColoursJSON, BlockVersionData, ToneKey } from '$lib/types/colours.js';
import { getBlockNBTData } from '$lib/palette/colours.js';

// ── Types ──

export interface ColourLayoutEntry {
  colourSetId: string;
  tone: ToneKey;
}

export interface MapData {
  coloursLayout: ColourLayoutEntry[][];
  materials: Record<string, number>;
}

export interface SchematicOptions {
  coloursJSON: ColoursJSON;
  version: { MCVersion: string; NBTVersion: number };
  staircasingId: number;
  whereSupportBlocks: number;
  supportBlock: string;
  waterSupportEnabled: boolean;
  normalizeExport: boolean;
  selectedBlocks: Record<string, string>;
}

/** Staircase mode IDs from mapModes.json (NBT mode) */
const StaircaseModes = {
  OFF: 0,
  CLASSIC: 1,
  VALLEY: 2,
  FULL_DARK: 3,
  FULL_LIGHT: 4,
} as const;

/** Support block placement modes from whereSupportBlocksModes.json */
const SupportBlockModes = {
  NONE: 0,
  IMPORTANT: 1,
  ALL_OPTIMIZED: 2,
  ALL_DOUBLE_OPTIMIZED: 3,
  WATER: 4,
} as const;

// ── Physical block ──

interface PhysicalBlock {
  pos: { type: typeof TagTypes.list; value: { type: typeof TagTypes.int; value: number[] } };
  state: { type: typeof TagTypes.int; value: number };
}

// ── SchematicBuilder class ──

export class SchematicBuilder {
  private mapColoursLayout: ColourLayoutEntry[][];
  private mapMaterialsCounts: Record<string, number>;
  private options: SchematicOptions;

  private nbtJson: NBTTopLevel;
  private paletteCsId2PaletteId: Record<string, number> = {};
  private palettePaletteId2CsId: string[] = [];
  private columnHeightsCache: number[] = [];
  private builtMaterialCounts: Record<string, number> = {};

  constructor(map: MapData, options: SchematicOptions) {
    this.mapColoursLayout = map.coloursLayout;
    this.mapMaterialsCounts = map.materials;
    this.options = options;

    this.nbtJson = {
      name: '',
      value: {
        blocks: {
          type: TagTypes.list,
          value: { type: TagTypes.compound, value: [] },
        },
        entities: {
          type: TagTypes.list,
          value: { type: TagTypes.compound, value: [] },
        },
        palette: {
          type: TagTypes.list,
          value: { type: TagTypes.compound, value: [] },
        },
        size: {
          type: TagTypes.list,
          value: { type: TagTypes.int, value: [] },
        },
        author: {
          type: TagTypes.string,
          value: 'damaparts',
        },
        DataVersion: {
          type: TagTypes.int,
          value: 0,
        },
      },
    };
  }

  // ── Palette lookups ──

  private constructPaletteLookups(): void {
    const nonZero = Object.entries(this.mapMaterialsCounts).filter(([, v]) => v !== 0);
    for (const [csId] of nonZero) {
      this.paletteCsId2PaletteId[csId] = this.palettePaletteId2CsId.length;
      this.palettePaletteId2CsId.push(csId);
    }
    // Add scaffold/noobline support block at the end
    this.paletteCsId2PaletteId['NOOBLINE_SCAFFOLD'] = this.palettePaletteId2CsId.length;
    this.palettePaletteId2CsId.push('NOOBLINE_SCAFFOLD');
  }

  private resolveBlockNBTData(colourSetId: string): BlockVersionData {
    const blockId = this.options.selectedBlocks[colourSetId];
    const block = this.options.coloursJSON[colourSetId].blocks[blockId];
    const data = getBlockNBTData(block, this.options.version.MCVersion);
    if (!data) {
      throw new Error(`No valid block NBT data for colourSet ${colourSetId} in version ${this.options.version.MCVersion}`);
    }
    return data;
  }

  private setNbtJsonPalette(): void {
    const paletteArray = (this.nbtJson.value.palette as any).value.value as any[];
    for (const csId of this.palettePaletteId2CsId) {
      const item: Record<string, any> = {};
      if (csId === 'NOOBLINE_SCAFFOLD') {
        item.Name = {
          type: TagTypes.string,
          value: `minecraft:${this.options.supportBlock.toLowerCase()}`,
        };
      } else {
        const nbtData = this.resolveBlockNBTData(csId);
        item.Name = {
          type: TagTypes.string,
          value: `minecraft:${nbtData.NBTName}`,
        };
        if (Object.keys(nbtData.NBTArgs).length > 0) {
          item.Properties = { type: TagTypes.compound, value: {} as NBTCompound };
          for (const [key, val] of Object.entries(nbtData.NBTArgs)) {
            (item.Properties.value as NBTCompound)[key] = {
              type: TagTypes.string,
              value: val,
            };
          }
        }
      }
      paletteArray.push(item);
    }
  }

  private setNbtJsonDataVersion(): void {
    (this.nbtJson.value.DataVersion as any).value = this.options.version.NBTVersion;
  }

  // ── Physical block helpers ──

  private returnPhysicalBlock(x: number, y: number, z: number, colourSetId: string): PhysicalBlock {
    return {
      pos: { type: TagTypes.list, value: { type: TagTypes.int, value: [x, y, z] } },
      state: { type: TagTypes.int, value: this.paletteCsId2PaletteId[colourSetId] },
    };
  }

  private isSupportBlockMandatory(entry: ColourLayoutEntry): boolean {
    const csId = entry.colourSetId;
    if (csId === '-1') return false;
    const blockId = this.options.selectedBlocks[csId];
    const block = this.options.coloursJSON[csId]?.blocks?.[blockId];
    if (!block) return false;

    if (block.supportBlockMandatory) return true;

    const nbtData = getBlockNBTData(block, this.options.version.MCVersion);
    const rawName = (nbtData?.NBTName ?? '').toLowerCase();
    return this.isLikelyFragileBlockName(rawName);
  }

  private isLikelyFragileBlockName(rawName: string): boolean {
    if (!rawName) return false;

    return (
      rawName.endsWith('_carpet') ||
      rawName.endsWith('_pressure_plate') ||
      rawName.endsWith('_button') ||
      rawName.endsWith('_sign') ||
      rawName.endsWith('_hanging_sign') ||
      rawName.endsWith('_banner') ||
      rawName.endsWith('_torch') ||
      rawName.endsWith('_candle') ||
      rawName.endsWith('_trapdoor') ||
      rawName.endsWith('_door') ||
      rawName === 'carpet' ||
      rawName === 'lily_pad' ||
      rawName === 'sea_pickle' ||
      rawName === 'scaffolding' ||
      rawName === 'snow' ||
      rawName === 'lantern'
    );
  }

  private isWaterColour(entry: ColourLayoutEntry): boolean {
    if (entry.colourSetId === '-1') return false;
    return this.options.coloursJSON[entry.colourSetId]?.mapdatId === 12;
  }

  private getWaterDepth(tone: ToneKey, x: number, z: number): number {
    if (tone === 'light') return 1;
    const even = (x + z) % 2 === 0;
    if (tone === 'normal') return even ? 5 : 3;
    return even ? 10 : 7;
  }

  // ── Column layout ──

  private getPhysicalLayoutColumn(
    columnNumber: number,
    onProgress?: (percent: number) => void,
  ): void {
    const column = this.mapColoursLayout[columnNumber];
    const physicalColumn: PhysicalBlock[] = [];
    let currentHeight: number;

    switch (this.options.staircasingId) {
      case StaircaseModes.OFF:
        currentHeight = 2;
        break;
      case StaircaseModes.CLASSIC:
      case StaircaseModes.VALLEY:
        currentHeight = 0;
        break;
      case StaircaseModes.FULL_DARK:
        currentHeight = 1 + column.length;
        break;
      case StaircaseModes.FULL_LIGHT:
        currentHeight = 1;
        break;
      default:
        throw new Error('Unknown staircase mode');
    }

    // Noobline
    physicalColumn.push(this.returnPhysicalBlock(columnNumber, currentHeight, 0, 'NOOBLINE_SCAFFOLD'));

    let previousWater:
      | {
          bottom: number;
          depth: number;
          top: number;
        }
      | undefined;

    for (let row = 0; row < column.length; row++) {
      const block = column[row];
      const previousHeight = currentHeight;

      if (this.isWaterColour(block)) {
        const depth = this.getWaterDepth(block.tone, columnNumber, row + 1);
        const bottom = previousWater ? previousWater.bottom : previousHeight;
        const top = bottom + depth - 1;

        for (let depthIndex = 0; depthIndex < depth; depthIndex++) {
          physicalColumn.push(
            this.returnPhysicalBlock(columnNumber, bottom + depthIndex, row + 1, block.colourSetId),
          );
        }

        currentHeight = top;
        previousWater = { bottom, depth, top };
      } else {
        switch (block.tone) {
          case 'dark': {
            const isDeepWater = !!previousWater && previousWater.depth > 1;
            if (isDeepWater) {
              currentHeight = previousWater!.bottom;
            } else {
              const darkReference = previousWater ? previousWater.bottom : previousHeight;
              currentHeight = darkReference - 1;
            }
            break;
          }
          case 'normal':
            currentHeight = previousHeight;
            break;
          case 'light':
            currentHeight = previousHeight + 1;
            break;
          case 'unobtainable': {
            const darkReference = previousWater ? previousWater.bottom : previousHeight;
            currentHeight = darkReference - 1;
            break;
          }
        }

        previousWater = undefined;

        physicalColumn.push(
          this.returnPhysicalBlock(columnNumber, currentHeight, row + 1, block.colourSetId),
        );
      }

      // Support blocks
      this.addSupportBlocks(physicalColumn, column, columnNumber, row, currentHeight, previousHeight, block);
    }

    // Sort by Z then Y (descending)
    physicalColumn.sort((a, b) => {
      const az = a.pos.value.value[2];
      const bz = b.pos.value.value[2];
      if (az !== bz) return az - bz;
      return b.pos.value.value[1] - a.pos.value.value[1];
    });

    // Post-process for staircase modes
    this.postProcessColumn(physicalColumn);

    // Append to blocks
    const blocksArray = (this.nbtJson.value.blocks as any).value.value as PhysicalBlock[];
    for (const b of physicalColumn) blocksArray.push(b);

    // Cache max height
    const maxY = physicalColumn.reduce((max, b) => Math.max(max, b.pos.value.value[1]), 0);
    this.columnHeightsCache.push(maxY);
  }

  private addSupportBlocks(
    physicalColumn: PhysicalBlock[],
    column: ColourLayoutEntry[],
    columnNumber: number,
    row: number,
    currentHeight: number,
    previousHeight: number,
    block: ColourLayoutEntry,
  ): void {
    const supportMode = this.options.whereSupportBlocks;

    switch (supportMode) {
      case SupportBlockModes.NONE:
        break;

      case SupportBlockModes.IMPORTANT:
        if (this.isSupportBlockMandatory(block)) {
          physicalColumn.push(this.returnPhysicalBlock(columnNumber, currentHeight - 1, row + 1, 'NOOBLINE_SCAFFOLD'));
        }
        break;

      case SupportBlockModes.ALL_OPTIMIZED:
        this.addAllOptimizedSupport(physicalColumn, column, columnNumber, row, currentHeight, previousHeight, block);
        break;

      case SupportBlockModes.ALL_DOUBLE_OPTIMIZED:
        this.addAllDoubleOptimizedSupport(physicalColumn, column, columnNumber, row, currentHeight, previousHeight, block);
        break;

      case SupportBlockModes.WATER:
        break;

      default:
        throw new Error('Unknown support-blocks option');
    }
  }

  private addWaterSupportBlocks(): void {
    const blocksArray = (this.nbtJson.value.blocks as any).value.value as PhysicalBlock[];
    if (blocksArray.length === 0) return;

    const occupied = new Set<string>();
    const waterPositions: Array<{ x: number; y: number; z: number }> = [];

    for (const block of blocksArray) {
      const [x, y, z] = block.pos.value.value;
      occupied.add(`${x},${y},${z}`);

      const csId = this.palettePaletteId2CsId[block.state.value];
      if (csId !== 'NOOBLINE_SCAFFOLD' && this.options.coloursJSON[csId]?.mapdatId === 12) {
        waterPositions.push({ x, y, z });
      }
    }

    const additions: PhysicalBlock[] = [];
    for (const water of waterPositions) {
      const neighbors = [
        { x: water.x, y: water.y, z: water.z - 1 },
        { x: water.x, y: water.y, z: water.z + 1 },
        { x: water.x - 1, y: water.y, z: water.z },
        { x: water.x + 1, y: water.y, z: water.z },
        { x: water.x, y: water.y - 1, z: water.z },
      ];

      for (const neighbor of neighbors) {
        if (neighbor.y < 0) continue;
        const key = `${neighbor.x},${neighbor.y},${neighbor.z}`;
        if (occupied.has(key)) continue;
        occupied.add(key);
        additions.push(this.returnPhysicalBlock(neighbor.x, neighbor.y, neighbor.z, 'NOOBLINE_SCAFFOLD'));
      }
    }

    for (const addition of additions) {
      blocksArray.push(addition);
    }
  }

  private addAllOptimizedSupport(
    physicalColumn: PhysicalBlock[],
    column: ColourLayoutEntry[],
    columnNumber: number,
    row: number,
    currentHeight: number,
    previousHeight: number,
    block: ColourLayoutEntry,
  ): void {
    switch (row) {
      case 0: {
        if (
          block.tone === 'dark' ||
          (block.tone === 'normal' && this.isSupportBlockMandatory(block))
        ) {
          physicalColumn.push(this.returnPhysicalBlock(columnNumber, previousHeight - 1, row, 'NOOBLINE_SCAFFOLD'));
        }
        if (block.tone === 'dark' && this.isSupportBlockMandatory(block)) {
          physicalColumn.push(this.returnPhysicalBlock(columnNumber, previousHeight - 2, row, 'NOOBLINE_SCAFFOLD'));
        }
        break;
      }
      case 1: {
        const b0 = column[0];
        if (
          b0.tone === 'light' ||
          block.tone === 'dark' ||
          this.isSupportBlockMandatory(b0) ||
          (block.tone === 'normal' && this.isSupportBlockMandatory(block))
        ) {
          physicalColumn.push(this.returnPhysicalBlock(columnNumber, previousHeight - 1, row, 'NOOBLINE_SCAFFOLD'));
        }
        if (block.tone === 'dark' && this.isSupportBlockMandatory(block)) {
          physicalColumn.push(this.returnPhysicalBlock(columnNumber, previousHeight - 2, row, 'NOOBLINE_SCAFFOLD'));
        }
        break;
      }
      default: {
        // Handle last row (falls through to default)
        if (row === column.length - 1) {
          const bNorth = column[row - 1];
          if (
            block.tone === 'light' ||
            this.isSupportBlockMandatory(block) ||
            (block.tone === 'normal' && this.isSupportBlockMandatory(bNorth))
          ) {
            physicalColumn.push(this.returnPhysicalBlock(columnNumber, currentHeight - 1, row + 1, 'NOOBLINE_SCAFFOLD'));
          }
          if (block.tone === 'light' && this.isSupportBlockMandatory(bNorth)) {
            physicalColumn.push(this.returnPhysicalBlock(columnNumber, currentHeight - 2, row + 1, 'NOOBLINE_SCAFFOLD'));
          }
        }
        // Default support logic
        const bNorth2 = column[row - 2];
        const bInQuestion = column[row - 1];
        if (
          bInQuestion.tone === 'light' ||
          block.tone === 'dark' ||
          this.isSupportBlockMandatory(bInQuestion) ||
          (block.tone === 'normal' && this.isSupportBlockMandatory(block)) ||
          (bInQuestion.tone === 'normal' && this.isSupportBlockMandatory(bNorth2))
        ) {
          physicalColumn.push(this.returnPhysicalBlock(columnNumber, previousHeight - 1, row, 'NOOBLINE_SCAFFOLD'));
        }
        if (
          (block.tone === 'dark' && this.isSupportBlockMandatory(block)) ||
          (bInQuestion.tone === 'light' && this.isSupportBlockMandatory(bNorth2))
        ) {
          physicalColumn.push(this.returnPhysicalBlock(columnNumber, previousHeight - 2, row, 'NOOBLINE_SCAFFOLD'));
        }
        break;
      }
    }
  }

  private addAllDoubleOptimizedSupport(
    physicalColumn: PhysicalBlock[],
    column: ColourLayoutEntry[],
    columnNumber: number,
    row: number,
    currentHeight: number,
    previousHeight: number,
    block: ColourLayoutEntry,
  ): void {
    switch (row) {
      case 0: {
        physicalColumn.push(this.returnPhysicalBlock(columnNumber, previousHeight - 1, row, 'NOOBLINE_SCAFFOLD'));
        if (block.tone === 'dark') {
          physicalColumn.push(this.returnPhysicalBlock(columnNumber, previousHeight - 2, row, 'NOOBLINE_SCAFFOLD'));
        }
        break;
      }
      default: {
        // Handle last row (falls through to default)
        if (row === column.length - 1) {
          physicalColumn.push(this.returnPhysicalBlock(columnNumber, currentHeight - 1, row + 1, 'NOOBLINE_SCAFFOLD'));
          if (block.tone === 'light') {
            physicalColumn.push(this.returnPhysicalBlock(columnNumber, currentHeight - 2, row + 1, 'NOOBLINE_SCAFFOLD'));
          }
        }
        // Default
        physicalColumn.push(this.returnPhysicalBlock(columnNumber, previousHeight - 1, row, 'NOOBLINE_SCAFFOLD'));
        const bInQuestion = column[row - 1];
        if (bInQuestion.tone === 'light' || block.tone === 'dark') {
          physicalColumn.push(this.returnPhysicalBlock(columnNumber, previousHeight - 2, row, 'NOOBLINE_SCAFFOLD'));
        }
        break;
      }
    }
  }

  // ── Post-process staircase modes ──

  private postProcessColumn(physicalColumn: PhysicalBlock[]): void {
    switch (this.options.staircasingId) {
      case StaircaseModes.VALLEY:
        this.applyValleyMode(physicalColumn);
        break;

      case StaircaseModes.CLASSIC: {
        const minY = physicalColumn.reduce(
          (min, b) => Math.min(min, b.pos.value.value[1]),
          Infinity,
        );
        for (const block of physicalColumn) {
          block.pos.value.value[1] -= minY;
        }
        break;
      }

      case StaircaseModes.OFF:
      case StaircaseModes.FULL_DARK:
      case StaircaseModes.FULL_LIGHT:
        break;

      default:
        throw new Error('Unknown staircase mode');
    }
  }

  private applyValleyMode(physicalColumn: PhysicalBlock[]): void {
    const plateaus: Array<{ startIndex: number; endIndex: number }> = [
      { startIndex: 0, endIndex: 0 },
    ];

    let ascending = false;
    let currentPlateauStartIndex = 0;
    let visibleBlocksHeight = physicalColumn[0].pos.value.value[1];

    for (let i = 0; i < physicalColumn.length; i++) {
      const block = physicalColumn[i];
      const csId = this.palettePaletteId2CsId[block.state.value];
      if (csId === 'NOOBLINE_SCAFFOLD') continue;

      const y = block.pos.value.value[1];
      if (ascending && y < visibleBlocksHeight) {
        ascending = false;
        plateaus.push({ startIndex: currentPlateauStartIndex, endIndex: i });
      } else if (y > visibleBlocksHeight) {
        ascending = true;
        currentPlateauStartIndex = i;
      }
      visibleBlocksHeight = y;
    }

    plateaus.push({ startIndex: physicalColumn.length, endIndex: physicalColumn.length });

    const nonPlateauPulldownHeights = [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];

    while (plateaus.length > 1) {
      let pullDownHeight = Number.MAX_SAFE_INTEGER;
      for (let i = plateaus[0].endIndex; i < plateaus[1].startIndex; i++) {
        pullDownHeight = Math.min(physicalColumn[i].pos.value.value[1], pullDownHeight);
      }
      for (let i = plateaus[0].endIndex; i < plateaus[1].startIndex; i++) {
        physicalColumn[i].pos.value.value[1] -= pullDownHeight;
      }
      nonPlateauPulldownHeights[1] = pullDownHeight;

      const plateauPulldownHeight = Math.min(...nonPlateauPulldownHeights);
      for (let i = plateaus[0].startIndex; i < plateaus[0].endIndex; i++) {
        physicalColumn[i].pos.value.value[1] -= plateauPulldownHeight;
      }
      plateaus.shift();
      nonPlateauPulldownHeights[0] = nonPlateauPulldownHeights[1];
    }
  }

  // ── Size ──

  private normalizeBlocksToOrigin(): void {
    const blocksArray = (this.nbtJson.value.blocks as any).value.value as PhysicalBlock[];
    if (blocksArray.length === 0) return;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;

    for (const block of blocksArray) {
      const [x, y, z] = block.pos.value.value;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
    }

    if (minX === 0 && minY === 0 && minZ === 0) return;

    for (const block of blocksArray) {
      block.pos.value.value[0] -= minX;
      block.pos.value.value[1] -= minY;
      block.pos.value.value[2] -= minZ;
    }
  }

  private ensureNoNegativeCoordinates(): void {
    const blocksArray = (this.nbtJson.value.blocks as any).value.value as PhysicalBlock[];
    for (const block of blocksArray) {
      const [x, y, z] = block.pos.value.value;
      if (x < 0 || y < 0 || z < 0) {
        throw new Error(
          'Export contains negative coordinates. Enable "Normalize export" or adjust settings.',
        );
      }
    }
  }

  private setNbtJsonSize(): void {
    const sizeArray = (this.nbtJson.value.size as any).value.value as number[];

    const blocksArray = (this.nbtJson.value.blocks as any).value.value as PhysicalBlock[];
    if (blocksArray.length === 0) {
      sizeArray.push(this.mapColoursLayout.length, 1, this.mapColoursLayout[0].length + 1);
      return;
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (const block of blocksArray) {
      const [x, y, z] = block.pos.value.value;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;
    }

    sizeArray.push(maxX - minX + 1, maxY - minY + 1, maxZ - minZ + 1);
  }

  private buildRealMaterialCountsFromPlacedBlocks(): void {
    const counts: Record<string, number> = {};
    const blocksArray = (this.nbtJson.value.blocks as any).value.value as PhysicalBlock[];

    for (const block of blocksArray) {
      const paletteId = block.state.value;
      const csId = this.palettePaletteId2CsId[paletteId];
      if (!csId) continue;

      if (csId === 'NOOBLINE_SCAFFOLD') {
        const key = this.options.supportBlock;
        counts[key] = (counts[key] || 0) + 1;
        continue;
      }

      const selectedBlockId = this.options.selectedBlocks[csId];
      const selectedBlock = this.options.coloursJSON[csId]?.blocks?.[selectedBlockId];
      const key = selectedBlock?.displayName ?? `ColourSet ${csId}`;
      counts[key] = (counts[key] || 0) + 1;
    }

    this.builtMaterialCounts = counts;
  }

  /** Returns material counts from actual placed schematic blocks after build(). */
  getBuiltMaterialCounts(): Record<string, number> {
    return { ...this.builtMaterialCounts };
  }

  // ── Public API ──

  /**
   * Build the complete schematic NBT binary data.
   * @param onProgress Optional callback (0-1) for column progress
   */
  build(onProgress?: (percent: number) => void): ArrayBuffer {
    this.constructPaletteLookups();
    this.setNbtJsonPalette();
    this.setNbtJsonDataVersion();

    // Build blocks column by column
    for (let col = 0; col < this.mapColoursLayout.length; col++) {
      this.getPhysicalLayoutColumn(col);
      onProgress?.((col + 1) / this.mapColoursLayout.length);
    }

    if (this.options.whereSupportBlocks === SupportBlockModes.WATER || this.options.waterSupportEnabled) {
      this.addWaterSupportBlocks();
    }

    if (this.options.normalizeExport) {
      this.normalizeBlocksToOrigin();
    } else {
      this.ensureNoNegativeCoordinates();
    }

    this.buildRealMaterialCountsFromPlacedBlocks();

    this.setNbtJsonSize();

    const writer = new NBTWriter();
    writer.writeTopLevelCompound(this.nbtJson);
    return writer.getData();
  }
}
