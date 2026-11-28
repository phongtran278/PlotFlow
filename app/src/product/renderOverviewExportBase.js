import { MASTERPLAN_NATIVE, MASTERPLAN_HEADER_SOURCE_SHA256 } from "./overviewMasterplanHeader.js";

export async function renderOverviewExportBase(width) {
  const manifestResponse = await fetch("/masterplan/generated/manifest.json");
  if (!manifestResponse.ok) throw new Error("Không tải được manifest để xuất Overview.");
  const manifest = await manifestResponse.json();
  const tiles = manifest.pages?.["1"]?.tiles;
  if (manifest.nativeCoordinateSource?.pdfSha256 !== MASTERPLAN_HEADER_SOURCE_SHA256 ||
      tiles?.sourceWidth !== MASTERPLAN_NATIVE.width || tiles?.sourceHeight !== MASTERPLAN_NATIVE.height) {
    throw new Error("Nguồn tile không khớp với Header Overview.");
  }
  const level = tiles.levels.find(item => item.width >= width);
  if (!level) throw new Error("Thiếu mức tile cho độ phân giải xuất.");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round(width * tiles.sourceHeight / tiles.sourceWidth);
  const ctx = canvas.getContext("2d", { alpha: false });
  const x = col => Math.round(Math.min(col * level.tileSize, level.width) * width / level.width);
  const y = row => Math.round(Math.min(row * level.tileSize, level.height) * canvas.height / level.height);
  for (let row = 0; row < level.rows; row++) {
    for (let col = 0; col < level.cols; col++) {
      const response = await fetch(`${tiles.base}/${level.width}/${col}_${row}.webp`);
      if (!response.ok) throw new Error(`Không tải được tile ${col}, ${row} để xuất Overview.`);
      const bitmap = await createImageBitmap(await response.blob());
      try {
        ctx.drawImage(bitmap, x(col), y(row), x(col + 1) - x(col), y(row + 1) - y(row));
      } finally {
        bitmap.close();
      }
    }
  }
  return canvas;
}
