/**
 * TypeScript definitions for all editor settings.
 */
import type { ToneKey } from './colours.js';

/** Supported Minecraft version entry */
export interface SupportedVersion {
  MCVersion: string;
  NBTVersion: number;
}

/** Map of version keys to SupportedVersion */
export type SupportedVersions = Record<string, SupportedVersion>;

/** Output mode */
export type MapMode = 'nbt' | 'mapdat';

/** Crop mode */
export type CropMode = 'off' | 'center' | 'manual';

/** Color space for perceptual matching */
export type ColorSpace =
  | 'mapartcraft-default'
  | 'euclidian'
  | 'cie76-lab65'
  | 'cie76-lab50'
  | 'ciede2000-lab65'
  | 'ciede2000-lab50'
  | 'hct'
  | 'rgb'
  | 'lab'
  | 'oklab'
  | 'oklch'
  | 'ycbcr'
  | 'hsl';

/** Staircasing mode (flat 2D or various 3D modes) */
export interface StaircaseMode {
  uniqueId: number;
  localeKey: string;
  toneKeys: ToneKey[];
  extra: boolean;
}

/** Where to place support blocks in NBT mode */
export interface WhereSupportBlocksMode {
  uniqueId: number;
  localeKey: string;
}

/** Background colour pre-processing mode */
export interface BackgroundColourMode {
  uniqueId: number;
  localeKey: string;
}

/** Full settings for image processing */
export interface ProcessorSettings {
  // Map
  mapSizeX: number;
  mapSizeZ: number;
  mode: MapMode;
  version: SupportedVersion;

  // Crop
  cropMode: CropMode;
  cropZoom: number;
  cropOffsetX: number;
  cropOffsetY: number;

  // Dithering
  ditherMethod: string;
  ditherPropagationRed: number;
  ditherPropagationGreen: number;
  ditherPropagationBlue: number;
  colorSpace: ColorSpace;
  betterColour: boolean;

  // Staircasing
  staircasing: number; // uniqueId of StaircaseMode
  whereSupportBlocks: number;
  supportBlock: string;

  // Transparency
  transparency: boolean;
  transparencyTolerance: number;

  // Pre-processing
  preprocessingEnabled: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  backgroundColourMode: number;
  backgroundColour: string;

  // Grid
  showGridOverlay: boolean;

  // map.dat specific
  mapdatFilenameUseId: boolean;
  mapdatFilenameIdStart: number;
}

/** Per-section material data */
export interface MapSectionData {
  materials: Record<string, number>;
  supportBlockCount: number;
}

/** Result from image processing */
export interface ProcessorResult {
  /** RGBA ImageData for display canvas */
  imageData: ImageData;
  /** Per-pixel colour data for NBT/mapdat export */
  pixelsData: Uint32Array;
  /** Material counts per 128x128 section [row][col] */
  maps: MapSectionData[][];
  /** Selected blocks snapshot */
  currentSelectedBlocks: Record<string, string>;
  /** Processing time in ms */
  processingTimeMs: number;
  /** Total unique colours used */
  uniqueColors: number;
}
