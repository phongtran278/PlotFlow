import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const projectDir = path.resolve(appDir, "..");
const masterDir = path.join(projectDir, "masterplan");
const publicMasterDir = path.join(appDir, "public", "masterplan");
const generatedDir = path.join(publicMasterDir, "generated");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "plotflow-masterplan-"));

let sharp;
try {
  ({ default: sharp } = await import("sharp"));
} catch {
  console.error("✕ Missing optional image tool: sharp");
  console.error("  Run once from app/: npm install --no-save --package-lock=false sharp@0.35.3");
  process.exit(1);
}

const pdfName = fs.existsSync(masterDir)
  ? fs.readdirSync(masterDir).find((name) => /\.pdf$/i.test(name))
  : null;
if (!pdfName) {
  console.error("✕ No PDF found in masterplan/");
  process.exit(1);
}

const pdfPath = path.join(masterDir, pdfName);
const pdfPublicPath = path.join(publicMasterDir, "masterplan.pdf");
fs.mkdirSync(publicMasterDir, { recursive: true });
fs.copyFileSync(pdfPath, pdfPublicPath);

const pdftoppmProbe = spawnSync("pdftoppm", ["-v"], { encoding: "utf8" });
if (pdftoppmProbe.error) {
  console.error("✕ Missing pdftoppm (PDF → image converter).");
  console.error("  macOS: brew install poppler");
  console.error("  Windows: install Poppler and add its bin folder to PATH.");
  process.exit(1);
}

const UNIT_CODE_RE = /[A-Z]{1,8}\d{1,5}-\d{1,5}/g;
const DPI = Number(process.env.PLOTFLOW_MASTERPLAN_DPI || 300);
const DETAIL_WIDTH = Number(process.env.PLOTFLOW_LOT_DETAIL_WIDTH || 2168);
const PREVIEW_WIDTH = Number(process.env.PLOTFLOW_LOT_PREVIEW_WIDTH || 640);
const TILE_SIZE = Number(process.env.PLOTFLOW_TILE_SIZE || 512);
const FRAME_ASPECT = 506 / 390;

function normalizeUnitCode(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function defaultCrop(pageWidth, pageHeight, anchorX, anchorY) {
  const baseWidth = Math.min(pageWidth * 0.38, 980 / 1.7);
  let w = baseWidth;
  let h = w / FRAME_ASPECT;
  if (h > pageHeight) { h = pageHeight; w = h * FRAME_ASPECT; }
  if (w > pageWidth) { w = pageWidth; h = w / FRAME_ASPECT; }
  const x = Math.max(0, Math.min(pageWidth - w, anchorX - w / 2));
  const y = Math.max(0, Math.min(pageHeight - h, anchorY - h / 2));
  return { x, y, w, h };
}

function safeName(value) {
  return String(value).replace(/[^A-Z0-9_-]+/gi, "_");
}

fs.rmSync(generatedDir, { recursive: true, force: true });
fs.mkdirSync(path.join(generatedDir, "pages"), { recursive: true });
fs.mkdirSync(path.join(generatedDir, "lots"), { recursive: true });
fs.mkdirSync(path.join(generatedDir, "lots-preview"), { recursive: true });
fs.mkdirSync(path.join(generatedDir, "tiles"), { recursive: true });

const data = new Uint8Array(fs.readFileSync(pdfPath));
const pdfDoc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;
const manifest = {
  version: 1,
  source: pdfName,
  generatedAt: new Date().toISOString(),
  numPages: pdfDoc.numPages,
  dpi: DPI,
  tileSize: TILE_SIZE,
  pages: {},
  index: {},
  lots: {},
};

console.log(`Preparing ${pdfName} · ${pdfDoc.numPages} page(s) · ${DPI} DPI`);

for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const pageEntries = [];

  for (const item of content.items) {
    if (!item?.str) continue;
    const matches = normalizeUnitCode(item.str).match(UNIT_CODE_RE) || [];
    for (const codeRaw of matches) {
      const code = normalizeUnitCode(codeRaw);
      const entry = {
        unitCode: code,
        pageNumber,
        x: Number(item.transform?.[4] || 0),
        y: Number(item.transform?.[5] || 0),
        width: Number(item.width || 0),
        height: Number(item.height || Math.abs(item.transform?.[3] || 0) || 0),
        sourceText: item.str,
      };
      if (!manifest.index[code]) manifest.index[code] = [];
      manifest.index[code].push(entry);
      pageEntries.push(entry);
    }
  }

  const outPrefix = path.join(tempDir, `page-${pageNumber}`);
  const raster = spawnSync("pdftoppm", ["-f", String(pageNumber), "-l", String(pageNumber), "-singlefile", "-png", "-r", String(DPI), pdfPath, outPrefix], { stdio: "inherit" });
  if (raster.status !== 0) throw new Error(`pdftoppm failed on page ${pageNumber}`);
  const rasterPath = `${outPrefix}.png`;
  const meta = await sharp(rasterPath, { limitInputPixels: false }).metadata();
  const rasterWidth = Number(meta.width || 1);
  const rasterHeight = Number(meta.height || 1);
  const scaleX = rasterWidth / viewport.width;
  const scaleY = rasterHeight / viewport.height;

  const pagePreviewName = `page-${pageNumber}.webp`;
  await sharp(rasterPath, { limitInputPixels: false })
    .resize({ width: 1800, withoutEnlargement: true })
    .webp({ quality: 82, effort: 5, smartSubsample: true })
    .toFile(path.join(generatedDir, "pages", pagePreviewName));

  const tileBase = path.join(generatedDir, "tiles", `page-${pageNumber}.dz`);
  await sharp(rasterPath, { limitInputPixels: false })
    .webp({ quality: 82, effort: 4, smartSubsample: true })
    .tile({ size: TILE_SIZE, layout: "dz", depth: "onetile" })
    .toFile(tileBase);

  manifest.pages[String(pageNumber)] = {
    width: viewport.width,
    height: viewport.height,
    rasterWidth,
    rasterHeight,
    preview: `/masterplan/generated/pages/${pagePreviewName}`,
    dzi: `/masterplan/generated/tiles/page-${pageNumber}.dzi`,
  };

  for (const entry of pageEntries) {
    if (manifest.lots[entry.unitCode]) continue;
    const [rawX, rawY] = viewport.convertToViewportPoint(entry.x, entry.y);
    const anchorW = Math.max(14, entry.width);
    const anchorH = Math.max(14, entry.height);
    const anchorX = rawX + anchorW / 2;
    const anchorY = rawY - anchorH / 2;
    const crop = defaultCrop(viewport.width, viewport.height, anchorX, anchorY);
    const left = Math.max(0, Math.round(crop.x * scaleX));
    const top = Math.max(0, Math.round(crop.y * scaleY));
    const width = Math.max(2, Math.min(rasterWidth - left, Math.round(crop.w * scaleX)));
    const height = Math.max(2, Math.min(rasterHeight - top, Math.round(crop.h * scaleY)));
    const name = safeName(entry.unitCode);
    const detailFile = `${name}.webp`;
    const previewFile = `${name}.webp`;

    const cropPipeline = sharp(rasterPath, { limitInputPixels: false }).extract({ left, top, width, height });
    const detailInfo = await cropPipeline.clone()
      .resize({ width: DETAIL_WIDTH, withoutEnlargement: true })
      .webp({ quality: 90, effort: 5, smartSubsample: true })
      .toFile(path.join(generatedDir, "lots", detailFile));
    const previewInfo = await cropPipeline.clone()
      .resize({ width: PREVIEW_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80, effort: 5, smartSubsample: true })
      .toFile(path.join(generatedDir, "lots-preview", previewFile));

    manifest.lots[entry.unitCode] = {
      pageNumber,
      preview: `/masterplan/generated/lots-preview/${previewFile}`,
      detail: `/masterplan/generated/lots/${detailFile}`,
      previewWidth: previewInfo.width,
      previewHeight: previewInfo.height,
      detailWidth: detailInfo.width,
      detailHeight: detailInfo.height,
      anchor: {
        x: (anchorX - crop.x) / crop.w,
        y: (anchorY - crop.y) / crop.h,
      },
      crop,
    };
  }

  page.cleanup?.();
  fs.rmSync(rasterPath, { force: true });
  console.log(`✓ Page ${pageNumber}/${pdfDoc.numPages} · ${pageEntries.length} code hit(s)`);
}

fs.writeFileSync(path.join(generatedDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
await pdfDoc.destroy();
fs.rmSync(tempDir, { recursive: true, force: true });
console.log(`✓ Prepared masterplan · ${Object.keys(manifest.lots).length} lot raster(s)`);
console.log("  Runtime can now use WebP crops + Deep Zoom tiles before falling back to PDF.");
