/**
 * WebGL 2 GPU-accelerated processor for ordered / blue-noise dithering.
 *
 * Encodes the palette + threshold matrix as textures and performs the
 * entire quantization pipeline in a single fragment shader pass.
 *
 * For error diffusion / curve methods, falls back to the CPU worker.
 */
import type { PaletteColor, RGB } from '$lib/types/colours.js';
import type { ColorSpace } from '$lib/types/settings.js';
import { getOrderedMatrix } from '$lib/dither/ordered.js';
import { rgb2lab, rgb2oklab, rgb2oklch, rgb2ycbcr, rgb2hsl } from '$lib/palette/colorSpace.js';
import { VERTEX_SHADER, FRAGMENT_SHADER } from './shaders.js';

const COLOR_SPACE_INDEX: Record<ColorSpace, number> = {
  'mapartcraft-default': 1,
  euclidian: 0,
  'cie76-lab65': 1,
  'cie76-lab50': 1,
  'ciede2000-lab65': 1,
  'ciede2000-lab50': 1,
  hct: 1,
  rgb: 0,
  lab: 1,
  oklab: 2,
  oklch: 3,
  ycbcr: 4,
  hsl: 5,
};

const GPU_COLOR_SPACES = new Set<ColorSpace>(['rgb', 'lab', 'oklab', 'oklch', 'ycbcr', 'hsl']);

/** Methods that can run on GPU (ordered + blue noise) */
const GPU_METHODS = new Set([
  'bayer-2x2',
  'bayer-4x4',
  'bayer-8x8',
  'ordered-3x3',
  'cluster-dot',
  'knoll',
  'blue-noise',
]);

export function canGPUProcess(ditherMethod: string): boolean {
  return GPU_METHODS.has(ditherMethod);
}

export function canGPUColorSpace(colorSpace: ColorSpace): boolean {
  return GPU_COLOR_SPACES.has(colorSpace);
}

let _gl: WebGL2RenderingContext | null = null;
let _canvas: OffscreenCanvas | null = null;
let _program: WebGLProgram | null = null;
let _vao: WebGLVertexArrayObject | null = null;
let _fb: WebGLFramebuffer | null = null;
let _supported: boolean | null = null;

/** Test if WebGL 2 is available */
export function isWebGL2Supported(): boolean {
  if (_supported !== null) return _supported;
  try {
    const c = new OffscreenCanvas(1, 1);
    const gl = c.getContext('webgl2');
    _supported = gl !== null;
    gl?.getExtension('EXT_color_buffer_float');
    return _supported;
  } catch {
    _supported = false;
    return false;
  }
}

function initGL(width: number, height: number): WebGL2RenderingContext {
  if (_gl && _canvas) {
    _canvas.width = width;
    _canvas.height = height;
    _gl.viewport(0, 0, width, height);
    return _gl;
  }

  _canvas = new OffscreenCanvas(width, height);
  const gl = _canvas.getContext('webgl2', {
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: true,
  }) as WebGL2RenderingContext | null;

  if (!gl) throw new Error('WebGL 2 is not available');

  // Enable float textures for palette data
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');

  // Compile shaders
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

  _program = gl.createProgram()!;
  gl.attachShader(_program, vs);
  gl.attachShader(_program, fs);
  gl.linkProgram(_program);

  if (!gl.getProgramParameter(_program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(_program);
    throw new Error(`Program link failed: ${info}`);
  }

  gl.useProgram(_program);

  // Full-screen quad VAO
  _vao = gl.createVertexArray()!;
  gl.bindVertexArray(_vao);
  const buf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const posLoc = gl.getAttribLocation(_program, 'a_position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  // Framebuffer for render-to-texture
  _fb = gl.createFramebuffer()!;

  gl.viewport(0, 0, width, height);
  _gl = gl;
  return gl;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

function createRGBATexture(
  gl: WebGL2RenderingContext,
  unit: number,
  width: number,
  height: number,
  data: Uint8Array | Float32Array,
  isFloat: boolean,
): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  if (isFloat) {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data as Float32Array);
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data as Uint8Array);
  }
  return tex;
}

function convertPaletteColor(color: PaletteColor, colorSpace: ColorSpace): [number, number, number] {
  switch (colorSpace) {
    case 'rgb':
      return [...color.rgb];
    case 'lab':
      return [...color.lab];
    case 'oklab':
      return [...color.oklab];
    case 'oklch':
      return [...color.oklch];
    case 'ycbcr':
      return [...color.ycbcr];
    case 'hsl':
      return [...color.hsl];
    default:
      return [...color.rgb];
  }
}

export interface GPUProcessResult {
  rgbaData: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Process an image on GPU using WebGL 2.
 * Only works for ordered and blue-noise dithering methods.
 */
export function gpuProcess(
  sourceRGBA: Uint8ClampedArray,
  width: number,
  height: number,
  palette: PaletteColor[],
  colorSpace: ColorSpace,
  ditherMethod: string,
): GPUProcessResult {
  const gl = initGL(width, height);
  const prog = _program!;

  // ── 1. Upload source image as texture (unit 0) ──
  const srcTex = createRGBATexture(gl, 0, width, height, new Uint8Array(sourceRGBA.buffer, sourceRGBA.byteOffset, sourceRGBA.byteLength), false);
  gl.uniform1i(gl.getUniformLocation(prog, 'u_source'), 0);

  // ── 2. Upload palette RGB values as float texture (unit 1) ──
  const paletteRGBData = new Float32Array(palette.length * 4);
  for (let i = 0; i < palette.length; i++) {
    paletteRGBData[i * 4] = palette[i].rgb[0];
    paletteRGBData[i * 4 + 1] = palette[i].rgb[1];
    paletteRGBData[i * 4 + 2] = palette[i].rgb[2];
    paletteRGBData[i * 4 + 3] = 1;
  }
  const palRGBTex = createRGBATexture(gl, 1, palette.length, 1, paletteRGBData, true);
  gl.uniform1i(gl.getUniformLocation(prog, 'u_paletteRGB'), 1);

  // ── 3. Upload pre-converted palette values as float texture (unit 2) ──
  const paletteConvData = new Float32Array(palette.length * 4);
  for (let i = 0; i < palette.length; i++) {
    const [a, b, c] = convertPaletteColor(palette[i], colorSpace);
    paletteConvData[i * 4] = a;
    paletteConvData[i * 4 + 1] = b;
    paletteConvData[i * 4 + 2] = c;
    paletteConvData[i * 4 + 3] = 1;
  }
  const palConvTex = createRGBATexture(gl, 2, palette.length, 1, paletteConvData, true);
  gl.uniform1i(gl.getUniformLocation(prog, 'u_paletteConverted'), 2);

  // ── 4. Upload threshold matrix (unit 3) ──
  let matrixSize = 4;
  let ditherMode = 0; // 0 = ordered (two-closest), 1 = blue-noise
  let threshTex: WebGLTexture;

  if (ditherMethod === 'blue-noise') {
    // Blue noise: no matrix needed, set dummy 1x1
    ditherMode = 1;
    matrixSize = 1;
    const threshData = new Float32Array([1, 0, 0, 1]);
    threshTex = createRGBATexture(gl, 3, 1, 1, threshData, true);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_threshold'), 3);
  } else {
    const matrix = getOrderedMatrix(ditherMethod);
    matrixSize = matrix.length;
    const threshData = new Float32Array(matrixSize * matrixSize * 4);
    for (let y = 0; y < matrixSize; y++) {
      for (let x = 0; x < matrixSize; x++) {
        const idx = (y * matrixSize + x) * 4;
        threshData[idx] = matrix[y][x]; // R = threshold value (1-indexed)
        threshData[idx + 3] = 1;
      }
    }
    threshTex = createRGBATexture(gl, 3, matrixSize, matrixSize, threshData, true);
    gl.uniform1i(gl.getUniformLocation(prog, 'u_threshold'), 3);
  }

  // ── 5. Set uniforms ──
  gl.uniform1i(gl.getUniformLocation(prog, 'u_paletteSize'), palette.length);
  gl.uniform1i(gl.getUniformLocation(prog, 'u_colorSpace'), COLOR_SPACE_INDEX[colorSpace]);
  gl.uniform1i(gl.getUniformLocation(prog, 'u_matrixSize'), matrixSize);
  gl.uniform1i(gl.getUniformLocation(prog, 'u_width'), width);
  gl.uniform1i(gl.getUniformLocation(prog, 'u_height'), height);
  gl.uniform1i(gl.getUniformLocation(prog, 'u_ditherMode'), ditherMode);
  gl.uniform1f(gl.getUniformLocation(prog, 'u_ditherStrength'), 48.0);

  // ── 6. Render to framebuffer ──
  const outputTex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0 + 4);
  gl.bindTexture(gl.TEXTURE_2D, outputTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  gl.bindFramebuffer(gl.FRAMEBUFFER, _fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outputTex, 0);

  gl.bindVertexArray(_vao);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // ── 7. Read back result ──
  const output = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, output);

  // Flip Y: readPixels returns rows bottom-to-top, but ImageData needs top-to-bottom
  const rowBytes = width * 4;
  const tmp = new Uint8Array(rowBytes);
  for (let top = 0, bot = height - 1; top < bot; top++, bot--) {
    const tOff = top * rowBytes;
    const bOff = bot * rowBytes;
    tmp.set(output.subarray(tOff, tOff + rowBytes));
    output.copyWithin(tOff, bOff, bOff + rowBytes);
    output.set(tmp, bOff);
  }

  // ── 8. Cleanup textures (keep GL context for reuse) ──
  gl.deleteTexture(srcTex);
  gl.deleteTexture(palRGBTex);
  gl.deleteTexture(palConvTex);
  gl.deleteTexture(threshTex);
  gl.deleteTexture(outputTex);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return {
    rgbaData: new Uint8ClampedArray(output.buffer),
    width,
    height,
  };
}
