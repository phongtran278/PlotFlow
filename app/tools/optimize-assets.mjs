import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const projectDir = path.resolve(appDir, "..");
const sourceDir = path.join(projectDir, "assets", "houses");
const outputDir = path.join(projectDir, "assets", "houses_optimized");

let sharp;
try {
  ({ default: sharp } = await import("sharp"));
} catch {
  console.error("✕ Missing optional image tool: sharp");
  console.error("  Run once from app/: npm install --no-save --package-lock=false sharp@0.35.3");
  process.exit(1);
}

const MAX_WIDTH = Number(process.env.PLOTFLOW_HOUSE_MAX_WIDTH || 2000);
const QUALITY = Number(process.env.PLOTFLOW_HOUSE_WEBP_QUALITY || 84);
const imageExt = /\.(png|jpe?g|webp|tif|tiff)$/i;

if (!fs.existsSync(sourceDir)) {
  console.error(`✕ Missing house folder: ${sourceDir}`);
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });
const files = fs.readdirSync(sourceDir)
  .filter((name) => fs.statSync(path.join(sourceDir, name)).isFile() && imageExt.test(name));

let inputBytes = 0;
let outputBytes = 0;
let converted = 0;

for (const fileName of files) {
  const source = path.join(sourceDir, fileName);
  const stem = fileName.replace(/\.[^.]+$/, "");
  const output = path.join(outputDir, `${stem}.webp`);
  const sourceStat = fs.statSync(source);
  inputBytes += sourceStat.size;

  const sourceMtime = sourceStat.mtimeMs;
  const outputStat = fs.existsSync(output) ? fs.statSync(output) : null;
  if (outputStat && outputStat.mtimeMs >= sourceMtime) {
    outputBytes += outputStat.size;
    console.log(`↳ Keep: ${fileName}`);
    continue;
  }

  const info = await sharp(source, { limitInputPixels: false })
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true, fit: "inside" })
    .webp({ quality: QUALITY, smartSubsample: true, effort: 5 })
    .toFile(output);

  outputBytes += info.size;
  converted += 1;
  console.log(`✓ ${fileName} → ${stem}.webp · ${info.width}×${info.height} · ${(info.size / 1024 / 1024).toFixed(2)} MB`);
}

const saving = inputBytes > 0 ? (1 - outputBytes / inputBytes) * 100 : 0;
console.log(`\n✓ House optimization complete · ${converted} updated / ${files.length} total`);
console.log(`  Original: ${(inputBytes / 1024 / 1024).toFixed(1)} MB`);
console.log(`  Runtime:  ${(outputBytes / 1024 / 1024).toFixed(1)} MB`);
console.log(`  Saved:    ${Math.max(0, saving).toFixed(0)}%`);
