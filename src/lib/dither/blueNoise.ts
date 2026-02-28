/**
 * Blue Noise dithering — Interleaved Gradient Noise.
 *
 * Uses Jiménez's Interleaved Gradient Noise function (NEXT 2014)
 * to approximate blue-noise properties procedurally. No lookup table needed.
 * Produces uniform but aperiodic noise, ideal for map art with
 * organic illustrations and anime-style sources.
 */

/**
 * Compute blue-noise threshold at position (x, y).
 * Returns a value in [0, 1).
 */
function blueNoiseThreshold(x: number, y: number): number {
  const v = 52.9829189 * ((0.06711056 * x + 0.00583715 * y) % 1);
  return v - Math.floor(v);
}

/**
 * Apply blue noise dithering by biasing the float buffer.
 * Similar to ordered dither but with pseudo-random noise instead of a fixed pattern.
 *
 * @param rgbFloat  Float buffer (3 channels per pixel), modified in-place
 * @param width     Image width
 * @param height    Image height
 * @param strength  Dither amplitude (default: 48)
 */
export function applyBlueNoiseDither(
  rgbFloat: Float32Array,
  width: number,
  height: number,
  strength: number = 48,
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      const threshold = (blueNoiseThreshold(x, y) - 0.5) * strength;
      rgbFloat[idx] = Math.max(0, Math.min(255, rgbFloat[idx] + threshold));
      rgbFloat[idx + 1] = Math.max(0, Math.min(255, rgbFloat[idx + 1] + threshold));
      rgbFloat[idx + 2] = Math.max(0, Math.min(255, rgbFloat[idx + 2] + threshold));
    }
  }
}
