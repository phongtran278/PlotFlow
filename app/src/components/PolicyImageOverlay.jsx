import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const POLICY_IMAGE_BY_HANDOVER = {
  THO: "/assets/policy/policy-tho.png",
  GIAN_XAY: "/assets/policy/policy-gian-xay.png",
  HOAN_THIEN: "/assets/policy/policy-hoan-thien.png",
};

const POLICY_LABELS = {
  THO: "Bàn giao thô",
  GIAN_XAY: "Giàn xây",
  HOAN_THIEN: "Hoàn thiện",
};

// Exact visible span of the two amenity cards in PosterCanvasBase:
// amenity1 x=26..541, amenity2 x=553..1054 => combined span x=26..1054.
const TARGET_LEFT = 26;
const TARGET_RIGHT = 1054;
const TARGET_WIDTH = TARGET_RIGHT - TARGET_LEFT;

// The amenity row ends at y=1437+293=1730. The artboard ends at y=1920.
const FOOTER_TOP = 1730;
const FOOTER_BOTTOM = 1920;
const FOOTER_HEIGHT = FOOTER_BOTTOM - FOOTER_TOP;

const ALPHA_THRESHOLD = 8;
const STORAGE_KEY = "plotflow-policy-images-r2";
const boundsCache = new Map();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

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

function resolvePolicyKey(handover) {
  const key = normalizeHandover(handover);
  if (key.includes("HOAN_THIEN")) return "HOAN_THIEN";
  if (key.includes("GIAN_XAY") || key.includes("GIANXAY")) return "GIAN_XAY";
  if (key === "THO" || key.includes("BAN_GIAO_THO") || key.includes("TCBG_THO")) return "THO";
  return null;
}

export function resolvePolicyImage(handover) {
  const key = resolvePolicyKey(handover);
  return key ? POLICY_IMAGE_BY_HANDOVER[key] : null;
}

function readPolicySettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePolicySettings(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

function readPolicyEntry(key) {
  const saved = readPolicySettings()[key] || {};
  return {
    dataUrl: typeof saved.dataUrl === "string" ? saved.dataUrl : "",
    name: typeof saved.name === "string" ? saved.name : "",
    scale: clamp(saved.scale || 100, 70, 130),
    offsetY: clamp(saved.offsetY || 0, -120, 120),
  };
}

function savePolicyEntry(key, nextEntry) {
  const all = readPolicySettings();
  writePolicySettings({ ...all, [key]: nextEntry });
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

function layoutFromBounds(bounds, scalePercent, offsetY) {
  if (!bounds) return null;

  const visibleWidth = bounds.maxX - bounds.minX + 1;
  const visibleHeight = bounds.maxY - bounds.minY + 1;
  if (visibleWidth <= 0 || visibleHeight <= 0) return null;

  // 100% means the visible pixels exactly span the existing fixed horizontal target.
  // Size changes stay aspect-ratio locked and centered; there is intentionally no X control.
  const factor = clamp(scalePercent, 70, 130) / 100;
  const scale = (TARGET_WIDTH / visibleWidth) * factor;
  const scaledVisibleWidth = visibleWidth * scale;
  const scaledVisibleHeight = visibleHeight * scale;
  const visibleLeft = TARGET_LEFT + (TARGET_WIDTH - scaledVisibleWidth) / 2;
  const visibleTop = FOOTER_TOP + (FOOTER_HEIGHT - scaledVisibleHeight) / 2 + clamp(offsetY, -120, 120);

  return {
    left: visibleLeft - bounds.minX * scale,
    top: visibleTop - bounds.minY * scale,
    width: bounds.naturalWidth * scale,
  };
}

const cardStyle = {
  display: "grid",
  gap: 10,
  padding: 12,
  border: "1px solid rgba(15,23,42,.08)",
  borderRadius: 14,
  background: "#fff",
  boxShadow: "0 8px 24px rgba(15,23,42,.06)",
};

const buttonStyle = {
  appearance: "none",
  border: "1px solid rgba(15,23,42,.12)",
  borderRadius: 9,
  background: "#fff",
  color: "#24302d",
  font: "inherit",
  fontSize: 12,
  fontWeight: 700,
  padding: "7px 10px",
  cursor: "pointer",
};

export default function PolicyImageOverlay({ handover }) {
  const policyKey = resolvePolicyKey(handover);
  const defaultSrc = policyKey ? POLICY_IMAGE_BY_HANDOVER[policyKey] : null;
  const imageRef = useRef(null);
  const fileInputRef = useRef(null);
  const [controlsTarget, setControlsTarget] = useState(null);
  const [entry, setEntry] = useState(() => policyKey ? readPolicyEntry(policyKey) : { dataUrl: "", name: "", scale: 100, offsetY: 0 });
  const [measuredBySrc, setMeasuredBySrc] = useState({});
  const [status, setStatus] = useState("");

  const src = entry.dataUrl || defaultSrc;
  const measuredBounds = useMemo(() => measuredBySrc[src] || null, [measuredBySrc, src]);

  useLayoutEffect(() => {
    if (!policyKey) return;
    setEntry(readPolicyEntry(policyKey));
    setStatus("");
  }, [policyKey]);

  useLayoutEffect(() => {
    // Only the live Detail preview gets editor controls. Hidden export roots do not.
    const isLiveDetail = Boolean(imageRef.current?.closest?.(".round1-canvas"));
    setControlsTarget(isLiveDetail ? document.querySelector(".design-assignment-dock") : null);
  });

  if (!policyKey || !src) return null;

  function persist(patch) {
    const next = {
      ...entry,
      ...patch,
      scale: clamp(patch.scale ?? entry.scale, 70, 130),
      offsetY: clamp(patch.offsetY ?? entry.offsetY, -120, 120),
    };
    try {
      savePolicyEntry(policyKey, next);
      setEntry(next);
      return true;
    } catch {
      setStatus("Không lưu được ảnh. Hãy thử PNG nhẹ hơn.");
      return false;
    }
  }

  function handleLoad(event) {
    const image = event.currentTarget;
    const bounds = measureVisiblePixelBounds(image);
    if (!bounds) return;
    setMeasuredBySrc((prev) => ({ ...prev, [image.src]: bounds }));
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.type !== "image/png" && !file.name.toLowerCase().endsWith(".png")) {
      setStatus("Chỉ nhận PNG để giữ nền trong suốt.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) {
        setStatus("Không đọc được PNG này.");
        return;
      }
      if (persist({ dataUrl, name: file.name })) setStatus("Đã thay policy PNG.");
    };
    reader.onerror = () => setStatus("Không đọc được PNG này.");
    reader.readAsDataURL(file);
  }

  function useDefaultImage() {
    if (persist({ dataUrl: "", name: "" })) setStatus("Đã dùng lại ảnh mặc định.");
  }

  function resetPosition() {
    if (persist({ scale: 100, offsetY: 0 })) setStatus("Đã reset kích thước và vị trí.");
  }

  const measuredLayout = layoutFromBounds(measuredBounds, entry.scale, entry.offsetY);
  const factor = entry.scale / 100;
  const imageStyle = measuredLayout
    ? {
        position: "absolute",
        left: `${measuredLayout.left}px`,
        top: `${measuredLayout.top}px`,
        width: `${measuredLayout.width}px`,
      }
    : {
        position: "absolute",
        left: `${TARGET_LEFT + (TARGET_WIDTH - TARGET_WIDTH * factor) / 2}px`,
        top: `${FOOTER_TOP + entry.offsetY}px`,
        width: `${TARGET_WIDTH * factor}px`,
      };

  const editor = controlsTarget ? createPortal(
    <section style={cardStyle} aria-label="Policy image controls">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <span style={{ display: "block", fontSize: 10, fontWeight: 800, letterSpacing: ".08em", color: "#7b8582", textTransform: "uppercase" }}>Policy image</span>
          <strong style={{ display: "block", marginTop: 2, fontSize: 13, color: "#1f2927" }}>{POLICY_LABELS[policyKey]}</strong>
        </div>
        <img src={src} alt="" style={{ width: 96, height: 44, borderRadius: 9, border: "1px solid rgba(15,23,42,.08)", background: "#f5f7f6", objectFit: "contain" }} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={{ ...buttonStyle, background: "#17211f", color: "#fff", borderColor: "#17211f" }} onClick={() => fileInputRef.current?.click()}>Replace PNG</button>
        {entry.dataUrl && <button type="button" style={buttonStyle} onClick={useDefaultImage}>Use default</button>}
        <input ref={fileInputRef} type="file" accept="image/png,.png" hidden onChange={handleFileChange} />
      </div>

      <label style={{ display: "grid", gridTemplateColumns: "66px 1fr 42px", alignItems: "center", gap: 8, fontSize: 11, color: "#66716e" }}>
        <span>Size</span>
        <input type="range" min="70" max="130" step="1" value={entry.scale} onChange={(event) => persist({ scale: event.target.value })} style={{ width: "100%", accentColor: "#17211f" }} />
        <b style={{ textAlign: "right", color: "#303b38" }}>{entry.scale}%</b>
      </label>

      <label style={{ display: "grid", gridTemplateColumns: "66px 1fr 42px", alignItems: "center", gap: 8, fontSize: 11, color: "#66716e" }}>
        <span>Vertical</span>
        <input type="range" min="-120" max="120" step="2" value={entry.offsetY} onChange={(event) => persist({ offsetY: event.target.value })} style={{ width: "100%", accentColor: "#17211f" }} />
        <b style={{ textAlign: "right", color: "#303b38" }}>{entry.offsetY > 0 ? `+${entry.offsetY}` : entry.offsetY}</b>
      </label>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 10, color: "#7a8582" }}>{status || entry.name || "Ảnh mặc định"}</span>
        <button type="button" style={{ ...buttonStyle, padding: "5px 8px", fontSize: 10 }} onClick={resetPosition}>Reset position</button>
      </div>
    </section>,
    controlsTarget,
  ) : null;

  return (
    <>
      <img
        ref={imageRef}
        className="plotflow-policy-image"
        src={src}
        alt=""
        aria-hidden="true"
        draggable="false"
        onLoad={handleLoad}
        style={{
          ...imageStyle,
          height: "auto",
          maxWidth: "none",
          zIndex: 18,
          pointerEvents: "none",
          userSelect: "none",
          display: "block",
          margin: 0,
        }}
      />
      {editor}
    </>
  );
}
