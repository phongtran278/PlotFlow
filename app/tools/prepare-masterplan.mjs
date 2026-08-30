import fs from "node:fs";
import path from "node:path";
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
const PAGE_PREVIEW_WIDTH = Number(process.env.PLOTFLOW_PAGE_PREVIEW_WIDTH || 1800);
const FRAME_ASPECT = 506 / 390;
const RASTER_EXT_RE = /\.(png|jpe?g|webp|tiff?)$/i;

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

function rasterCandidates(pageNumber, totalPages) {
  const names = totalPages === 1
    ? [
        "masterplan-raster.png", "masterplan-raster.jpg", "masterplan-raster.jpeg", "masterplan-raster.webp", "masterplan-raster.tif", "masterplan-raster.tiff",
        "masterplan.png", "masterplan.jpg", "masterplan.jpeg", "masterplan.webp", "masterplan.tif", "masterplan.tiff",
        "page-1.png", "page-1.jpg", "page-1.jpeg", "page-1.webp", "page-1.tif", "page-1.tiff",
      ]
    : [
        `masterplan-page-${pageNumber}.png`, `masterplan-page-${pageNumber}.jpg`, `masterplan-page-${pageNumber}.jpeg`, `masterplan-page-${pageNumber}.webp`,
        `page-${pageNumber}.png`, `page-${pageNumber}.jpg`, `page-${pageNumber}.jpeg`, `page-${pageNumber}.webp`,
      ];
  return names.map((name) => path.join(masterDir, name));
}

function resolveRasterSource(pageNumber, totalPages) {
  const explicit = rasterCandidates(pageNumber, totalPages).find((candidate) => fs.existsSync(candidate));
  if (explicit) return explicit;

  const loose = fs.existsSync(masterDir)
    ? fs.readdirSync(masterDir)
        .filter((name) => RASTER_EXT_RE.test(name))
        .map((name) => path.join(masterDir, name))
    : [];
  if (totalPages === 1 && loose.length === 1) return loose[0];
  return null;
}

function printRasterHelp(pageNumber, totalPages) {
  console.error(`✕ Missing raster source for PDF page ${pageNumber}.`);
  console.error("  PlotFlow now keeps PDF only for text/tọa độ and never rasterizes it during preparation.");
  if (totalPages === 1) {
    console.error("  Export the masterplan once as a large PNG/JPG/WebP and place it here:");
    console.error(`  ${path.join(masterDir, "masterplan-raster.png")}`);
  } else {
    console.error("  Export each PDF page once and place files like:");
    console.error(`  ${path.join(masterDir, `masterplan-page-${pageNumber}.png`)}`);
  }
  console.error("  Recommended: 7000–10000 px wide, same full-page composition, no crop/rotation.");
  console.error("  After that, rerun: npm run prepare-masterplan");
}

fs.rmSync(generatedDir, { recursive: true, force: true });
fs.mkdirSync(path.join(generatedDir, "pages"), { recursive: true });
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
  version: 6,
  source: pdfName,
  generatedAt: new Date().toISOString(),
  numPages: pdfDoc.numPages,
  renderer: "supplied-raster+pdf-text-index+sharp",
  pages: {},
  index: {},
  lots: {},
};

console.log(`Preparing ${pdfName} · ${pdfDoc.numPages} page(s)`);
console.log("Memory-safe pipeline: PDF.js reads text/tọa độ only · supplied raster provides pixels · sharp creates crops/tiles");
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

  const rasterSource = resolveRasterSource(pageNumber, pdfDoc.numPages);
  if (!rasterSource) {
    printRasterHelp(pageNumber, pdfDoc.numPages);
    await pdfDoc.destroy();
    process.exit(1);
  }

  const sourceMeta = await sharp(rasterSource, { limitInputPixels: false }).metadata();
  const rasterWidth = Number(sourceMeta.width || 0);
  const rasterHeight = Number(sourceMeta.height || 0);
  if (!rasterWidth || !rasterHeight) throw new Error(`Cannot read raster dimensions: ${rasterSource}`);

  const pdfAspect = viewport.width / Math.max(1, viewport.height);
  const rasterAspect = rasterWidth / Math.max(1, rasterHeight);
  const aspectError = Math.abs(rasterAspect / pdfAspect - 1);
  if (aspectError > 0.025) {
    console.error(`✕ Raster aspect does not match PDF page ${pageNumber}.`);
    console.error(`  PDF: ${viewport.width.toFixed(1)}×${viewport.height.toFixed(1)} · raster: ${rasterWidth}×${rasterHeight}`);
    console.error("  Export the complete page again with no crop or rotation.");
    await pdfDoc.destroy();
    process.exit(1);
  }

  const scaleX = rasterWidth / Math.max(1, viewport.width);
  const scaleY = rasterHeight / Math.max(1, viewport.height);
  const pagePreviewName = `page-${pageNumber}.webp`;
  const pageInfo = await sharp(rasterSource, { limitInputPixels: false })
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
    rasterSource: path.basename(rasterSource),
    dzi: null,
  };

  console.log(`• Page ${pageNumber}: ${pageEntries.length} code hit(s) · raster ${rasterWidth}×${rasterHeight} · ${path.basename(rasterSource)}`);

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

    const cropBuffer = await sharp(rasterSource, { limitInputPixels: false, sequentialRead: true })
      .extract({ left, top, width, height })
      .resize({ width: DETAIL_WIDTH, withoutEnlargement: false })
      .webp({ quality: 90, effort: 3, smartSubsample: true })
      .toBuffer();

    const detailInfo = await sharp(cropBuffer, { limitInputPixels: false })
      .toFile(path.join(generatedDir, "lots", detailFile));
    const mediumInfo = await sharp(cropBuffer, { limitInputPixels: false })
      .resize({ width: MEDIUM_WIDTH, withoutEnlargement: true })
      .webp({ quality: 86, effort: 3, smartSubsample: true })
      .toFile(path.join(generatedDir, "lots-medium", mediumFile));
    const previewInfo = await sharp(cropBuffer, { limitInputPixels: false })
      .resize({ width: PREVIEW_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80, effort: 3, smartSubsample: true })
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
      anchor: { x: (anchorX - crop.x) / crop.w, y: (anchorY - crop.y) / crop.h },
      crop,
    };
  }

  page.cleanup?.();
  console.log(`✓ Page ${pageNumber}/${pdfDoc.numPages} · ${pageEntries.length} code hit(s)`);
}

fs.writeFileSync(path.join(generatedDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
await pdfDoc.destroy();

const lotCount = Object.keys(manifest.lots).length;
if (!lotCount) {
  console.error("✕ Prepared masterplan contains 0 lot rasters. The PDF text index did not match PlotFlow unit-code format.");
  process.exit(1);
}
console.log(`✓ Prepared masterplan · ${lotCount} lot raster(s)`);
console.log("  Next step: generate-lot-tiles.mjs builds the viewport tile pyramid.");
