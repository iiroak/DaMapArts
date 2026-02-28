/**
 * Download manager — handles gzip compression, ZIP bundling, and
 * browser file downloads for NBT/mapdat exports.
 */
import { gzip } from 'pako';
import JSZip from 'jszip';
import type { ColoursJSON, ToneKey } from '$lib/types/colours.js';
import type { PixelEntry } from '$lib/processor/types.js';
import { SchematicBuilder, type ColourLayoutEntry, type MapData, type SchematicOptions } from './schematic.js';
import { MapdatBuilder, type MapdatOptions } from './mapdat.js';

// ── Helpers ──

/** Build an exact colour cache: RGB → { colourSetId, tone } */
function buildExactColourCache(
  coloursJSON: ColoursJSON,
): Map<number, { colourSetId: string; tone: ToneKey }> {
  const cache = new Map<number, { colourSetId: string; tone: ToneKey }>();
  for (const [csId, cs] of Object.entries(coloursJSON)) {
    for (const [tone, rgb] of Object.entries(cs.tonesRGB)) {
      if (!rgb) continue;
      const key = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
      cache.set(key, { colourSetId: csId, tone: tone as ToneKey });
    }
  }
  // Special transparent
  cache.set(0, { colourSetId: '-1', tone: 'normal' });
  return cache;
}

/** Build coloursLayouts from processed pixelEntries for each 128×128 map section */
function buildColoursLayouts(
  pixelEntries: PixelEntry[],
  mapSizeX: number,
  mapSizeZ: number,
  totalWidth: number,
): { layouts: ColourLayoutEntry[][][][]; materialsPerMap: Record<string, number>[][] } {
  // layouts[mapZ][mapX] = ColourLayoutEntry[column128][row128]
  const layouts: ColourLayoutEntry[][][][] = [];
  const materialsPerMap: Record<string, number>[][] = [];

  for (let mz = 0; mz < mapSizeZ; mz++) {
    const layoutRow: ColourLayoutEntry[][][] = [];
    const matRow: Record<string, number>[] = [];
    for (let mx = 0; mx < mapSizeX; mx++) {
      const layout: ColourLayoutEntry[][] = [];
      const materials: Record<string, number> = {};

      for (let col = 0; col < 128; col++) {
        const columnEntries: ColourLayoutEntry[] = [];
        for (let row = 0; row < 128; row++) {
          const globalX = mx * 128 + col;
          const globalZ = mz * 128 + row;
          const idx = globalZ * totalWidth + globalX;
          const entry = pixelEntries[idx];

          columnEntries.push({
            colourSetId: entry.colourSetId,
            tone: entry.toneKey,
          });

          // Count materials
          if (entry.colourSetId !== '-1') {
            materials[entry.colourSetId] = (materials[entry.colourSetId] || 0) + 1;
          }
        }
        layout.push(columnEntries);
      }

      layoutRow.push(layout);
      matRow.push(materials);
    }
    layouts.push(layoutRow);
    materialsPerMap.push(matRow);
  }

  return { layouts, materialsPerMap };
}

/** Trigger a browser file download */
export function downloadBlobFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

// ── Export functions ──

export interface ExportSettings {
  coloursJSON: ColoursJSON;
  version: { MCVersion: string; NBTVersion: number };
  staircasingId: number;
  whereSupportBlocks: number;
  supportBlock: string;
  selectedBlocks: Record<string, string>;
  mapSizeX: number;
  mapSizeZ: number;
  filename: string;
  /** For map.dat naming with IDs */
  mapdatFilenameUseId: boolean;
  mapdatFilenameIdStart: number;
}

/**
 * Export joined NBT (single file, all maps merged).
 */
export async function exportNBTJoined(
  pixelEntries: PixelEntry[],
  settings: ExportSettings,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const totalWidth = settings.mapSizeX * 128;
  const { layouts, materialsPerMap } = buildColoursLayouts(
    pixelEntries,
    settings.mapSizeX,
    settings.mapSizeZ,
    totalWidth,
  );

  // Merge all maps into one
  const merged = mergeMaps(layouts, materialsPerMap, settings.mapSizeX, settings.mapSizeZ);

  const builder = new SchematicBuilder(merged, {
    coloursJSON: settings.coloursJSON,
    version: settings.version,
    staircasingId: settings.staircasingId,
    whereSupportBlocks: settings.whereSupportBlocks,
    supportBlock: settings.supportBlock,
    selectedBlocks: settings.selectedBlocks,
  });

  const nbtData = builder.build(onProgress);
  const gzipped = gzip(new Uint8Array(nbtData));
  const blob = new Blob([gzipped], { type: 'application/x-minecraft-level' });
  downloadBlobFile(blob, `${settings.filename}.nbt`);
}

/**
 * Export split NBTs (one per map section, bundled in ZIP).
 */
export async function exportNBTSplit(
  pixelEntries: PixelEntry[],
  settings: ExportSettings,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const totalWidth = settings.mapSizeX * 128;
  const { layouts, materialsPerMap } = buildColoursLayouts(
    pixelEntries,
    settings.mapSizeX,
    settings.mapSizeZ,
    totalWidth,
  );

  const zip = new JSZip();
  const totalMaps = settings.mapSizeX * settings.mapSizeZ;
  let completed = 0;

  for (let mz = 0; mz < settings.mapSizeZ; mz++) {
    for (let mx = 0; mx < settings.mapSizeX; mx++) {
      const mapData: MapData = {
        coloursLayout: layouts[mz][mx],
        materials: materialsPerMap[mz][mx],
      };

      const builder = new SchematicBuilder(mapData, {
        coloursJSON: settings.coloursJSON,
        version: settings.version,
        staircasingId: settings.staircasingId,
        whereSupportBlocks: settings.whereSupportBlocks,
        supportBlock: settings.supportBlock,
        selectedBlocks: settings.selectedBlocks,
      });

      const nbtData = builder.build();
      const gzipped = gzip(new Uint8Array(nbtData));
      zip.file(`${settings.filename}_${mx}_${mz}.nbt`, gzipped);

      completed++;
      onProgress?.(completed / totalMaps);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlobFile(content, `${settings.filename}.zip`);
}

/**
 * Export map.dat files (one per map section).
 */
export async function exportMapdatSplit(
  pixelEntries: PixelEntry[],
  settings: ExportSettings,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const totalWidth = settings.mapSizeX * 128;
  const { layouts } = buildColoursLayouts(
    pixelEntries,
    settings.mapSizeX,
    settings.mapSizeZ,
    totalWidth,
  );

  const totalMaps = settings.mapSizeX * settings.mapSizeZ;
  let completed = 0;

  for (let mz = 0; mz < settings.mapSizeZ; mz++) {
    for (let mx = 0; mx < settings.mapSizeX; mx++) {
      const builder = new MapdatBuilder(layouts[mz][mx], {
        version: settings.version,
        coloursJSON: settings.coloursJSON,
      });

      const nbtData = builder.build();
      const gzipped = gzip(new Uint8Array(nbtData));

      const filename = settings.mapdatFilenameUseId
        ? `map_${settings.mapdatFilenameIdStart + mz * settings.mapSizeX + mx}.dat`
        : `${settings.filename}_${mx}_${mz}.dat`;

      const blob = new Blob([gzipped], { type: 'application/x-minecraft-level' });
      downloadBlobFile(blob, filename);

      completed++;
      onProgress?.(completed / totalMaps);
    }
  }
}

/**
 * Export map.dat files in a ZIP archive.
 */
export async function exportMapdatZip(
  pixelEntries: PixelEntry[],
  settings: ExportSettings,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const totalWidth = settings.mapSizeX * 128;
  const { layouts } = buildColoursLayouts(
    pixelEntries,
    settings.mapSizeX,
    settings.mapSizeZ,
    totalWidth,
  );

  const zip = new JSZip();
  const totalMaps = settings.mapSizeX * settings.mapSizeZ;
  let completed = 0;

  for (let mz = 0; mz < settings.mapSizeZ; mz++) {
    for (let mx = 0; mx < settings.mapSizeX; mx++) {
      const builder = new MapdatBuilder(layouts[mz][mx], {
        version: settings.version,
        coloursJSON: settings.coloursJSON,
      });

      const nbtData = builder.build();
      const gzipped = gzip(new Uint8Array(nbtData));

      const filename = settings.mapdatFilenameUseId
        ? `map_${settings.mapdatFilenameIdStart + mz * settings.mapSizeX + mx}.dat`
        : `${settings.filename}_${mx}_${mz}.dat`;

      zip.file(filename, gzipped);
      completed++;
      onProgress?.(completed / totalMaps);
    }
  }

  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlobFile(content, `${settings.filename}.zip`);
}

/**
 * Export raw NBT ArrayBuffer (for 3D viewer / view online).
 * Returns the joined schematic as uncompressed NBT data.
 */
export function buildNBTForViewer(
  pixelEntries: PixelEntry[],
  settings: ExportSettings,
  onProgress?: (percent: number) => void,
): ArrayBuffer {
  const totalWidth = settings.mapSizeX * 128;
  const { layouts, materialsPerMap } = buildColoursLayouts(
    pixelEntries,
    settings.mapSizeX,
    settings.mapSizeZ,
    totalWidth,
  );

  const merged = mergeMaps(layouts, materialsPerMap, settings.mapSizeX, settings.mapSizeZ);

  const builder = new SchematicBuilder(merged, {
    coloursJSON: settings.coloursJSON,
    version: settings.version,
    staircasingId: settings.staircasingId,
    whereSupportBlocks: settings.whereSupportBlocks,
    supportBlock: settings.supportBlock,
    selectedBlocks: settings.selectedBlocks,
  });

  return builder.build(onProgress);
}

// ── Internal helpers ──

/** Merge all map sections into a single large map. */
function mergeMaps(
  layouts: ColourLayoutEntry[][][][],
  materialsPerMap: Record<string, number>[][],
  mapSizeX: number,
  mapSizeZ: number,
): MapData {
  // Merge along X axis first
  for (let mz = 0; mz < mapSizeZ; mz++) {
    for (let mx = 1; mx < mapSizeX; mx++) {
      for (let col = 0; col < 128; col++) {
        layouts[mz][0].push(layouts[mz][mx][col]);
      }
    }
  }

  // Merge along Z axis
  const mergedLayout = layouts[0][0];
  for (let col = 0; col < mergedLayout.length; col++) {
    for (let mz = 1; mz < mapSizeZ; mz++) {
      mergedLayout[col] = mergedLayout[col].concat(layouts[mz][0][col]);
    }
  }

  // Merge materials
  const mergedMaterials: Record<string, number> = {};
  for (let mz = 0; mz < mapSizeZ; mz++) {
    for (let mx = 0; mx < mapSizeX; mx++) {
      for (const [csId, count] of Object.entries(materialsPerMap[mz][mx])) {
        mergedMaterials[csId] = (mergedMaterials[csId] || 0) + count;
      }
    }
  }

  return {
    coloursLayout: mergedLayout,
    materials: mergedMaterials,
  };
}
