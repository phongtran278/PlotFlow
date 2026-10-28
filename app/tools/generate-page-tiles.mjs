import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  findBestMasterplanTileSource,
  renderTileRegionToBuffer,
} from "./masterplan-tile-source.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const publicMasterDir = path.join(appDir, "public", "masterplan");
const generatedDir = path.join(publicMasterDir, "generated");
const manifestPath = path.join(generatedDir, "manifest.json");
const tileRoot = path.join(generatedDir, "page-tiles", "page-1");
const TILE_SIZE = Number(process.env.PLOTFLOW_PAGE_TILE_SIZE || 512);
const MIN_LEVEL_WIDTH = Number(process.env.PLOTFLOW_PAGE_TILE_MIN_WIDTH || 1800);

if (!fs.existsSync(manifestPath)) {
  console.error("✕ Missing prepared masterplan manifest. Run prepare-masterplan.mjs first.");
  process.exit(1);
}

const source = findBestMasterplanTileSource([
  path.join(publicMasterDir, "hires-masterplan"),
  path.resolve(appDir, "..", "masterplan", "hires-masterplan"),
]);
if (!source) {
  console.warn("△ No hires masterplan tile source found; global page pyramid skipped.");
  process.exit(0);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const pageInfo = manifest.pages?.["1"] || manifest.pages?.[1];
if (!pageInfo) {
  console.error("✕ Prepared manifest has no page 1.");
  process.exit(1);
}

const widths = [];
let width = source.width;
while (width > MIN_LEVEL_WIDTH) {
  widths.push(Math.round(width));
  width /= 2;
}
widths.push(Math.max(MIN_LEVEL_WIDTH, Math.round(width)));
const levelWidths = [...new Set(widths)].sort((a, b) => a - b);

fs.rmSync(tileRoot, { recursive: true, force: true });
fs.mkdirSync(tileRoot, { recursive: true });

console.log(`Global page pyramid: ${source.width}×${source.height} source · ${TILE_SIZE}px tiles`);
console.log(`Levels: ${levelWidths.join(" / ")}px`);

const levels = [];
let totalFiles = 0;
for (const levelWidth of levelWidths) {
  const scale = levelWidth / source.width;
  const levelHeight = Math.max(1, Math.round(source.height * scale));
  const cols = Math.ceil(levelWidth / TILE_SIZE);
  const rows = Math.ceil(levelHeight / TILE_SIZE);
  const levelDir = path.join(tileRoot, String(levelWidth));
  fs.mkdirSync(levelDir, { recursive: true });

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const left = col * TILE_SIZE;
      const top = row * TILE_SIZE;
      const tileWidth = Math.min(TILE_SIZE, levelWidth - left);
      const tileHeight = Math.min(TILE_SIZE, levelHeight - top);
      const sourceRegion = {
        left: left / scale,
        top: top / scale,
        width: tileWidth / scale,
        height: tileHeight / scale,
      };
      const png = await renderTileRegionToBuffer(sharp, source, sourceRegion, tileWidth);
      await sharp(png, { limitInputPixels: false })
        .resize({ width: tileWidth, height: tileHeight, fit: "fill" })
        .webp({ quality: levelWidth >= source.width * 0.75 ? 88 : 82, effort: 2, smartSubsample: true })
        .toFile(path.join(levelDir, `${col}_${row}.webp`));
      totalFiles += 1;
    }
  }

  levels.push({ width: levelWidth, height: levelHeight, cols, rows, tileSize: TILE_SIZE });
  console.log(`✓ Page tiles ${levelWidth}×${levelHeight} · ${cols}×${rows} · ${cols * rows} file(s)`);
}

pageInfo.tiles = {
  base: "/masterplan/generated/page-tiles/page-1",
  tileSize: TILE_SIZE,
  sourceWidth: source.width,
  sourceHeight: source.height,
  levels,
};
manifest.version = Math.max(8, Number(manifest.version || 0));
manifest.pageTileRenderer = "global-viewport-pyramid-v1";
manifest.pageTileStats = {
  levels: levels.length,
  files: totalFiles,
  sourceWidth: source.width,
  sourceHeight: source.height,
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

console.log(`✓ Global page tile pyramid ready · ${totalFiles} file(s)`);
console.log(`✓ ${tileRoot}`);
