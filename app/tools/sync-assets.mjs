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
const generatedHouseCatalogPath = path.join(appDir, "src", "data", "generatedHouseCatalog.js");

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

function houseTokenFromFilename(fileName) {
  const stem = fileName.replace(/\.[^.]+$/, "");
  return stripDiacritics(stem)
    .toUpperCase()
    .replace(/\bLIEN[\s_-]*KE\b/g, "LK")
    .replace(/\bSONG[\s_-]*LAP\b/g, "SONG_LAP")
    .replace(/\bDON[\s_-]*LAP\b/g, "DON_LAP")
    .replace(/\bCAN[\s_-]*GOC\b/g, "CAN_GOC")
    .replace(/\bXE[\s_-]*KHE\b/g, "XE_KHE")
    .replace(/\bSAN[\s_-]*VUON\b/g, "SAN_VUON")
    .replace(/CH[\s_-]+(\d+)/g, "CH$1")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function canonicalStem(fileName) {
  return fileName.replace(/\.[^.]+$/, "").toUpperCase();
}

function canonicalFilenameScore(fileName, token) {
  const stem = canonicalStem(fileName);
  let score = 0;
  if (stem === token) score += 1000;
  if (!/[\s-]/.test(stem)) score += 100;
  if (!/[À-ỿ]/i.test(stem)) score += 20;
  if (/^[A-Z0-9_]+$/.test(stem)) score += 10;
  return score;
}

function generateHouseCatalog() {
  const houseDir = path.join(assetSource, "houses");
  const incomingDir = path.join(assetSource, "houses_incoming");
  const imageExt = /\.(png|jpe?g|webp)$/i;
  const files = fs.existsSync(houseDir)
    ? fs.readdirSync(houseDir).filter((name) => fs.statSync(path.join(houseDir, name)).isFile() && imageExt.test(name))
    : [];
  const incomingFiles = fs.existsSync(incomingDir)
    ? fs.readdirSync(incomingDir).filter((name) => fs.statSync(path.join(incomingDir, name)).isFile() && imageExt.test(name))
    : [];

  const grouped = new Map();
  for (const fileName of files) {
    const token = houseTokenFromFilename(fileName);
    if (!token) continue;
    if (!grouped.has(token)) grouped.set(token, []);
    grouped.get(token).push(fileName);
  }

  const duplicates = [];
  const rows = Array.from(grouped.entries())
    .map(([token, candidates]) => {
      const ranked = [...candidates].sort((a, b) => {
        const scoreDiff = canonicalFilenameScore(b, token) - canonicalFilenameScore(a, token);
        return scoreDiff || a.localeCompare(b);
      });
      const fileName = ranked[0];
      if (ranked.length > 1) duplicates.push({ token, keep: fileName, ignored: ranked.slice(1) });
      return {
        id: `HOUSE_${token}`,
        name: token.replace(/_/g, " · "),
        fileName,
        src: `/assets/houses/${encodeURIComponent(fileName).replace(/%2F/gi, "/")}`,
        group: "House",
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const duplicateFileCount = duplicates.reduce((sum, item) => sum + item.ignored.length, 0);
  console.log(`✓ House source: ${files.length} image(s) in assets/houses`);
  console.log(`✓ House catalog: ${rows.length} unique key(s)`);
  if (duplicates.length) {
    console.warn(`△ House duplicates: ${duplicateFileCount} extra file(s) collapsed into ${duplicates.length} key(s)`);
    for (const item of duplicates) {
      console.warn(`  ${item.token}: KEEP "${item.keep}"`);
      item.ignored.forEach((name) => console.warn(`    IGNORE "${name}"`));
    }
  }
  if (incomingFiles.length) {
    console.warn(`△ ${incomingFiles.length} image(s) still in assets/houses_incoming and NOT shown in House Picker.`);
    incomingFiles.forEach((name) => console.warn(`    INCOMING "${name}"`));
  }

  const content = `// Auto-generated by app/tools/sync-assets.mjs.\n// Source of truth: assets/houses/ filenames. Duplicate technical keys are collapsed.\nexport const generatedHouseCatalog = ${JSON.stringify(rows, null, 2)};\n`;
  ensureDir(path.dirname(generatedHouseCatalogPath));
  fs.writeFileSync(generatedHouseCatalogPath, content, "utf8");
  console.log(`✓ House catalog generated -> ${path.relative(projectDir, generatedHouseCatalogPath)}`);
}

if (!fs.existsSync(assetSource)) {
  console.error(`✕ Missing asset folder: ${assetSource}`);
  process.exit(1);
}

fs.rmSync(assetDest, { recursive: true, force: true });
copyDir(assetSource, assetDest);
console.log(`✓ Base assets synced: ${path.relative(projectDir, assetSource)} -> ${path.relative(projectDir, assetDest)}`);

generateHouseCatalog();

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

const fontSource = path.join(assetSource, "font");
const fontDest = path.join(assetDest, "font");
copyAlias(fontSource, (raw, n) => n.includes("gilroy regular") && !n.includes("italic"), path.join(fontDest, "SVN-Gilroy-Regular.otf"), "Gilroy Regular");
copyAlias(fontSource, (raw, n) => n.includes("gilroy medium") && !n.includes("italic"), path.join(fontDest, "SVN-Gilroy-Medium.otf"), "Gilroy Medium");
copyAlias(fontSource, (raw, n) => n.includes("gilroy semibold") && !n.includes("italic"), path.join(fontDest, "SVN-Gilroy-SemiBold.otf"), "Gilroy SemiBold");
copyAlias(fontSource, (raw, n) => n.includes("gilroy bold") && !n.includes("italic"), path.join(fontDest, "SVN-Gilroy-Bold.otf"), "Gilroy Bold");

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
