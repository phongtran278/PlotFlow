import { useMemo, useState } from "react";

const POLICY_IMAGE_BY_HANDOVER = {
  THO: "/assets/policy/policy-tho.png",
  GIAN_XAY: "/assets/policy/policy-gian-xay.png",
  HOAN_THIEN: "/assets/policy/policy-hoan-thien.png",
};

// Match the exact combined span of the two amenity cards in PosterCanvasBase:
// amenity1 x=26..541, amenity2 x=553..1054 => real combined span x=26..1054.
const TARGET_LEFT = 26;
const TARGET_RIGHT = 1054;
const TARGET_WIDTH = TARGET_RIGHT - TARGET_LEFT;
const TARGET_BOTTOM = 1912; // 8px safe margin from the 1920px artboard bottom.
const ALPHA_THRESHOLD = 8;
const boundsCache = new Map();

function normalizeHandover(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function resolvePolicyImage(handover) {
  const key = normalizeHandover(handover);
  if (key.includes("HOAN_THIEN")) return POLICY_IMAGE_BY_HANDOVER.HOAN_THIEN;
  if (key.includes("GIAN_XAY") || key.includes("GIANXAY")) return POLICY_IMAGE_BY_HANDOVER.GIAN_XAY;
  if (key === "THO" || key.includes("BAN_GIAO_THO") || key.includes("TCBG_THO")) return POLICY_IMAGE_BY_HANDOVER.THO;
  return null;
}

function measureVisiblePixelBounds(image) {
  if (!image?.naturalWidth || !image?.naturalHeight) return null;
  const cached = boundsCache.get(image.src);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);

  let pixels;
  try {
    pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    return null;
  }

  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < canvas.height; y += 1) {
    const row = y * canvas.width * 4;
    for (let x = 0; x < canvas.width; x += 1) {
      const alpha = pixels[row + x * 4 + 3];
      if (alpha <= ALPHA_THRESHOLD) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;

  const bounds = {
    minX,
    minY,
    maxX,
    maxY,
    naturalWidth: canvas.width,
    naturalHeight: canvas.height,
  };
  boundsCache.set(image.src, bounds);
  return bounds;
}

function layoutFromBounds(bounds) {
  if (!bounds) return null;
  const visibleWidth = bounds.maxX - bounds.minX + 1;
  if (visibleWidth <= 0) return null;

  const scale = TARGET_WIDTH / visibleWidth;
  return {
    left: TARGET_LEFT - bounds.minX * scale,
    top: TARGET_BOTTOM - (bounds.maxY + 1) * scale,
    width: bounds.naturalWidth * scale,
  };
}

export default function PolicyImageOverlay({ handover }) {
  const src = resolvePolicyImage(handover);
  const [measuredBySrc, setMeasuredBySrc] = useState({});

  const measuredLayout = useMemo(() => measuredBySrc[src] || null, [measuredBySrc, src]);
  if (!src) return null;

  function handleLoad(event) {
    const image = event.currentTarget;
    const bounds = measureVisiblePixelBounds(image);
    const nextLayout = layoutFromBounds(bounds);
    if (!nextLayout) return;
    setMeasuredBySrc((prev) => ({ ...prev, [src]: nextLayout }));
  }

  const style = measuredLayout
    ? {
        position: "absolute",
        left: `${measuredLayout.left}px`,
        top: `${measuredLayout.top}px`,
        width: `${measuredLayout.width}px`,
      }
    : {
        // Stable fallback for the first paint; replaced immediately after image load.
        position: "absolute",
        left: `${TARGET_LEFT}px`,
        bottom: "8px",
        width: `${TARGET_WIDTH}px`,
      };

  return (
    <img
      className="plotflow-policy-image"
      src={src}
      alt=""
      aria-hidden="true"
      draggable="false"
      onLoad={handleLoad}
      style={{
        ...style,
        height: "auto",
        maxWidth: "none",
        zIndex: 18,
        pointerEvents: "none",
        userSelect: "none",
        display: "block",
        margin: 0,
      }}
    />
  );
}
