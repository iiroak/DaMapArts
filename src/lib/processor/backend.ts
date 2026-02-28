/**
 * Processing backend — orchestrates GPU (WebGL 2) and CPU (Worker / main thread).
 *
 * Processing modes:
 * - 'auto'   : GPU for ordered/blue-noise dithering, Worker for the rest
 * - 'gpu'    : Force GPU (falls back to worker if method is incompatible)
 * - 'worker' : Force Web Worker (off-thread CPU)
 * - 'main'   : Force main thread (legacy, blocks UI)
 *
 * The GPU path outputs RGBA only. A fast CPU post-pass maps RGBA → palette entries
 * and material counts to produce the full EngineOutput.
 */
import type { PaletteColor, ToneKey, RGB } from '$lib/types/colours.js';
import type { ProcessorSettings } from './types.js';
import type { EngineOutput, EngineInput } from './engine.js';
import { applyBilateralFilter } from './bilateralFilter.js';
import { processPixels } from './engine.js';

export type ProcessingMode = 'auto' | 'gpu' | 'worker' | 'main';

// ── Lazy imports for GPU (avoid loading WebGL code on server) ──
let _gpuModule: typeof import('./gpu/WebGLProcessor.js') | null = null;

async function getGPUModule() {
  if (!_gpuModule) {
    _gpuModule = await import('./gpu/WebGLProcessor.js');
  }
  return _gpuModule;
}

// ── Worker Pool ──
// Creates N workers (one per CPU core minus 1, max 16) to parallelize
// processing — especially useful for CompareModal batch comparisons.

let _pool: Worker[] | null = null;
let _poolIdle: Worker[] = [];
let _poolWaiters: ((w: Worker) => void)[] = [];
let _workerSupported: boolean | null = null;
let _requestId = 0;   // Stale-detection counter (MapPreview only)
let _messageId = 0;    // Per-message unique ID for worker request/response matching

function isWorkerSupported(): boolean {
  if (_workerSupported !== null) return _workerSupported;
  _workerSupported = typeof Worker !== 'undefined';
  return _workerSupported;
}

/** Number of workers in the pool (cores − 1, min 1). */
export function getPoolSize(): number {
  if (typeof navigator === 'undefined') return 1;
  return Math.max(1, (navigator.hardwareConcurrency || 4) - 1);
}

function initPool(): void {
  if (_pool) return;
  const size = getPoolSize();
  _pool = [];
  for (let i = 0; i < size; i++) {
    const w = new Worker(
      new URL('./processor.worker.ts', import.meta.url),
      { type: 'module' },
    );
    _pool.push(w);
    _poolIdle.push(w);
  }
}

function acquireWorker(): Promise<Worker> {
  initPool();
  if (_poolIdle.length > 0) {
    return Promise.resolve(_poolIdle.pop()!);
  }
  return new Promise((resolve) => {
    _poolWaiters.push(resolve);
  });
}

function releaseWorker(w: Worker): void {
  if (_poolWaiters.length > 0) {
    const next = _poolWaiters.shift()!;
    next(w);
  } else {
    _poolIdle.push(w);
  }
}

/** Kill all workers (e.g., on page unload). */
export function terminateWorker(): void {
  if (_pool) {
    for (const w of _pool) {
      w.terminate();
    }
    _pool = null;
    _poolIdle = [];
    _poolWaiters = [];
  }
}

// ── Capability detection ──

export interface CapabilityInfo {
  gpu: boolean;
  worker: boolean;
  recommended: ProcessingMode;
}

let _capabilities: CapabilityInfo | null = null;

export async function detectCapabilities(): Promise<CapabilityInfo> {
  if (_capabilities) return _capabilities;

  const workerOk = isWorkerSupported();

  let gpuOk = false;
  try {
    const gpu = await getGPUModule();
    gpuOk = gpu.isWebGL2Supported();
  } catch {
    gpuOk = false;
  }

  const recommended: ProcessingMode = gpuOk && workerOk ? 'auto' : workerOk ? 'worker' : 'main';
  _capabilities = { gpu: gpuOk, worker: workerOk, recommended };
  return _capabilities;
}

// ── Public API ──

export interface ProcessAsyncOptions {
  mode: ProcessingMode;
  onProgress?: (percent: number) => void;
  /** Skip the global stale-request check. Use for batch/compare calls that
   *  should never be discarded by concurrent MapPreview processing. */
  skipStaleCheck?: boolean;
}

/**
 * Process image asynchronously.
 * Returns null if the request was superseded by a newer call
 * (unless skipStaleCheck is true).
 */
export async function processAsync(
  input: EngineInput,
  options: ProcessAsyncOptions,
): Promise<EngineOutput | null> {
  const myId = options.skipStaleCheck ? _requestId : ++_requestId;

  const { mode, onProgress } = options;
  const methodId = input.settings.ditherMethod;

  // ── Decide path ──
  let useGPU = false;
  if (mode === 'gpu' || mode === 'auto') {
    // Edge-masked dithering requires per-pixel logic the GPU shader can't do
    if (input.settings.edgeMaskEnabled) {
      useGPU = false;
    } else {
      try {
        const gpu = await getGPUModule();
        if (gpu.isWebGL2Supported() && gpu.canGPUProcess(methodId)) {
          useGPU = true;
        }
      } catch {
        useGPU = false;
      }
    }
  }

  let result: EngineOutput;

  if (useGPU) {
    result = await processOnGPU(input, onProgress);
  } else if (mode !== 'main' && isWorkerSupported()) {
    result = await processInWorker(input, onProgress);
  } else {
    // Main thread (blocking)
    result = processPixels({ ...input, onProgress });
  }

  // Check if this request is still current
  if (!options.skipStaleCheck && myId !== _requestId) return null;

  return result;
}

// ── GPU path ──

async function processOnGPU(
  input: EngineInput,
  onProgress?: (p: number) => void,
): Promise<EngineOutput> {
  const gpu = await getGPUModule();

  onProgress?.(0.1);

  // Pre-processing: apply bilateral filter before GPU quantization
  let gpuRGBA = input.rgbaData;
  if (input.settings.bilateralEnabled) {
    const { width, height } = input;
    const totalPixels = width * height;
    // Convert RGBA to float RGB for bilateral filter
    const rgbFloat = new Float32Array(totalPixels * 3);
    for (let i = 0; i < totalPixels; i++) {
      rgbFloat[i * 3] = input.rgbaData[i * 4];
      rgbFloat[i * 3 + 1] = input.rgbaData[i * 4 + 1];
      rgbFloat[i * 3 + 2] = input.rgbaData[i * 4 + 2];
    }
    applyBilateralFilter(
      rgbFloat, width, height,
      input.settings.bilateralSigmaSpace,
      input.settings.bilateralSigmaColor,
      input.settings.bilateralRadius,
    );
    // Write filtered values back to RGBA copy
    gpuRGBA = new Uint8ClampedArray(input.rgbaData);
    for (let i = 0; i < totalPixels; i++) {
      gpuRGBA[i * 4] = Math.round(rgbFloat[i * 3]);
      gpuRGBA[i * 4 + 1] = Math.round(rgbFloat[i * 3 + 1]);
      gpuRGBA[i * 4 + 2] = Math.round(rgbFloat[i * 3 + 2]);
    }
  }

  // GPU produces RGBA output only
  const gpuResult = gpu.gpuProcess(
    gpuRGBA,
    input.width,
    input.height,
    input.palette,
    input.settings.colorSpace,
    input.settings.ditherMethod,
  );

  onProgress?.(0.7);

  // Post-pass: map RGBA → palette entries + material counts
  const { rgbaData, width, height } = gpuResult;
  const totalPixels = width * height;

  // Build RGB → palette lookup from known palette entries
  const paletteLookup = new Map<number, PaletteColor>();
  for (const p of input.palette) {
    const key = (p.rgb[0] << 16) | (p.rgb[1] << 8) | p.rgb[2];
    paletteLookup.set(key, p);
  }

  const pixelEntries: { colourSetId: string; toneKey: ToneKey }[] = new Array(totalPixels);
  const usedColors = new Set<string>();
  const mapSizeX = input.settings.mapSizeX;
  const mapSizeZ = input.settings.mapSizeZ;

  // Initialize maps
  const maps: { materials: Record<string, number>; supportBlockCount: number }[][] = [];
  for (let z = 0; z < mapSizeZ; z++) {
    const row: { materials: Record<string, number>; supportBlockCount: number }[] = [];
    for (let x = 0; x < mapSizeX; x++) {
      row.push({ materials: {}, supportBlockCount: 0 });
    }
    maps.push(row);
  }

  for (let i = 0; i < totalPixels; i++) {
    const r = rgbaData[i * 4];
    const g = rgbaData[i * 4 + 1];
    const b = rgbaData[i * 4 + 2];
    const key = (r << 16) | (g << 8) | b;

    const p = paletteLookup.get(key);
    if (p) {
      pixelEntries[i] = { colourSetId: p.colourSetId, toneKey: p.toneKey };
      usedColors.add(`${p.colourSetId}:${p.toneKey}`);

      const px = i % width;
      const py = Math.floor(i / width);
      const mx = Math.floor(px / 128);
      const mz = Math.floor(py / 128);
      if (mz < mapSizeZ && mx < mapSizeX) {
        maps[mz][mx].materials[p.colourSetId] =
          (maps[mz][mx].materials[p.colourSetId] || 0) + 1;
      }
    } else {
      pixelEntries[i] = { colourSetId: '-1', toneKey: 'normal' };
    }
  }

  onProgress?.(1);

  return {
    rgbaData,
    pixelEntries,
    maps,
    totalPixels,
    uniqueColors: usedColors.size,
  };
}

// ── Worker path ──

function processInWorker(
  input: EngineInput,
  onProgress?: (p: number) => void,
): Promise<EngineOutput> {
  return new Promise(async (resolve, reject) => {
    const id = ++_messageId;
    let w: Worker;

    try {
      w = await acquireWorker();
    } catch (err) {
      reject(err);
      return;
    }

    const handler = (e: MessageEvent) => {
      if (e.data.id !== id) return;

      if (e.data.type === 'progress') {
        onProgress?.(e.data.progress);
        return;
      }

      if (e.data.type === 'result') {
        w.removeEventListener('message', handler);
        w.removeEventListener('error', errorHandler);
        releaseWorker(w);
        resolve(e.data.output);
      }
    };

    const errorHandler = (e: ErrorEvent) => {
      w.removeEventListener('message', handler);
      w.removeEventListener('error', errorHandler);
      releaseWorker(w);
      reject(new Error(`Worker error: ${e.message}`));
    };

    w.addEventListener('message', handler);
    w.addEventListener('error', errorHandler);

    // Clone rgbaData because transferring detaches the original
    const rgbaCopy = new Uint8ClampedArray(input.rgbaData);

    // Strip Svelte 5 $state Proxy wrappers — postMessage requires plain objects.
    // JSON round-trip converts Proxy → plain object (TypedArrays stay separate).
    w.postMessage(
      {
        id,
        rgbaData: rgbaCopy,
        width: input.width,
        height: input.height,
        palette: JSON.parse(JSON.stringify(input.palette)),
        settings: JSON.parse(JSON.stringify(input.settings)),
        selectedBlocks: JSON.parse(JSON.stringify(input.selectedBlocks)),
      },
      [rgbaCopy.buffer], // Transfer for zero-copy
    );
  });
}
