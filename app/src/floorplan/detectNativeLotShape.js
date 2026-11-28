import { detectLotShape } from "./autoLotShape.js";
import { renderPdfRegion } from "./pdfLocatorRuntimeStrict.js";

/** Detect against native tiles in a fixed-size area around the selected text match. */
export async function detectNativeLotShape(page, isCurrent) {
  const { anchorX: x, anchorY: y, width, height, scale } = page;
  if (![x, y, width, height, scale].every(Number.isFinite)
    || scale <= 0 || x <= 0 || x >= width || y <= 0 || y >= height) {
    throw new Error("Invalid lot anchor");
  }
  const left = Math.max(0, x - 12 * scale);
  const top = Math.max(0, y - 9 * scale);
  const crop = {
    x: left,
    y: top,
    w: Math.min(width, x + 12 * scale) - left,
    h: Math.min(height, y + 9 * scale) - top,
  };
  const raster = await renderPdfRegion(null, page, {}, {
    outputWidth: 720,
    aspect: crop.w / crop.h,
    explicitCrop: crop,
    independent: true,
  });
  if (!raster?.dataUrl) throw new Error("Lot crop unavailable");
  try {
    if (!isCurrent()) return null;
    const result = await detectLotShape(raster.dataUrl, {
      x: (x - raster.crop.x) / raster.crop.w,
      y: (y - raster.crop.y) / raster.crop.h,
    });
    return isCurrent() ? { result, crop: raster.crop } : null;
  } finally {
    URL.revokeObjectURL(raster.dataUrl);
  }
}
