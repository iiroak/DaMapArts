/**
 * Processing backend — orchestrates GPU (WebGL 2) and CPU (Worker / main thread).
 *
 * Processing modes:
 * - 'auto'   : GPU for ordered/blue-noise dithering, Worker for the rest
 * - 'gpu'    : Force GPU (falls back to worker if method is incompatible)
 * - 'worker' : Force Web Worker (off-thread CPU)
 * - 'main'   : Force main thread (legacy, blocks UI)
 */
import type { PaletteColor, ToneKey } from '$lib/types/colours.js';
import type { EngineOutput, EngineInput } from './engine.js';
import { applyBilateralFilter } from './bilateralFilter.js';
import { processPixels } from './engine.js';

export type ProcessingMode = 'auto' | 'gpu' | 'worker' | 'main';

let _gpuModule: typeof import('./gpu/WebGLProcessor.js') | null = null;
async function getGPUModule() {
  if (!_gpuModule) _gpuModule = await import('./gpu/WebGLProcessor.js');
  return _gpuModule;
}

let _pool: Worker[] | null = null;
let _poolIdle: Worker[] = [];
let _poolWaiters: ((w: Worker) => void)[] = [];
let _workerSupported: boolean | null = null;
let _requestId = 0;
let _messageId = 0;

function isWorkerSupported(): boolean {
  if (_workerSupported !== null) return _workerSupported;
  _workerSupported = typeof Worker !== 'undefined';
  return _workerSupported;
}

function spawnWorker(): Worker {
  return new Worker(new URL('./processor.worker.ts', import.meta.url), { type: 'module' });
}

export function getPoolSize(): number {
  if (typeof navigator === 'undefined') return 1;
  return Math.max(1, (navigator.hardwareConcurrency || 4) - 1);
}

function initPool(): void {
  if (_pool) return;
  const size = getPoolSize();
  _pool = [];
  for (let i = 0; i < size; i++) {
    const w = spawnWorker();
    _pool.push(w);
    _poolIdle.push(w);
  }
}

function acquireWorker(): Promise<Worker> {
  initPool();
  if (_poolIdle.length > 0) return Promise.resolve(_poolIdle.pop()!);
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

function replaceWorkerInPool(oldWorker: Worker): void {
  if (!_pool) return;

  const poolIndex = _pool.indexOf(oldWorker);
  if (poolIndex >= 0) _pool.splice(poolIndex, 1);

  const idleIndex = _poolIdle.indexOf(oldWorker);
  if (idleIndex >= 0) _poolIdle.splice(idleIndex, 1);

  try {
    oldWorker.terminate();
  } catch {
    // noop
  }

  const replacement = spawnWorker();
  _pool.push(replacement);
  if (_poolWaiters.length > 0) {
    const next = _poolWaiters.shift()!;
    next(replacement);
  } else {
    _poolIdle.push(replacement);
  }
}

export function terminateWorker(): void {
  if (_pool) {
    for (const w of _pool) w.terminate();
    _pool = null;
    _poolIdle = [];
    _poolWaiters = [];
  }
}

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

export interface ProcessAsyncOptions {
  mode: ProcessingMode;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
  skipStaleCheck?: boolean;
}

export async function processAsync(
  input: EngineInput,
  options: ProcessAsyncOptions,
): Promise<EngineOutput | null> {
  const myId = options.skipStaleCheck ? _requestId : ++_requestId;
  const { mode, onProgress, signal } = options;
  const methodId = input.settings.ditherMethod;

  let useGPU = false;
  if (mode === 'gpu' || mode === 'auto') {
    if (input.settings.edgeMaskEnabled) {
      useGPU = false;
    } else {
      try {
        const gpu = await getGPUModule();
        if (
          gpu.isWebGL2Supported()
          && gpu.canGPUProcess(methodId)
          && gpu.canGPUColorSpace(input.settings.colorSpace)
        ) {
          useGPU = true;
        }
      } catch {
        useGPU = false;
      }
    }
  }

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  let result: EngineOutput;
  if (useGPU) {
    result = await processOnGPU(input, onProgress);
  } else if (mode !== 'main' && isWorkerSupported()) {
    result = await processInWorker(input, onProgress, signal);
  } else {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    result = processPixels({ ...input, onProgress });
  }

  if (!options.skipStaleCheck && myId !== _requestId) return null;
  return result;
}

async function processOnGPU(
  input: EngineInput,
  onProgress?: (p: number) => void,
): Promise<EngineOutput> {
  const gpu = await getGPUModule();

  onProgress?.(0.1);

  let gpuRGBA = input.rgbaData;
  if (input.settings.bilateralEnabled) {
    const { width, height } = input;
    const totalPixels = width * height;
    const rgbFloat = new Float32Array(totalPixels * 3);
    for (let i = 0; i < totalPixels; i++) {
      rgbFloat[i * 3] = input.rgbaData[i * 4];
      rgbFloat[i * 3 + 1] = input.rgbaData[i * 4 + 1];
      rgbFloat[i * 3 + 2] = input.rgbaData[i * 4 + 2];
    }
    applyBilateralFilter(
      rgbFloat,
      width,
      height,
      input.settings.bilateralSigmaSpace,
      input.settings.bilateralSigmaColor,
      input.settings.bilateralRadius,
    );
    gpuRGBA = new Uint8ClampedArray(input.rgbaData);
    for (let i = 0; i < totalPixels; i++) {
      gpuRGBA[i * 4] = Math.round(rgbFloat[i * 3]);
      gpuRGBA[i * 4 + 1] = Math.round(rgbFloat[i * 3 + 1]);
      gpuRGBA[i * 4 + 2] = Math.round(rgbFloat[i * 3 + 2]);
    }
  }

  const gpuResult = gpu.gpuProcess(
    gpuRGBA,
    input.width,
    input.height,
    input.palette,
    input.settings.colorSpace,
    input.settings.ditherMethod,
  );

  onProgress?.(0.7);

  const { rgbaData, width, height } = gpuResult;
  const totalPixels = width * height;

  const paletteLookup = new Map<number, PaletteColor>();
  for (const p of input.palette) {
    const key = (p.rgb[0] << 16) | (p.rgb[1] << 8) | p.rgb[2];
    paletteLookup.set(key, p);
  }

  const pixelEntries: { colourSetId: string; toneKey: ToneKey }[] = new Array(totalPixels);
  const usedColors = new Set<string>();
  const mapSizeX = input.settings.mapSizeX;
  const mapSizeZ = input.settings.mapSizeZ;

  const maps: { materials: Record<string, number>; supportBlockCount: number }[][] = [];
  for (let z = 0; z < mapSizeZ; z++) {
    const row: { materials: Record<string, number>; supportBlockCount: number }[] = [];
    for (let x = 0; x < mapSizeX; x++) row.push({ materials: {}, supportBlockCount: 0 });
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
        maps[mz][mx].materials[p.colourSetId] = (maps[mz][mx].materials[p.colourSetId] || 0) + 1;
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

function processInWorker(
  input: EngineInput,
  onProgress?: (p: number) => void,
  signal?: AbortSignal,
): Promise<EngineOutput> {
  return new Promise(async (resolve, reject) => {
    const id = ++_messageId;
    let w: Worker;
    let settled = false;

    try {
      w = await acquireWorker();
    } catch (err) {
      reject(err);
      return;
    }

    if (signal?.aborted) {
      replaceWorkerInPool(w);
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const cleanup = () => {
      w.removeEventListener('message', handler);
      w.removeEventListener('error', errorHandler);
      signal?.removeEventListener('abort', abortHandler);
    };

    const finishResolve = (output: EngineOutput) => {
      if (settled) return;
      settled = true;
      cleanup();
      releaseWorker(w);
      resolve(output);
    };

    const finishReject = (err: unknown, replaceWorker: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (replaceWorker) replaceWorkerInPool(w);
      else releaseWorker(w);
      reject(err);
    };

    const abortHandler = () => {
      finishReject(new DOMException('Aborted', 'AbortError'), true);
    };

    const handler = (e: MessageEvent) => {
      if (e.data.id !== id) return;
      if (e.data.type === 'progress') {
        onProgress?.(e.data.progress);
        return;
      }
      if (e.data.type === 'result') {
        finishResolve(e.data.output);
      }
    };

    const errorHandler = (e: ErrorEvent) => {
      finishReject(new Error(`Worker error: ${e.message}`), true);
    };

    w.addEventListener('message', handler);
    w.addEventListener('error', errorHandler);
    signal?.addEventListener('abort', abortHandler, { once: true });

    const rgbaCopy = new Uint8ClampedArray(input.rgbaData);
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
      [rgbaCopy.buffer],
    );
  });
}
