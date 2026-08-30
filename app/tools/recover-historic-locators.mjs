import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const repoDir = path.resolve(appDir, "..");
const overridesPath = path.join(appDir, "src", "floorplan", "locatorOverrides.json");
const manifestPath = path.join(appDir, "public", "masterplan", "generated", "manifest.json");

const HISTORIC_COMMIT = "58a7ef04148c310bf93990bfbc76bc910ea5bba0";
const HISTORIC_PDF_PATH = "masterplan/masterplan.pdf";
const UNIT_CODE_RE = /[A-Z]{1,8}\d{1,5}-\d{1,5}/g;
const requestedPrefix = normalizeUnitCode(process.argv[2] || "DLCV");

function runGit(args, options = {}) {
  return execFileSync("git", args, {
    cwd: repoDir,
    encoding: options.encoding || "utf8",
    stdio: options.stdio || ["ignore", "pipe", "pipe"],
  });
}

function normalizeUnitCode(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ĐđÐð]/g, "D")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function readJson(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); } catch { return fallback; }
}

function locateLfsObject(gitDir, oid) {
  const direct = path.join(gitDir, "lfs", "objects", oid.slice(0, 2), oid.slice(2, 4), oid);
  if (fs.existsSync(direct)) return direct;

  const root = path.join(gitDir, "lfs", "objects");
  if (!fs.existsSync(root)) return null;
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const itemPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(itemPath);
      else if (entry.name === oid) return itemPath;
    }
  }
  return null;
}

function historicalPointer() {
  const pointer = runGit(["show", `${HISTORIC_COMMIT}:${HISTORIC_PDF_PATH}`]);
  const oid = pointer.match(/oid sha256:([a-f0-9]{64})/i)?.[1];
  const size = Number(pointer.match(/size (\d+)/)?.[1] || 0);
  if (!oid) throw new Error("Không đọc được Git LFS oid của masterplan lịch sử.");
  return { pointer, oid, size };
}

function ensureHistoricPdf(oid) {
  const rawGitDir = runGit(["rev-parse", "--git-dir"]).trim();
  const gitDir = path.resolve(repoDir, rawGitDir);
  let objectPath = locateLfsObject(gitDir, oid);
  if (objectPath) return objectPath;

  console.log("Fetching historical masterplan LFS object once...");
  execFileSync("git", ["lfs", "fetch", "origin", HISTORIC_COMMIT, `--include=${HISTORIC_PDF_PATH}`], {
    cwd: repoDir,
    stdio: "inherit",
  });

  objectPath = locateLfsObject(gitDir, oid);
  if (!objectPath) {
    throw new Error(`Đã fetch nhưng không tìm thấy LFS object ${oid}. Kiểm tra Git LFS đã được cài.`);
  }
  return objectPath;
}

function currentPageDimensions() {
  const manifest = readJson(manifestPath, null);
  const pages = manifest?.pages || {};
  const result = {};
  for (const [pageNumber, page] of Object.entries(pages)) {
    result[pageNumber] = {
      width: Number(page?.width || 0),
      height: Number(page?.height || 0),
    };
  }
  return result;
}

function dedupe(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.pageNumber}:${entry.x.toFixed(3)}:${entry.y.toFixed(3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const { oid, size } = historicalPointer();
console.log(`Historic source: ${HISTORIC_COMMIT.slice(0, 8)} · ${HISTORIC_PDF_PATH}`);
console.log(`LFS oid: ${oid} · ${(size / 1024 / 1024).toFixed(2)} MB`);
console.log(`Recovering prefix: ${requestedPrefix}`);

const historicPdfPath = ensureHistoricPdf(oid);
const data = new Uint8Array(fs.readFileSync(historicPdfPath));
const doc = await pdfjsLib.getDocument({
  data,
  useWorkerFetch: false,
  isEvalSupported: false,
  disableFontFace: true,
}).promise;

const currentDims = currentPageDimensions();
const recovered = {};

for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const current = currentDims[String(pageNumber)];
  const scaleX = current?.width ? current.width / viewport.width : 1;
  const scaleY = current?.height ? current.height / viewport.height : 1;
  const content = await page.getTextContent();

  for (const item of content.items) {
    if (!item?.str) continue;
    const normalizedText = normalizeUnitCode(item.str);
    const matches = normalizedText.match(UNIT_CODE_RE) || [];
    for (const rawCode of matches) {
      const code = normalizeUnitCode(rawCode);
      if (!code.startsWith(requestedPrefix)) continue;
      const entry = {
        unitCode: code,
        pageNumber,
        x: Number(item.transform?.[4] || 0) * scaleX,
        y: Number(item.transform?.[5] || 0) * scaleY,
        width: Number(item.width || 0) * scaleX,
        height: Number(item.height || Math.abs(item.transform?.[3] || 0) || 0) * scaleY,
        sourceText: item.str,
        locatorSource: "historic-pdf",
      };
      if (!recovered[code]) recovered[code] = [];
      recovered[code].push(entry);
    }
  }
  page.cleanup?.();
}

try { doc.cleanup?.(); } catch {}
try { await doc.destroy?.(); } catch {}

for (const code of Object.keys(recovered)) recovered[code] = dedupe(recovered[code]);

const overrides = readJson(overridesPath, {});
overrides._meta = {
  ...(overrides._meta || {}),
  version: 1,
  lastRecoveredAt: new Date().toISOString(),
  historicCommit: HISTORIC_COMMIT,
  historicLfsOid: oid,
  recoveredPrefix: requestedPrefix,
  note: "Coordinates are extracted from the historical masterplan that previously supported Vietnamese DLCV labels. The historical PDF is preprocessing-only and is never loaded by runtime.",
};

let recoveredCodes = 0;
let recoveredMatches = 0;
for (const [code, entries] of Object.entries(recovered)) {
  if (!entries.length) continue;
  overrides[code] = entries;
  recoveredCodes += 1;
  recoveredMatches += entries.length;
}

fs.writeFileSync(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");

console.log(`Recovered ${recoveredCodes} code(s) · ${recoveredMatches} coordinate match(es).`);
if (overrides["DLCV2-14"]?.length) {
  const entry = overrides["DLCV2-14"][0];
  console.log(`✓ DLCV2-14 recovered at page ${entry.pageNumber} · x=${entry.x.toFixed(2)} · y=${entry.y.toFixed(2)}`);
} else if (requestedPrefix === "DLCV") {
  console.warn("⚠ DLCV2-14 was not recovered from the historical PDF. Share this output before doing any manual locating.");
}
console.log(`Wrote: ${path.relative(repoDir, overridesPath)}`);
console.log("Runtime remains PDF-free: only this JSON coordinate file is used after recovery.");
