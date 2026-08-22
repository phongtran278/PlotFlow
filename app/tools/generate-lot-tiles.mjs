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
const LEVEL_WIDTHS = [640, 1280, 2168];

if (!fs.existsSync(manifestPath)) {
  console.error("✕ Missing prepared masterplan manifest. Run prepare-masterplan first.");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
fs.rmSync(tilesRoot, { recursive: true, force: true });
fs.mkdirSync(tilesRoot, { recursive: true });

function safeName(value) {
  return String(value).replace(/[^A-Z0-9_-]+/gi, "_");
}

for (const [unitCode, lot] of Object.entries(manifest.lots || {})) {
  const detailRelative = String(lot.detail || "").replace(/^\//, "");
  const detailPath = path.join(appDir, "public", detailRelative);
  if (!fs.existsSync(detailPath)) continue;

  const codeDir = path.join(tilesRoot, safeName(unitCode));
  fs.mkdirSync(codeDir, { recursive: true });
  const levels = [];

  for (const targetWidth of LEVEL_WIDTHS) {
    const source = sharp(detailPath, { limitInputPixels: false }).resize({ width: targetWidth, withoutEnlargement: true });
    const levelBuffer = await source.webp({ quality: targetWidth >= 2000 ? 88 : 82, effort: 4, smartSubsample: true }).toBuffer();
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
          .webp({ quality: 82, effort: 3, smartSubsample: true })
          .toFile(path.join(levelDir, `${x}_${y}.webp`));
      }
    }

    levels.push({ width, height, cols, rows, tileSize: TILE_SIZE });
  }

  lot.tiles = {
    base: `/masterplan/generated/lot-tiles/${safeName(unitCode)}`,
    tileSize: TILE_SIZE,
    levels,
  };
  console.log(`✓ Tiles ${unitCode} · ${levels.map((level) => `${level.width}px`).join(" / ")}`);
}

manifest.version = Math.max(4, Number(manifest.version || 0));
manifest.tileRenderer = "viewport-pyramid-v1";
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
console.log(`✓ Lot tile pyramid ready · ${Object.keys(manifest.lots || {}).length} lot(s) · ${TILE_SIZE}px tiles`);
