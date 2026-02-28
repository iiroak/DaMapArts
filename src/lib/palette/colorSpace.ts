/**
 * Color space conversions: RGB ↔ CIELAB, RGB ↔ Oklab, Oklch, YCbCr, HSL.
 * Used for perceptual color matching in dithering and palette lookup.
 */
import type { RGB, LAB, Oklab, Oklch, YCbCr, HSL } from '$lib/types/colours.js';
import type { ColorSpace } from '$lib/types/settings.js';

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

function labF(y: number): number {
  return y > 0.00885645167903563
    ? Math.cbrt(y)
    : (903.2962962962963 * y + 16) / 116;
}

export function rgb2lab50(rgb: RGB): LAB {
  const r1 = rgb[0] / 255.0;
  const g1 = rgb[1] / 255.0;
  const b1 = rgb[2] / 255.0;

  const x = (0.436065742824811 * r1 + 0.3851514688337912 * g1 + 0.14307845442264197 * b1) / 0.9642956764295676;
  const y = 0.22249319175623702 * r1 + 0.7168870538238823 * g1 + 0.06061979053616537 * b1;
  const z = (0.013923904500943465 * r1 + 0.09708128566574634 * g1 + 0.7140993584005155 * b1) / 0.8251046025104603;

  const f1 = labF(y);
  let a = 0;
  let bVal = 0;

  if (r1 !== g1 || g1 !== b1) {
    const f0 = labF(x);
    const f2 = labF(z);
    a = 500 * (f0 - f1);
    bVal = 200 * (f1 - f2);
  }

  return [116 * f1 - 16, a, bVal];
}

export function rgb2lab65(rgb: RGB): LAB {
  const r1 = rgb[0] / 255.0;
  const g1 = rgb[1] / 255.0;
  const b1 = rgb[2] / 255.0;

  const x = (0.4123907992659593 * r1 + 0.357584339383878 * g1 + 0.1804807884018343 * b1) / 0.9504559270516717;
  const y = 0.2126390058715102 * r1 + 0.715168678767756 * g1 + 0.0721923153607337 * b1;
  const z = (0.0193308187155918 * r1 + 0.119194779794626 * g1 + 0.9505321522496607 * b1) / 1.0890577507598784;

  const f1 = labF(y);
  let a = 0;
  let bVal = 0;

  if (r1 !== g1 || g1 !== b1) {
    const f0 = labF(x);
    const f2 = labF(z);
    a = 500 * (f0 - f1);
    bVal = 200 * (f1 - f2);
  }

  return [116 * f1 - 16, a, bVal];
}

function linearized(channel: number): number {
  const normalized = channel / 255.0;
  return normalized <= 0.040449936
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function signum(num: number): number {
  if (num < 0) return -1;
  if (num > 0) return 1;
  return 0;
}

function rgb2xyz(rgb: RGB): RGB {
  const r1 = linearized(rgb[0]);
  const g1 = linearized(rgb[1]);
  const b1 = linearized(rgb[2]);

  const x = 0.41233895 * r1 + 0.35762064 * g1 + 0.18051042 * b1;
  const y = 0.2126 * r1 + 0.7152 * g1 + 0.0722 * b1;
  const z = 0.01932141 * r1 + 0.11916382 * g1 + 0.95034478 * b1;
  return [x, y, z];
}

export function rgb2hct(rgb: RGB): LAB {
  const [x, y, z] = rgb2xyz(rgb);

  const rD = (0.401288 * x + 0.650173 * y - 0.051461 * z) * 1.02117770275752;
  const gD = (-0.250268 * x + 1.204414 * y + 0.045854 * z) * 0.9863077294280124;
  const bD = (-0.002079 * x + 0.048952 * y + 0.953127 * z) * 0.9339605082802299;

  const rAF = Math.pow((0.3884814537800353 * Math.abs(rD)) / 100.0, 0.42);
  const gAF = Math.pow((0.3884814537800353 * Math.abs(gD)) / 100.0, 0.42);
  const bAF = Math.pow((0.3884814537800353 * Math.abs(bD)) / 100.0, 0.42);

  const rA = (signum(rD) * 400.0 * rAF) / (rAF + 27.13);
  const gA = (signum(gD) * 400.0 * gAF) / (gAF + 27.13);
  const bA = (signum(bD) * 400.0 * bAF) / (bAF + 27.13);

  const a = (11.0 * rA - 12.0 * gA + bA) / 11.0;
  const b = (rA + gA - 2.0 * bA) / 9.0;
  const u = (20.0 * rA + 20.0 * gA + 21.0 * bA) / 20.0;
  const p2 = (40.0 * rA + 20.0 * gA + bA) / 20.0;

  const atanDegrees = (Math.atan2(b, a) * 180.0) / Math.PI;
  const hue = atanDegrees < 0 ? atanDegrees + 360.0 : atanDegrees >= 360 ? atanDegrees - 360.0 : atanDegrees;
  const hueRadians = (hue * Math.PI) / 180.0;

  const j = 100.0 * Math.pow(p2 * 0.03391879108791669, 1.3173270022537198);
  const huePrime = hue < 20.14 ? hue + 360 : hue;
  const p1 = 3911.227617099521 * 0.25 * (Math.cos((huePrime * Math.PI) / 180.0 + 2.0) + 3.8);
  const t = (p1 * Math.sqrt(a * a + b * b)) / (u + 0.305);
  const alpha = Math.pow(t, 0.9) * 0.8834525670408592;

  const m = alpha * Math.sqrt(j / 100.0) * 0.7894826179304937;
  const mStar = 43.859649122807014 * Math.log(1.0 + 0.0228 * m);

  const aStar = mStar * Math.cos(hueRadians);
  const bStar = mStar * Math.sin(hueRadians);
  const lStar = 116.0 * labF(y) - 16.0;

  return [lStar, aStar, bStar];
}

export function ciede2000DistanceSq(a: LAB, b: LAB): number {
  const lStd = a[0];
  const aStd = a[1];
  const bStd = a[2];
  const cStd = Math.sqrt(aStd * aStd + bStd * bStd);

  const lSmp = b[0];
  const aSmp = b[1];
  const bSmp = b[2];
  const cSmp = Math.sqrt(aSmp * aSmp + bSmp * bSmp);
  const cAvg = (cStd + cSmp) / 2;

  const cAvgPow7 = Math.pow(cAvg, 7);
  const g = 0.5 * (1 - Math.sqrt(cAvgPow7 / (cAvgPow7 + Math.pow(25, 7))));

  const apStd = aStd * (1 + g);
  const apSmp = aSmp * (1 + g);

  const cpStd = Math.sqrt(apStd * apStd + bStd * bStd);
  const cpSmp = Math.sqrt(apSmp * apSmp + bSmp * bSmp);

  let hpStd = Math.abs(apStd) + Math.abs(bStd) === 0 ? 0 : Math.atan2(bStd, apStd);
  hpStd += hpStd < 0 ? 2 * Math.PI : 0;

  let hpSmp = Math.abs(apSmp) + Math.abs(bSmp) === 0 ? 0 : Math.atan2(bSmp, apSmp);
  hpSmp += hpSmp < 0 ? 2 * Math.PI : 0;

  const dL = lSmp - lStd;
  const dC = cpSmp - cpStd;

  const cpBothZero = cpStd === 0 && cpSmp === 0;
  let dhp = cpBothZero ? 0 : hpSmp - hpStd;
  if (dhp > Math.PI) dhp -= 2 * Math.PI;
  if (dhp < -Math.PI) dhp += 2 * Math.PI;

  const dH = 2 * Math.sqrt(cpStd * cpSmp) * Math.sin(dhp / 2);

  const lp = (lStd + lSmp) / 2;
  const cp = (cpStd + cpSmp) / 2;

  let hp: number;
  if (cpBothZero) {
    hp = hpStd + hpSmp;
  } else {
    hp = (hpStd + hpSmp) / 2;
    if (Math.abs(hpStd - hpSmp) > Math.PI) hp -= Math.PI;
    if (hp < 0) hp += 2 * Math.PI;
  }

  const lpMinus50 = lp - 50;
  const lpM50 = lpMinus50 * lpMinus50;
  const t =
    1 -
    0.17 * Math.cos(hp - Math.PI / 6) +
    0.24 * Math.cos(2 * hp) +
    0.32 * Math.cos(3 * hp + Math.PI / 30) -
    0.2 * Math.cos(4 * hp - (63 * Math.PI) / 180);

  const sl = 1 + (0.015 * lpM50) / Math.sqrt(20 + lpM50);
  const sc = 1 + 0.045 * cp;
  const sh = 1 + 0.015 * cp * t;

  const deltaTheta = ((30 * Math.PI) / 180) * Math.exp(-Math.pow(((180 / Math.PI) * hp - 275) / 25, 2));
  const rc = 2 * Math.sqrt(Math.pow(cp, 7) / (Math.pow(cp, 7) + Math.pow(25, 7)));
  const rt = -Math.sin(2 * deltaTheta) * rc;

  const dLdivSl = dL / sl;
  const dCdivSc = dC / sc;
  const dHdivSh = dH / sh;
  return dLdivSl * dLdivSl + dCdivSc * dCdivSc + dHdivSh * dHdivSh + (((rt * dC) / sc) * dH) / sh;
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
  space: ColorSpace,
): number {
  if (space === 'mapartcraft-default' || space === 'lab') {
    const la = rgb2lab(a);
    const lb = rgb2lab(b);
    return (la[0] - lb[0]) ** 2 + (la[1] - lb[1]) ** 2 + (la[2] - lb[2]) ** 2;
  }
  if (space === 'cie76-lab50') {
    const la = rgb2lab50(a);
    const lb = rgb2lab50(b);
    return (la[0] - lb[0]) ** 2 + (la[1] - lb[1]) ** 2 + (la[2] - lb[2]) ** 2;
  }
  if (space === 'cie76-lab65') {
    const la = rgb2lab65(a);
    const lb = rgb2lab65(b);
    return (la[0] - lb[0]) ** 2 + (la[1] - lb[1]) ** 2 + (la[2] - lb[2]) ** 2;
  }
  if (space === 'ciede2000-lab50') {
    return ciede2000DistanceSq(rgb2lab50(a), rgb2lab50(b));
  }
  if (space === 'ciede2000-lab65') {
    return ciede2000DistanceSq(rgb2lab65(a), rgb2lab65(b));
  }
  if (space === 'hct') {
    const ha = rgb2hct(a);
    const hb = rgb2hct(b);
    return (ha[0] - hb[0]) ** 2 + (ha[1] - hb[1]) ** 2 + (ha[2] - hb[2]) ** 2;
  }
  if (space === 'euclidian' || space === 'rgb') {
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
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
  return hslDistanceSq(rgb2hsl(a), rgb2hsl(b));
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
