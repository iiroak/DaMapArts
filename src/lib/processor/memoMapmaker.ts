import type { PaletteColor, RGB, ToneKey } from '$lib/types/colours.js';
import type { ProcessorSettings, PixelEntry, MapSection } from './types.js';
import { rgb2lab } from '$lib/palette/colorSpace.js';
import { getOrderedMatrix } from '$lib/dither/ordered.js';

type RGBObj = { r: number; g: number; b: number };
type Gamut = { low: RGBObj; high: RGBObj };

type BestPick = {
  entry: PaletteColor;
  err: number;
  diff: RGBObj;
};

type SolveResult = {
  entries: PaletteColor[];
  heights: number[];
  errs: RGBObj[];
  totalError: number;
};

const DEFAULT_GAMUT: Gamut = {
  low: { r: 0, g: 0, b: 0 },
  high: { r: 255, g: 255, b: 255 },
};

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

function rgbObj(r: number, g: number, b: number): RGBObj {
  return { r, g, b };
}

function colorKey(r: number, g: number, b: number): number {
  return (clampByte(r) << 16) | (clampByte(g) << 8) | clampByte(b);
}

function parseHexColour(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16) || 0,
    parseInt(h.substring(2, 4), 16) || 0,
    parseInt(h.substring(4, 6), 16) || 0,
  ];
}

function buildGamut(palette: PaletteColor[]): Gamut {
  if (palette.length === 0) return DEFAULT_GAMUT;
  let minR = 255, minG = 255, minB = 255;
  let maxR = 0, maxG = 0, maxB = 0;
  for (const p of palette) {
    if (p.rgb[0] < minR) minR = p.rgb[0];
    if (p.rgb[1] < minG) minG = p.rgb[1];
    if (p.rgb[2] < minB) minB = p.rgb[2];
    if (p.rgb[0] > maxR) maxR = p.rgb[0];
    if (p.rgb[1] > maxG) maxG = p.rgb[1];
    if (p.rgb[2] > maxB) maxB = p.rgb[2];
  }
  return {
    low: rgbObj(minR, minG, minB),
    high: rgbObj(maxR, maxG, maxB),
  };
}

function cap(col: RGBObj, limits: Gamut, clampToPalette: boolean): RGBObj {
  const gamut = clampToPalette ? limits : DEFAULT_GAMUT;
  return {
    r: col.r < gamut.low.r ? gamut.low.r : col.r > gamut.high.r ? gamut.high.r : col.r,
    g: col.g < gamut.low.g ? gamut.low.g : col.g > gamut.high.g ? gamut.high.g : col.g,
    b: col.b < gamut.low.b ? gamut.low.b : col.b > gamut.high.b ? gamut.high.b : col.b,
  };
}

function errDiff(c1: RGBObj, c2: RGBObj, useLab: boolean): { err: number; diff: RGBObj } {
  if (useLab) {
    const l1 = rgb2lab([clampByte(c1.r), clampByte(c1.g), clampByte(c1.b)] as RGB);
    const l2 = rgb2lab([clampByte(c2.r), clampByte(c2.g), clampByte(c2.b)] as RGB);
    const dL = l1[0] - l2[0];
    const da = l1[1] - l2[1];
    const db = l1[2] - l2[2];
    return {
      err: dL * dL + da * da + db * db,
      diff: rgbObj(c1.r - c2.r, c1.g - c2.g, c1.b - c2.b),
    };
  }
  const dr = c1.r - c2.r;
  const dg = c1.g - c2.g;
  const db = c1.b - c2.b;
  return {
    err: dr * dr + dg * dg + db * db,
    diff: rgbObj(dr, dg, db),
  };
}

function findBest(
  color: RGBObj,
  pal: PaletteColor[],
  limits: Gamut,
  clampToPalette: boolean,
  useLab: boolean,
): BestPick {
  const capped = cap(color, limits, clampToPalette);
  let best = pal[0];
  let bestErr = Number.POSITIVE_INFINITY;
  let bestDiff = rgbObj(0, 0, 0);
  for (const p of pal) {
    const d = errDiff(capped, rgbObj(p.rgb[0], p.rgb[1], p.rgb[2]), useLab);
    if (d.err < bestErr) {
      bestErr = d.err;
      best = p;
      bestDiff = d.diff;
    }
  }
  return { entry: best, err: bestErr, diff: bestDiff };
}

function findBestTwo(
  color: RGBObj,
  pal: PaletteColor[],
  limits: Gamut,
  clampToPalette: boolean,
  useLab: boolean,
  chooser: number,
): [BestPick, BestPick] {
  const capped = cap(color, limits, clampToPalette);
  let best1: BestPick = { entry: pal[0], err: Number.POSITIVE_INFINITY, diff: rgbObj(0, 0, 0) };
  let best2: BestPick = { entry: pal[0], err: Number.POSITIVE_INFINITY, diff: rgbObj(0, 0, 0) };

  if (chooser === 1) {
    for (const p of pal) {
      const d = errDiff(capped, rgbObj(p.rgb[0], p.rgb[1], p.rgb[2]), useLab);
      if (d.err < best1.err) {
        best1 = { entry: p, err: d.err, diff: d.diff };
      } else if (d.err < best2.err) {
        best2 = { entry: p, err: d.err, diff: d.diff };
      }
    }
    return [best1, best2];
  }

  for (const p of pal) {
    const d = errDiff(capped, rgbObj(p.rgb[0], p.rgb[1], p.rgb[2]), useLab);
    if (d.err < best1.err) {
      best2 = best1;
      best1 = { entry: p, err: d.err, diff: d.diff };
    }
  }

  if (chooser === 2) {
    const target = cap(
      rgbObj(capped.r + best1.diff.r, capped.g + best1.diff.g, capped.b + best1.diff.b),
      limits,
      clampToPalette,
    );
    best2 = { entry: pal[0], err: Number.POSITIVE_INFINITY, diff: rgbObj(0, 0, 0) };
    for (const p of pal) {
      const d = errDiff(target, rgbObj(p.rgb[0], p.rgb[1], p.rgb[2]), useLab);
      if (d.err < best2.err) {
        best2 = { entry: p, err: d.err, diff: d.diff };
      }
    }
  }

  return [best1, best2];
}

function findBestPattern(
  color: RGBObj,
  pal: PaletteColor[],
  limits: Gamut,
  threshold: number,
  patsize: number,
  clampToPalette: boolean,
  useLab: boolean,
  chooser: number,
  discriminator: number,
): BestPick {
  const [a0, b0] = findBestTwo(color, pal, limits, clampToPalette, useLab, chooser);
  let a = a0;
  let b = b0;

  if (discriminator === 0) {
    const twoErr = errDiff(
      rgbObj(a.entry.rgb[0], a.entry.rgb[1], a.entry.rgb[2]),
      rgbObj(b.entry.rgb[0], b.entry.rgb[1], b.entry.rgb[2]),
      useLab,
    ).err;
    if (b.err - twoErr >= 0) {
      b = a;
    }
    if (b.err !== 0 && (a.err * (patsize + 1)) / b.err > threshold) {
      a = b;
    }
    return a;
  }

  const r1 = a.entry.rgb[0];
  const g1 = a.entry.rgb[1];
  const b1 = a.entry.rgb[2];
  const r2 = b.entry.rgb[0];
  const g2 = b.entry.rgb[1];
  const b2 = b.entry.rgb[2];
  const tv = rgbObj(color.r - r1, color.g - g1, color.b - b1);
  const cv = rgbObj(r2 - r1, g2 - g1, b2 - b1);
  const dot = tv.r * cv.r + tv.g * cv.g + tv.b * cv.b;
  const colorDot = cv.r * cv.r + cv.g * cv.g + cv.b * cv.b;
  let projected = colorDot !== 0 ? dot / colorDot : 0;
  if (projected > 0) {
    if (r1 + g1 + b1 > r2 + g2 + b2) {
      const tmp = a;
      a = b;
      b = tmp;
      projected = 1 - projected;
    }
    if (projected * (patsize + 1) > threshold) {
      a = b;
    }
  }

  return a;
}

function createRng(seedEnabled: boolean): () => number {
  if (!seedEnabled) return Math.random;
  let s = 0x2f6e2b1;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1000000) / 1000000;
  };
}

function resolveTransitionPalette(
  lastHeight: number,
  height: number,
  byTone: Record<ToneKey, PaletteColor[]>,
  all: PaletteColor[],
): PaletteColor[] {
  if (height === lastHeight) return byTone.normal.length ? byTone.normal : all;
  if (height > lastHeight) return byTone.light.length ? byTone.light : (byTone.normal.length ? byTone.normal : all);
  return byTone.dark.length ? byTone.dark : (byTone.normal.length ? byTone.normal : all);
}

function fallbackGreedyColumn(
  column: RGBObj[],
  byTone: Record<ToneKey, PaletteColor[]>,
  all: PaletteColor[],
  maxHeight: number,
  useLab: boolean,
): SolveResult {
  const entries: PaletteColor[] = new Array(column.length);
  const heights: number[] = new Array(column.length);
  const errs: RGBObj[] = new Array(column.length);
  let totalError = 0;
  let lastHeight = 0;
  for (let i = 0; i < column.length; i++) {
    let bestPick = findBest(column[i], resolveTransitionPalette(lastHeight, lastHeight, byTone, all), DEFAULT_GAMUT, false, useLab);
    let bestHeight = lastHeight;
    for (let h = 0; h < maxHeight; h++) {
      const pick = findBest(column[i], resolveTransitionPalette(lastHeight, h, byTone, all), DEFAULT_GAMUT, false, useLab);
      if (pick.err < bestPick.err) {
        bestPick = pick;
        bestHeight = h;
      }
    }
    entries[i] = bestPick.entry;
    heights[i] = bestHeight;
    errs[i] = bestPick.diff;
    totalError += bestPick.err;
    lastHeight = bestHeight;
  }
  return { entries, heights, errs, totalError };
}

export function processMemoMapmaker(input: {
  rgbaData: Uint8ClampedArray;
  rgbFloat: Float32Array;
  width: number;
  height: number;
  palette: PaletteColor[];
  settings: ProcessorSettings;
  onProgress?: (p: number) => void;
}): {
  rgbaData: Uint8ClampedArray;
  pixelEntries: PixelEntry[];
  maps: MapSection[][];
  totalPixels: number;
  uniqueColors: number;
} {
  const { rgbaData, rgbFloat, width, height, palette, settings, onProgress } = input;
  const totalPixels = width * height;

  const mapSizeX = settings.mapSizeX;
  const mapSizeZ = settings.mapSizeZ;
  const maps: MapSection[][] = [];
  for (let z = 0; z < mapSizeZ; z++) {
    const row: MapSection[] = [];
    for (let x = 0; x < mapSizeX; x++) {
      const materials: Record<string, number> = {};
      for (const p of palette) materials[p.colourSetId] = 0;
      row.push({ materials, supportBlockCount: 0 });
    }
    maps.push(row);
  }

  const outputRGBA = new Uint8ClampedArray(totalPixels * 4);
  const pixelEntries: PixelEntry[] = new Array(totalPixels);
  const usedColors = new Set<string>();

  const tonePalette: Record<ToneKey, PaletteColor[]> = {
    dark: palette.filter((p) => p.toneKey === 'dark'),
    normal: palette.filter((p) => p.toneKey === 'normal'),
    light: palette.filter((p) => p.toneKey === 'light'),
    unobtainable: palette.filter((p) => p.toneKey === 'unobtainable'),
  };

  const method = settings.ditherMethod.startsWith('memo-pattern')
    ? 'pattern'
    : settings.ditherMethod.startsWith('memo-diffuse')
      ? 'diffuse'
      : 'none';

  const maxHeight = Math.max(1, settings.memoMaxHeight || 1);
  const maxDepth = Math.max(4, settings.memoMaxDepth || 950);
  const maxCache = Math.max(1000, settings.memoMaxCache || 200000);
  const useLab = !!settings.memoUseLab;
  const clampToPalette = !!settings.memoClampToPalette;
  const useReference = !!settings.memoUseReference;
  const chooser = settings.memoChooser ?? 2;
  const discriminator = settings.memoDiscriminator ?? 1;
  const quantize = settings.memoQuantize ?? 8;
  const diffFact = settings.memoDiffusionFactor ?? 1;
  const rng = createRng(!!settings.memoUseSeed);

  const gamutNormal = buildGamut(tonePalette.normal.length ? tonePalette.normal : palette);
  const gamutLight = buildGamut(tonePalette.light.length ? tonePalette.light : (tonePalette.normal.length ? tonePalette.normal : palette));
  const gamutDark = buildGamut(tonePalette.dark.length ? tonePalette.dark : (tonePalette.normal.length ? tonePalette.normal : palette));
  const gamutAny = buildGamut(palette);

  const isClear = new Uint8Array(totalPixels);
  if (settings.transparencyEnabled) {
    const [bgR, bgG, bgB] = parseHexColour(settings.backgroundColour);
    for (let i = 0; i < totalPixels; i++) {
      const a = rgbaData[i * 4 + 3];
      if (a >= settings.transparencyTolerance) continue;
      if (settings.backgroundMode === 0) {
        isClear[i] = 1;
      } else {
        rgbFloat[i * 3] = bgR;
        rgbFloat[i * 3 + 1] = bgG;
        rgbFloat[i * 3 + 2] = bgB;
      }
    }
  }

  const ordered = method === 'pattern' ? getOrderedMatrix(settings.memoPatternId || 'bayer-4x4') : null;
  const patsize = ordered ? ordered.reduce((m, row) => Math.max(m, ...row), 1) : 1;

  const nextErrorMap = new Float64Array(height * 3);

  for (let x = 0; x < width; x++) {
    if (onProgress && (x & 3) === 0) onProgress(x / width);

    const colRgb: RGBObj[] = new Array(height);
    const errorMap = nextErrorMap.slice();
    nextErrorMap.fill(0);

    for (let y = 0; y < height; y++) {
      const idx = (y * width + x) * 3;
      const ei = y * 3;
      colRgb[y] = rgbObj(
        rgbFloat[idx] + errorMap[ei],
        rgbFloat[idx + 1] + errorMap[ei + 1],
        rgbFloat[idx + 2] + errorMap[ei + 2],
      );
    }

    const solveColumn = (start: number, end: number, lastHeight: number): SolveResult | null => {
      if (end - start > maxDepth) return null;

      if (method === 'diffuse') {
        const memo = new Map<string, SolveResult>();
        const recur = (
          pos: number,
          prevHeight: number,
          lastBlock: number,
          lastErr: RGBObj,
        ): SolveResult | null => {
          if (pos >= end) return { entries: [], heights: [], errs: [], totalError: 0 };

          const base = colRgb[pos];
          const pix = rgbObj(base.r + lastErr.r, base.g + lastErr.g, base.b + lastErr.b);
          const quant = quantize < 8
            ? `${clampByte(pix.r) >> quantize},${clampByte(pix.g) >> quantize},${clampByte(pix.b) >> quantize}`
            : '';
          const key = quantize < 8
            ? `${pos}|${prevHeight}|${lastBlock}|${quant}`
            : `${pos}|${prevHeight}|${lastBlock}`;
          const cached = memo.get(key);
          if (cached) return cached;
          if (memo.size > maxCache) return null;

          let best: SolveResult | null = null;
          const fromSamePal = resolveTransitionPalette(prevHeight, prevHeight, tonePalette, palette);
          const fromSame = findBest(pix, fromSamePal, gamutNormal, clampToPalette, useLab);
          const fromBelowPal = resolveTransitionPalette(prevHeight, prevHeight + 1, tonePalette, palette);
          const fromBelow = findBest(pix, fromBelowPal, gamutLight, clampToPalette, useLab);
          const fromAbovePal = resolveTransitionPalette(prevHeight, prevHeight - 1, tonePalette, palette);
          const fromAbove = findBest(pix, fromAbovePal, gamutDark, clampToPalette, useLab);
          const stair = useReference ? findBest(pix, palette, gamutAny, clampToPalette, useLab) : null;

          for (let h = 0; h < maxHeight; h++) {
            const pick = h === prevHeight ? fromSame : (h > prevHeight ? fromBelow : fromAbove);
            const nextErr = rgbObj(
              (pick.diff.r * 7 / 16) * diffFact,
              (pick.diff.g * 7 / 16) * diffFact,
              (pick.diff.b * 7 / 16) * diffFact,
            );
            const cont = recur(pos + 1, h, pick.entry.paletteIndex, nextErr);
            if (!cont) return null;

            let err = pick.err;
            if (stair && err === stair.err) err = 0;
            const total = cont.totalError + err;
            if (!best || total < best.totalError) {
              best = {
                entries: [pick.entry, ...cont.entries],
                heights: [h, ...cont.heights],
                errs: [pick.diff, ...cont.errs],
                totalError: total,
              };
            }
          }

          if (best) memo.set(key, best);
          return best;
        };

        return recur(start, lastHeight, -1, rgbObj(0, 0, 0));
      }

      const memo = new Map<string, SolveResult>();
      const recur = (pos: number, prevHeight: number): SolveResult | null => {
        if (pos >= end) return { entries: [], heights: [], errs: [], totalError: 0 };
        const key = `${pos}|${prevHeight}`;
        const cached = memo.get(key);
        if (cached) return cached;
        if (memo.size > maxCache) return null;

        const pix = colRgb[pos];
        const threshold = ordered ? ordered[pos % ordered.length][x % ordered[0].length] : 1;

        const fromSamePal = resolveTransitionPalette(prevHeight, prevHeight, tonePalette, palette);
        const fromBelowPal = resolveTransitionPalette(prevHeight, prevHeight + 1, tonePalette, palette);
        const fromAbovePal = resolveTransitionPalette(prevHeight, prevHeight - 1, tonePalette, palette);

        const fromSame = method === 'pattern'
          ? findBestPattern(pix, fromSamePal, gamutNormal, threshold, patsize, clampToPalette, useLab, chooser, discriminator)
          : findBest(pix, fromSamePal, gamutNormal, clampToPalette, useLab);
        const fromBelow = method === 'pattern'
          ? findBestPattern(pix, fromBelowPal, gamutLight, threshold, patsize, clampToPalette, useLab, chooser, discriminator)
          : findBest(pix, fromBelowPal, gamutLight, clampToPalette, useLab);
        const fromAbove = method === 'pattern'
          ? findBestPattern(pix, fromAbovePal, gamutDark, threshold, patsize, clampToPalette, useLab, chooser, discriminator)
          : findBest(pix, fromAbovePal, gamutDark, clampToPalette, useLab);
        const stair = useReference
          ? (method === 'pattern'
            ? findBestPattern(pix, palette, gamutAny, threshold, patsize, clampToPalette, useLab, chooser, discriminator)
            : findBest(pix, palette, gamutAny, clampToPalette, useLab))
          : null;

        let best: SolveResult | null = null;
        for (let h = 0; h < maxHeight; h++) {
          const pick = h === prevHeight ? fromSame : (h > prevHeight ? fromBelow : fromAbove);
          const cont = recur(pos + 1, h);
          if (!cont) return null;
          let err = pick.err;
          if (stair && err === stair.err) err = 0;
          const total = cont.totalError + err;
          if (!best || total < best.totalError) {
            best = {
              entries: [pick.entry, ...cont.entries],
              heights: [h, ...cont.heights],
              errs: [pick.diff, ...cont.errs],
              totalError: total,
            };
          }
        }

        if (best) memo.set(key, best);
        return best;
      };

      return recur(start, lastHeight);
    };

    let result: SolveResult | null;
    const subdivisions: Array<[number, number]> = [[0, height]];
    const assembledEntries: PaletteColor[] = new Array(height);
    const assembledHeights: number[] = new Array(height);
    const assembledErrs: RGBObj[] = new Array(height);
    let sectionLastHeight = 0;

    while (subdivisions.length > 0) {
      const [start, end] = subdivisions.pop()!;
      result = solveColumn(start, end, sectionLastHeight);
      if (!result) {
        const size = end - start;
        if (size <= 6) {
          const fallback = fallbackGreedyColumn(colRgb.slice(start, end), tonePalette, palette, maxHeight, useLab);
          for (let i = 0; i < fallback.entries.length; i++) {
            assembledEntries[start + i] = fallback.entries[i];
            assembledHeights[start + i] = fallback.heights[i];
            assembledErrs[start + i] = fallback.errs[i];
          }
          sectionLastHeight = fallback.heights[fallback.heights.length - 1] ?? sectionLastHeight;
          continue;
        }
        const quarter = Math.max(1, Math.floor(size / 4));
        const pivot = start + quarter + Math.floor(rng() * Math.max(1, size - quarter * 2));
        subdivisions.push([pivot, end]);
        subdivisions.push([start, pivot]);
      } else {
        for (let i = start; i < end; i++) {
          const local = i - start;
          assembledEntries[i] = result.entries[local];
          assembledHeights[i] = result.heights[local];
          assembledErrs[i] = result.errs[local];
        }
        sectionLastHeight = result.heights[result.heights.length - 1] ?? sectionLastHeight;
      }
    }

    for (let y = 0; y < height; y++) {
      const pix = y * width + x;
      if (isClear[pix]) {
        outputRGBA[pix * 4] = 0;
        outputRGBA[pix * 4 + 1] = 0;
        outputRGBA[pix * 4 + 2] = 0;
        outputRGBA[pix * 4 + 3] = 0;
        pixelEntries[pix] = { colourSetId: '-1', toneKey: 'normal' };
        continue;
      }

      const entry = assembledEntries[y] ?? palette[0];
      outputRGBA[pix * 4] = entry.rgb[0];
      outputRGBA[pix * 4 + 1] = entry.rgb[1];
      outputRGBA[pix * 4 + 2] = entry.rgb[2];
      outputRGBA[pix * 4 + 3] = 255;
      pixelEntries[pix] = { colourSetId: entry.colourSetId, toneKey: entry.toneKey };
      usedColors.add(`${entry.colourSetId}:${entry.toneKey}`);

      const mapX = Math.floor(x / 128);
      const mapZ = Math.floor(y / 128);
      if (mapZ < mapSizeZ && mapX < mapSizeX) {
        maps[mapZ][mapX].materials[entry.colourSetId] =
          (maps[mapZ][mapX].materials[entry.colourSetId] || 0) + 1;
      }

      if (method === 'diffuse') {
        const d = assembledErrs[y] ?? rgbObj(0, 0, 0);
        if (x + 1 < width) {
          const east = y * 3;
          nextErrorMap[east] += d.r * 5 / 16 * diffFact;
          nextErrorMap[east + 1] += d.g * 5 / 16 * diffFact;
          nextErrorMap[east + 2] += d.b * 5 / 16 * diffFact;

          if (y > 0) {
            const ne = (y - 1) * 3;
            nextErrorMap[ne] += d.r * 3 / 16 * diffFact;
            nextErrorMap[ne + 1] += d.g * 3 / 16 * diffFact;
            nextErrorMap[ne + 2] += d.b * 3 / 16 * diffFact;
          }
          if (y + 1 < height) {
            const se = (y + 1) * 3;
            nextErrorMap[se] += d.r * 1 / 16 * diffFact;
            nextErrorMap[se + 1] += d.g * 1 / 16 * diffFact;
            nextErrorMap[se + 2] += d.b * 1 / 16 * diffFact;
          }
        }
      }
    }
  }

  if (onProgress) onProgress(1);

  return {
    rgbaData: outputRGBA,
    pixelEntries,
    maps,
    totalPixels,
    uniqueColors: usedColors.size,
  };
}