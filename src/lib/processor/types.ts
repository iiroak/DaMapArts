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
