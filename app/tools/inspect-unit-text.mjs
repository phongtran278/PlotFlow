import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const pdfPath = path.join(appDir, "public", "masterplan", "masterplan.pdf");
const requested = String(process.argv[2] || "ĐLCV2-14").trim();
const suffix = requested.match(/(\d+-\d+)$/)?.[1] || requested;

if (!fs.existsSync(pdfPath)) {
  console.error(`Missing PDF: ${pdfPath}`);
  process.exit(1);
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ĐđÐð]/g, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
}

function visible(value) {
  return String(value || "")
    .replace(/\s/g, (char) => char === " " ? "␠" : "↵")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

function codepoints(value) {
  return [...String(value || "")]
    .map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`)
    .join(" ");
}

function prefixScore(text, target) {
  const normalized = normalize(text);
  const targetNorm = normalize(target);
  let score = normalized.includes(targetNorm) ? 100 : 0;
  for (const token of ["DLCV", "LCV", "CV", suffix]) {
    if (normalized.includes(token)) score += token === suffix ? 20 : token.length * 5;
  }
  return score;
}

const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, disableFontFace: true }).promise;
console.log(`Inspecting ${requested} · suffix ${suffix} · ${doc.numPages} page(s)`);

const candidates = [];
for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  const items = content.items.filter((item) => item?.str != null).map((item, index) => ({
    ...item,
    index,
    x: Number(item.transform?.[4] || 0),
    y: Number(item.transform?.[5] || 0),
  }));

  for (const hit of items) {
    if (!String(hit.str).includes(suffix)) continue;

    const neighborhood = items
      .filter((item) => Math.abs(item.y - hit.y) <= 8 && Math.abs(item.x - hit.x) <= 140)
      .filter((item) => String(item.str || "").trim())
      .sort((a, b) => a.x - b.x || a.index - b.index);

    const stitched = neighborhood.map((item) => item.str).join("");
    const score = prefixScore(stitched, requested);
    candidates.push({ pageNumber, hit, neighborhood, stitched, score });
  }

  page.cleanup?.();
}

candidates.sort((a, b) => b.score - a.score);
const shown = candidates.slice(0, 8);

if (!shown.length) {
  console.log(`\nNo text item contained suffix ${suffix}.`);
} else {
  console.log(`\nTop ${shown.length} candidate neighborhood(s) out of ${candidates.length}:`);
  for (let rank = 0; rank < shown.length; rank += 1) {
    const candidate = shown[rank];
    console.log(`\n#${rank + 1} · PAGE ${candidate.pageNumber} · score ${candidate.score} · stitched="${visible(candidate.stitched)}" · normalized="${normalize(candidate.stitched)}"`);
    for (const item of candidate.neighborhood) {
      const marker = item.index === candidate.hit.index ? ">" : " ";
      console.log(`${marker} [${item.index}] x=${item.x.toFixed(2)} y=${item.y.toFixed(2)} str="${visible(item.str)}" codes=${codepoints(item.str)}`);
    }
  }
}

console.log(`\nDone · ${candidates.length} item(s) contained ${suffix}`);
try { doc.cleanup?.(); } catch {}
try { await doc.destroy?.(); } catch {}
