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

function dedupe(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.pageNumber}:${entry.x.toFixed(3)}:${entry.y.toFixed(3)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function solve3(matrix, vector) {
  const a = matrix.map((row, index) => [...row, vector[index]]);
  for (let col = 0; col < 3; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 3; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-9) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col];
    for (let j = col; j < 4; j += 1) a[col][j] /= divisor;
    for (let row = 0; row < 3; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j < 4; j += 1) a[row][j] -= factor * a[col][j];
    }
  }
  return [a[0][3], a[1][3], a[2][3]];
}

function fitAffine(pairs) {
  if (pairs.length < 3) return null;
  const normal = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const bx = [0, 0, 0];
  const by = [0, 0, 0];
  for (const pair of pairs) {
    const row = [pair.old.x, pair.old.y, 1];
    for (let i = 0; i < 3; i += 1) {
      bx[i] += row[i] * pair.current.x;
      by[i] += row[i] * pair.current.y;
      for (let j = 0; j < 3; j += 1) normal[i][j] += row[i] * row[j];
    }
  }
  const x = solve3(normal, bx);
  const y = solve3(normal, by);
  if (!x || !y) return null;
  return { a: x[0], b: x[1], c: x[2], d: y[0], e: y[1], f: y[2] };
}

function applyAffine(model, point) {
  return {
    x: model.a * point.x + model.b * point.y + model.c,
    y: model.d * point.x + model.e * point.y + model.f,
  };
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function residual(model, pair) {
  const mapped = applyAffine(model, pair.old);
  return Math.hypot(mapped.x - pair.current.x, mapped.y - pair.current.y);
}

function robustAffine(pairs) {
  let active = pairs;
  let model = fitAffine(active);
  if (!model) return null;
  for (let pass = 0; pass < 3; pass += 1) {
    const errors = active.map((pair) => residual(model, pair));
    const med = median(errors);
    const threshold = Math.max(2, med * 4);
    const filtered = active.filter((pair) => residual(model, pair) <= threshold);
    if (filtered.length < 12 || filtered.length === active.length) break;
    active = filtered;
    model = fitAffine(active) || model;
  }
  const errors = active.map((pair) => residual(model, pair));
  return {
    model,
    landmarks: active.length,
    medianError: median(errors),
    maxError: errors.length ? Math.max(...errors) : 0,
  };
}

const { oid, size } = historicalPointer();
console.log(`Historic source: ${HISTORIC_COMMIT.slice(0, 8)} · ${HISTORIC_PDF_PATH}`);
console.log(`LFS oid: ${oid} · ${(size / 1024 / 1024).toFixed(2)} MB`);
console.log(`Recovering prefix: ${requestedPrefix}`);

const manifest = readJson(manifestPath, null);
if (!manifest?.index) throw new Error("Không tìm thấy generated/manifest.json hiện tại để calibrate tọa độ.");

const historicPdfPath = ensureHistoricPdf(oid);
const data = new Uint8Array(fs.readFileSync(historicPdfPath));
const doc = await pdfjsLib.getDocument({
  data,
  useWorkerFetch: false,
  isEvalSupported: false,
  disableFontFace: true,
}).promise;

const historicIndex = {};
for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  for (const item of content.items) {
    if (!item?.str) continue;
    const normalizedText = normalizeUnitCode(item.str);
    const matches = normalizedText.match(UNIT_CODE_RE) || [];
    for (const rawCode of matches) {
      const code = normalizeUnitCode(rawCode);
      const entry = {
        unitCode: code,
        pageNumber,
        x: Number(item.transform?.[4] || 0),
        y: Number(item.transform?.[5] || 0),
        width: Number(item.width || 0),
        height: Number(item.height || Math.abs(item.transform?.[3] || 0) || 0),
        sourceText: item.str,
      };
      if (!historicIndex[code]) historicIndex[code] = [];
      historicIndex[code].push(entry);
    }
  }
  page.cleanup?.();
}
try { doc.cleanup?.(); } catch {}
try { await doc.destroy?.(); } catch {}
for (const code of Object.keys(historicIndex)) historicIndex[code] = dedupe(historicIndex[code]);

const calibrationPairs = [];
for (const [code, historicEntries] of Object.entries(historicIndex)) {
  const currentEntries = manifest.index?.[code] || [];
  if (historicEntries.length !== 1 || currentEntries.length !== 1) continue;
  const old = historicEntries[0];
  const current = currentEntries[0];
  if (Number(old.pageNumber) !== Number(current.pageNumber)) continue;
  calibrationPairs.push({ code, old, current });
}

const alignment = robustAffine(calibrationPairs);
if (!alignment || alignment.landmarks < 12) {
  throw new Error(`Không đủ landmark chung để align PDF cũ → masterplan hiện tại (${alignment?.landmarks || 0}).`);
}
console.log(`Alignment: ${alignment.landmarks} shared landmarks · median error ${alignment.medianError.toFixed(2)} PDF units · max ${alignment.maxError.toFixed(2)}`);
if (alignment.medianError > 8) {
  console.warn("⚠ Alignment residual khá cao. Hãy gửi output này trước khi dùng locator override trong production.");
}

const recovered = {};
for (const [code, historicEntries] of Object.entries(historicIndex)) {
  if (!code.startsWith(requestedPrefix)) continue;
  recovered[code] = historicEntries.map((entry) => {
    const mapped = applyAffine(alignment.model, entry);
    const widthVector = {
      x: alignment.model.a * entry.width,
      y: alignment.model.d * entry.width,
    };
    const heightVector = {
      x: alignment.model.b * entry.height,
      y: alignment.model.e * entry.height,
    };
    return {
      ...entry,
      x: mapped.x,
      y: mapped.y,
      width: Math.hypot(widthVector.x, widthVector.y),
      height: Math.hypot(heightVector.x, heightVector.y),
      locatorSource: "historic-pdf-affine-aligned",
    };
  });
}

const overrides = readJson(overridesPath, {});
overrides._meta = {
  ...(overrides._meta || {}),
  version: 2,
  lastRecoveredAt: new Date().toISOString(),
  historicCommit: HISTORIC_COMMIT,
  historicLfsOid: oid,
  recoveredPrefix: requestedPrefix,
  alignmentLandmarks: alignment.landmarks,
  alignmentMedianError: alignment.medianError,
  alignmentMaxError: alignment.maxError,
  alignmentModel: alignment.model,
  note: "Historic coordinates are aligned to the current masterplan using shared unit-code landmarks. The historical PDF is preprocessing-only and is never loaded by runtime.",
};

let recoveredCodes = 0;
let recoveredMatches = 0;
for (const [code, entries] of Object.entries(recovered)) {
  if (!entries.length) continue;
  overrides[code] = dedupe(entries);
  recoveredCodes += 1;
  recoveredMatches += entries.length;
}

fs.writeFileSync(overridesPath, `${JSON.stringify(overrides, null, 2)}\n`, "utf8");

console.log(`Recovered ${recoveredCodes} code(s) · ${recoveredMatches} coordinate match(es).`);
if (overrides["DLCV2-14"]?.length) {
  const entry = overrides["DLCV2-14"][0];
  console.log(`✓ DLCV2-14 aligned at page ${entry.pageNumber} · x=${entry.x.toFixed(2)} · y=${entry.y.toFixed(2)}`);
} else if (requestedPrefix === "DLCV") {
  console.warn("⚠ DLCV2-14 was not recovered from the historical PDF. Share this output before doing any manual locating.");
}
console.log(`Wrote: ${path.relative(repoDir, overridesPath)}`);
console.log("Runtime remains PDF-free: only this JSON coordinate file is used after recovery.");