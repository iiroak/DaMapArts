/**
 * Riemersma dithering — space-filling curve with exponential error queue.
 *
 * Instead of a raster scan, this method follows a Hilbert curve through the image,
 * distributing quantization error along the curve path using an exponentially
 * decaying queue. This produces error distribution in all directions (not just
 * forward/down), eliminating directionality artifacts.
 *
 * Reference: T. Riemersma, "A balanced dithering technique" (C/C++ Users Journal, 1998)
 */

/**
 * Convert Hilbert curve distance d to (x, y) for an N×N grid (N must be power of 2).
 */
function hilbertD2xy(n: number, d: number): [number, number] {
  let x = 0;
  let y = 0;
  for (let s = 1; s < n; s <<= 1) {
    const rx = (d >>> 1) & 1;
    const ry = (d ^ rx) & 1;
    if (ry === 0) {
      if (rx === 1) {
        x = s - 1 - x;
        y = s - 1 - y;
      }
      const tmp = x;
      x = y;
      y = tmp;
    }
    x += s * rx;
    y += s * ry;
    d >>>= 2;
  }
  return [x, y];
}

/**
 * Generate the Hilbert curve path for a W×H image.
 * Returns flat Uint32Array [x0, y0, x1, y1, ...] for cache-friendly access.
 *
 * The Hilbert curve is computed for the next power-of-2 enclosing square,
 * then points outside the image are filtered out.
 */
export function generateHilbertPath(width: number, height: number): Uint32Array {
  const maxDim = Math.max(width, height);
  let n = 1;
  while (n < maxDim) n <<= 1;

  const totalPoints = n * n;

  // First pass: count valid points
  let count = 0;
  for (let d = 0; d < totalPoints; d++) {
    const [px, py] = hilbertD2xy(n, d);
    if (px < width && py < height) count++;
  }

  // Second pass: build path
  const path = new Uint32Array(count * 2);
  let idx = 0;
  for (let d = 0; d < totalPoints; d++) {
    const [px, py] = hilbertD2xy(n, d);
    if (px < width && py < height) {
      path[idx++] = px;
      path[idx++] = py;
    }
  }

  return path;
}

/**
 * Create exponentially decaying weights for the Riemersma error queue.
 *
 * @param queueSize  Number of historical errors to carry (16 typical)
 * @returns Normalized weight array (index 0 = newest/heaviest)
 */
export function createRiemersmaWeights(queueSize: number = 16): Float32Array {
  const weights = new Float32Array(queueSize);
  const ratio = Math.exp(-1 / queueSize);
  weights[0] = 1;
  for (let i = 1; i < queueSize; i++) {
    weights[i] = weights[i - 1] * ratio;
  }
  // Normalize
  let sum = 0;
  for (let i = 0; i < queueSize; i++) sum += weights[i];
  for (let i = 0; i < queueSize; i++) weights[i] /= sum;
  return weights;
}

/**
 * Apply Riemersma dithering along the Hilbert curve path.
 * Modifies rgbFloat in-place by distributing accumulated error queue.
 *
 * @param rgbFloat   Float buffer (3 channels/pixel), modified in-place
 * @param width      Image width
 * @param height     Image height
 * @param path       Hilbert curve path (from generateHilbertPath)
 * @param queueSize  Error queue length (default: 16)
 */
export function applyRiemarsmaDither(
  rgbFloat: Float32Array,
  width: number,
  height: number,
  path: Uint32Array,
  queueSize: number = 16,
): void {
  const weights = createRiemersmaWeights(queueSize);
  const pointCount = path.length >>> 1;

  // Error queues for R, G, B channels
  const errQueueR = new Float32Array(queueSize);
  const errQueueG = new Float32Array(queueSize);
  const errQueueB = new Float32Array(queueSize);
  let queueHead = 0;

  for (let i = 0; i < pointCount; i++) {
    const x = path[i * 2];
    const y = path[i * 2 + 1];
    const idx = (y * width + x) * 3;

    // Accumulate weighted error from queue
    let accR = 0;
    let accG = 0;
    let accB = 0;
    for (let q = 0; q < queueSize; q++) {
      const wi = (queueHead + q) % queueSize;
      accR += errQueueR[wi] * weights[q];
      accG += errQueueG[wi] * weights[q];
      accB += errQueueB[wi] * weights[q];
    }

    // Apply accumulated error to current pixel
    rgbFloat[idx] = Math.max(0, Math.min(255, rgbFloat[idx] + accR));
    rgbFloat[idx + 1] = Math.max(0, Math.min(255, rgbFloat[idx + 1] + accG));
    rgbFloat[idx + 2] = Math.max(0, Math.min(255, rgbFloat[idx + 2] + accB));

    // The actual quantization (finding closest color) happens in the processor,
    // which will call back to set the error after quantizing.
    // Here we just pre-bias the pixel values. The error push happens externally.
  }
}

/**
 * Push a new error value into the Riemersma queue (ring buffer).
 * This is called by the processor after each pixel is quantized.
 */
export function pushRiemersmaError(
  errQueueR: Float32Array,
  errQueueG: Float32Array,
  errQueueB: Float32Array,
  queueHead: number,
  queueSize: number,
  errR: number,
  errG: number,
  errB: number,
): number {
  // Move head back (newest at head)
  const newHead = (queueHead - 1 + queueSize) % queueSize;
  errQueueR[newHead] = errR;
  errQueueG[newHead] = errG;
  errQueueB[newHead] = errB;
  return newHead;
}
