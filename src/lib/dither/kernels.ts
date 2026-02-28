/**
 * Error-diffusion dithering kernels.
 *
 * Each kernel is defined as an array of [dx, dy, weight] entries
 * relative to the current pixel (0, 0). The divisor normalizes the weights.
 *
 * The matrix format from the original ditherMethods.json is a 3×5 grid
 * where center column (index 2) at row 0 is the current pixel.
 * We convert to the standard [dx, dy, weight] format here for efficiency.
 */
import type { DiffusionKernel } from './types.js';

export const KERNELS: Record<string, DiffusionKernel> = {
  'floyd-steinberg': {
    entries: [
      [1, 0, 7],
      [-1, 1, 3],
      [0, 1, 5],
      [1, 1, 1],
    ],
    divisor: 16,
  },
  'min-avg-err': {
    entries: [
      [1, 0, 7], [2, 0, 5],
      [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3],
      [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1],
    ],
    divisor: 48,
  },
  burkes: {
    entries: [
      [1, 0, 8], [2, 0, 4],
      [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2],
    ],
    divisor: 32,
  },
  'sierra-lite': {
    entries: [
      [1, 0, 2],
      [-1, 1, 1],
      [0, 1, 1],
    ],
    divisor: 4,
  },
  stucki: {
    entries: [
      [1, 0, 8], [2, 0, 4],
      [-2, 1, 2], [-1, 1, 4], [0, 1, 8], [1, 1, 4], [2, 1, 2],
      [-2, 2, 1], [-1, 2, 2], [0, 2, 4], [1, 2, 2], [2, 2, 1],
    ],
    divisor: 42,
  },
  atkinson: {
    entries: [
      [1, 0, 1], [2, 0, 1],
      [-1, 1, 1], [0, 1, 1], [1, 1, 1],
      [0, 2, 1],
    ],
    divisor: 8,
  },
  'jarvis-judice-ninke': {
    entries: [
      [1, 0, 7], [2, 0, 5],
      [-2, 1, 3], [-1, 1, 5], [0, 1, 7], [1, 1, 5], [2, 1, 3],
      [-2, 2, 1], [-1, 2, 3], [0, 2, 5], [1, 2, 3], [2, 2, 1],
    ],
    divisor: 48,
  },
  'sierra-3': {
    entries: [
      [1, 0, 5], [2, 0, 3],
      [-2, 1, 2], [-1, 1, 4], [0, 1, 5], [1, 1, 4], [2, 1, 2],
      [-1, 2, 2], [0, 2, 3], [1, 2, 2],
    ],
    divisor: 32,
  },
  'shiau-fan': {
    entries: [
      [1, 0, 4],
      [-1, 1, 1], [0, 1, 1], [1, 1, 2],
    ],
    divisor: 8,
  },
};

/**
 * Distribute quantization error from pixel (x, y) using a standard kernel.
 * Operates on a Float32Array with 3 channels per pixel (RGB).
 */
export function distributeError(
  rgbFloat: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  errR: number,
  errG: number,
  errB: number,
  kernelId: string,
): void {
  const kernelDef = KERNELS[kernelId];
  if (!kernelDef) return;

  const { entries, divisor } = kernelDef;
  for (let i = 0; i < entries.length; i++) {
    const dx = entries[i][0];
    const dy = entries[i][1];
    const weight = entries[i][2];

    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

    const nIdx = (ny * width + nx) * 3;
    const factor = weight / divisor;
    rgbFloat[nIdx] += errR * factor;
    rgbFloat[nIdx + 1] += errG * factor;
    rgbFloat[nIdx + 2] += errB * factor;
  }
}
