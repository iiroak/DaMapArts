/**
 * Image crop/resize utilities.
 *
 * Handles extracting the correct region from the source image
 * based on crop mode, zoom, and offset settings.
 */
import type { ProcessorSettings } from './types.js';

/**
 * Draw the source image onto a canvas context with crop/zoom applied.
 * Also applies CSS filters for brightness, contrast, saturation.
 */
export function drawCroppedImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | ImageBitmap,
  settings: ProcessorSettings,
  canvasW: number,
  canvasH: number,
): void {
  const imgW = img instanceof HTMLImageElement
    ? (img.naturalWidth || img.width)
    : img.width;
  const imgH = img instanceof HTMLImageElement
    ? (img.naturalHeight || img.height)
    : img.height;

  switch (settings.cropMode) {
    case 'off': {
      // Stretch to fill — no cropping
      ctx.drawImage(img, 0, 0, canvasW, canvasH);
      break;
    }
    case 'center': {
      // Cover-crop from center, maintaining aspect ratio
      const targetRatio = canvasW / canvasH;
      const imgRatio = imgW / imgH;
      let sx: number, sy: number, sw: number, sh: number;

      if (imgRatio > targetRatio) {
        // Image is wider than target: crop sides
        sh = imgH;
        sw = imgH * targetRatio;
        sx = (imgW - sw) / 2;
        sy = 0;
      } else {
        // Image is taller than target: crop top/bottom
        sw = imgW;
        sh = imgW / targetRatio;
        sx = 0;
        sy = (imgH - sh) / 2;
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvasW, canvasH);
      break;
    }
    case 'manual': {
      // User-controlled offset + zoom
      const targetRatio = canvasW / canvasH;
      const zoom = settings.cropZoom;
      let sw: number, sh: number;

      if (imgW * canvasH > imgH * canvasW) {
        sw = (imgH * targetRatio) / zoom;
        sh = imgH / zoom;
      } else {
        sw = imgW / zoom;
        sh = (imgW / targetRatio) / zoom;
      }

      const sx = (settings.cropOffsetX / 100) * (imgW - sw);
      const sy = (settings.cropOffsetY / 100) * (imgH - sh);

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvasW, canvasH);
      break;
    }
  }
}

/**
 * Get the source image as raw RGBA pixel data, with crop and filters applied.
 * Returns a Uint8ClampedArray of length width × height × 4.
 */
export function getSourcePixels(
  img: HTMLImageElement,
  settings: ProcessorSettings,
): { data: Uint8ClampedArray; width: number; height: number } {
  const width = Math.max(1, settings.mapSizeX) * 128;
  const height = Math.max(1, settings.mapSizeZ) * 128;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Apply brightness/contrast/saturation via CSS filters
  const filters: string[] = [];
  if (settings.brightness !== 100) filters.push(`brightness(${settings.brightness}%)`);
  if (settings.contrast !== 100) filters.push(`contrast(${settings.contrast}%)`);
  if (settings.saturation !== 100) filters.push(`saturate(${settings.saturation}%)`);
  ctx.filter = filters.length > 0 ? filters.join(' ') : 'none';

  drawCroppedImage(ctx, img, settings, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  return { data: imageData.data, width, height };
}
