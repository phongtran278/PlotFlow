import fs from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const forwardedArgs = process.argv.slice(2);
const generatedManifestPath = path.join(appDir, "public", "masterplan", "generated", "manifest.json");

function cliValue(flag) {
  const index = forwardedArgs.indexOf(flag);
  if (index < 0) return null;
  return forwardedArgs[index + 1] || null;
}

function completedPreparedManifestIsValid() {
  if (!fs.existsSync(generatedManifestPath)) return false;
  try {
    const manifest = JSON.parse(fs.readFileSync(generatedManifestPath, "utf8"));
    const lotCount = Object.keys(manifest?.lots || {}).length;
    const indexCount = Object.keys(manifest?.index || {}).length;
    const requestedSample = Number(cliValue("--sample") || 0);
    const requestedCodes = String(cliValue("--codes") || "")
      .split(/[\s,;]+/)
      .filter(Boolean).length;
    const expectedMinimum = requestedCodes || requestedSample || 1;
    return indexCount > 0 && lotCount >= expectedMinimum;
  } catch {
    return false;
  }
}

function run(script, args = [], { acceptPreparedCleanupFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, script), ...args], {
      cwd: appDir,
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${script} stopped by signal ${signal}`));
        return;
      }
      if (code !== 0) {
        if (acceptPreparedCleanupFailure && completedPreparedManifestIsValid()) {
          console.warn("△ Preparation assets and manifest are complete; ignoring PDF.js cleanup-only exit and continuing.");
          resolve();
          return;
        }
        reject(new Error(`${script} exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

try {
  await run("prepare-masterplan.mjs", forwardedArgs, { acceptPreparedCleanupFailure: true });
  await run("generate-page-tiles.mjs");
} catch (error) {
  console.error(`✕ ${error.message || error}`);
  process.exit(1);
}
