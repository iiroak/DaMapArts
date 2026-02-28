/**
 * Web Worker for off-thread image processing.
 * Handles ALL dither methods on CPU without blocking the main thread.
 */
import { processPixels, type EngineInput, type EngineOutput } from './engine.js';
import type { PaletteColor } from '$lib/types/colours.js';
import type { ProcessorSettings } from './types.js';

export interface WorkerRequest {
  id: number;
  rgbaData: Uint8ClampedArray;
  width: number;
  height: number;
  palette: PaletteColor[];
  settings: ProcessorSettings;
  selectedBlocks: Record<string, string>;
}

export interface WorkerResponse {
  id: number;
  type: 'result' | 'progress';
  output?: EngineOutput;
  progress?: number;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, rgbaData, width, height, palette, settings, selectedBlocks } = e.data;

  const input: EngineInput = {
    rgbaData,
    width,
    height,
    palette,
    settings,
    selectedBlocks,
    onProgress: (p: number) => {
      (self as unknown as Worker).postMessage({ id, type: 'progress', progress: p } satisfies WorkerResponse);
    },
  };

  const result = processPixels(input);

  // Transfer the large RGBA buffer for zero-copy
  (self as unknown as Worker).postMessage(
    { id, type: 'result', output: result } satisfies WorkerResponse,
    [result.rgbaData.buffer],
  );
};
