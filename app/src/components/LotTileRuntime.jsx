import { useEffect } from "react";

const MANIFEST_URL = "/masterplan/generated/manifest.json";
let manifestPromise = null;

function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .catch(() => null);
  }
  return manifestPromise;
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
}

function chooseLevel(levels = [], zoom = 100) {
  if (!levels.length) return null;
  const targetWidth = zoom <= 150 ? 640 : zoom <= 400 ? 1280 : 2168;
  return levels.reduce((best, level) => {
    if (!best) return level;
    const a = Math.abs(Number(level.width || 0) - targetWidth);
    const b = Math.abs(Number(best.width || 0) - targetWidth);
    return a < b ? level : best;
  }, null);
}

function parseCamera(scene, controls) {
  const zoomInput = controls?.querySelector('input[type="number"]');
  const zoom = Math.max(100, Number(zoomInput?.value || 100));
  const transform = String(scene?.style?.transform || "");
  const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/);
  return {
    zoom,
    panX: match ? Number(match[1]) || 0 : 0,
    panY: match ? Number(match[2]) || 0 : 0,
  };
}

function visibleRect(viewport, camera) {
  const rect = viewport.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const scale = Math.max(1, camera.zoom / 100);
  const left = 0.5 + (0 - camera.panX - width * 0.5) / (scale * width);
  const right = 0.5 + (width - camera.panX - width * 0.5) / (scale * width);
  const top = 0.5 + (0 - camera.panY - height * 0.5) / (scale * height);
  const bottom = 0.5 + (height - camera.panY - height * 0.5) / (scale * height);
  return {
    left: Math.max(0, Math.min(1, left)),
    right: Math.max(0, Math.min(1, right)),
    top: Math.max(0, Math.min(1, top)),
    bottom: Math.max(0, Math.min(1, bottom)),
  };
}

function clearTileLayer(layer) {
  if (!layer) return;
  layer.querySelectorAll("img").forEach((img) => {
    try { img.src = ""; } catch {}
  });
  layer.replaceChildren();
}

function hideOriginalImage(scene) {
  const original = scene?.querySelector(":scope > img");
  if (!original) return null;
  if (!original.dataset.plotflowOriginalSrc) original.dataset.plotflowOriginalSrc = original.currentSrc || original.src || "";
  original.style.display = "none";
  try { original.src = ""; } catch {}
  return original;
}

function restoreOriginalImage(original) {
  if (!original) return;
  const src = original.dataset.plotflowOriginalSrc;
  if (src) original.src = src;
  original.style.display = "";
}

export default function LotTileRuntime() {
  useEffect(() => {
    const root = document.getElementById("root") || document.body;
    let editorObserver = null;
    let raf = null;
    let currentEditor = null;
    let currentLayer = null;
    let originalImage = null;
    let currentSignature = "";
    let resizeObserver = null;
    let cameraObserver = null;
    let controlsListener = null;

    function teardownEditor({ restore = false } = {}) {
      if (raf != null) cancelAnimationFrame(raf);
      raf = null;
      resizeObserver?.disconnect();
      cameraObserver?.disconnect();
      if (controlsListener) controlsListener.node?.removeEventListener("input", controlsListener.handler, true);
      resizeObserver = null;
      cameraObserver = null;
      controlsListener = null;
      clearTileLayer(currentLayer);
      currentLayer?.remove();
      currentLayer = null;
      if (restore) restoreOriginalImage(originalImage);
      originalImage = null;
      currentEditor = null;
      currentSignature = "";
    }

    async function bindEditor(editor) {
      teardownEditor();
      currentEditor = editor;
      const scene = editor.querySelector(".lot-canvas-scene");
      const viewport = editor.querySelector(".lot-canvas-viewport");
      const controls = editor.querySelector(".lot-view-controls");
      const code = normalizeCode(editor.querySelector(".lot-editor-header h2")?.textContent);
      if (!scene || !viewport || !code) return;

      const manifest = await loadManifest();
      if (currentEditor !== editor) return;
      const tileSpec = manifest?.lots?.[code]?.tiles;
      if (!tileSpec?.levels?.length) return;

      originalImage = hideOriginalImage(scene);
      currentLayer = document.createElement("div");
      currentLayer.className = "lot-tile-layer runtime-tile-layer";
      scene.insertBefore(currentLayer, scene.firstChild);

      const update = () => {
        raf = null;
        if (!currentEditor?.isConnected || !currentLayer?.isConnected) return;
        const camera = parseCamera(scene, controls);
        const level = chooseLevel(tileSpec.levels, camera.zoom);
        if (!level) return;
        const rect = visibleRect(viewport, camera);
        const cols = Math.max(1, Number(level.cols || 1));
        const rows = Math.max(1, Number(level.rows || 1));
        const overscan = 1;
        const x0 = Math.max(0, Math.floor(rect.left * cols) - overscan);
        const x1 = Math.min(cols - 1, Math.floor(Math.max(0, rect.right - Number.EPSILON) * cols) + overscan);
        const y0 = Math.max(0, Math.floor(rect.top * rows) - overscan);
        const y1 = Math.min(rows - 1, Math.floor(Math.max(0, rect.bottom - Number.EPSILON) * rows) + overscan);
        const entries = [];
        for (let y = y0; y <= y1; y += 1) {
          for (let x = x0; x <= x1; x += 1) entries.push({ x, y });
        }
        const limited = entries.slice(0, 20);
        const signature = `${level.width}:${limited.map((item) => `${item.x},${item.y}`).join("|")}`;
        if (signature === currentSignature) return;
        currentSignature = signature;
        clearTileLayer(currentLayer);

        const fragment = document.createDocumentFragment();
        for (const { x, y } of limited) {
          const img = document.createElement("img");
          img.alt = "";
          img.decoding = "async";
          img.loading = "eager";
          img.draggable = false;
          img.src = `${tileSpec.base}/${level.width}/${x}_${y}.webp`;
          const left = (x * level.tileSize / level.width) * 100;
          const top = (y * level.tileSize / level.height) * 100;
          const width = (Math.min(level.tileSize, level.width - x * level.tileSize) / level.width) * 100;
          const height = (Math.min(level.tileSize, level.height - y * level.tileSize) / level.height) * 100;
          Object.assign(img.style, {
            position: "absolute",
            left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`,
            objectFit: "fill", pointerEvents: "none", userSelect: "none",
          });
          fragment.appendChild(img);
        }
        currentLayer.appendChild(fragment);
      };

      const schedule = () => {
        if (raf != null) return;
        raf = requestAnimationFrame(update);
      };

      resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
      resizeObserver?.observe(viewport);
      cameraObserver = new MutationObserver(schedule);
      cameraObserver.observe(scene, { attributes: true, attributeFilter: ["style"] });
      const handler = schedule;
      controls?.addEventListener("input", handler, true);
      controlsListener = controls ? { node: controls, handler } : null;
      schedule();
    }

    function scan() {
      const editor = document.querySelector(".lot-editor-shell");
      if (!editor) {
        if (currentEditor) teardownEditor();
        return;
      }
      if (editor !== currentEditor) bindEditor(editor);
    }

    editorObserver = new MutationObserver(scan);
    editorObserver.observe(root, { childList: true, subtree: true });
    scan();

    return () => {
      editorObserver?.disconnect();
      teardownEditor({ restore: true });
    };
  }, []);

  return null;
}
