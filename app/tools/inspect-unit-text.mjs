import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const pdfPath = path.join(appDir, "public", "masterplan", "masterplan.pdf");
const requested = String(process.argv[2] || "DLCV2-14").trim();
const suffix = requested.match(/(\d+-\d+)$/)?.[1] || requested;

if (!fs.existsSync(pdfPath)) {
  console.error(`Missing PDF: ${pdfPath}`);
  process.exit(1);
}

function visible(value) {
  return String(value || "")
    .replace(/\s/g, (char) => char === " " ? "␠" : "↵")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
}

const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, disableFontFace: true }).promise;
console.log(`Inspecting ${requested} · suffix ${suffix} · ${doc.numPages} page(s)`);

let hits = 0;
for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
  const page = await doc.getPage(pageNumber);
  const content = await page.getTextContent();
  const items = content.items.filter((item) => item?.str != null);

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!String(item.str).includes(suffix)) continue;
    hits += 1;
    console.log(`\nPAGE ${pageNumber} · item ${i}`);
    for (let j = Math.max(0, i - 4); j <= Math.min(items.length - 1, i + 4); j += 1) {
      const current = items[j];
      const x = Number(current.transform?.[4] || 0).toFixed(2);
      const y = Number(current.transform?.[5] || 0).toFixed(2);
      const marker = j === i ? ">" : " ";
      console.log(`${marker} [${j}] x=${x} y=${y} str="${visible(current.str)}" codes=${[...String(current.str || "")].map((c) => `U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`).join(" ")}`);
    }
  }
  page.cleanup?.();
}

console.log(`\nDone · ${hits} item(s) contained ${suffix}`);
try { doc.cleanup?.(); } catch {}
try { await doc.destroy?.(); } catch {}
