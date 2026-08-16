import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const projectDir = path.resolve(appDir, "..");
const assetSource = path.join(projectDir, "assets");
const assetDest = path.join(appDir, "public", "assets");
const masterSource = path.join(projectDir, "masterplan");
const masterDest = path.join(appDir, "public", "masterplan");

function stripDiacritics(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function findFile(dir, predicate) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((name) => fs.statSync(path.join(dir, name)).isFile());
  return files.find((name) => predicate(name, stripDiacritics(name))) || null;
}

function copyAlias(srcDir, matcher, destPath, label) {
  const file = findFile(srcDir, matcher);
  if (!file) {
    console.warn(`△ Missing ${label}`);
    return false;
  }
  ensureDir(path.dirname(destPath));
  fs.copyFileSync(path.join(srcDir, file), destPath);
  console.log(`✓ ${label}: ${file} -> ${path.relative(projectDir, destPath)}`);
  return true;
}

if (!fs.existsSync(assetSource)) {
  console.error(`✕ Missing asset folder: ${assetSource}`);
  process.exit(1);
}

fs.rmSync(assetDest, { recursive: true, force: true });
copyDir(assetSource, assetDest);
console.log(`✓ Base assets synced: ${path.relative(projectDir, assetSource)} -> ${path.relative(projectDir, assetDest)}`);

const uiDir = path.join(assetDest, "ui");
const houseAliasDir = path.join(assetDest, "library", "houses");
ensureDir(uiDir);
ensureDir(houseAliasDir);

copyAlias(
  path.join(assetSource, "houses"),
  (raw, norm) => norm.includes("59") && (norm.includes("san vuon") || norm.includes("lk")),
  path.join(houseAliasDir, "HOUSE_CH59_LK_SAN_VUON.jpg"),
  "CH-59 canonical house"
);

const logoSource = path.join(assetSource, "logo");
copyAlias(logoSource, (raw, n) => n.includes("vang") || n.includes("gold") && !n.includes("rose"), path.join(uiDir, "logo_gold.png"), "Gold logo");
copyAlias(logoSource, (raw, n) => n.includes("den") || n.includes("black"), path.join(uiDir, "logo_black.png"), "Black logo");
copyAlias(logoSource, (raw, n) => n.includes("xanh") || n.includes("blue"), path.join(uiDir, "logo_blue.png"), "Blue logo");
copyAlias(logoSource, (raw, n) => n.includes("do") || n.includes("red"), path.join(uiDir, "logo_red.png"), "Red logo");
copyAlias(logoSource, (raw, n) => n.includes("trang") || n.includes("white"), path.join(uiDir, "logo_white.png"), "White logo");
copyAlias(logoSource, (raw, n) => n.includes("rose gold") || n.includes("rose"), path.join(uiDir, "logo_rose_gold.png"), "Rose-gold logo");

const badgeSource = path.join(assetSource, "badges");
copyAlias(badgeSource, (raw, n) => n.includes("hotdeal") || (n.includes("hot") && n.includes("deal")), path.join(uiDir, "badge_hotdeal.png"), "Hot Deal badge");
copyAlias(badgeSource, (raw, n) => n.includes("veosom") || n.includes("ve o som"), path.join(uiDir, "badge_veosom.png"), "Về ở sớm badge");

const pinSource = path.join(assetSource, "pin");
copyAlias(pinSource, (raw, n) => n.includes("pin2d"), path.join(uiDir, "pin_2d.png"), "2D pin");
copyAlias(pinSource, (raw, n) => n.includes("pin3d"), path.join(uiDir, "pin_3d.png"), "3D pin");

ensureDir(masterDest);
if (fs.existsSync(masterSource)) {
  const pdf = findFile(masterSource, (raw, n) => n.endsWith(".pdf") || raw.toLowerCase().endsWith(".pdf"));
  if (pdf) {
    fs.copyFileSync(path.join(masterSource, pdf), path.join(masterDest, "masterplan.pdf"));
    console.log(`✓ Masterplan: ${pdf} -> app/public/masterplan/masterplan.pdf`);
  } else {
    console.warn("△ No PDF found in masterplan/");
  }
}

console.log("✓ PlotFlow cross-platform asset setup complete");
