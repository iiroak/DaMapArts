/**
 * Central application state — Svelte 5 runes-based store.
 *
 * All UI components read from and write to this shared state.
 * Mirrors the original mapartcraft's global React state but uses
 * Svelte's fine-grained reactivity through $state/$derived.
 */
import type { ColoursJSON, PaletteColor, ToneKey } from '$lib/types/colours.js';
import type { ColorSpace } from '$lib/types/settings.js';
import type { ProcessorSettings, MapSection, PixelEntry } from '$lib/processor/types.js';
import type { ProcessingMode } from '$lib/processor/backend.js';

// ── JSON data imports ──
import coloursJSON from '$lib/data/coloursJSON.json';
import supportedVersions from '$lib/data/supportedVersions.json';
import mapModes from '$lib/data/mapModes.json';
import ditherMethods from '$lib/data/ditherMethods.json';
import cropModes from '$lib/data/cropModes.json';
import backgroundColourModes from '$lib/data/backgroundColourModes.json';
import defaultPresets from '$lib/data/defaultPresets.json';
import whereSupportBlocksModes from '$lib/data/whereSupportBlocksModes.json';

// ── Palette builder ──
import {
  buildActivePalette,
  initSelectedBlocks,
  initSelectedBlocksWithCarpets,
  filterBlocksByVersion,
  applyPreset,
} from '$lib/palette/colours.js';

// ── Types ──
export interface AppState {
  // Data
  coloursJSON: ColoursJSON;
  supportedVersions: typeof supportedVersions;
  mapModes: typeof mapModes;
  ditherMethods: typeof ditherMethods;

  // Version
  selectedVersion: string;

  // Blocks
  selectedBlocks: Record<string, string>;

  // Map settings
  mapSizeX: number;
  mapSizeZ: number;
  modeId: number;
  staircasingId: number;

  // Dithering
  ditherMethodId: string;
  colorSpace: ColorSpace;

  // Crop
  cropMode: 'off' | 'center' | 'manual';
  cropZoom: number;
  cropOffsetX: number;
  cropOffsetY: number;

  // Pre-processing
  brightness: number;
  contrast: number;
  saturation: number;

  // Map.dat options
  transparencyEnabled: boolean;
  transparencyTolerance: number;

  // Support blocks
  whereSupportBlocks: number;
  supportBlock: string;

  // Background
  backgroundMode: number;
  backgroundColour: string;

  // Image
  sourceImage: HTMLImageElement | null;
  sourceFileName: string;

  // Processing state
  isProcessing: boolean;
  processingProgress: number;

  // Results
  resultImageData: ImageData | null;
  resultPixelEntries: PixelEntry[] | null;
  resultMaps: MapSection[][] | null;
  resultTotalPixels: number;
  resultUniqueColors: number;

  // UI state
  showGrid: boolean;
  splitView: boolean;
  zoomLevel: number;
  currentPreset: string;

  // Processing mode
  processingMode: ProcessingMode;

  // ── Pre-processing Filters ──
  /** Enable bilateral filter before dithering (smooths flat areas, preserves edges) */
  bilateralEnabled: boolean;
  /** Bilateral spatial sigma (larger = wider blur) */
  bilateralSigmaSpace: number;
  /** Bilateral range sigma (larger = less edge-preserving) */
  bilateralSigmaColor: number;
  /** Bilateral kernel radius in pixels */
  bilateralRadius: number;
  /** Enable edge-masked dithering (solid colors on edges, dithering on flat areas) */
  edgeMaskEnabled: boolean;
  /** Sobel edge detection threshold (0-255, lower = more edges detected) */
  edgeMaskThreshold: number;
  /** Weight multiplier for luminance in color distance (1.0 = neutral, 1.5-2.0 = prioritize brightness) */
  luminanceWeight: number;
}

// Find default version (latest)
const versionKeys = Object.keys(supportedVersions);
const defaultVersionKey = versionKeys[versionKeys.length - 1];
const defaultVersion = (supportedVersions as any)[defaultVersionKey];

// Find default mode and staircasing (default to Classic staircase)
const modeKeys = Object.keys(mapModes);
const defaultMode = (mapModes as any)[modeKeys[0]];
const defaultStair = defaultMode.staircaseModes['CLASSIC'] ?? defaultMode.staircaseModes[Object.keys(defaultMode.staircaseModes)[0]];

// Find default dither
const defaultDither = ditherMethods.FloydSteinberg;

/**
 * Create the application state with Svelte 5 $state.
 */
export function createAppState(): AppState {
  const typedColoursJSON = coloursJSON as unknown as ColoursJSON;

  let appState: AppState = $state({
    // Data
    coloursJSON: typedColoursJSON,
    supportedVersions,
    mapModes,
    ditherMethods,

    // Version
    selectedVersion: defaultVersion.MCVersion,

    // Blocks — start with Carpets preset
    selectedBlocks: initSelectedBlocksWithCarpets(typedColoursJSON),

    // Map settings
    mapSizeX: 1,
    mapSizeZ: 1,
    modeId: defaultMode.uniqueId,
    staircasingId: defaultStair.uniqueId,

    // Dithering
    ditherMethodId: 'floyd-steinberg',
    colorSpace: 'lab' as ColorSpace,

    // Crop
    cropMode: 'center',
    cropZoom: 1.0,
    cropOffsetX: 50,
    cropOffsetY: 50,

    // Pre-processing
    brightness: 100,
    contrast: 100,
    saturation: 100,

    // Map.dat options
    transparencyEnabled: false,
    transparencyTolerance: 128,

    // Support blocks
    whereSupportBlocks: 0,
    supportBlock: 'netherrack',

    // Background
    backgroundMode: 0,
    backgroundColour: '#151515',

    // Image
    sourceImage: null,
    sourceFileName: '',

    // Processing state
    isProcessing: false,
    processingProgress: 0,

    // Results
    resultImageData: null,
    resultPixelEntries: null,
    resultMaps: null,
    resultTotalPixels: 0,
    resultUniqueColors: 0,

    // UI state
    showGrid: false,
    splitView: false,
    zoomLevel: 1,
    currentPreset: '',

    // Processing mode
    processingMode: 'auto' as ProcessingMode,

    // Pre-processing Filters
    bilateralEnabled: false,
    bilateralSigmaSpace: 3,
    bilateralSigmaColor: 25,
    bilateralRadius: 3,
    edgeMaskEnabled: false,
    edgeMaskThreshold: 40,
    luminanceWeight: 1.0,
  });

  return appState;
}
