/**
 * Web Worker for image processing.
 *
 * Receives raw pixel data and settings, runs the processing engine,
 * sends back progress updates and final result.
 *
 * This file is loaded as a Vite worker module (format: 'es').
 */
import type { PaletteColor } from '$lib/types/colours.js';
import type {
  ProcessorSettings,
  ProcessorWorkerInput,
  ProcessorWorkerMessage,
} from './types.js';
import { processPixels } from './engine.js';

self.onmessage = (e: MessageEvent<ProcessorWorkerInput>) => {
  const { rgbaBuffer, width, height, palette, settings, selectedBlocks } = e.data;

  const rgbaData = new Uint8ClampedArray(rgbaBuffer);

  const result = processPixels({
    rgbaData,
    width,
    height,
    palette,
    settings,
    selectedBlocks,
    onProgress: (percent) => {
      self.postMessage({
        type: 'progress',
        percent,
      } satisfies ProcessorWorkerMessage);
    },
  });

  const buffer = result.rgbaData.buffer as ArrayBuffer;
  const msg = {
    type: 'result' as const,
    rgbaBuffer: buffer,
    pixelEntries: result.pixelEntries,
    maps: result.maps,
    totalPixels: result.totalPixels,
    uniqueColors: result.uniqueColors,
  };
  (self as unknown as Worker).postMessage(msg, [buffer]);
};
