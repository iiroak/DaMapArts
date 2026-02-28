/**
 * Ordered dithering — Bayer matrices and threshold maps.
 *
 * For ordered dithering, we use the classic two-closest-color approach:
 * for each pixel, find the two nearest palette colours, then choose between
 * them based on the threshold matrix value vs. the distance ratio.
 */

/** Pre-computed Bayer & ordered matrices */
export const BAYER_4X4 = [
  [1, 9, 3, 11],
  [13, 5, 15, 7],
  [4, 12, 2, 10],
  [16, 8, 14, 6],
];

export const BAYER_2X2 = [
  [1, 3],
  [4, 2],
];

export const ORDERED_3X3 = [
  [1, 7, 4],
  [5, 8, 3],
  [6, 2, 9],
];

/** Bayer 8×8 — 64 threshold levels for smoother banding */
export const BAYER_8X8 = [
  [ 1, 33,  9, 41,  3, 35, 11, 43],
  [49, 17, 57, 25, 51, 19, 59, 27],
  [13, 45,  5, 37, 15, 47,  7, 39],
  [61, 29, 53, 21, 63, 31, 55, 23],
  [ 4, 36, 12, 44,  2, 34, 10, 42],
  [52, 20, 60, 28, 50, 18, 58, 26],
  [16, 48,  8, 40, 14, 46,  6, 38],
  [64, 32, 56, 24, 62, 30, 54, 22],
];

/** Cluster Dot (Halftone) 8×8 — groups pixels into dots like newspaper print */
export const CLUSTER_DOT_8X8 = [
  [25, 11, 13, 27, 36, 48, 50, 38],
  [ 9,  1,  3, 15, 46, 60, 62, 52],
  [23,  7,  5, 17, 44, 58, 64, 54],
  [31, 21, 19, 29, 34, 42, 56, 40],
  [35, 47, 49, 37, 26, 12, 14, 28],
  [45, 59, 61, 51, 10,  2,  4, 16],
  [43, 57, 63, 53, 24,  8,  6, 18],
  [33, 41, 55, 39, 32, 22, 20, 30],
];

/** Knoll pattern 8×8 — Thomas Knoll's artistic dither pattern */
export const KNOLL_8X8 = [
  [30,  8, 16, 28, 34, 56, 48, 36],
  [ 6,  2, 10, 22, 58, 62, 54, 42],
  [14, 12,  4, 20, 50, 52, 60, 44],
  [24, 18, 26, 32, 40, 46, 38, 64],
  [35, 57, 49, 37, 29,  7, 15, 27],
  [59, 63, 55, 43,  5,  1,  9, 21],
  [51, 53, 61, 45, 13, 11,  3, 19],
  [41, 47, 39, 33, 23, 17, 25, 31],
];

/** Get the threshold matrix for a given method ID */
export function getOrderedMatrix(methodId: string): number[][] {
  if (methodId === 'bayer-4x4') return BAYER_4X4;
  if (methodId === 'bayer-2x2') return BAYER_2X2;
  if (methodId === 'bayer-8x8') return BAYER_8X8;
  if (methodId === 'cluster-dot') return CLUSTER_DOT_8X8;
  if (methodId === 'knoll') return KNOLL_8X8;
  return ORDERED_3X3;
}

/**
 * Apply ordered dither by pre-biasing the float buffer with the threshold map.
 * After this, a simple nearest-color pass produces the dithered output.
 *
 * @param rgbFloat  Float buffer (3 channels per pixel), modified in-place
 * @param width     Image width
 * @param height    Image height
 * @param methodId  Which ordered matrix to use
 * @param strength  Dither amplitude (default: 48)
 */
export function applyOrderedDither(
  rgbFloat: Float32Array,
  width: number,
  height: number,
  methodId: string,
  strength: number = 48,
): void {
  const matrix = getOrderedMatrix(methodId);
  const n = matrix.length;
  const maxVal = n * n + 1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const threshold = (matrix[y % n][x % n] / maxVal - 0.5) * strength;
      rgbFloat[idx] = Math.max(0, Math.min(255, rgbFloat[idx] + threshold));
      rgbFloat[idx + 1] = Math.max(0, Math.min(255, rgbFloat[idx + 1] + threshold));
      rgbFloat[idx + 2] = Math.max(0, Math.min(255, rgbFloat[idx + 2] + threshold));
    }
  }
}

/**
 * Two-closest ordered dithering — original mapartcraft approach.
 *
 * For each pixel, uses the ratio of distances to the two closest colours
 * and the threshold matrix to decide which colour to pick. This produces
 * more natural patterning than simple threshold biasing.
 *
 * @returns The index (0 or 1) of which of the two closest colors to use
 */
export function orderedChooseClosest(
  dist1: number,
  dist2: number,
  x: number,
  y: number,
  methodId: string,
): 0 | 1 {
  const matrix = getOrderedMatrix(methodId);
  const n = matrix.length;
  const maxValPlusOne = n * n + 1;
  const threshold = matrix[y % n][x % n];

  // If (dist1 * maxValPlusOne / dist2) > threshold → pick second color
  if (dist1 * maxValPlusOne > dist2 * threshold) {
    return 1;
  }
  return 0;
}
