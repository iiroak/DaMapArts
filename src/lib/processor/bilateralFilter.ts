/**
 * Bilateral filter — smooths flat areas while preserving edges.
 *
 * Unlike Gaussian blur which blurs everything uniformly, the bilateral filter
 * considers both spatial distance AND color similarity. Pixels with similar
 * colors get blurred together, but pixels across an edge (big color difference)
 * are kept separate.
 *
 * This is the #1 technique for cleaning up skin/sky/flat areas before dithering
 * while keeping anime linework and eye details crisp.
 *
 * Operates on Float32Array RGB buffer (3 channels, [R,G,B,R,G,B,...]).
 */

/**
 * Apply bilateral filter in-place to an RGB float buffer.
 *
 * @param rgbFloat  Float32Array of interleaved RGB values (length = width * height * 3)
 * @param width     Image width in pixels
 * @param height    Image height in pixels
 * @param sigmaSpace  Spatial sigma — controls the size of the blur neighborhood.
 *                     Higher = wider blur. Typical: 2-6.
 * @param sigmaColor  Color/range sigma — controls how much color difference is tolerated.
 *                     Higher = more tolerant (blurs across mild edges). Typical: 15-50.
 * @param radius       Kernel radius in pixels (window = 2*radius+1). Typical: 2-5.
 */
export function applyBilateralFilter(
  rgbFloat: Float32Array,
  width: number,
  height: number,
  sigmaSpace: number,
  sigmaColor: number,
  radius: number,
): void {
  const totalPixels = width * height;

  // Pre-compute spatial Gaussian weights (only depends on distance, not color)
  const kernelSize = 2 * radius + 1;
  const spatialWeights = new Float32Array(kernelSize * kernelSize);
  const spatialDenom = -2 * sigmaSpace * sigmaSpace;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const distSq = dx * dx + dy * dy;
      spatialWeights[(dy + radius) * kernelSize + (dx + radius)] =
        Math.exp(distSq / spatialDenom);
    }
  }

  // Pre-compute range Gaussian LUT (indexed by squared color distance)
  // Max squared distance for RGB [0-255] is 3*255*255 ≈ 195075
  const colorDenom = -2 * sigmaColor * sigmaColor;
  // Use a LUT for the range kernel — clamp to reasonable max
  const RANGE_LUT_SIZE = 256 * 3 + 1; // enough for most cases
  const rangeLUT = new Float32Array(RANGE_LUT_SIZE);
  for (let i = 0; i < RANGE_LUT_SIZE; i++) {
    rangeLUT[i] = Math.exp(i / colorDenom);
  }

  // Work on a copy to avoid reading modified values during convolution
  const copy = new Float32Array(rgbFloat);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const centerIdx = (y * width + x) * 3;
      const cR = copy[centerIdx];
      const cG = copy[centerIdx + 1];
      const cB = copy[centerIdx + 2];

      let sumR = 0, sumG = 0, sumB = 0;
      let weightSum = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;

        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;

          const neighborIdx = (ny * width + nx) * 3;
          const nR = copy[neighborIdx];
          const nG = copy[neighborIdx + 1];
          const nB = copy[neighborIdx + 2];

          // Color distance (Euclidean in RGB space)
          const dr = cR - nR;
          const dg = cG - nG;
          const db = cB - nB;
          const colorDistSq = dr * dr + dg * dg + db * db;

          // Spatial weight (from precomputed table)
          const sw = spatialWeights[(dy + radius) * kernelSize + (dx + radius)];

          // Range weight — use LUT if in range, else compute directly
          const rw = colorDistSq < RANGE_LUT_SIZE
            ? rangeLUT[Math.round(colorDistSq)]
            : Math.exp(colorDistSq / colorDenom);

          const w = sw * rw;

          sumR += nR * w;
          sumG += nG * w;
          sumB += nB * w;
          weightSum += w;
        }
      }

      if (weightSum > 0) {
        rgbFloat[centerIdx] = sumR / weightSum;
        rgbFloat[centerIdx + 1] = sumG / weightSum;
        rgbFloat[centerIdx + 2] = sumB / weightSum;
      }
    }
  }
}
