/**
 * Ostromoukhov variable error diffusion (2001).
 *
 * Unlike fixed-kernel methods, Ostromoukhov's algorithm varies the diffusion
 * coefficients based on pixel intensity. This eliminates the directional
 * "worm" artifacts common in Floyd-Steinberg and similar methods.
 *
 * The algorithm uses serpentine scanning (alternating left-right / right-left)
 * for further improved quality.
 *
 * Reference: V. Ostromoukhov, "A Simple and Efficient Error-Diffusion Algorithm"
 *            SIGGRAPH 2001.
 */

/**
 * Get the variable diffusion coefficients based on pixel intensity.
 *
 * The original paper provides a lookup table of 256 coefficient triplets,
 * but we use a smooth approximation that matches the paper's characteristics:
 * - At extremes (black/white): heavy right bias
 * - At midtones: more balanced distribution
 */
export function getOstromoukhovCoeffs(
  intensity: number,
): { right: number; downLeft: number; down: number; divisor: number } {
  intensity = Math.max(0, Math.min(255, Math.round(intensity)));

  // Symmetric distance from midpoint: 0 = extreme, 1 = midtone
  const t = 1 - Math.abs(intensity - 127.5) / 127.5;
  const t2 = t * t;

  // At extremes: heavy right (13), no down-left (0), moderate down (5)
  // At midtones: balanced (7, 3, 5)
  const right = Math.round(13 - 6 * t2);
  const downLeft = Math.round(3 * t2);
  const down = 5;

  const divisor = right + downLeft + down;
  return { right, downLeft, down, divisor: divisor || 1 };
}

/**
 * Distribute error using Ostromoukhov's variable coefficients.
 *
 * @param rgbFloat   Float buffer (3 channels per pixel)
 * @param width      Image width
 * @param height     Image height
 * @param x          Current pixel x
 * @param y          Current pixel y
 * @param errR       Red error (oldR - quantizedR)
 * @param errG       Green error
 * @param errB       Blue error
 * @param intensity  Average intensity of original pixel (for coefficient lookup)
 * @param direction  Scan direction: +1 = left-to-right, -1 = right-to-left
 */
export function distributeErrorOstromoukhov(
  rgbFloat: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  errR: number,
  errG: number,
  errB: number,
  intensity: number,
  direction: 1 | -1,
): void {
  const { right, downLeft, down, divisor } = getOstromoukhovCoeffs(intensity);

  // Neighbors: right in scan direction, diagonal behind, straight down
  const neighbors: Array<[number, number, number]> = [
    [direction, 0, right],       // next pixel in scan direction
    [-direction, 1, downLeft],   // diagonal behind in next row
    [0, 1, down],                // directly below
  ];

  for (const [dx, dy, weight] of neighbors) {
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
