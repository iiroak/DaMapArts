/**
 * Map.dat builder — converts colour layout data into Minecraft map.dat
 * NBT format for use as in-game map items.
 *
 * Faithfully ports the original mapartcraft Map_Mapdat class.
 */
import { NBTWriter, TagTypes, type NBTTopLevel } from './nbt.js';
import type { ColoursJSON, ToneKey } from '$lib/types/colours.js';
import type { ColourLayoutEntry } from './schematic.js';

export interface MapdatOptions {
  version: { MCVersion: string; NBTVersion: number };
  coloursJSON: ColoursJSON;
}

export class MapdatBuilder {
  private coloursLayout: ColourLayoutEntry[][];
  private options: MapdatOptions;
  private nbtJson: NBTTopLevel;

  constructor(coloursLayout: ColourLayoutEntry[][], options: MapdatOptions) {
    this.coloursLayout = coloursLayout;
    this.options = options;

    const dataVersion = options.version.NBTVersion;

    this.nbtJson = {
      name: '',
      value: {
        data: {
          type: TagTypes.compound,
          value: {
            scale: { type: TagTypes.byte, value: 0 },
            dimension: {
              type: dataVersion >= 2566 ? TagTypes.string : TagTypes.byte,
              value: dataVersion >= 2566 ? 'minecraft:overworld' : dataVersion > 1343 ? 0 : -128,
            },
            unlimitedTracking: { type: TagTypes.byte, value: 0 },
            trackingPosition: { type: TagTypes.byte, value: 0 },
            locked: { type: TagTypes.byte, value: 1 },
            height: { type: TagTypes.short, value: 128 },
            width: { type: TagTypes.short, value: 128 },
            xCenter: { type: TagTypes.int, value: 0 },
            zCenter: { type: TagTypes.int, value: 0 },
            colors: {
              type: TagTypes.byteArray,
              value: new Uint8Array(16384),
            },
          },
        },
        DataVersion: { type: TagTypes.int, value: dataVersion },
      },
    };
  }

  /**
   * Convert a tone key to the mapdat ID offset.
   *  dark = base * 4 + 0
   *  normal = base * 4 + 1
   *  light = base * 4 + 2
   *  unobtainable = base * 4 + 3
   */
  private toneToOffset(tone: ToneKey): number {
    switch (tone) {
      case 'dark':
        return 0;
      case 'normal':
        return 1;
      case 'light':
        return 2;
      case 'unobtainable':
        return 3;
    }
  }

  private setColors(onProgress?: (percent: number) => void): void {
    const colors = (this.nbtJson.value.data as any).value.colors.value as Uint8Array;

    for (let x = 0; x < 128; x++) {
      for (let z = 0; z < 128; z++) {
        const pixel = this.coloursLayout[x][z];
        const arrayOffset = z * 128 + x;

        let mapdatId: number;
        if (pixel.colourSetId === '-1') {
          // Transparent
          mapdatId = 1;
        } else {
          const baseId = this.options.coloursJSON[pixel.colourSetId].mapdatId;
          mapdatId = 4 * baseId + this.toneToOffset(pixel.tone);
        }

        colors[arrayOffset] = mapdatId;
      }
      onProgress?.((x + 1) / 128);
    }
  }

  /**
   * Build the complete map.dat NBT binary data.
   */
  build(onProgress?: (percent: number) => void): ArrayBuffer {
    this.setColors(onProgress);

    const writer = new NBTWriter();
    writer.writeTopLevelCompound(this.nbtJson);
    return writer.getData();
  }
}
