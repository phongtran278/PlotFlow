import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const projectDir = path.resolve(appDir, "..");
const masterDir = path.join(projectDir, "masterplan");
const publicMasterDir = path.join(appDir, "public", "masterplan");
const generatedDir = path.join(publicMasterDir, "generated");

let sharp;
try {
  ({ default: sharp } = await import("sharp"));
} catch {
  console.error("✕ Missing sharp.");
  console.error("  Run once from app/:");
  console.error("  npm install --no-save --package-lock=false sharp@0.35.3");
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

const UNIT_CODE_RE = /[A-Z]{1,8}\d{1,5}-\d{1,5}/g;
const DETAIL_WIDTH = Number(process.env.PLOTFLOW_LOT_DETAIL_WIDTH || 2168);
const MEDIUM_WIDTH = Number(process.env.PLOTFLOW_LOT_MEDIUM_WIDTH || 1600);
const PREVIEW_WIDTH = Number(process.env.PLOTFLOW_LOT_PREVIEW_WIDTH || 640);
const PAGE_RASTER_WIDTH = Number(process.env.PLOTFLOW_PAGE_RASTER_WIDTH || 7200);
const PAGE_PREVIEW_WIDTH = Number(process.env.PLOTFLOW_PAGE_PREVIEW_WIDTH || 1800);
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

function commandExists(command) {
  const checker = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(checker, [command], { stdio: "ignore" });
  return result.status === 0;
}

function newestPng(dir) {
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) => /\.png$/i.test(name)).map((name) => path.join(dir, name))
    : [];
  if (!files.length) return null;
  return files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

function renderPageExternally(pageNumber, totalPages, outputPath) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "plotflow-masterplan-"));
  try {
    if (commandExists("pdftoppm")) {
      const prefix = path.join(tempDir, `page-${pageNumber}`);
      execFileSync("pdftoppm", [
        "-f", String(pageNumber),
        "-l", String(pageNumber),
        "-singlefile",
        "-png",
        "-scale-to-x", String(PAGE_RASTER_WIDTH),
        "-scale-to-y", "-1",
        pdfPath,
        prefix,
      ], { stdio: "inherit" });
      const source = `${prefix}.png`;
      if (!fs.existsSync(source)) throw new Error(`pdftoppm did not create page ${pageNumber}.`);
      fs.copyFileSync(source, outputPath);
      return "pdftoppm";
    }

    if (process.platform === "darwin" && commandExists("qlmanage")) {
      if (totalPages !== 1 || pageNumber !== 1) {
        throw new Error("macOS Quick Look fallback supports this pipeline only for a one-page masterplan. Install Poppler for multi-page PDFs: brew install poppler");
      }
      execFileSync("qlmanage", ["-t", "-s", String(PAGE_RASTER_WIDTH), "-o", tempDir, pdfPath], {
        stdio: ["ignore", "ignore", "inherit"],
      });
      const source = newestPng(tempDir);
      if (!source) throw new Error("Quick Look did not create a PNG preview.");
      fs.copyFileSync(source, outputPath);
      return "macOS-QuickLook";
    }

    throw new Error(
      process.platform === "darwin"
        ? "No safe PDF rasterizer found. Install Poppler once with: brew install poppler"
        : "No safe PDF rasterizer found. Install Poppler so pdftoppm is available."
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

fs.rmSync(generatedDir, { recursive: true, force: true });
fs.mkdirSync(path.join(generatedDir, "pages"), { recursive: true });
fs.mkdirSync(path.join(generatedDir, "page-source"), { recursive: true });
fs.mkdirSync(path.join(generatedDir, "lots"), { recursive: true });
fs.mkdirSync(path.join(generatedDir, "lots-medium"), { recursive: true });
fs.mkdirSync(path.join(generatedDir, "lots-preview"), { recursive: true });

const data = new Uint8Array(fs.readFileSync(pdfPath));
const pdfDoc = await pdfjsLib.getDocument({
  data,
  useWorkerFetch: false,
  isEvalSupported: false,
  disableFontFace: true,
}).promise;

const manifest = {
  version: 5,
  source: pdfName,
  generatedAt: new Date().toISOString(),
  numPages: pdfDoc.numPages,
  renderer: "external-page-raster+sharp-crops",
  pages: {},
  index: {},
  lots: {},
};

console.log(`Preparing ${pdfName} · ${pdfDoc.numPages} page(s)`);
console.log("Safe pipeline: PDF.js reads text only · page raster runs in a separate process · sharp crops WebP assets");
console.log(`Page raster: ${PAGE_RASTER_WIDTH}px max width`);
console.log(`Lot rasters: ${PREVIEW_WIDTH}px preview · ${MEDIUM_WIDTH}px low-memory · ${DETAIL_WIDTH}px detail`);

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

  console.log(`• Page ${pageNumber}: ${pageEntries.length} code hit(s) · rasterizing outside Node…`);
  const sourcePng = path.join(generatedDir, "page-source", `page-${pageNumber}.png`);
  const renderer = renderPageExternally(pageNumber, pdfDoc.numPages, sourcePng);
  const sourceMeta = await sharp(sourcePng, { limitInputPixels: false }).metadata();
  const rasterWidth = Number(sourceMeta.width || 1);
  const rasterHeight = Number(sourceMeta.height || 1);
  const scaleX = rasterWidth / Math.max(1, viewport.width);
  const scaleY = rasterHeight / Math.max(1, viewport.height);

  const pagePreviewName = `page-${pageNumber}.webp`;
  const pageInfo = await sharp(sourcePng, { limitInputPixels: false })
    .resize({ width: PAGE_PREVIEW_WIDTH, withoutEnlargement: true })
    .webp({ quality: 80, effort: 4, smartSubsample: true })
    .toFile(path.join(generatedDir, "pages", pagePreviewName));

  manifest.pages[String(pageNumber)] = {
    width: viewport.width,
    height: viewport.height,
    rasterWidth: pageInfo.width,
    rasterHeight: pageInfo.height,
    sourceRasterWidth: rasterWidth,
    sourceRasterHeight: rasterHeight,
    preview: `/masterplan/generated/pages/${pagePreviewName}`,
    dzi: null,
  };

  for (const entry of pageEntries) {
    if (manifest.lots[entry.unitCode]) continue;
    const [rawX, rawY] = viewport.convertToViewportPoint(entry.x, entry.y);
    const anchorW = Math.max(14, entry.width);
    const anchorH = Math.max(14, entry.height);
    const anchorX = rawX + anchorW / 2;
    const anchorY = rawY - anchorH / 2;
    const crop = defaultCrop(viewport.width, viewport.height, anchorX, anchorY);
    const name = safeName(entry.unitCode);
    const detailFile = `${name}.webp`;
    const mediumFile = `${name}.webp`;
    const previewFile = `${name}.webp`;

    const left = Math.max(0, Math.floor(crop.x * scaleX));
    const top = Math.max(0, Math.floor(crop.y * scaleY));
    const width = Math.max(2, Math.min(rasterWidth - left, Math.ceil(crop.w * scaleX)));
    const height = Math.max(2, Math.min(rasterHeight - top, Math.ceil(crop.h * scaleY)));

    const cropBuffer = await sharp(sourcePng, { limitInputPixels: false })
      .extract({ left, top, width, height })
      .resize({ width: DETAIL_WIDTH, withoutEnlargement: false })
      .webp({ quality: 90, effort: 4, smartSubsample: true })
      .toBuffer();

    const detailInfo = await sharp(cropBuffer, { limitInputPixels: false })
      .toFile(path.join(generatedDir, "lots", detailFile));

    const mediumInfo = await sharp(cropBuffer, { limitInputPixels: false })
      .resize({ width: MEDIUM_WIDTH, withoutEnlargement: true })
      .webp({ quality: 86, effort: 4, smartSubsample: true })
      .toFile(path.join(generatedDir, "lots-medium", mediumFile));

    const previewInfo = await sharp(cropBuffer, { limitInputPixels: false })
      .resize({ width: PREVIEW_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80, effort: 4, smartSubsample: true })
      .toFile(path.join(generatedDir, "lots-preview", previewFile));

    manifest.lots[entry.unitCode] = {
      pageNumber,
      preview: `/masterplan/generated/lots-preview/${previewFile}`,
      medium: `/masterplan/generated/lots-medium/${mediumFile}`,
      detail: `/masterplan/generated/lots/${detailFile}`,
      previewWidth: previewInfo.width,
      previewHeight: previewInfo.height,
      mediumWidth: mediumInfo.width,
      mediumHeight: mediumInfo.height,
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
  fs.rmSync(sourcePng, { force: true });
  console.log(`✓ Page ${pageNumber}/${pdfDoc.numPages} · ${pageEntries.length} code hit(s) · ${renderer}`);
}

fs.rmSync(path.join(generatedDir, "page-source"), { recursive: true, force: true });
fs.writeFileSync(path.join(generatedDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
await pdfDoc.destroy();

const lotCount = Object.keys(manifest.lots).length;
if (!lotCount) {
  console.error("✕ Prepared masterplan contains 0 lot rasters. The PDF text index did not match PlotFlow unit-code format.");
  process.exit(1);
}
console.log(`✓ Prepared masterplan · ${lotCount} lot raster(s)`);
console.log("  Next step: generate-lot-tiles.mjs builds the viewport tile pyramid.");
