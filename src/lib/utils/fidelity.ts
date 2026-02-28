/**
 * Image fidelity metrics using S-CIELAB approach:
 *   1. Gaussian blur both images (simulates human eye spatial filtering)
 *   2. Convert to CIELAB color space
 *   3. Compute CIEDE2000 perceptual color difference
 *
 * This gives the most perceptually accurate fidelity score,
 * especially for dithered images where pixel-level differences
 * are averaged by the human visual system.
 */

// ─── Standard RGB → CIELAB ──────────────────────────────────

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function labF(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

/** Convert sRGB [0-255] to standard CIELAB (L: 0-100, a/b: ~-128..+127) */
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // sRGB → linear → XYZ (D65)
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  const x = (0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl) / 0.95047;
  const y = 0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl;
  const z = (0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl) / 1.08883;

  const fx = labF(x);
  const fy = labF(y);
  const fz = labF(z);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const bVal = 200 * (fy - fz);

  return [L, a, bVal];
}

// ─── CIEDE2000 ──────────────────────────────────────────────

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/**
 * CIEDE2000 color difference.
 * Reference: Sharma, Wu, Dalal (2005).
 */
function ciede2000(
  L1: number,
  a1: number,
  b1: number,
  L2: number,
  a2: number,
  b2: number,
): number {
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cab = (C1 + C2) / 2;

  const Cab7 = Math.pow(Cab, 7);
  const G = 0.5 * (1 - Math.sqrt(Cab7 / (Cab7 + 6103515625))); // 25^7

  const a1p = a1 * (1 + G);
  const a2p = a2 * (1 + G);

  const C1p = Math.sqrt(a1p * a1p + b1 * b1);
  const C2p = Math.sqrt(a2p * a2p + b2 * b2);

  let h1p = Math.atan2(b1, a1p) * DEG;
  if (h1p < 0) h1p += 360;
  let h2p = Math.atan2(b2, a2p) * DEG;
  if (h2p < 0) h2p += 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp / 2) * RAD);

  const Lp = (L1 + L2) / 2;
  const Cp = (C1p + C2p) / 2;

  let hp: number;
  if (C1p * C2p === 0) {
    hp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hp = (h1p + h2p + 360) / 2;
  } else {
    hp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos((hp - 30) * RAD) +
    0.24 * Math.cos(2 * hp * RAD) +
    0.32 * Math.cos((3 * hp + 6) * RAD) -
    0.20 * Math.cos((4 * hp - 63) * RAD);

  const Lp50sq = (Lp - 50) * (Lp - 50);
  const SL = 1 + 0.015 * Lp50sq / Math.sqrt(20 + Lp50sq);
  const SC = 1 + 0.045 * Cp;
  const SH = 1 + 0.015 * Cp * T;

  const Cp7 = Math.pow(Cp, 7);
  const RC = 2 * Math.sqrt(Cp7 / (Cp7 + 6103515625));

  const dhpRad = ((hp - 275) / 25);
  const RT = -Math.sin(2 * 30 * RAD * Math.exp(-dhpRad * dhpRad)) * RC;

  const termL = dLp / SL;
  const termC = dCp / SC;
  const termH = dHp / SH;

  return Math.sqrt(
    termL * termL + termC * termC + termH * termH + RT * termC * termH,
  );
}

// ─── Gaussian Blur ──────────────────────────────────────────

/**
 * Build a 1D Gaussian kernel of given radius.
 * Kernel size = 2*radius + 1.
 */
function buildGaussianKernel(radius: number): Float32Array {
  const sigma = radius / 2;
  const size = Math.ceil(radius) * 2 + 1;
  const kernel = new Float32Array(size);
  let sum = 0;
  const center = Math.floor(size / 2);

  for (let i = 0; i < size; i++) {
    const x = i - center;
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += kernel[i];
  }

  // Normalize
  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }

  return kernel;
}

/**
 * Apply separable Gaussian blur to an RGBA buffer.
 * Returns a new Float32Array of [R, G, B] per pixel (no alpha).
 */
function gaussianBlur(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Float32Array {
  const kernel = buildGaussianKernel(radius);
  const halfK = Math.floor(kernel.length / 2);
  const n = width * height;

  // Extract RGB as float
  const srcR = new Float32Array(n);
  const srcG = new Float32Array(n);
  const srcB = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    srcR[i] = rgba[i * 4];
    srcG[i] = rgba[i * 4 + 1];
    srcB[i] = rgba[i * 4 + 2];
  }

  // Horizontal pass
  const tmpR = new Float32Array(n);
  const tmpG = new Float32Array(n);
  const tmpB = new Float32Array(n);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0,
        g = 0,
        b = 0;
      for (let k = 0; k < kernel.length; k++) {
        const sx = Math.min(Math.max(x + k - halfK, 0), width - 1);
        const idx = y * width + sx;
        const w = kernel[k];
        r += srcR[idx] * w;
        g += srcG[idx] * w;
        b += srcB[idx] * w;
      }
      const out = y * width + x;
      tmpR[out] = r;
      tmpG[out] = g;
      tmpB[out] = b;
    }
  }

  // Vertical pass
  const outBuf = new Float32Array(n * 3);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0,
        g = 0,
        b = 0;
      for (let k = 0; k < kernel.length; k++) {
        const sy = Math.min(Math.max(y + k - halfK, 0), height - 1);
        const idx = sy * width + x;
        const w = kernel[k];
        r += tmpR[idx] * w;
        g += tmpG[idx] * w;
        b += tmpB[idx] * w;
      }
      const out = (y * width + x) * 3;
      outBuf[out] = r;
      outBuf[out + 1] = g;
      outBuf[out + 2] = b;
    }
  }

  return outBuf;
}

// ─── S-CIELAB Fidelity Score ────────────────────────────────

/**
 * Compute perceptual fidelity percentage using S-CIELAB:
 *   1. Gaussian blur both images (radius 1.5)
 *   2. Convert to CIELAB
 *   3. Mean CIEDE2000 across all pixels
 *   4. Map to 0-100% scale
 *
 * @param processed - Processed RGBA pixels (Uint8ClampedArray)
 * @param source    - Original RGBA pixels (Uint8ClampedArray)
 * @param width     - Image width
 * @param height    - Image height
 * @returns Fidelity percentage (0-100, higher = more faithful)
 */
export function computePerceptualFidelity(
  processed: Uint8ClampedArray,
  source: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  const BLUR_RADIUS = 1.5;

  // Step 1: Gaussian blur both images
  const blurredSrc = gaussianBlur(source, width, height, BLUR_RADIUS);
  const blurredProc = gaussianBlur(processed, width, height, BLUR_RADIUS);

  const n = width * height;
  let totalDeltaE = 0;

  // Step 2+3: Convert each pixel pair to CIELAB, compute CIEDE2000
  for (let i = 0; i < n; i++) {
    const idx = i * 3;

    const [L1, a1, b1] = rgbToLab(
      blurredSrc[idx],
      blurredSrc[idx + 1],
      blurredSrc[idx + 2],
    );
    const [L2, a2, b2] = rgbToLab(
      blurredProc[idx],
      blurredProc[idx + 1],
      blurredProc[idx + 2],
    );

    totalDeltaE += ciede2000(L1, a1, b1, L2, a2, b2);
  }

  const meanDeltaE = totalDeltaE / n;

  // Step 4: Map to fidelity percentage.
  // Delta-E 2000 scale: 0 = identical, ~1 = barely noticeable, ~5 = clearly different.
  // For map art with limited palette, typical values range 2-15.
  // We use a sigmoid-like mapping: fidelity = 100 * exp(-meanDeltaE / k)
  // k=8 gives ~88% for deltaE=1, ~54% for deltaE=5, ~29% for deltaE=10
  const fidelity = 100 * Math.exp(-meanDeltaE / 8);

  return Math.round(fidelity * 1000) / 1000; // three decimal places
}
