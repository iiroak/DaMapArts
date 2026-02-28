/**
 * Edge detection via Sobel operator for edge-masked dithering.
 *
 * Computes a per-pixel edge mask where:
 *   - 1.0 = strong edge (linework, eye outlines, hair strands)
 *   - 0.0 = flat area (skin, sky, solid clothing)
 *
 * The engine uses this mask to decide per-pixel:
 *   - On edges: use direct quantization (nearest palette color, no dithering)
 *   - On flat areas: use the selected dithering method normally
 *
 * This preserves sharp linework while allowing smooth gradients in flat areas.
 *
 * Operates on Float32Array RGB buffer (3 channels, [R,G,B,R,G,B,...]).
 */

/**
 * Compute Sobel edge magnitude for each pixel.
 *
 * @param rgbFloat  Float32Array of interleaved RGB values
 * @param width     Image width
 * @param height    Image height
 * @param threshold Edge threshold (0-255). Pixels with gradient magnitude above this
 *                  are classified as edges. Lower = more edges detected.
 * @returns Float32Array with one value per pixel: 0.0 (flat) to 1.0 (edge)
 */
export function computeEdgeMask(
  rgbFloat: Float32Array,
  width: number,
  height: number,
  threshold: number,
): Float32Array {
  const totalPixels = width * height;
  const mask = new Float32Array(totalPixels);

  // Convert to grayscale luminance for edge detection
  // Using perceptual weights (BT.601)
  const gray = new Float32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    gray[i] =
      0.299 * rgbFloat[i * 3] +
      0.587 * rgbFloat[i * 3 + 1] +
      0.114 * rgbFloat[i * 3 + 2];
  }

  // Sobel kernels:
  //   Gx = [-1 0 1]    Gy = [-1 -2 -1]
  //        [-2 0 2]          [ 0  0  0]
  //        [-1 0 1]          [ 1  2  1]
  //
  // We compute Gx and Gy at each pixel, then magnitude = sqrt(Gx² + Gy²)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // 3x3 neighborhood indices
      const tl = (y - 1) * width + (x - 1);
      const tc = (y - 1) * width + x;
      const tr = (y - 1) * width + (x + 1);
      const ml = y * width + (x - 1);
      const mr = y * width + (x + 1);
      const bl = (y + 1) * width + (x - 1);
      const bc = (y + 1) * width + x;
      const br = (y + 1) * width + (x + 1);

      // Horizontal gradient
      const gx =
        -gray[tl] + gray[tr] +
        -2 * gray[ml] + 2 * gray[mr] +
        -gray[bl] + gray[br];

      // Vertical gradient
      const gy =
        -gray[tl] - 2 * gray[tc] - gray[tr] +
        gray[bl] + 2 * gray[bc] + gray[br];

      const magnitude = Math.sqrt(gx * gx + gy * gy);

      // Normalize to 0-1 using threshold as the "full edge" point
      // Pixels above threshold → 1.0, below → proportional
      mask[y * width + x] = Math.min(1.0, magnitude / threshold);
    }
  }

  // Border pixels: copy from nearest interior pixel
  for (let x = 0; x < width; x++) {
    mask[x] = mask[width + x]; // top row
    mask[(height - 1) * width + x] = mask[(height - 2) * width + x]; // bottom row
  }
  for (let y = 0; y < height; y++) {
    mask[y * width] = mask[y * width + 1]; // left col
    mask[y * width + width - 1] = mask[y * width + width - 2]; // right col
  }

  return mask;
}
