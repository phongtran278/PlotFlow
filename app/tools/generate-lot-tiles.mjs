import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const generatedDir = path.join(appDir, "public", "masterplan", "generated");
const manifestPath = path.join(generatedDir, "manifest.json");
const tilesRoot = path.join(generatedDir, "lot-tiles");
const TILE_SIZE = Number(process.env.PLOTFLOW_TILE_SIZE || 256);
const REQUESTED_LEVEL_WIDTHS = [640, 1280, 2168];

if (!fs.existsSync(manifestPath)) {
  console.error("✕ Missing prepared masterplan manifest.");
  console.error(`  Expected: ${manifestPath}`);
  console.error("  Run from app/: npm run prepare-masterplan");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const lotEntries = Object.entries(manifest.lots || {});
const indexCodes = Object.keys(manifest.index || {});

console.log(`Tile source manifest: ${lotEntries.length} prepared lot(s) · ${indexCodes.length} indexed code(s)`);
console.log(`Tile output: ${tilesRoot}`);

if (!lotEntries.length) {
  console.error("✕ Manifest contains zero prepared lots, so no tile folders can be generated.");
  console.error("  The PDF index may still exist, but Fine Tune would fall back to the heavy runtime path.");
  if (indexCodes.length) console.error(`  Indexed examples: ${indexCodes.slice(0, 8).join(", ")}`);
  process.exit(1);
}

fs.rmSync(tilesRoot, { recursive: true, force: true });
fs.mkdirSync(tilesRoot, { recursive: true });

function safeName(value) {
  return String(value).replace(/[^A-Z0-9_-]+/gi, "_");
}

function resolvePreparedSource(lot) {
  for (const candidate of [lot.detail, lot.medium, lot.preview]) {
    if (!candidate) continue;
    const relative = String(candidate).replace(/^\/+/, "");
    const absolute = path.join(appDir, "public", relative);
    if (fs.existsSync(absolute)) return { absolute, relative };
  }
  return null;
}

let tiledLots = 0;
let tileFiles = 0;
const missingSources = [];

for (const [unitCode, lot] of lotEntries) {
  const source = resolvePreparedSource(lot);
  if (!source) {
    missingSources.push({ unitCode, detail: lot.detail, medium: lot.medium, preview: lot.preview });
    continue;
  }

  const sourceMeta = await sharp(source.absolute, { limitInputPixels: false }).metadata();
  const sourceWidth = Number(sourceMeta.width || lot.detailWidth || lot.mediumWidth || lot.previewWidth || 0);
  if (!sourceWidth) {
    missingSources.push({ unitCode, invalid: source.absolute });
    continue;
  }

  const levelWidths = [...new Set(
    REQUESTED_LEVEL_WIDTHS
      .map((width) => Math.min(width, sourceWidth))
      .filter((width) => width >= 320)
  )].sort((a, b) => a - b);

  if (!levelWidths.length) levelWidths.push(sourceWidth);

  const codeDir = path.join(tilesRoot, safeName(unitCode));
  fs.mkdirSync(codeDir, { recursive: true });
  const levels = [];

  for (const targetWidth of levelWidths) {
    const levelBuffer = await sharp(source.absolute, { limitInputPixels: false })
      .resize({ width: targetWidth, withoutEnlargement: true })
      .webp({ quality: targetWidth >= 2000 ? 86 : 80, effort: 3, smartSubsample: true })
      .toBuffer();

    const meta = await sharp(levelBuffer, { limitInputPixels: false }).metadata();
    const width = Number(meta.width || targetWidth);
    const height = Number(meta.height || Math.round(width * 390 / 506));
    const cols = Math.ceil(width / TILE_SIZE);
    const rows = Math.ceil(height / TILE_SIZE);
    const levelDir = path.join(codeDir, String(width));
    fs.mkdirSync(levelDir, { recursive: true });

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const left = x * TILE_SIZE;
        const top = y * TILE_SIZE;
        const tileWidth = Math.min(TILE_SIZE, width - left);
        const tileHeight = Math.min(TILE_SIZE, height - top);
        await sharp(levelBuffer, { limitInputPixels: false })
          .extract({ left, top, width: tileWidth, height: tileHeight })
          .webp({ quality: 80, effort: 2, smartSubsample: true })
          .toFile(path.join(levelDir, `${x}_${y}.webp`));
        tileFiles += 1;
      }
    }

    levels.push({ width, height, cols, rows, tileSize: TILE_SIZE });
  }

  lot.tiles = {
    base: `/masterplan/generated/lot-tiles/${safeName(unitCode)}`,
    tileSize: TILE_SIZE,
    levels,
  };
  tiledLots += 1;
  console.log(`✓ Tiles ${unitCode} · ${levels.map((level) => `${level.width}px`).join(" / ")}`);
}

if (!tiledLots) {
  console.error("✕ Generated zero lot tile folders.");
  console.error("  Prepared lot records exist, but their raster source files were not found.");
  for (const item of missingSources.slice(0, 5)) console.error(`  Missing ${item.unitCode}: ${JSON.stringify(item)}`);
  process.exit(1);
}

manifest.version = Math.max(5, Number(manifest.version || 0));
manifest.tileRenderer = "viewport-pyramid-v2";
manifest.tileStats = {
  tiledLots,
  tileFiles,
  missingSources: missingSources.length,
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

console.log(`✓ Lot tile pyramid ready · ${tiledLots}/${lotEntries.length} lot(s) · ${tileFiles} tile file(s) · ${TILE_SIZE}px tiles`);
console.log(`✓ Verify folders here: ${tilesRoot}`);
if (missingSources.length) {
  console.warn(`△ ${missingSources.length} lot(s) had no prepared raster source and were skipped.`);
}
