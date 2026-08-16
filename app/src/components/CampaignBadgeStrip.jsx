import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "plotflow-campaign-badges-v1";
const ARTBOARD_WIDTH = 1080;
const DEFAULT_TOP = 0;
const DEFAULT_GAP = 18;
const DEFAULT_VISIBLE_HEIGHT = 156;
const ALPHA_THRESHOLD = 8;

const BADGES = [
  { id: "hotdeal", name: "Hot Deal", src: "/assets/badges/hotdeal.png", enabled: true },
  { id: "veosom", name: "Về ở sớm", src: "/assets/badges/veosom.png", enabled: false },
  { id: "gold1", name: "Tặng 1 chỉ vàng", src: "/assets/badges/1 chỉ.png", enabled: false },
  { id: "gold3", name: "Tặng 3 chỉ vàng", src: "/assets/badges/3 chỉ.png", enabled: false },
  { id: "gold5", name: "Tặng 5 chỉ vàng", src: "/assets/badges/5 chỉ.png", enabled: false },
  { id: "gold6", name: "Tặng 6 chỉ vàng", src: "/assets/badges/6 chỉ.png", enabled: false },
  { id: "gold9", name: "Tặng 9 chỉ vàng", src: "/assets/badges/9 chỉ.png", enabled: false },
];

const pixelBoundsCache = new Map();

function defaultConfig() {
  return {
    gap: DEFAULT_GAP,
    visibleHeight: DEFAULT_VISIBLE_HEIGHT,
    badges: BADGES.map((badge, index) => ({
      id: badge.id,
      enabled: badge.enabled,
      order: index,
      scale: 1,
    })),
  };
}

function readConfig() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!raw || !Array.isArray(raw.badges)) return defaultConfig();
    const defaults = defaultConfig();
    const byId = new Map(raw.badges.map((item) => [item.id, item]));
    return {
      gap: Number.isFinite(Number(raw.gap)) ? Math.max(0, Number(raw.gap)) : defaults.gap,
      visibleHeight: Number.isFinite(Number(raw.visibleHeight)) ? Math.max(60, Number(raw.visibleHeight)) : defaults.visibleHeight,
      badges: defaults.badges.map((fallback) => {
        const saved = byId.get(fallback.id) || {};
        return {
          id: fallback.id,
          enabled: typeof saved.enabled === "boolean" ? saved.enabled : fallback.enabled,
          order: Number.isFinite(Number(saved.order)) ? Number(saved.order) : fallback.order,
          scale: Number.isFinite(Number(saved.scale)) ? Math.max(0.4, Math.min(2.2, Number(saved.scale))) : 1,
        };
      }),
    };
  } catch {
    return defaultConfig();
  }
}

function saveConfig(config) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent("plotflow-campaign-badges-updated", { detail: config }));
  } catch {
    // localStorage is optional.
  }
}

function measureVisibleBounds(image) {
  if (!image?.naturalWidth || !image?.naturalHeight) return null;
  const cached = pixelBoundsCache.get(image.src);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);

  let data;
  try {
    data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
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
      if (data[row + x * 4 + 3] <= ALPHA_THRESHOLD) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;
  const result = {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    naturalWidth: canvas.width,
    naturalHeight: canvas.height,
  };
  pixelBoundsCache.set(image.src, result);
  return result;
}

function paintedImageBox(img, artboard) {
  if (!img || !artboard || !img.naturalWidth || !img.naturalHeight) return null;
  const artRect = artboard.getBoundingClientRect();
  const rect = img.getBoundingClientRect();
  if (!artRect.width || !rect.width || !rect.height) return null;
  const artScale = artRect.width / ARTBOARD_WIDTH;
  const box = {
    x: (rect.left - artRect.left) / artScale,
    y: (rect.top - artRect.top) / artScale,
    width: rect.width / artScale,
    height: rect.height / artScale,
  };

  const fit = getComputedStyle(img).objectFit || "fill";
  if (fit !== "contain") return box;

  const naturalRatio = img.naturalWidth / img.naturalHeight;
  const boxRatio = box.width / box.height;
  if (naturalRatio > boxRatio) {
    const paintedHeight = box.width / naturalRatio;
    return { x: box.x, y: box.y + (box.height - paintedHeight) / 2, width: box.width, height: paintedHeight };
  }
  const paintedWidth = box.height * naturalRatio;
  return { x: box.x + (box.width - paintedWidth) / 2, y: box.y, width: paintedWidth, height: box.height };
}

function measureVisibleLogoLeft(artboard) {
  const img = artboard?.querySelector(".poster-logo img");
  if (!img?.complete || !img.naturalWidth) return 28;
  const bounds = measureVisibleBounds(img);
  const box = paintedImageBox(img, artboard);
  if (!bounds || !box) return 28;
  return box.x + (bounds.minX / bounds.naturalWidth) * box.width;
}

function orderedConfigBadges(config) {
  return [...config.badges].sort((a, b) => a.order - b.order);
}

export default function CampaignBadgeStrip({
  artboard,
  quickControlsTarget,
  isEditing = false,
  quickPinMode = false,
  pinVisible = false,
  onToggleQuickPin,
}) {
  const [config, setConfig] = useState(readConfig);
  const [boundsById, setBoundsById] = useState({});
  const [logoVisibleLeft, setLogoVisibleLeft] = useState(28);
  const imageRefs = useRef({});

  useEffect(() => {
    const sync = (event) => setConfig(event?.detail || readConfig());
    window.addEventListener("plotflow-campaign-badges-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("plotflow-campaign-badges-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Hide the obsolete BADGES block from the old assignment UI. CampaignBadgeStrip
  // is now the only badge control surface, so the dock stays clean and non-duplicated.
  useEffect(() => {
    if (!quickControlsTarget) return;
    const legacy = quickControlsTarget.querySelector(".dock-badges");
    if (!legacy) return;
    const previous = legacy.style.display;
    legacy.style.display = "none";
    return () => { legacy.style.display = previous; };
  }, [quickControlsTarget]);

  useLayoutEffect(() => {
    if (!artboard) return;
    const update = () => setLogoVisibleLeft(measureVisibleLogoLeft(artboard));
    update();
    const logoImg = artboard.querySelector(".poster-logo img");
    logoImg?.addEventListener("load", update);
    window.addEventListener("resize", update);
    return () => {
      logoImg?.removeEventListener("load", update);
      window.removeEventListener("resize", update);
    };
  }, [artboard]);

  function commit(next) {
    setConfig(next);
    saveConfig(next);
  }

  function patchBadge(id, patch) {
    commit({
      ...config,
      badges: config.badges.map((item) => item.id === id ? { ...item, ...patch } : item),
    });
  }

  function moveBadge(id, direction) {
    const ordered = orderedConfigBadges(config);
    const index = ordered.findIndex((item) => item.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    const swapped = [...ordered];
    [swapped[index], swapped[nextIndex]] = [swapped[nextIndex], swapped[index]];
    commit({
      ...config,
      badges: config.badges.map((item) => ({
        ...item,
        order: swapped.findIndex((entry) => entry.id === item.id),
      })),
    });
  }

  function handleLoad(id, event) {
    const image = event.currentTarget;
    imageRefs.current[id] = image;
    const bounds = measureVisibleBounds(image);
    if (!bounds) return;
    setBoundsById((prev) => ({ ...prev, [id]: bounds }));
    if (artboard) setLogoVisibleLeft(measureVisibleLogoLeft(artboard));
  }

  const ordered = useMemo(() => orderedConfigBadges(config), [config]);
  const active = useMemo(() => ordered
    .filter((item) => item.enabled)
    .map((item) => ({ ...item, asset: BADGES.find((badge) => badge.id === item.id) }))
    .filter((item) => item.asset), [ordered]);

  const layouts = useMemo(() => {
    const ready = active.every((item) => boundsById[item.id]);
    if (!ready || !active.length) return {};

    const measured = active.map((item) => {
      const bounds = boundsById[item.id];
      const visibleHeight = config.visibleHeight * item.scale;
      const renderScale = visibleHeight / bounds.height;
      return {
        ...item,
        bounds,
        renderScale,
        visibleWidth: bounds.width * renderScale,
      };
    });

    const totalVisibleWidth = measured.reduce((sum, item) => sum + item.visibleWidth, 0)
      + Math.max(0, measured.length - 1) * config.gap;
    const rightVisibleEdge = ARTBOARD_WIDTH - Math.max(0, logoVisibleLeft);
    let visibleCursor = rightVisibleEdge - totalVisibleWidth;
    const next = {};

    measured.forEach((item) => {
      next[item.id] = {
        left: visibleCursor - item.bounds.minX * item.renderScale,
        top: DEFAULT_TOP - item.bounds.minY * item.renderScale,
        width: item.bounds.naturalWidth * item.renderScale,
        height: item.bounds.naturalHeight * item.renderScale,
      };
      visibleCursor += item.visibleWidth + config.gap;
    });
    return next;
  }, [active, boundsById, config.gap, config.visibleHeight, logoVisibleLeft]);

  const quickControls = !isEditing && quickControlsTarget ? createPortal(
    <div style={{ display: "grid", gap: 12, padding: "12px 0 2px", borderTop: "1px solid rgba(20,24,33,.10)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: ".12em", opacity: .58 }}>CAMPAIGN TABS</div>
          <strong style={{ fontSize: 13 }}>Quick Arrange</strong>
        </div>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11, opacity: .72 }}>
          <span>Gap</span>
          <input
            type="number"
            min="0"
            max="120"
            value={config.gap}
            onChange={(event) => commit({ ...config, gap: Math.max(0, Number(event.target.value) || 0) })}
            style={{ width: 58 }}
          />
          <span>px</span>
        </label>
      </div>

      <div style={{ display: "grid", gap: 7 }}>
        {ordered.map((item) => {
          const asset = BADGES.find((badge) => badge.id === item.id);
          if (!asset) return null;
          return (
            <div key={item.id} style={{
              display: "grid",
              gridTemplateColumns: "minmax(96px,1fr) 28px 28px minmax(86px,1fr) 42px",
              gap: 5,
              alignItems: "center",
              padding: "6px 7px",
              border: item.enabled ? "1px solid rgba(20,95,255,.32)" : "1px solid rgba(20,24,33,.10)",
              borderRadius: 9,
              background: item.enabled ? "rgba(20,95,255,.05)" : "transparent",
            }}>
              <button
                type="button"
                onClick={() => patchBadge(item.id, { enabled: !item.enabled })}
                style={{ padding: "6px 7px", borderRadius: 7, fontWeight: item.enabled ? 700 : 500 }}
              >{item.enabled ? "✓ " : "+ "}{asset.name}</button>
              <button type="button" onClick={() => moveBadge(item.id, -1)} title="Đưa tab sang trái">←</button>
              <button type="button" onClick={() => moveBadge(item.id, 1)} title="Đưa tab sang phải">→</button>
              <input
                type="range"
                min="50"
                max="180"
                step="1"
                value={Math.round(item.scale * 100)}
                onChange={(event) => patchBadge(item.id, { scale: Number(event.target.value) / 100 })}
                title="Phóng to / thu nhỏ tab"
              />
              <strong style={{ fontSize: 10, textAlign: "right" }}>{Math.round(item.scale * 100)}%</strong>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gap: 6, paddingTop: 3 }}>
        <button
          type="button"
          onClick={onToggleQuickPin}
          disabled={!pinVisible}
          style={{
            padding: "9px 10px",
            borderRadius: 9,
            fontWeight: 700,
            background: quickPinMode ? "#145fff" : undefined,
            color: quickPinMode ? "white" : undefined,
          }}
        >{quickPinMode ? "✓ Done arranging 3D Pin" : "✥ Arrange 3D Pin on poster"}</button>
        <small style={{ opacity: .58, lineHeight: 1.4 }}>
          {pinVisible
            ? "Bật Arrange Pin rồi kéo trực tiếp trên poster. Dùng zoom preview phía trên để đặt pin chính xác; kéo chấm góc để đổi kích thước."
            : "Bật Show 3D Pin trước để đặt vị trí."}
        </small>
      </div>
    </div>,
    quickControlsTarget
  ) : null;

  return (
    <>
      {BADGES.map((asset) => {
        const item = config.badges.find((badge) => badge.id === asset.id);
        const layout = layouts[asset.id];
        const shouldRender = Boolean(item?.enabled);
        return (
          <img
            key={asset.id}
            ref={(node) => { if (node) imageRefs.current[asset.id] = node; }}
            src={asset.src}
            alt=""
            aria-hidden="true"
            draggable="false"
            onLoad={(event) => handleLoad(asset.id, event)}
            style={{
              position: "absolute",
              left: layout ? `${layout.left}px` : "-10000px",
              top: layout ? `${layout.top}px` : "-10000px",
              width: layout ? `${layout.width}px` : "1px",
              height: layout ? `${layout.height}px` : "1px",
              maxWidth: "none",
              display: shouldRender ? "block" : "none",
              pointerEvents: "none",
              userSelect: "none",
              zIndex: 19,
            }}
          />
        );
      })}
      {quickControls}
    </>
  );
}
