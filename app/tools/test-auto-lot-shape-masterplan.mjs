import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { calculateCropRect, FLOORPLAN_FRAME_ASPECT } from "../src/floorplan/floorplanGeometry.js";
import { detectLotShapeFromImageData } from "../src/floorplan/autoLotShape.js";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(app, "dist");
const generated = path.join(dist, "masterplan", "generated");
const manifest = JSON.parse(await fs.readFile(path.join(generated, "manifest.json"), "utf8"));
const supplement = JSON.parse(await fs.readFile(path.join(generated, "tl-hyphen-index.json"), "utf8"));
const page = manifest.pages?.["1"];
assert.ok(page?.tiles?.levels?.length, "Masterplan page tile pyramid is required");

const OUTPUT_WIDTH = 1084;
const OUTPUT_HEIGHT = Math.round(OUTPUT_WIDTH / FLOORPLAN_FRAME_ASPECT);
const report = { mode: "real-masterplan-auto-lot-shape", output: { width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT }, samples: [] };

function anchorFor(code) {
  const supplemental = supplement.entries.find((entry) => entry.unitCode === code);
  if (supplemental) {
    const box = supplemental.bbox;
    return { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
  }
  const match = manifest.index?.[code]?.[0];
  assert.ok(match, "No prepared PDF text anchor for " + code);
  return {
    x: Number(match.x) + Number(match.width || 0) / 2,
    y: Number(page.height) - Number(match.y) - Number(match.height || 0) / 2,
  };
}

function chooseLevel(crop) {
  const levels = [...page.tiles.levels].sort((a, b) => Number(a.width) - Number(b.width));
  const equivalentPageWidth = OUTPUT_WIDTH * (Number(page.width) / Math.max(1, crop.w));
  return levels.find((level) => Number(level.width) >= equivalentPageWidth * 0.82) || levels.at(-1);
}

async function renderPageCrop(crop, level) {
  const tileSize = Number(level.tileSize || page.tiles.tileSize || 512);
  const scaleX = Number(level.width) / Number(page.width);
  const scaleY = Number(level.height) / Number(page.height);
  const x0 = Math.max(0, Math.floor(crop.x * scaleX));
  const y0 = Math.max(0, Math.floor(crop.y * scaleY));
  const x1 = Math.min(Number(level.width), Math.ceil((crop.x + crop.w) * scaleX));
  const y1 = Math.min(Number(level.height), Math.ceil((crop.y + crop.h) * scaleY));
  const width = Math.max(1, x1 - x0);
  const height = Math.max(1, y1 - y0);
  const composites = [];
  const base = path.join(dist, page.tiles.base.replace(/^\/+/, ""));

  const firstCol = Math.floor(x0 / tileSize);
  const lastCol = Math.floor((x1 - 1) / tileSize);
  const firstRow = Math.floor(y0 / tileSize);
  const lastRow = Math.floor((y1 - 1) / tileSize);

  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let col = firstCol; col <= lastCol; col += 1) {
      const tilePath = path.join(base, String(level.width), String(col) + "_" + String(row) + ".webp");
      const tileLeft = col * tileSize;
      const tileTop = row * tileSize;
      const tileRight = Math.min(Number(level.width), tileLeft + tileSize);
      const tileBottom = Math.min(Number(level.height), tileTop + tileSize);
      const ix0 = Math.max(x0, tileLeft);
      const iy0 = Math.max(y0, tileTop);
      const ix1 = Math.min(x1, tileRight);
      const iy1 = Math.min(y1, tileBottom);
      const input = await sharp(tilePath)
        .extract({
          left: ix0 - tileLeft,
          top: iy0 - tileTop,
          width: ix1 - ix0,
          height: iy1 - iy0,
        })
        .png()
        .toBuffer();
      composites.push({ input, left: ix0 - x0, top: iy0 - y0 });
    }
  }

  const rendered = await sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite(composites)
    .resize({ width: OUTPUT_WIDTH, height: OUTPUT_HEIGHT, fit: "fill" })
    .resize({ width: 720, height: Math.round(720 / FLOORPLAN_FRAME_ASPECT), fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data: rendered.data,
    width: rendered.info.width,
    height: rendered.info.height,
  };
}

for (const code of ["TL-01", "TL-81", "TL30-01", "TL31-02"]) {
  const anchor = anchorFor(code);
  const pageRender = {
    width: Number(page.width),
    height: Number(page.height),
    scale: 1,
    anchorX: anchor.x,
    anchorY: anchor.y,
  };
  const crop = calculateCropRect(pageRender, { zoom: 100, offsetX: 0, offsetY: 0 }, FLOORPLAN_FRAME_ASPECT);
  const level = chooseLevel(crop);
  const pixels = await renderPageCrop(crop, level);
  const localAnchor = {
    x: (anchor.x - crop.x) / crop.w,
    y: (anchor.y - crop.y) / crop.h,
  };
  const result = await detectLotShapeFromImageData(pixels, localAnchor);
  const sample = {
    code,
    level: level.width,
    crop: { x: crop.x, y: crop.y, width: crop.w, height: crop.h },
    accepted: result.accepted,
    confidence: result.confidence,
    vertices: result.vertices || 0,
    classification: result.classification || null,
    reason: result.reason,
    diagnostics: result.diagnostics || null,
  };
  report.samples.push(sample);
  console.log("[auto-lot-shape]", JSON.stringify(sample));
}

await fs.writeFile(path.join(app, "auto-lot-shape-masterplan-report.json"), JSON.stringify(report, null, 2) + "\n");
const accepted = report.samples.filter((sample) => sample.accepted);
assert.ok(accepted.length >= 3, "Expected at least 3/4 real Masterplan lot boundaries to be accepted; got " + accepted.length + "/4");
for (const sample of accepted) {
  assert.ok(sample.vertices >= 4 && sample.vertices <= 8, "Invalid polygon vertex count for " + sample.code);
  assert.ok(sample.confidence >= 0.68, "Low confidence for " + sample.code);
}
