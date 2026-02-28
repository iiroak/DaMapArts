/**
 * Schematic NBT builder — converts colour layout data into Minecraft
 * structure block NBT format with proper staircasing, noobline, and
 * support block placement.
 *
 * Faithfully ports the original mapartcraft Map_NBT class.
 */
import { NBTWriter, TagTypes, type NBTTopLevel, type NBTCompound } from './nbt.js';
import type { ColoursJSON, BlockVersionData, ToneKey } from '$lib/types/colours.js';

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
    let data = block.validVersions[this.options.version.MCVersion];
    if (typeof data === 'string') {
      // Reference like "&1.12.2"
      data = block.validVersions[data.slice(1)];
    }
    return data as BlockVersionData;
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
    const blockId = this.options.selectedBlocks[csId];
    return this.options.coloursJSON[csId].blocks[blockId].supportBlockMandatory;
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

    for (let row = 0; row < column.length; row++) {
      const block = column[row];
      const previousHeight = currentHeight;

      switch (block.tone) {
        case 'dark':
          currentHeight -= 1;
          break;
        case 'normal':
          break;
        case 'light':
          currentHeight += 1;
          break;
      }

      physicalColumn.push(
        this.returnPhysicalBlock(columnNumber, currentHeight, row + 1, block.colourSetId),
      );

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

      default:
        throw new Error('Unknown support-blocks option');
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

  private setNbtJsonSize(): void {
    const sizeArray = (this.nbtJson.value.size as any).value.value as number[];
    sizeArray.push(
      this.mapColoursLayout.length,
      Math.max(...this.columnHeightsCache) + 1,
      this.mapColoursLayout[0].length + 1,
    );
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

    this.setNbtJsonSize();

    const writer = new NBTWriter();
    writer.writeTopLevelCompound(this.nbtJson);
    return writer.getData();
  }
}
