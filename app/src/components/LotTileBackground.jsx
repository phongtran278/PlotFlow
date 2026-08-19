import { useEffect, useMemo, useState } from "react";

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

function chooseLevel(levels = [], zoom = 100) {
  if (!levels.length) return null;
  const targetWidth = zoom <= 150 ? 640 : zoom <= 400 ? 1280 : 2168;
  return levels.reduce((best, level) => {
    if (!best) return level;
    return Math.abs(Number(level.width || 0) - targetWidth) < Math.abs(Number(best.width || 0) - targetWidth) ? level : best;
  }, null);
}

function visibleNormalizedRect(viewport, zoom, pan) {
  const scale = Math.max(1, Number(zoom || 100) / 100);
  const width = Math.max(1, viewport.width || 1);
  const height = Math.max(1, viewport.height || 1);
  const left = 0.5 + (0 - (pan?.x || 0) - width * 0.5) / (scale * width);
  const right = 0.5 + (width - (pan?.x || 0) - width * 0.5) / (scale * width);
  const top = 0.5 + (0 - (pan?.y || 0) - height * 0.5) / (scale * height);
  const bottom = 0.5 + (height - (pan?.y || 0) - height * 0.5) / (scale * height);
  return {
    left: Math.max(0, Math.min(1, left)),
    right: Math.max(0, Math.min(1, right)),
    top: Math.max(0, Math.min(1, top)),
    bottom: Math.max(0, Math.min(1, bottom)),
  };
}

export default function LotTileBackground({ unitCode, zoom, pan, viewportRef, fallbackSrc }) {
  const [tileSpec, setTileSpec] = useState(null);
  const [viewport, setViewport] = useState({ width: 960, height: 664 });

  useEffect(() => {
    let cancelled = false;
    loadManifest().then((manifest) => {
      if (cancelled) return;
      const code = String(unitCode || "").trim().toUpperCase().replace(/\s+/g, "");
      setTileSpec(manifest?.lots?.[code]?.tiles || null);
    });
    return () => { cancelled = true; };
  }, [unitCode]);

  useEffect(() => {
    const node = viewportRef?.current;
    if (!node) return undefined;
    const update = () => {
      const rect = node.getBoundingClientRect();
      if (rect.width && rect.height) setViewport({ width: rect.width, height: rect.height });
    };
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(node);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [viewportRef]);

  const level = useMemo(() => chooseLevel(tileSpec?.levels || [], zoom), [tileSpec, zoom]);
  const visibleTiles = useMemo(() => {
    if (!level) return [];
    const rect = visibleNormalizedRect(viewport, zoom, pan);
    const cols = Math.max(1, Number(level.cols || 1));
    const rows = Math.max(1, Number(level.rows || 1));
    const overscan = 1;
    const x0 = Math.max(0, Math.floor(rect.left * cols) - overscan);
    const x1 = Math.min(cols - 1, Math.floor(Math.max(0, rect.right - Number.EPSILON) * cols) + overscan);
    const y0 = Math.max(0, Math.floor(rect.top * rows) - overscan);
    const y1 = Math.min(rows - 1, Math.floor(Math.max(0, rect.bottom - Number.EPSILON) * rows) + overscan);
    const result = [];
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) result.push({ x, y });
    }
    return result.slice(0, 20);
  }, [level, viewport, zoom, pan?.x, pan?.y]);

  if (!level || !visibleTiles.length) {
    return fallbackSrc ? <img src={fallbackSrc} alt="Floorplan crop" draggable="false" /> : <div className="lot-empty">Floorplan chưa được render.</div>;
  }

  return (
    <div className="lot-tile-layer" aria-hidden="true">
      {visibleTiles.map(({ x, y }) => {
        const left = (x * level.tileSize / level.width) * 100;
        const top = (y * level.tileSize / level.height) * 100;
        const width = (Math.min(level.tileSize, level.width - x * level.tileSize) / level.width) * 100;
        const height = (Math.min(level.tileSize, level.height - y * level.tileSize) / level.height) * 100;
        return (
          <img
            key={`${level.width}-${x}-${y}`}
            src={`${tileSpec.base}/${level.width}/${x}_${y}.webp`}
            alt=""
            draggable="false"
            decoding="async"
            style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}
