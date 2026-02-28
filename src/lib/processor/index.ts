/**
 * Processor module — barrel export.
 */
export type {
  ProcessorSettings,
  PixelEntry,
  MapSection,
  ProcessorResult,
  ProcessorWorkerInput,
  ProcessorWorkerProgress,
  ProcessorWorkerResult,
  ProcessorWorkerMessage,
} from './types.js';
export { processPixels } from './engine.js';
export type { EngineInput, EngineOutput } from './engine.js';
export { drawCroppedImage, getSourcePixels } from './crop.js';
