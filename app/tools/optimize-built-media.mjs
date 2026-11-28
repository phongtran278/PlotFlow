import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Run only on app/dist after Vite has copied the source images.
// Never modify assets/ originals or the masterplan tile pyramid.
const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(appDir, 'dist');
const types = ['houses', 'amenities', 'houses_optimized', 'library/houses', 'library/amenities'];
const imageExt = /\.(png|jpe?g|webp)$/i;
const limitBytes = 25 * 1024 * 1024;
const maxWidth = Number(process.env.PLOTFLOW_MEDIA_MAX_WIDTH || 3200);
const maxPixels = 100_000_000;
const targetBytes = Math.round(Number(process.env.PLOTFLOW_MEDIA_TARGET_MIB || 2.5) * 1024 * 1024);
const dryRun = process.argv.includes('--dry-run');
// Staging preserves every in-limit image. Explicit non-staging optimization can still use a smaller target.
const optimizeThreshold = process.env.PLOTFLOW_MEDIA_ONLY_OVERSIZED === '1' || !process.env.PLOTFLOW_MEDIA_TARGET_MIB ? limitBytes : targetBytes;
if (!Number.isInteger(maxWidth) || maxWidth < 400 || maxWidth > 8192 || !Number.isFinite(targetBytes) || targetBytes < 64 * 1024 || targetBytes > limitBytes) {
  throw new Error('Invalid PLOTFLOW_MEDIA_MAX_WIDTH or PLOTFLOW_MEDIA_TARGET_MIB');
}

const images = [];
function collect(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) collect(file);
    else if (item.isFile() && imageExt.test(item.name)) images.push(file);
  }
}
for (const group of types) collect(path.join(dist, 'assets', group));
if (!fs.existsSync(dist)) throw new Error('Missing app/dist; run npm run build first.');
images.sort();
const report = { scanned: images.length, optimized: 0, unchanged: 0, failed: [], bytesBefore: 0, bytesAfter: 0, entries: [], sourcePreserved: true, mode: dryRun ? 'dry-run' : 'optimize' };
let sharp;
if (!dryRun && images.some(file => fs.statSync(file).size > optimizeThreshold)) {
  try { ({ default: sharp } = await import('sharp')); }
  catch { throw new Error('Image optimizer requires sharp. Install it in the build environment before enabling this step.'); }
  sharp.cache(false);
  sharp.concurrency(1);
}

for (const file of images) {
  const name = path.relative(dist, file).split(path.sep).join('/');
  const before = fs.statSync(file).size;
  report.bytesBefore += before;
  if (dryRun) {
    report.bytesAfter += before;
    report.entries.push({ path: name, inputBytes: before, action: before > optimizeThreshold ? 'would-optimize' : 'within-limit' });
    continue;
  }
  if (before <= optimizeThreshold) {
    report.unchanged++;
    report.bytesAfter += before;
    report.entries.push({ path: name, inputBytes: before, outputBytes: before, optimized: false, skippedReason: 'within-cloudflare-limit', exceedsCloudflareLimit: false });
    continue;
  }
  const ext = path.extname(file).toLowerCase();
  let smallest = null;
  let failReason = null;
  // Limit each process to one input image at a time; avoid loading entire library in memory.
  try {
    const metadata = await sharp(file, { sequentialRead: true, limitInputPixels: maxPixels }).metadata();
    const width = Math.max(Number(metadata.width || 0), Number(metadata.height || 0));
    if (!width || (metadata.pages || 1) > 1) throw new Error('Unsupported image dimensions or animated image');
    const alpha = Boolean(metadata.hasAlpha);
    const widths = [...new Set([Math.min(width, maxWidth), Math.min(maxWidth, 2400), Math.min(maxWidth, 1600), Math.min(maxWidth, 1200)].filter(w => w <= width && w >= 400))];
    for (const w of widths) {
      for (const quality of [86, 76, 66]) {
        let pipeline = sharp(file, { sequentialRead: true, limitInputPixels: maxPixels })
          .rotate().resize({ width: w, height: w, fit: 'inside', withoutEnlargement: true });
        if (ext === '.png') {
          // Preserve transparency and file extension/URL; no silent JPEG conversion.
          pipeline = pipeline.png({ palette: false, compressionLevel: 9, effort: 5 });
        } else if (ext === '.webp') {
          pipeline = pipeline.webp({ quality, effort: 4, alphaQuality: alpha ? 95 : undefined });
        } else {
          pipeline = pipeline.jpeg({ quality, mozjpeg: true });
        }
        const output = await pipeline.toBuffer();
        if (!smallest || output.length < smallest.length) smallest = output;
        if (output.length <= targetBytes) break;
        // PNG is lossless for a fixed width, do not waste time trying other quality values.
        if (ext === '.png') break;
      }
      if (smallest?.length <= targetBytes) break;
    }
    if (smallest && smallest.length < before) {
      const outputMeta = await sharp(smallest, { limitInputPixels: maxPixels }).metadata();
      if (outputMeta.format !== metadata.format || (alpha && !outputMeta.hasAlpha)) throw new Error('Output format or alpha channel was not preserved');
      // Atomic replacement in dist only. Never modify the original project assets.
      const tmp = file + '.plotflow-tmp';
      try {
        fs.writeFileSync(tmp, smallest);
        fs.renameSync(tmp, file);
      } finally {
        if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      }
      report.optimized++;
    } else {
      report.unchanged++;
    }
  } catch (error) {
    failReason = String(error?.message || error);
    report.failed.push({ path: name, error: failReason });
  }
  const after = fs.statSync(file).size;
  report.bytesAfter += after;
  report.entries.push({ path: name, inputBytes: before, outputBytes: after, optimized: after < before, transparent: ext === '.png' ? 'format-preserved' : undefined, exceedsCloudflareLimit: after > limitBytes, error: failReason });
  console.log(`[media] ${name} ${(before / 1048576).toFixed(2)} -> ${(after / 1048576).toFixed(2)} MiB${failReason ? ' FAILED: '+failReason : ''}`);
}
const reportPath = path.join(appDir, 'media-optimization-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(`[media] ${report.optimized} optimized; ${report.failed.length} failures; output ${reportPath}`);
if (!dryRun && (report.failed.length || report.entries.some(x => x.exceedsCloudflareLimit))) {
  // Fail closed instead of silently dropping images from a published build.
  process.exitCode = 1;
}
