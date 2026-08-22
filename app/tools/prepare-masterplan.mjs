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
let createCanvas;
try {
  ({ default: sharp } = await import("sharp"));
  ({ createCanvas } = await import("@napi-rs/canvas"));
} catch {
  console.error("✕ Missing local image tools.");
  console.error("  Run once from app/:");
  console.error("  npm install --no-save --package-lock=false sharp@0.35.3 @napi-rs/canvas@0.1.80");
  console.error("  No Homebrew, Poppler, CMake, or full Xcode is required for this step.");
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

async function renderRegion(page, crop, outputWidth) {
  const scale = outputWidth / Math.max(1, crop.w);
  const outputHeight = Math.max(2, Math.round(crop.h * scale));
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.max(2, Math.round(outputWidth)), outputHeight);
  const ctx = canvas.getContext("2d");
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  await page.render({
    canvasContext: ctx,
    viewport,
    transform: [1, 0, 0, 1, -crop.x * scale, -crop.y * scale],
    background: "#ffffff",
  }).promise;

  const png = canvas.toBuffer("image/png");
  canvas.width = 1;
  canvas.height = 1;
  return png;
}

async function renderPagePreview(page, viewport) {
  const scale = PAGE_PREVIEW_WIDTH / Math.max(1, viewport.width);
  const width = Math.max(2, Math.round(viewport.width * scale));
  const height = Math.max(2, Math.round(viewport.height * scale));
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  const renderViewport = page.getViewport({ scale });
  await page.render({ canvasContext: ctx, viewport: renderViewport, background: "#ffffff" }).promise;
  const png = canvas.toBuffer("image/png");
  canvas.width = 1;
  canvas.height = 1;
  return png;
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
  version: 3,
  source: pdfName,
  generatedAt: new Date().toISOString(),
  numPages: pdfDoc.numPages,
  renderer: "pdfjs-napi-canvas",
  pages: {},
  index: {},
  lots: {},
};

console.log(`Preparing ${pdfName} · ${pdfDoc.numPages} page(s)`);
console.log("Renderer: PDF.js + @napi-rs/canvas · no Poppler/Homebrew required");
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

  const pagePreviewName = `page-${pageNumber}.webp`;
  const pagePng = await renderPagePreview(page, viewport);
  const pageInfo = await sharp(pagePng, { limitInputPixels: false })
    .webp({ quality: 80, effort: 4, smartSubsample: true })
    .toFile(path.join(generatedDir, "pages", pagePreviewName));

  manifest.pages[String(pageNumber)] = {
    width: viewport.width,
    height: viewport.height,
    rasterWidth: pageInfo.width,
    rasterHeight: pageInfo.height,
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

    const detailPng = await renderRegion(page, crop, DETAIL_WIDTH);
    const detailInfo = await sharp(detailPng, { limitInputPixels: false })
      .webp({ quality: 90, effort: 4, smartSubsample: true })
      .toFile(path.join(generatedDir, "lots", detailFile));

    const mediumInfo = await sharp(detailPng, { limitInputPixels: false })
      .resize({ width: MEDIUM_WIDTH, withoutEnlargement: true })
      .webp({ quality: 86, effort: 4, smartSubsample: true })
      .toFile(path.join(generatedDir, "lots-medium", mediumFile));

    const previewInfo = await sharp(detailPng, { limitInputPixels: false })
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
  console.log(`✓ Page ${pageNumber}/${pdfDoc.numPages} · ${pageEntries.length} code hit(s)`);
}

fs.writeFileSync(path.join(generatedDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
await pdfDoc.destroy();
console.log(`✓ Prepared masterplan · ${Object.keys(manifest.lots).length} lot raster(s)`);
console.log("  Runtime now selects preview / medium / detail by device memory profile.");
