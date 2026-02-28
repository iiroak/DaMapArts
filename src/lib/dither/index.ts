/**
 * Dithering module — barrel export and method registry.
 */

export type { DitherMethod, DitherType, DiffusionEntry, DiffusionKernel } from './types.js';
export { KERNELS, distributeError } from './kernels.js';
export {
  BAYER_4X4,
  BAYER_2X2,
  ORDERED_3X3,
  BAYER_8X8,
  CLUSTER_DOT_8X8,
  KNOLL_8X8,
  getOrderedMatrix,
  applyOrderedDither,
  orderedChooseClosest,
} from './ordered.js';
export {
  getOstromoukhovCoeffs,
  distributeErrorOstromoukhov,
} from './ostromoukhov.js';
export { applyBlueNoiseDither } from './blueNoise.js';
export {
  generateHilbertPath,
  createRiemersmaWeights,
  applyRiemarsmaDither,
  pushRiemersmaError,
} from './riemersma.js';

import type { DitherMethod } from './types.js';

/** Registry of all available dither methods */
export const DITHER_METHODS: DitherMethod[] = [
  { id: 'none', uniqueId: 0, name: 'None', type: 'none' },
  // Error diffusion
  { id: 'floyd-steinberg', uniqueId: 1, name: 'Floyd-Steinberg', type: 'error-diffusion' },
  { id: 'min-avg-err', uniqueId: 5, name: 'MinAvgErr', type: 'error-diffusion' },
  { id: 'burkes', uniqueId: 6, name: 'Burkes', type: 'error-diffusion' },
  { id: 'sierra-lite', uniqueId: 7, name: 'Sierra-Lite', type: 'error-diffusion' },
  { id: 'sierra-3', uniqueId: 15, name: 'Sierra (Full)', type: 'error-diffusion' },
  { id: 'stucki', uniqueId: 8, name: 'Stucki', type: 'error-diffusion' },
  { id: 'jarvis-judice-ninke', uniqueId: 13, name: 'Jarvis-Judice-Ninke', type: 'error-diffusion' },
  { id: 'atkinson', uniqueId: 9, name: 'Atkinson', type: 'error-diffusion' },
  { id: 'shiau-fan', uniqueId: 16, name: 'Shiau-Fan', type: 'error-diffusion' },
  { id: 'ostromoukhov', uniqueId: 10, name: 'Ostromoukhov', type: 'error-diffusion' },
  // Ordered
  { id: 'bayer-2x2', uniqueId: 3, name: 'Bayer (2×2)', type: 'ordered' },
  { id: 'bayer-4x4', uniqueId: 2, name: 'Bayer (4×4)', type: 'ordered' },
  { id: 'bayer-8x8', uniqueId: 14, name: 'Bayer (8×8)', type: 'ordered' },
  { id: 'ordered-3x3', uniqueId: 4, name: 'Ordered (3×3)', type: 'ordered' },
  { id: 'cluster-dot', uniqueId: 17, name: 'Cluster Dot (Halftone)', type: 'ordered' },
  { id: 'knoll', uniqueId: 18, name: 'Knoll', type: 'ordered' },
  { id: 'blue-noise', uniqueId: 11, name: 'Blue Noise', type: 'ordered' },
  // Curve
  { id: 'riemersma', uniqueId: 12, name: 'Riemersma (Hilbert)', type: 'curve' },
];

/** Lookup helpers */
export function getDitherMethodById(id: string): DitherMethod | undefined {
  return DITHER_METHODS.find((m) => m.id === id);
}

export function getDitherMethodByUniqueId(uniqueId: number): DitherMethod | undefined {
  return DITHER_METHODS.find((m) => m.uniqueId === uniqueId);
}

export function isErrorDiffusion(methodId: string): boolean {
  const m = getDitherMethodById(methodId);
  return m?.type === 'error-diffusion' && methodId !== 'ostromoukhov';
}

export function isOrderedDither(methodId: string): boolean {
  return ['bayer-4x4', 'bayer-2x2', 'bayer-8x8', 'ordered-3x3', 'cluster-dot', 'knoll'].includes(methodId);
}

export function isBlueNoise(methodId: string): boolean {
  return methodId === 'blue-noise';
}

export function isOstromoukhov(methodId: string): boolean {
  return methodId === 'ostromoukhov';
}

export function isRiemersma(methodId: string): boolean {
  return methodId === 'riemersma';
}
