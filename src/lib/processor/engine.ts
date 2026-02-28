/**
 * Core image processing engine.
 *
 * Pipeline: RGBA input → float RGB buffer → pre-dither (ordered/blue) →
 *           scanline/curve quantization → error diffusion → RGBA output + materials
 *
 * This runs on the main thread for small images or in a Web Worker for large ones.
 */
import type { PaletteColor, ToneKey, RGB } from '$lib/types/colours.js';
import type { ColorSpace } from '$lib/types/settings.js';
import type { ProcessorSettings, PixelEntry, MapSection } from './types.js';
import { findClosestColor } from '$lib/palette/findClosest.js';
import { rgb2lab, rgb2oklab, rgb2oklch, rgb2ycbcr, rgb2hsl } from '$lib/palette/colorSpace.js';
import {
  distributeError,
  isErrorDiffusion,
  isOrderedDither,
  isOstromoukhov,
  isBlueNoise,
  isRiemersma,
  KERNELS,
} from '$lib/dither/index.js';
import { applyOrderedDither, orderedChooseClosest } from '$lib/dither/ordered.js';
import { applyBlueNoiseDither } from '$lib/dither/blueNoise.js';
import { distributeErrorOstromoukhov } from '$lib/dither/ostromoukhov.js';
import { generateHilbertPath, createRiemersmaWeights } from '$lib/dither/riemersma.js';
import { applyBilateralFilter } from './bilateralFilter.js';
import { computeEdgeMask } from './edgeMask.js';

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/** Parse hex '#rrggbb' to [r, g, b] */
function parseHexColour(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16) || 0,
    parseInt(h.substring(2, 4), 16) || 0,
    parseInt(h.substring(4, 6), 16) || 0,
  ];
}

/**
 * Find the two closest palette colors. Used by ordered dithering.
 */
function findClosest2(
  rgb: RGB,
  palette: PaletteColor[],
  colorSpace: ColorSpace,
  luminanceWeight: number = 1.0,
): { dist1: number; dist2: number; color1: PaletteColor; color2: PaletteColor } {
  let best1Idx = 0;
  let best2Idx = 0;
  let dist1 = Infinity;
  let dist2 = Infinity;

  if (colorSpace === 'rgb') {
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const dr = rgb[0] - p.rgb[0];
      const dg = rgb[1] - p.rgb[1];
      const db = rgb[2] - p.rgb[2];
      const d = dr * dr + dg * dg + db * db;
      if (d < dist1) {
        dist2 = dist1; best2Idx = best1Idx;
        dist1 = d; best1Idx = i;
      } else if (d < dist2) {
        dist2 = d; best2Idx = i;
      }
    }
  } else if (colorSpace === 'lab') {
    const wL = luminanceWeight;
    const lab = rgb2lab(rgb);
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const dL = lab[0] - p.lab[0];
      const da = lab[1] - p.lab[1];
      const db = lab[2] - p.lab[2];
      const d = wL * dL * dL + da * da + db * db;
      if (d < dist1) {
        dist2 = dist1; best2Idx = best1Idx;
        dist1 = d; best1Idx = i;
      } else if (d < dist2) {
        dist2 = d; best2Idx = i;
      }
    }
  } else if (colorSpace === 'oklab') {
    const wL = luminanceWeight;
    const oklab = rgb2oklab(rgb);
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const dL = oklab[0] - p.oklab[0];
      const da = oklab[1] - p.oklab[1];
      const dB = oklab[2] - p.oklab[2];
      const d = wL * dL * dL + da * da + dB * dB;
      if (d < dist1) {
        dist2 = dist1; best2Idx = best1Idx;
        dist1 = d; best1Idx = i;
      } else if (d < dist2) {
        dist2 = d; best2Idx = i;
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
      const d = wL * dL * dL + dC * dC + dH * dH;
      if (d < dist1) {
        dist2 = dist1; best2Idx = best1Idx;
        dist1 = d; best1Idx = i;
      } else if (d < dist2) {
        dist2 = d; best2Idx = i;
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
      const d = wL * dY * dY + dCb * dCb + dCr * dCr;
      if (d < dist1) {
        dist2 = dist1; best2Idx = best1Idx;
        dist1 = d; best1Idx = i;
      } else if (d < dist2) {
        dist2 = d; best2Idx = i;
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
      const d = (dH * avgS) ** 2 + dS * dS + wL * dL * dL;
      if (d < dist1) {
        dist2 = dist1; best2Idx = best1Idx;
        dist1 = d; best1Idx = i;
      } else if (d < dist2) {
        dist2 = d; best2Idx = i;
      }
    }
  }

  return {
    dist1,
    dist2,
    color1: palette[best1Idx],
    color2: palette[best2Idx],
  };
}

export interface EngineInput {
  /** Raw RGBA pixels (Uint8ClampedArray or ArrayBuffer contents) */
  rgbaData: Uint8ClampedArray;
  width: number;
  height: number;
  palette: PaletteColor[];
  settings: ProcessorSettings;
  selectedBlocks: Record<string, string>;
  /** Optional progress callback (0-1) */
  onProgress?: (percent: number) => void;
}

export interface EngineOutput {
  /** Quantized RGBA pixels */
  rgbaData: Uint8ClampedArray;
  /** Per-pixel palette entries */
  pixelEntries: PixelEntry[];
  /** Per-map section materials */
  maps: MapSection[][];
  totalPixels: number;
  uniqueColors: number;
}

/**
 * Main processing engine.
 * Converts RGBA pixel data to palette-mapped output with dithering.
 */
export function processPixels(input: EngineInput): EngineOutput {
  const { rgbaData, width, height, palette, settings, selectedBlocks, onProgress } = input;
  const totalPixels = width * height;

  // Build float RGB buffer from RGBA
  const rgbFloat = new Float32Array(totalPixels * 3);
  for (let i = 0; i < totalPixels; i++) {
    rgbFloat[i * 3] = rgbaData[i * 4];
    rgbFloat[i * 3 + 1] = rgbaData[i * 4 + 1];
    rgbFloat[i * 3 + 2] = rgbaData[i * 4 + 2];
  }

  // ── Pre-processing: Bilateral Filter ──
  // Smooths flat areas (skin, sky) while preserving hard edges (linework, eyes).
  // Must run before dithering so the ditherer sees a cleaner input.
  if (settings.bilateralEnabled) {
    applyBilateralFilter(
      rgbFloat, width, height,
      settings.bilateralSigmaSpace,
      settings.bilateralSigmaColor,
      settings.bilateralRadius,
    );
  }

  // ── Pre-processing: Edge Mask ──
  // Compute Sobel edge magnitude per pixel.
  // Used as a continuous factor (soft-thresholding) during dithering:
  //   edgeFactor=0 (flat) → full dithering
  //   edgeFactor=1 (strong edge) → no dithering
  const edgeMask: Float32Array | null = settings.edgeMaskEnabled
    ? computeEdgeMask(rgbFloat, width, height, settings.edgeMaskThreshold)
    : null;

  // Luminance weight for color distance calculations
  const lumWeight = settings.luminanceWeight;

  // Build output arrays
  const outputRGBA = new Uint8ClampedArray(totalPixels * 4);
  const pixelEntries: PixelEntry[] = new Array(totalPixels);
  const usedColors = new Set<string>();

  // Initialize map sections
  const mapSizeX = settings.mapSizeX;
  const mapSizeZ = settings.mapSizeZ;
  const maps: MapSection[][] = [];
  for (let z = 0; z < mapSizeZ; z++) {
    const row: MapSection[] = [];
    for (let x = 0; x < mapSizeX; x++) {
      const materials: Record<string, number> = {};
      for (const p of palette) {
        materials[p.colourSetId] = (materials[p.colourSetId] || 0);
      }
      row.push({ materials, supportBlockCount: 0 });
    }
    maps.push(row);
  }

  // Build exactColourCache (RGB → palette entry) for support block lookups
  const exactCache = new Map<number, { colourSetId: string; toneKey: ToneKey }>();
  for (const p of palette) {
    const key = (p.rgb[0] << 16) | (p.rgb[1] << 8) | p.rgb[2];
    exactCache.set(key, { colourSetId: p.colourSetId, toneKey: p.toneKey });
  }

  // Color cache for repeated pixels
  const colorCache = new Map<number, PaletteColor>();

  // Determine dither mode
  const methodId = settings.ditherMethod;
  const useErrorDiffusion = isErrorDiffusion(methodId);
  const useOrdered = isOrderedDither(methodId);
  const useBlueNoise = isBlueNoise(methodId);
  const useOstro = isOstromoukhov(methodId);
  const useRiemer = isRiemersma(methodId);

  // Step 1: Apply threshold-based dither (ordered / blue noise) — modifies rgbFloat
  if (useOrdered && methodId !== 'bayer-4x4' && methodId !== 'bayer-2x2' && methodId !== 'bayer-8x8'
      && methodId !== 'ordered-3x3' && methodId !== 'cluster-dot' && methodId !== 'knoll') {
    // Generic ordered dither bias (for any future ordered methods)
    applyOrderedDither(rgbFloat, width, height, methodId);
  }
  if (useBlueNoise) {
    applyBlueNoiseDither(rgbFloat, width, height);
  }

  // Step 2: Quantize
  if (useRiemer) {
    // ── Riemersma (Hilbert curve) ──
    const path = generateHilbertPath(width, height);
    const QUEUE_SIZE = 16;
    const weights = createRiemersmaWeights(QUEUE_SIZE);
    const qR = new Float32Array(QUEUE_SIZE);
    const qG = new Float32Array(QUEUE_SIZE);
    const qB = new Float32Array(QUEUE_SIZE);
    let qLen = 0;
    const pointCount = path.length >>> 1;

    for (let i = 0; i < pointCount; i++) {
      if (onProgress && i % 10000 === 0) {
        onProgress(i / pointCount);
      }

      const px = path[i * 2];
      const py = path[i * 2 + 1];
      const fIdx = (py * width + px) * 3;

      // Soft-thresholding: use edge mask as continuous damping factor
      // edgeFactor 0=flat (full dither), 1=strong edge (no dither)
      const edgeFactor = edgeMask !== null ? edgeMask[py * width + px] : 0;
      const dampFactor = 1.0 - edgeFactor;
      let accR = 0, accG = 0, accB = 0;
      for (let q = 0; q < qLen; q++) {
        accR += qR[q] * weights[q];
        accG += qG[q] * weights[q];
        accB += qB[q] * weights[q];
      }
      // Dampen accumulated error by edge factor
      accR *= dampFactor;
      accG *= dampFactor;
      accB *= dampFactor;

      // Convert pixel to sRGB for color matching
      const rMatch = clamp(rgbFloat[fIdx] + accR);
      const gMatch = clamp(rgbFloat[fIdx + 1] + accG);
      const bMatch = clamp(rgbFloat[fIdx + 2] + accB);

      // Handle transparency
      const alphaIdx = (py * width + px) * 4 + 3;
      if (settings.transparencyEnabled && rgbaData[alphaIdx] < settings.transparencyTolerance) {
        if (settings.backgroundMode !== 0) {
          // Fill mode: replace transparent pixel with background colour
          const [bgR, bgG, bgB] = parseHexColour(settings.backgroundColour);
          if (settings.backgroundMode === 2) {
            // Smooth: find closest palette colour directly (no dithering)
            const bgClosest = findClosestCached(bgR, bgG, bgB, palette, settings.colorSpace, colorCache, lumWeight);
            const pixIdx = py * width + px;
            pixelEntries[pixIdx] = { colourSetId: bgClosest.colourSetId, toneKey: bgClosest.toneKey };
            usedColors.add(`${bgClosest.colourSetId}:${bgClosest.toneKey}`);
            outputRGBA[pixIdx * 4] = bgClosest.rgb[0];
            outputRGBA[pixIdx * 4 + 1] = bgClosest.rgb[1];
            outputRGBA[pixIdx * 4 + 2] = bgClosest.rgb[2];
            outputRGBA[pixIdx * 4 + 3] = 255;
            const mapX = Math.floor((px % (mapSizeX * 128)) / 128);
            const mapZ = Math.floor(py / 128);
            if (mapZ < mapSizeZ && mapX < mapSizeX) {
              maps[mapZ][mapX].materials[bgClosest.colourSetId] =
                (maps[mapZ][mapX].materials[bgClosest.colourSetId] || 0) + 1;
            }
            continue;
          }
          // Dithered: override the pixel colour and fall through to normal dither processing
          rgbFloat[fIdx] = bgR;
          rgbFloat[fIdx + 1] = bgG;
          rgbFloat[fIdx + 2] = bgB;
          rgbaData[alphaIdx] = 255;
        } else {
          // Clear mode: no block
          outputRGBA[(py * width + px) * 4] = 0;
          outputRGBA[(py * width + px) * 4 + 1] = 0;
          outputRGBA[(py * width + px) * 4 + 2] = 0;
          outputRGBA[(py * width + px) * 4 + 3] = 0;
          pixelEntries[py * width + px] = { colourSetId: '-1', toneKey: 'normal' };
          continue;
        }
      }

      const closest = findClosestCached(rMatch, gMatch, bMatch, palette, settings.colorSpace, colorCache, lumWeight);
      const pixIdx = py * width + px;
      pixelEntries[pixIdx] = { colourSetId: closest.colourSetId, toneKey: closest.toneKey };
      usedColors.add(`${closest.colourSetId}:${closest.toneKey}`);

      outputRGBA[pixIdx * 4] = closest.rgb[0];
      outputRGBA[pixIdx * 4 + 1] = closest.rgb[1];
      outputRGBA[pixIdx * 4 + 2] = closest.rgb[2];
      outputRGBA[pixIdx * 4 + 3] = 255;

      // Material count
      const mapX = Math.floor((px % (mapSizeX * 128)) / 128);
      const mapZ = Math.floor(py / 128);
      if (mapZ < mapSizeZ && mapX < mapSizeX) {
        maps[mapZ][mapX].materials[closest.colourSetId] =
          (maps[mapZ][mapX].materials[closest.colourSetId] || 0) + 1;
      }

      // Push error to queue
      const errR = rMatch - closest.rgb[0];
      const errG = gMatch - closest.rgb[1];
      const errB = bMatch - closest.rgb[2];
      if (qLen < QUEUE_SIZE) qLen++;
      for (let j = qLen - 1; j > 0; j--) {
        qR[j] = qR[j - 1];
        qG[j] = qG[j - 1];
        qB[j] = qB[j - 1];
      }
      qR[0] = errR;
      qG[0] = errG;
      qB[0] = errB;
    }
  } else {
    // ── Scanline processing ──
    for (let y = 0; y < height; y++) {
      if (onProgress && y % 16 === 0) {
        onProgress(y / height);
      }

      // Serpentine scan for Ostromoukhov
      const leftToRight = useOstro ? (y % 2 === 0) : true;
      const xStart = leftToRight ? 0 : width - 1;
      const xEnd = leftToRight ? width : -1;
      const xStep = leftToRight ? 1 : -1;

      for (let x = xStart; x !== xEnd; x += xStep) {
        const pixIdx = y * width + x;
        const fIdx = pixIdx * 3;

        // Handle transparency
        if (settings.transparencyEnabled && rgbaData[pixIdx * 4 + 3] < settings.transparencyTolerance) {
          if (settings.backgroundMode !== 0) {
            // Fill mode: replace transparent pixel with background colour
            const [bgR, bgG, bgB] = parseHexColour(settings.backgroundColour);
            if (settings.backgroundMode === 2) {
              // Smooth: find closest palette colour directly (no dithering)
              const bgClosest = findClosestCached(bgR, bgG, bgB, palette, settings.colorSpace, colorCache, lumWeight);
              pixelEntries[pixIdx] = { colourSetId: bgClosest.colourSetId, toneKey: bgClosest.toneKey };
              usedColors.add(`${bgClosest.colourSetId}:${bgClosest.toneKey}`);
              outputRGBA[pixIdx * 4] = bgClosest.rgb[0];
              outputRGBA[pixIdx * 4 + 1] = bgClosest.rgb[1];
              outputRGBA[pixIdx * 4 + 2] = bgClosest.rgb[2];
              outputRGBA[pixIdx * 4 + 3] = 255;
              const mapX = Math.floor((x % (mapSizeX * 128)) / 128);
              const mapZ = Math.floor(y / 128);
              if (mapZ < mapSizeZ && mapX < mapSizeX) {
                maps[mapZ][mapX].materials[bgClosest.colourSetId] =
                  (maps[mapZ][mapX].materials[bgClosest.colourSetId] || 0) + 1;
              }
              continue;
            }
            // Dithered: override the pixel colour and fall through to normal processing
            rgbFloat[fIdx] = bgR;
            rgbFloat[fIdx + 1] = bgG;
            rgbFloat[fIdx + 2] = bgB;
            rgbaData[pixIdx * 4 + 3] = 255;
          } else {
            // Clear mode: no block
            outputRGBA[pixIdx * 4] = 0;
            outputRGBA[pixIdx * 4 + 1] = 0;
            outputRGBA[pixIdx * 4 + 2] = 0;
            outputRGBA[pixIdx * 4 + 3] = 0;
            pixelEntries[pixIdx] = { colourSetId: '-1', toneKey: 'normal' };
            continue;
          }
        }

        // Convert pixel to sRGB for color matching
        const rMatch = clamp(rgbFloat[fIdx]);
        const gMatch = clamp(rgbFloat[fIdx + 1]);
        const bMatch = clamp(rgbFloat[fIdx + 2]);

        let closest: PaletteColor;

        // Soft-thresholding: edge factor determines dithering intensity
        const edgeFactor = edgeMask !== null ? edgeMask[pixIdx] : 0;
        const isStrongEdge = edgeFactor > 0.8; // strong edges skip ordered dither entirely

        if (isStrongEdge) {
          // Strong edge: pure quantization, no dithering artifacts
          closest = findClosestCached(rMatch, gMatch, bMatch, palette, settings.colorSpace, colorCache, lumWeight);
        } else if (useOrdered) {
          // Two-closest ordered dithering (original mapartcraft approach)
          const two = findClosest2([rMatch, gMatch, bMatch], palette, settings.colorSpace, lumWeight);
          const pick = orderedChooseClosest(two.dist1, two.dist2, x, y, methodId);
          closest = pick === 0 ? two.color1 : two.color2;
        } else {
          closest = findClosestCached(rMatch, gMatch, bMatch, palette, settings.colorSpace, colorCache, lumWeight);
        }

        pixelEntries[pixIdx] = { colourSetId: closest.colourSetId, toneKey: closest.toneKey };
        usedColors.add(`${closest.colourSetId}:${closest.toneKey}`);

        outputRGBA[pixIdx * 4] = closest.rgb[0];
        outputRGBA[pixIdx * 4 + 1] = closest.rgb[1];
        outputRGBA[pixIdx * 4 + 2] = closest.rgb[2];
        outputRGBA[pixIdx * 4 + 3] = 255;

        // Material count
        const mapX = Math.floor(x / 128);
        const mapZ = Math.floor(y / 128);
        if (mapZ < mapSizeZ && mapX < mapSizeX) {
          maps[mapZ][mapX].materials[closest.colourSetId] =
            (maps[mapZ][mapX].materials[closest.colourSetId] || 0) + 1;
        }

        // Error diffusion with soft-thresholding: dampen error by (1 - edgeFactor)
        const dampFactor = 1.0 - edgeFactor;
        if (useErrorDiffusion && dampFactor > 0.01) {
          const errR = (rMatch - closest.rgb[0]) * dampFactor;
          const errG = (gMatch - closest.rgb[1]) * dampFactor;
          const errB = (bMatch - closest.rgb[2]) * dampFactor;
          distributeError(rgbFloat, width, height, x, y, errR, errG, errB, methodId);
        } else if (useOstro && dampFactor > 0.01) {
          const errR = (rMatch - closest.rgb[0]) * dampFactor;
          const errG = (gMatch - closest.rgb[1]) * dampFactor;
          const errB = (bMatch - closest.rgb[2]) * dampFactor;
          const intensity = (rMatch + gMatch + bMatch) / 3;
          const direction: 1 | -1 = leftToRight ? 1 : -1;
          distributeErrorOstromoukhov(rgbFloat, width, height, x, y, errR, errG, errB, intensity, direction);
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

/**
 * Cached findClosest with Map lookup.
 */
function findClosestCached(
  r: number,
  g: number,
  b: number,
  palette: PaletteColor[],
  colorSpace: ColorSpace,
  cache: Map<number, PaletteColor>,
  luminanceWeight: number = 1.0,
): PaletteColor {
  // Include luminance weight in cache key when non-default
  // (weight encoded as 4-bit value in upper bits to avoid collisions)
  const wBits = luminanceWeight === 1.0 ? 0 : (Math.round(luminanceWeight * 10) << 24);
  const key = wBits | (r << 16) | (g << 8) | b;
  let result = cache.get(key);
  if (result) return result;

  result = findClosestColor([r, g, b], palette, colorSpace, luminanceWeight);
  cache.set(key, result);
  return result;
}
