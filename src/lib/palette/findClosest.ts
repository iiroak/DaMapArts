/**
 * Closest-color finder — find the best matching PaletteColor for any RGB.
 * Supports multiple color spaces for distance calculation.
 */
import type { PaletteColor, RGB, LAB, Oklab } from '$lib/types/colours.js';
import type { ColorSpace } from '$lib/types/settings.js';
import {
  rgb2lab,
  rgb2lab50,
  rgb2lab65,
  rgb2hct,
  ciede2000DistanceSq,
  rgb2oklab,
  rgb2oklch,
  rgb2ycbcr,
  rgb2hsl,
} from './colorSpace.js';

/**
 * Find the closest palette color to a given RGB.
 * Uses brute-force search (palette is typically <200 entries).
 *
 * @param luminanceWeight  Multiplier for L-channel distance (≥1.0 prioritizes brightness matching)
 */
export function findClosestColor(
  rgb: RGB,
  palette: PaletteColor[],
  colorSpace: ColorSpace,
  luminanceWeight: number = 1.0,
): PaletteColor {
  if (palette.length === 0) {
    throw new Error('Palette is empty');
  }

  let bestIdx = 0;
  let bestDist = Infinity;

  if (colorSpace === 'rgb' || colorSpace === 'euclidian') {
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const dr = rgb[0] - p.rgb[0];
      const dg = rgb[1] - p.rgb[1];
      const db = rgb[2] - p.rgb[2];
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
        if (dist === 0) break;
      }
    }
  } else if (colorSpace === 'lab' || colorSpace === 'mapartcraft-default') {
    const wL = luminanceWeight;
    const lab = rgb2lab(rgb);
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const dL = lab[0] - p.lab[0];
      const da = lab[1] - p.lab[1];
      const db = lab[2] - p.lab[2];
      const dist = wL * dL * dL + da * da + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
        if (dist === 0) break;
      }
    }
  } else if (colorSpace === 'cie76-lab50') {
    const wL = luminanceWeight;
    const lab = rgb2lab50(rgb);
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const pLab = p.lab50 ?? rgb2lab50(p.rgb);
      const dL = lab[0] - pLab[0];
      const da = lab[1] - pLab[1];
      const db = lab[2] - pLab[2];
      const dist = wL * dL * dL + da * da + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
        if (dist === 0) break;
      }
    }
  } else if (colorSpace === 'cie76-lab65') {
    const wL = luminanceWeight;
    const lab = rgb2lab65(rgb);
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const pLab = p.lab65 ?? rgb2lab65(p.rgb);
      const dL = lab[0] - pLab[0];
      const da = lab[1] - pLab[1];
      const db = lab[2] - pLab[2];
      const dist = wL * dL * dL + da * da + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
        if (dist === 0) break;
      }
    }
  } else if (colorSpace === 'ciede2000-lab50') {
    const lab = rgb2lab50(rgb);
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const pLab = p.lab50 ?? rgb2lab50(p.rgb);
      const dist = ciede2000DistanceSq(lab, pLab);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
        if (dist === 0) break;
      }
    }
  } else if (colorSpace === 'ciede2000-lab65') {
    const lab = rgb2lab65(rgb);
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const pLab = p.lab65 ?? rgb2lab65(p.rgb);
      const dist = ciede2000DistanceSq(lab, pLab);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
        if (dist === 0) break;
      }
    }
  } else if (colorSpace === 'hct') {
    const wL = luminanceWeight;
    const hct = rgb2hct(rgb);
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const pHct = p.hct ?? rgb2hct(p.rgb);
      const dL = hct[0] - pHct[0];
      const da = hct[1] - pHct[1];
      const db = hct[2] - pHct[2];
      const dist = wL * dL * dL + da * da + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
        if (dist === 0) break;
      }
    }
  } else if (colorSpace === 'oklab') {
    const wL = luminanceWeight;
    const oklab = rgb2oklab(rgb);
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const dL = oklab[0] - p.oklab[0];
      const da = oklab[1] - p.oklab[1];
      const db = oklab[2] - p.oklab[2];
      const dist = wL * dL * dL + da * da + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
        if (dist === 0) break;
      }
    }
  } else if (colorSpace === 'oklch') {
    const wL = luminanceWeight;
    const oklch = rgb2oklch(rgb);
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const dL = oklch[0] - p.oklch[0];
      const dC = oklch[1] - p.oklch[1];
      const dh = oklch[2] - p.oklch[2];
      const dH = 2 * Math.sqrt(oklch[1] * p.oklch[1]) * Math.sin(dh / 2);
      const dist = wL * dL * dL + dC * dC + dH * dH;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
        if (dist === 0) break;
      }
    }
  } else if (colorSpace === 'ycbcr') {
    const wL = luminanceWeight;
    const ycbcr = rgb2ycbcr(rgb);
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const dY = ycbcr[0] - p.ycbcr[0];
      const dCb = ycbcr[1] - p.ycbcr[1];
      const dCr = ycbcr[2] - p.ycbcr[2];
      const dist = wL * dY * dY + dCb * dCb + dCr * dCr;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
        if (dist === 0) break;
      }
    }
  } else {
    // hsl
    const wL = luminanceWeight;
    const hsl = rgb2hsl(rgb);
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      let dH = Math.abs(hsl[0] - p.hsl[0]);
      if (dH > Math.PI) dH = 2 * Math.PI - dH;
      const avgS = (hsl[1] + p.hsl[1]) / 2;
      const dS = hsl[1] - p.hsl[1];
      const dL = hsl[2] - p.hsl[2];
      const dist = (dH * avgS) ** 2 + dS * dS + wL * dL * dL;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
        if (dist === 0) break;
      }
    }
  }

  return palette[bestIdx];
}

/**
 * Build a lookup cache mapping RGB triples to palette indices.
 * This is used by the dithering engine to avoid repeated searches.
 * The cache key is an integer: (r << 16) | (g << 8) | b.
 */
export function buildColorCache(): Map<number, number> {
  return new Map<number, number>();
}

/**
 * Get or compute the closest palette index for an RGB, using cache.
 */
export function findClosestCached(
  r: number,
  g: number,
  b: number,
  palette: PaletteColor[],
  colorSpace: ColorSpace,
  cache: Map<number, number>,
): number {
  const key = (r << 16) | (g << 8) | b;
  let idx = cache.get(key);
  if (idx !== undefined) return idx;

  const result = findClosestColor([r, g, b], palette, colorSpace);
  idx = result.paletteIndex;
  cache.set(key, idx);
  return idx;
}
