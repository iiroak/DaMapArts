/**
 * Color space conversions: RGB ↔ CIELAB, RGB ↔ Oklab, Oklch, YCbCr, HSL.
 * Used for perceptual color matching in dithering and palette lookup.
 */
import type { RGB, LAB, Oklab, Oklch, YCbCr, HSL } from '$lib/types/colours.js';

/**
 * Convert sRGB [0-255] to CIE L*a*b*.
 * Implementation matches mapartcraft's worker.js rgb2lab.
 */
export function rgb2lab(rgb: RGB): LAB {
  let r1 = rgb[0] / 255.0;
  let g1 = rgb[1] / 255.0;
  let b1 = rgb[2] / 255.0;

  r1 = r1 <= 0.04045 ? r1 / 12.0 : Math.pow((r1 + 0.055) / 1.055, 2.4);
  g1 = g1 <= 0.04045 ? g1 / 12.0 : Math.pow((g1 + 0.055) / 1.055, 2.4);
  b1 = b1 <= 0.04045 ? b1 / 12.0 : Math.pow((b1 + 0.055) / 1.055, 2.4);

  const x = (0.43605202 * r1 + 0.3850816 * g1 + 0.14308742 * b1) / 0.964221;
  const y = 0.22249159 * r1 + 0.71688604 * g1 + 0.060621485 * b1;
  const z = (0.013929122 * r1 + 0.097097 * g1 + 0.7141855 * b1) / 0.825211;

  const fy = y > 0.008856452 ? Math.pow(y, 1 / 3) : (903.2963 * y + 16.0) / 116.0;
  const fx = x > 0.008856452 ? Math.pow(x, 1 / 3) : (903.2963 * x + 16.0) / 116.0;
  const fz = z > 0.008856452 ? Math.pow(z, 1 / 3) : (903.2963 * z + 16.0) / 116.0;

  const L = 2.55 * (116.0 * fy - 16.0) + 0.5;
  const a = 500.0 * (fx - fy) + 0.5;
  const bVal = 200.0 * (fy - fz) + 0.5;

  return [L, a, bVal];
}

/**
 * Linearize a single sRGB channel [0-255] → linear [0-1].
 */
function linearize(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/**
 * Convert sRGB [0-255] to Oklab (Björn Ottosson, 2020).
 * Better perceptual uniformity than CIELAB.
 */
export function rgb2oklab(rgb: RGB): Oklab {
  const r = linearize(rgb[0]);
  const g = linearize(rgb[1]);
  const b = linearize(rgb[2]);

  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2024326453 * g + 0.6892648928 * b);

  return [
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
  ];
}

/**
 * Convert Oklab to Oklch (cylindrical form).
 * Oklch: L = lightness, C = chroma (saturation), h = hue angle (radians).
 */
export function oklab2oklch(oklab: Oklab): Oklch {
  const [L, a, b] = oklab;
  const C = Math.sqrt(a * a + b * b);
  const h = Math.atan2(b, a); // radians, may be negative
  return [L, C, h];
}

/**
 * Convert sRGB [0-255] to Oklch.
 */
export function rgb2oklch(rgb: RGB): Oklch {
  return oklab2oklch(rgb2oklab(rgb));
}

/**
 * Convert sRGB [0-255] to YCbCr (BT.601).
 * Y ∈ [0, 255], Cb ∈ [0, 255], Cr ∈ [0, 255].
 */
export function rgb2ycbcr(rgb: RGB): YCbCr {
  const [R, G, B] = rgb;
  const Y = 0.299 * R + 0.587 * G + 0.114 * B;
  const Cb = -0.168736 * R - 0.331264 * G + 0.5 * B + 128;
  const Cr = 0.5 * R - 0.418688 * G - 0.081312 * B + 128;
  return [Y, Cb, Cr];
}

/**
 * Convert sRGB [0-255] to HSL.
 * H ∈ [0, 2π) in radians, S ∈ [0, 1], L ∈ [0, 1].
 */
export function rgb2hsl(rgb: RGB): HSL {
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const L = (max + min) / 2;
  const d = max - min;

  if (d === 0) return [0, 0, L]; // achromatic

  const S = L > 0.5 ? d / (2 - max - min) : d / (max + min);

  let H: number;
  if (max === r) {
    H = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  } else if (max === g) {
    H = ((b - r) / d + 2) / 6;
  } else {
    H = ((r - g) / d + 4) / 6;
  }

  return [H * Math.PI * 2, S, L]; // H in radians
}

/**
 * Convert RGB [0-255] to CSS hex string.
 */
export function rgbToHex(rgb: RGB): string {
  return '#' + rgb.map((c) => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Squared color distance in the specified color space.
 * Using squared distance avoids sqrt for performance.
 */
export function colorDistanceSq(
  a: RGB,
  b: RGB,
  space: 'rgb' | 'lab' | 'oklab' | 'oklch' | 'ycbcr' | 'hsl',
): number {
  if (space === 'lab') {
    const la = rgb2lab(a);
    const lb = rgb2lab(b);
    return (la[0] - lb[0]) ** 2 + (la[1] - lb[1]) ** 2 + (la[2] - lb[2]) ** 2;
  }
  if (space === 'oklab') {
    const oa = rgb2oklab(a);
    const ob = rgb2oklab(b);
    return (oa[0] - ob[0]) ** 2 + (oa[1] - ob[1]) ** 2 + (oa[2] - ob[2]) ** 2;
  }
  if (space === 'oklch') {
    return oklchDistanceSq(rgb2oklch(a), rgb2oklch(b));
  }
  if (space === 'ycbcr') {
    const ya = rgb2ycbcr(a);
    const yb = rgb2ycbcr(b);
    return (ya[0] - yb[0]) ** 2 + (ya[1] - yb[1]) ** 2 + (ya[2] - yb[2]) ** 2;
  }
  if (space === 'hsl') {
    return hslDistanceSq(rgb2hsl(a), rgb2hsl(b));
  }
  // RGB euclidean
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

/**
 * Squared distance in Oklch space.
 * Uses the ΔH formula for cylindrical hue: ΔH = 2·√(C₁·C₂)·sin(Δh/2)
 */
function oklchDistanceSq(a: Oklch, b: Oklch): number {
  const dL = a[0] - b[0];
  const dC = a[1] - b[1];
  const dh = a[2] - b[2];
  const dH = 2 * Math.sqrt(a[1] * b[1]) * Math.sin(dh / 2);
  return dL * dL + dC * dC + dH * dH;
}

/**
 * Squared distance in HSL space.
 * Handles hue as a circular dimension.
 */
function hslDistanceSq(a: HSL, b: HSL): number {
  // Hue difference (circular, in radians)
  let dH = Math.abs(a[0] - b[0]);
  if (dH > Math.PI) dH = 2 * Math.PI - dH;
  // Weight hue by both saturations so achromatic colors ignore hue
  const avgS = (a[1] + b[1]) / 2;
  const dS = a[1] - b[1];
  const dL = a[2] - b[2];
  return (dH * avgS) ** 2 + dS * dS + dL * dL;
}
