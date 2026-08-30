import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  findBestMasterplanTileSource,
  renderTileRegionToBuffer,
} from "./masterplan-tile-source.mjs";

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

const pdfCandidates = [
  ...(fs.existsSync(masterDir) ? fs.readdirSync(masterDir).filter((name) => /\.pdf$/i.test(name)).map((name) => path.join(masterDir, name)) : []),
  ...(fs.existsSync(publicMasterDir) ? fs.readdirSync(publicMasterDir).filter((name) => /\.pdf$/i.test(name)).map((name) => path.join(publicMasterDir, name)) : []),
];
const pdfPath = pdfCandidates[0] || null;
if (!pdfPath) {
  console.error("✕ No PDF found in masterplan/ or app/public/masterplan/.");
  process.exit(1);
}
const pdfName = path.basename(pdfPath);
const pdfPublicPath = path.join(publicMasterDir, "masterplan.pdf");
fs.mkdirSync(publicMasterDir, { recursive: true });
if (path.resolve(pdfPath) !== path.resolve(pdfPublicPath)) fs.copyFileSync(pdfPath, pdfPublicPath);

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
  return [masterDir, publicMasterDir].flatMap((dir) => names.map((name) => path.join(dir, name)));
}

function resolveRasterSource(pageNumber, totalPages) {
  const explicit = rasterCandidates(pageNumber, totalPages).find((candidate) => fs.existsSync(candidate));
  if (explicit) return explicit;
  const loose = [masterDir, publicMasterDir].flatMap((dir) => fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) => RASTER_EXT_RE.test(name)).map((name) => path.join(dir, name))
    : []);
  if (totalPages === 1 && loose.length === 1) return loose[0];
  return null;
}

async function pageSourceFor(pageNumber, totalPages) {
  const tiled = totalPages === 1
    ? findBestMasterplanTileSource([
        path.join(publicMasterDir, "hires-masterplan"),
        path.join(masterDir, "hires-masterplan"),
      ])
    : null;
  if (tiled) return tiled;

  const rasterPath = resolveRasterSource(pageNumber, totalPages);
  if (!rasterPath) return null;
  const meta = await sharp(rasterPath, { limitInputPixels: false }).metadata();
  return {
    type: "raster",
    path: rasterPath,
    width: Number(meta.width || 0),
    height: Number(meta.height || 0),
  };
}

async function renderSourceRegion(source, region, outputWidth) {
  if (source.type === "tiles") {
    return renderTileRegionToBuffer(sharp, source, region, outputWidth);
  }
  return sharp(source.path, { limitInputPixels: false, sequentialRead: true })
    .extract({
      left: Math.max(0, Math.floor(region.left)),
      top: Math.max(0, Math.floor(region.top)),
      width: Math.max(2, Math.min(source.width - Math.max(0, Math.floor(region.left)), Math.ceil(region.width))),
      height: Math.max(2, Math.min(source.height - Math.max(0, Math.floor(region.top)), Math.ceil(region.height))),
    })
    .resize({ width: outputWidth, withoutEnlargement: false })
    .png()
    .toBuffer();
}

function sourceLabel(source) {
  if (source.type === "tiles") {
    return `tiles ${source.width}×${source.height} · ${path.relative(appDir, source.manifestPath)}`;
  }
  return `${source.width}×${source.height} · ${path.basename(source.path)}`;
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
  version: 7,
  source: pdfName,
  generatedAt: new Date().toISOString(),
  numPages: pdfDoc.numPages,
  renderer: "tile-or-raster-source+pdf-text-index+sharp",
  pages: {},
  index: {},
  lots: {},
};

console.log(`Preparing ${pdfName} · ${pdfDoc.numPages} page(s)`);
console.log("Memory-safe pipeline: PDF.js reads text/tọa độ only · hires tile/raster source provides pixels");
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

  const source = await pageSourceFor(pageNumber, pdfDoc.numPages);
  if (!source?.width || !source?.height) {
    console.error(`✕ Missing pixel source for PDF page ${pageNumber}.`);
    console.error("  Put the hires tile output under app/public/masterplan/hires-masterplan/ or provide masterplan-raster.png.");
    await pdfDoc.destroy();
    process.exit(1);
  }

  const pdfAspect = viewport.width / Math.max(1, viewport.height);
  const sourceAspect = source.width / Math.max(1, source.height);
  const aspectError = Math.abs(sourceAspect / pdfAspect - 1);
  if (aspectError > 0.025) {
    console.error(`✕ Pixel source aspect does not match PDF page ${pageNumber}.`);
    console.error(`  PDF: ${viewport.width.toFixed(1)}×${viewport.height.toFixed(1)} · source: ${source.width}×${source.height}`);
    await pdfDoc.destroy();
    process.exit(1);
  }

  const scaleX = source.width / Math.max(1, viewport.width);
  const scaleY = source.height / Math.max(1, viewport.height);
  const pagePreviewName = `page-${pageNumber}.webp`;
  const pagePreviewBuffer = await renderSourceRegion(source, { left: 0, top: 0, width: source.width, height: source.height }, PAGE_PREVIEW_WIDTH);
  const pageInfo = await sharp(pagePreviewBuffer, { limitInputPixels: false })
    .webp({ quality: 80, effort: 3, smartSubsample: true })
    .toFile(path.join(generatedDir, "pages", pagePreviewName));

  manifest.pages[String(pageNumber)] = {
    width: viewport.width,
    height: viewport.height,
    rasterWidth: pageInfo.width,
    rasterHeight: pageInfo.height,
    sourceRasterWidth: source.width,
    sourceRasterHeight: source.height,
    preview: `/masterplan/generated/pages/${pagePreviewName}`,
    sourceType: source.type,
    sourceManifest: source.type === "tiles" ? path.relative(publicMasterDir, source.manifestPath) : null,
    dzi: null,
  };

  console.log(`• Page ${pageNumber}: ${pageEntries.length} code hit(s) · ${sourceLabel(source)}`);

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

    const pixelRegion = {
      left: crop.x * scaleX,
      top: crop.y * scaleY,
      width: crop.w * scaleX,
      height: crop.h * scaleY,
    };
    const detailPng = await renderSourceRegion(source, pixelRegion, DETAIL_WIDTH);

    const detailInfo = await sharp(detailPng, { limitInputPixels: false })
      .webp({ quality: 90, effort: 3, smartSubsample: true })
      .toFile(path.join(generatedDir, "lots", detailFile));
    const mediumInfo = await sharp(detailPng, { limitInputPixels: false })
      .resize({ width: MEDIUM_WIDTH, withoutEnlargement: true })
      .webp({ quality: 86, effort: 3, smartSubsample: true })
      .toFile(path.join(generatedDir, "lots-medium", mediumFile));
    const previewInfo = await sharp(detailPng, { limitInputPixels: false })
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
console.log("  Next step: generate-lot-tiles.mjs builds the bounded viewport pyramid.");
