import fs from "node:fs";
import path from "node:path";

function walkForManifests(root, maxDepth = 4) {
  const found = [];
  function visit(dir, depth) {
    if (depth > maxDepth || !fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full, depth + 1);
      else if (entry.isFile() && entry.name === "manifest.json") found.push(full);
    }
  }
  visit(root, 0);
  return found;
}

export function findBestMasterplanTileSource(searchRoots = []) {
  const candidates = [];
  for (const root of searchRoots) {
    for (const manifestPath of walkForManifests(root)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        const width = Number(manifest?.canvas?.width || manifest?.targetWidth || 0);
        const height = Number(manifest?.canvas?.height || manifest?.targetHeight || 0);
        const tiles = Array.isArray(manifest?.tiles) ? manifest.tiles : [];
        if (!width || !height || !tiles.length || manifest.coverageValid === false) continue;
        const dir = path.dirname(manifestPath);
        const resolvedTiles = tiles.map((tile) => ({
          ...tile,
          x0: Number(tile.x0 ?? tile.left ?? 0),
          y0: Number(tile.y0 ?? tile.top ?? 0),
          x1: Number(tile.x1 ?? ((tile.left ?? 0) + (tile.expectedWidth ?? tile.width ?? 0))),
          y1: Number(tile.y1 ?? ((tile.top ?? 0) + (tile.expectedHeight ?? tile.height ?? 0))),
          filePath: path.join(dir, tile.file),
        }));
        if (resolvedTiles.some((tile) => !fs.existsSync(tile.filePath))) continue;
        candidates.push({ type: "tiles", manifestPath, dir, width, height, tiles: resolvedTiles });
      } catch {}
    }
  }
  return candidates.sort((a, b) => b.width - a.width)[0] || null;
}

function clampRegion(region, width, height) {
  const left = Math.max(0, Math.min(width - 1, Math.floor(region.left)));
  const top = Math.max(0, Math.min(height - 1, Math.floor(region.top)));
  const right = Math.max(left + 1, Math.min(width, Math.ceil(region.left + region.width)));
  const bottom = Math.max(top + 1, Math.min(height, Math.ceil(region.top + region.height)));
  return { left, top, width: right - left, height: bottom - top };
}

export async function renderTileRegionToBuffer(sharp, source, region, outputWidth) {
  const safe = clampRegion(region, source.width, source.height);
  const outputHeight = Math.max(2, Math.round(outputWidth * safe.height / safe.width));
  const layers = [];

  for (const tile of source.tiles) {
    const ix0 = Math.max(safe.left, tile.x0);
    const iy0 = Math.max(safe.top, tile.y0);
    const ix1 = Math.min(safe.left + safe.width, tile.x1);
    const iy1 = Math.min(safe.top + safe.height, tile.y1);
    if (ix1 <= ix0 || iy1 <= iy0) continue;

    const logicalW = Math.max(1, tile.x1 - tile.x0);
    const logicalH = Math.max(1, tile.y1 - tile.y0);
    const meta = await sharp(tile.filePath, { limitInputPixels: false, sequentialRead: true }).metadata();
    const actualW = Number(meta.width || logicalW);
    const actualH = Number(meta.height || logicalH);

    const srcLeft = Math.max(0, Math.floor((ix0 - tile.x0) / logicalW * actualW));
    const srcTop = Math.max(0, Math.floor((iy0 - tile.y0) / logicalH * actualH));
    const srcRight = Math.min(actualW, Math.ceil((ix1 - tile.x0) / logicalW * actualW));
    const srcBottom = Math.min(actualH, Math.ceil((iy1 - tile.y0) / logicalH * actualH));
    const srcWidth = Math.max(1, srcRight - srcLeft);
    const srcHeight = Math.max(1, srcBottom - srcTop);

    const dstLeft = Math.max(0, Math.round((ix0 - safe.left) / safe.width * outputWidth));
    const dstTop = Math.max(0, Math.round((iy0 - safe.top) / safe.height * outputHeight));
    const dstRight = Math.min(outputWidth, Math.round((ix1 - safe.left) / safe.width * outputWidth));
    const dstBottom = Math.min(outputHeight, Math.round((iy1 - safe.top) / safe.height * outputHeight));
    const dstWidth = Math.max(1, dstRight - dstLeft);
    const dstHeight = Math.max(1, dstBottom - dstTop);

    const input = await sharp(tile.filePath, { limitInputPixels: false, sequentialRead: true })
      .extract({ left: srcLeft, top: srcTop, width: srcWidth, height: srcHeight })
      .resize({ width: dstWidth, height: dstHeight, fit: "fill" })
      .png()
      .toBuffer();

    layers.push({ input, left: dstLeft, top: dstTop });
  }

  if (!layers.length) throw new Error("No source tiles intersect the requested masterplan region.");

  return sharp({
    create: { width: outputWidth, height: outputHeight, channels: 3, background: "#ffffff" },
  })
    .composite(layers)
    .png()
    .toBuffer();
}
