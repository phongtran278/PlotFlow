#!/usr/bin/env node
// Read-only architectural inventory. Heuristics are leads, NOT proof of leaks or unused code.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, relative, join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const scannedRoots = ["app/src", "app/tools", "services"];
const extensions = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".css"]);
const files = [];

function visit(path) {
  let stat;
  try { stat = statSync(path); } catch { return; }
  if (stat.isDirectory()) {
    for (const name of readdirSync(path)) {
      if (["node_modules", "dist", ".git", "coverage"].includes(name)) continue;
      visit(join(path, name));
    }
  } else if (stat.isFile() && extensions.has(extname(path))) {
    const text = readFileSync(path, "utf8");
    const count = (pattern) => [...text.matchAll(pattern)].length;
    files.push({
      path: relative(root, path).replaceAll("\\", "/"),
      bytes: stat.size,
      lines: text.split("\n").length,
      effectHooks: count(/\buseEffect\s*\(/g),
      listenersAdded: count(/\baddEventListener\s*\(/g),
      listenersRemoved: count(/\bremoveEventListener\s*\(/g),
      observersCreated: count(/new\s+(?:MutationObserver|ResizeObserver|IntersectionObserver)\s*\(/g),
      observersDisconnected: count(/\.disconnect\s*\(/g),
      intervalsCreated: count(/\bsetInterval\s*\(/g),
      intervalsCleared: count(/\bclearInterval\s*\(/g),
      objectUrlsCreated: count(/\bcreateObjectURL\s*\(/g),
      objectUrlsRevoked: count(/\b(?:revokeObjectURL|URL\.revokeObjectURL)\s*\(/g),
      rafScheduled: count(/\brequestAnimationFrame\s*\(/g),
      rafCancelled: count(/\bcancelAnimationFrame\s*\(/g),
    });
  }
}

for (const dir of scannedRoots) visit(resolve(root, dir));
files.sort((a, b) => a.path.localeCompare(b.path));
const flagged = files.filter((f) =>
  f.bytes >= 20_000 ||
  (f.listenersAdded > f.listenersRemoved && f.listenersAdded >= 3) ||
  (f.observersCreated > f.observersDisconnected) ||
  (f.intervalsCreated > f.intervalsCleared) ||
  (f.objectUrlsCreated > f.objectUrlsRevoked) ||
  (f.rafScheduled > 0 && f.rafCancelled === 0)
);
const summary = {
  disclaimer: "Read-only static inventory; counts are heuristic, not proven memory leaks or safe-to-delete code.",
  scannedRoots, totalFiles: files.length,
  jsxAndJs: files.filter(f => /\.(?:jsx?|tsx?|mjs)$/.test(f.path)).length,
  stylesheets: files.filter(f => f.path.endsWith(".css")).length,
  totalBytes: files.reduce((n, f) => n + f.bytes, 0),
  oversized: files.filter(f => f.bytes >= 20_000).sort((a,b)=>b.bytes-a.bytes).map(f => ({path:f.path,bytes:f.bytes})),
  riskReviewQueue: flagged.map(f => ({
    path: f.path, bytes: f.bytes,
    listeners: [f.listenersAdded, f.listenersRemoved],
    observers: [f.observersCreated, f.observersDisconnected],
    intervals: [f.intervalsCreated, f.intervalsCleared],
    objectUrls: [f.objectUrlsCreated, f.objectUrlsRevoked],
    animationFrames: [f.rafScheduled, f.rafCancelled]
  })),
};
if (process.argv.includes("--json")) console.log(JSON.stringify(summary, null, 2));
else {
  console.log(`PlotFlow read-only audit: ${summary.totalFiles} source files, ${summary.stylesheets} CSS, ${summary.totalBytes} bytes`);
  console.log(`Large modules (20 KB+): ${summary.oversized.length}; review candidates: ${summary.riskReviewQueue.length}`);
  for (const f of summary.riskReviewQueue.slice(0, 40)) console.log(`- ${f.path} (${f.bytes} bytes)`);
  console.log(summary.disclaimer);
}
