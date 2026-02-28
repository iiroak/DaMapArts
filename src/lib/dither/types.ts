/**
 * Dithering type definitions
 */

export type DitherType = 'none' | 'error-diffusion' | 'ordered' | 'curve';

export interface DitherMethod {
  id: string;
  uniqueId: number;
  name: string;
  type: DitherType;
}

/** Error diffusion kernel entry: [dx, dy, weight] */
export type DiffusionEntry = [number, number, number];

export interface DiffusionKernel {
  entries: DiffusionEntry[];
  divisor: number;
}
