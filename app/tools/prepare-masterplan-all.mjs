import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appDir = path.resolve(__dirname, "..");
const forwardedArgs = process.argv.slice(2);

function run(script, args = []) {
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
        reject(new Error(`${script} exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

try {
  await run("prepare-masterplan.mjs", forwardedArgs);
  await run("generate-page-tiles.mjs");
} catch (error) {
  console.error(`✕ ${error.message || error}`);
  process.exit(1);
}
