/**
 * GLSL shaders for WebGL 2 GPU-accelerated ordered dithering.
 *
 * The fragment shader handles:
 * - All 6 color space conversions (RGB, Lab, Oklab, Oklch, YCbCr, HSL)
 * - Two-closest palette search + threshold-based selection (ordered dithering)
 * - Single-nearest for blue noise bias pre-pass
 *
 * Palette is uploaded as two float textures:
 * - u_paletteRGB:       Nx1 RGB values [0-255]
 * - u_paletteConverted:  Nx1 pre-converted values in target color space
 *
 * Threshold matrix uploaded as u_threshold NxN texture.
 */

export const VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec2 a_position;
out vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  // Map [-1,1] to [0,1] for texture lookup
  v_texCoord = a_position * 0.5 + 0.5;
}
`;

export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

uniform sampler2D u_source;          // Source image (RGBA, normalized 0-1)
uniform sampler2D u_paletteRGB;      // Palette RGB values [0-255] as float in RGB channels
uniform sampler2D u_paletteConverted; // Palette pre-converted to target space
uniform sampler2D u_threshold;       // Threshold matrix (R channel, 1-indexed values)

uniform int u_paletteSize;           // Number of palette colors
uniform int u_colorSpace;            // 0=rgb,1=lab,2=oklab,3=oklch,4=ycbcr,5=hsl
uniform int u_matrixSize;            // Threshold matrix dimension (e.g. 4 for 4x4)
uniform int u_width;
uniform int u_height;
uniform int u_ditherMode;            // 0=ordered (two-closest), 1=blue-noise (bias+nearest)
uniform float u_ditherStrength;      // Bias strength for blue noise (default 48.0)

in vec2 v_texCoord;
out vec4 fragColor;

// ── sRGB linearization ──
// Note: Lab uses /12.0, Oklab uses /12.92 (matching original JS implementations)
float linearizeLab(float c) {
  return c <= 0.04045 ? c / 12.0 : pow((c + 0.055) / 1.055, 2.4);
}

float linearizeOklab(float c) {
  return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4);
}

// ── Color space conversions (input: RGB [0-255]) ──

vec3 rgb2lab(vec3 rgb) {
  float r1 = linearizeLab(rgb.r / 255.0);
  float g1 = linearizeLab(rgb.g / 255.0);
  float b1 = linearizeLab(rgb.b / 255.0);

  float x = (0.43605202 * r1 + 0.3850816 * g1 + 0.14308742 * b1) / 0.964221;
  float y = 0.22249159 * r1 + 0.71688604 * g1 + 0.060621485 * b1;
  float z = (0.013929122 * r1 + 0.097097 * g1 + 0.7141855 * b1) / 0.825211;

  float fy = y > 0.008856452 ? pow(y, 1.0/3.0) : (903.2963 * y + 16.0) / 116.0;
  float fx = x > 0.008856452 ? pow(x, 1.0/3.0) : (903.2963 * x + 16.0) / 116.0;
  float fz = z > 0.008856452 ? pow(z, 1.0/3.0) : (903.2963 * z + 16.0) / 116.0;

  float L = 2.55 * (116.0 * fy - 16.0) + 0.5;
  float a = 500.0 * (fx - fy) + 0.5;
  float bVal = 200.0 * (fy - fz) + 0.5;
  return vec3(L, a, bVal);
}

vec3 rgb2oklab(vec3 rgb) {
  float r = linearizeOklab(rgb.r / 255.0);
  float g = linearizeOklab(rgb.g / 255.0);
  float b = linearizeOklab(rgb.b / 255.0);

  float l_ = pow(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b, 1.0/3.0);
  float m_ = pow(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b, 1.0/3.0);
  float s_ = pow(0.0883024619 * r + 0.2024326453 * g + 0.6892648928 * b, 1.0/3.0);

  return vec3(
    0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
  );
}

vec3 rgb2oklch(vec3 rgb) {
  vec3 oklab = rgb2oklab(rgb);
  float C = sqrt(oklab.y * oklab.y + oklab.z * oklab.z);
  float h = atan(oklab.z, oklab.y);
  return vec3(oklab.x, C, h);
}

vec3 rgb2ycbcr(vec3 rgb) {
  float Y  =  0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  float Cb = -0.168736 * rgb.r - 0.331264 * rgb.g + 0.5 * rgb.b + 128.0;
  float Cr =  0.5 * rgb.r - 0.418688 * rgb.g - 0.081312 * rgb.b + 128.0;
  return vec3(Y, Cb, Cr);
}

vec3 rgb2hsl(vec3 rgb) {
  float r = rgb.r / 255.0;
  float g = rgb.g / 255.0;
  float b = rgb.b / 255.0;

  float mx = max(max(r, g), b);
  float mn = min(min(r, g), b);
  float L = (mx + mn) / 2.0;
  float d = mx - mn;

  if (d == 0.0) return vec3(0.0, 0.0, L);

  float S = L > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);

  float H;
  if (mx == r) {
    H = ((g - b) / d + (g < b ? 6.0 : 0.0)) / 6.0;
  } else if (mx == g) {
    H = ((b - r) / d + 2.0) / 6.0;
  } else {
    H = ((r - g) / d + 4.0) / 6.0;
  }

  return vec3(H * 6.28318530718, S, L); // H in radians
}

vec3 convertColor(vec3 rgb, int space) {
  if (space == 0) return rgb;
  if (space == 1) return rgb2lab(rgb);
  if (space == 2) return rgb2oklab(rgb);
  if (space == 3) return rgb2oklch(rgb);
  if (space == 4) return rgb2ycbcr(rgb);
  return rgb2hsl(rgb);
}

// ── Distance functions ──

float colorDist(vec3 a, vec3 b, int space) {
  if (space <= 2 || space == 4) {
    // Euclidean for rgb, lab, oklab, ycbcr
    vec3 d = a - b;
    return dot(d, d);
  }
  if (space == 3) {
    // Oklch: cylindrical ΔH
    float dL = a.x - b.x;
    float dC = a.y - b.y;
    float dh = a.z - b.z;
    float dH = 2.0 * sqrt(max(a.y * b.y, 0.0)) * sin(dh / 2.0);
    return dL*dL + dC*dC + dH*dH;
  }
  // HSL: circular hue
  float dH = abs(a.x - b.x);
  if (dH > 3.14159265359) dH = 6.28318530718 - dH;
  float avgS = (a.y + b.y) / 2.0;
  float dS = a.y - b.y;
  float dL = a.z - b.z;
  float hTerm = dH * avgS;
  return hTerm*hTerm + dS*dS + dL*dL;
}

// ── Blue noise threshold (Jiménez IGN) ──

float blueNoiseThreshold(int x, int y) {
  float v = 52.9829189 * mod(0.06711056 * float(x) + 0.00583715 * float(y), 1.0);
  return v - floor(v);
}

// ── Main ──

void main() {
  ivec2 coord = ivec2(gl_FragCoord.xy);
  // Flip Y since WebGL renders bottom-up
  coord.y = u_height - 1 - coord.y;

  if (coord.x >= u_width || coord.y >= u_height) {
    fragColor = vec4(0.0);
    return;
  }

  // Read source pixel (texture is normalized 0-1)
  vec4 pixel = texelFetch(u_source, coord, 0);
  vec3 rgb = pixel.rgb * 255.0;

  if (u_ditherMode == 1) {
    // ── Blue Noise: bias + single nearest ──
    float bn = blueNoiseThreshold(coord.x, coord.y);
    rgb += vec3((bn - 0.5) * u_ditherStrength);
    rgb = clamp(rgb, vec3(0.0), vec3(255.0));

    vec3 converted = convertColor(rgb, u_colorSpace);

    float bestDist = 1e20;
    int bestIdx = 0;
    for (int i = 0; i < u_paletteSize; i++) {
      vec3 pConverted = texelFetch(u_paletteConverted, ivec2(i, 0), 0).rgb;
      float d = colorDist(converted, pConverted, u_colorSpace);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    vec3 result = texelFetch(u_paletteRGB, ivec2(bestIdx, 0), 0).rgb;
    fragColor = vec4(result / 255.0, 1.0);
    return;
  }

  // ── Ordered dithering: two-closest + threshold ──
  vec3 converted = convertColor(rgb, u_colorSpace);

  // Find two closest palette colors
  float d1 = 1e20, d2 = 1e20;
  int idx1 = 0, idx2 = 0;
  for (int i = 0; i < u_paletteSize; i++) {
    vec3 pConverted = texelFetch(u_paletteConverted, ivec2(i, 0), 0).rgb;
    float d = colorDist(converted, pConverted, u_colorSpace);
    if (d < d1) {
      d2 = d1; idx2 = idx1;
      d1 = d;  idx1 = i;
    } else if (d < d2) {
      d2 = d;  idx2 = i;
    }
  }

  // Get threshold value from matrix
  int mx = coord.x % u_matrixSize;
  int my = coord.y % u_matrixSize;
  float threshold = texelFetch(u_threshold, ivec2(mx, my), 0).r;
  float maxValPlusOne = float(u_matrixSize * u_matrixSize + 1);

  // Choose between two closest (matches orderedChooseClosest in JS)
  int chosenIdx;
  if (d1 * maxValPlusOne > d2 * threshold) {
    chosenIdx = idx2;
  } else {
    chosenIdx = idx1;
  }

  vec3 result = texelFetch(u_paletteRGB, ivec2(chosenIdx, 0), 0).rgb;
  fragColor = vec4(result / 255.0, 1.0);
}
`;
