/**
 * Processor types — shared between main thread and worker.
 */
import type { PaletteColor, ToneKey, RGB } from '$lib/types/colours.js';
import type { ColorSpace } from '$lib/types/settings.js';

/** Settings for the image processor */
export interface ProcessorSettings {
  mapSizeX: number;
  mapSizeZ: number;
  cropMode: 'off' | 'center' | 'manual';
  cropZoom: number;
  cropOffsetX: number;
  cropOffsetY: number;
  ditherMethod: string;
  ditherPropagationRed: number;
  ditherPropagationGreen: number;
  ditherPropagationBlue: number;
  colorSpace: ColorSpace;
  brightness: number;
  contrast: number;
  saturation: number;
  modeId: number;
  staircasingId: number;
  transparencyEnabled: boolean;
  transparencyTolerance: number;
  /** Background fill for transparent pixels: 0 = clear (no block), 1 = fill (dithered), 2 = fill (smooth) */
  backgroundMode: number;
  /** Hex colour string for fill mode, e.g. '#151515' */
  backgroundColour: string;
  whereSupportBlocks: number;
  /** Pre-processing: bilateral filter for smoothing flat areas */
  bilateralEnabled: boolean;
  bilateralSigmaSpace: number;
  bilateralSigmaColor: number;
  bilateralRadius: number;
  /** Pre-processing: edge-masked dithering (solid on edges, dither on flat) */
  edgeMaskEnabled: boolean;
  edgeMaskThreshold: number;
  /** Weight multiplier for luminance channel in Lab/Oklab/Oklch/YCbCr distance (1.0 = neutral) */
  luminanceWeight: number;
  /** Mapmaker-style memo dithering: max staircase height states */
  memoMaxHeight: number;
  /** Max recursive depth before subdivision */
  memoMaxDepth: number;
  /** Max memo cache entries before subdivision */
  memoMaxCache: number;
  /** Quantize bits for diffusion memo state (8 disables quantized color key) */
  memoQuantize: number;
  /** Compare colors in LAB instead of RGB */
  memoUseLab: boolean;
  /** Clamp candidate colors to palette gamut instead of full RGB */
  memoClampToPalette: boolean;
  /** Reference staircase mode (zero error for unrestricted pick) */
  memoUseReference: boolean;
  /** Deterministic split seed */
  memoUseSeed: boolean;
  /** Diffusion factor multiplier */
  memoDiffusionFactor: number;
  /** Pattern chooser strategy: 0 closest-two, 1 old, 2 reflect */
  memoChooser: number;
  /** Pattern discriminator strategy: 0 old, 1 vector */
  memoDiscriminator: number;
  /** Ordered matrix id for memo pattern mode */
  memoPatternId: string;
}

/** Per-pixel quantization result */
export interface PixelEntry {
  colourSetId: string;
  toneKey: ToneKey;
}

/** Per 128×128 map section */
export interface MapSection {
  materials: Record<string, number>;
  supportBlockCount: number;
}

/** Full processor result */
export interface ProcessorResult {
  /** Quantized pixel data (RGBA) for display */
  imageData: ImageData;
  /** Per-pixel palette entries for NBT/mapdat encoding */
  pixelEntries: PixelEntry[];
  /** Per-map material counts */
  maps: MapSection[][];
  /** Total pixel count */
  totalPixels: number;
  /** Unique palette colors used */
  uniqueColors: number;
}

/** Message to worker */
export interface ProcessorWorkerInput {
  type: 'process';
  rgbaBuffer: ArrayBuffer;
  width: number;
  height: number;
  palette: PaletteColor[];
  settings: ProcessorSettings;
  selectedBlocks: Record<string, string>;
}

/** Progress message from worker */
export interface ProcessorWorkerProgress {
  type: 'progress';
  percent: number;
}

/** Result message from worker */
export interface ProcessorWorkerResult {
  type: 'result';
  rgbaBuffer: ArrayBuffer;
  pixelEntries: PixelEntry[];
  maps: MapSection[][];
  totalPixels: number;
  uniqueColors: number;
}

export type ProcessorWorkerMessage = ProcessorWorkerProgress | ProcessorWorkerResult;
