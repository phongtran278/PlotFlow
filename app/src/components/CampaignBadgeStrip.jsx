import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "plotflow-campaign-badges-by-unit-v2";
const ARTBOARD_WIDTH = 1080;
const DEFAULT_TOP = 0;
const DEFAULT_GAP = 18;
const DEFAULT_VISIBLE_HEIGHT = 156;
const ALPHA_THRESHOLD = 8;

const BADGES = [
  { id: "hotdeal", name: "Hot Deal", src: "/assets/ui/badge_hotdeal.png", enabled: false },
  { id: "veosom", name: "Về ở sớm", src: "/assets/ui/badge_veosom.png", enabled: false },
  { id: "gold1", name: "Tặng 1 chỉ vàng", shortName: "1 chỉ vàng", src: "/assets/badges/1%20ch%E1%BB%89.png", enabled: false },
  { id: "gold3", name: "Tặng 3 chỉ vàng", shortName: "3 chỉ vàng", src: "/assets/badges/3%20ch%E1%BB%89.png", enabled: false },
  { id: "gold5", name: "Tặng 5 chỉ vàng", shortName: "5 chỉ vàng", src: "/assets/badges/5%20ch%E1%BB%89.png", enabled: false },
  { id: "gold6", name: "Tặng 6 chỉ vàng", shortName: "6 chỉ vàng", src: "/assets/badges/6%20ch%E1%BB%89.png", enabled: false },
  { id: "gold9", name: "Tặng 9 chỉ vàng", shortName: "9 chỉ vàng", src: "/assets/badges/9%20ch%E1%BB%89.png", enabled: false },
];

const GOLD_IDS = BADGES.filter((badge) => badge.id.startsWith("gold")).map((badge) => badge.id);
const pixelBoundsCache = new Map();

function normalizeUnitCode(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function sourceBadgeIds(sourceBadges = []) {
  return new Set(
    (Array.isArray(sourceBadges) ? sourceBadges : [])
      .map((item) => typeof item === "string" ? item : item?.id)
      .filter(Boolean)
  );
}

function defaultConfig(sourceBadges = []) {
  const sourceIds = sourceBadgeIds(sourceBadges);
  return {
    gap: DEFAULT_GAP,
    visibleHeight: DEFAULT_VISIBLE_HEIGHT,
    badges: BADGES.map((badge, index) => ({
      id: badge.id,
      enabled: badge.id === "hotdeal"
        ? sourceIds.has("BADGE_HOT_DEAL")
        : badge.id === "veosom"
          ? sourceIds.has("BADGE_VE_O_SOM")
          : false,
      order: index,
      scale: 1,
    })),
  };
}

function readAllConfigs() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

function readConfig(unitCode, sourceBadges = []) {
  const code = normalizeUnitCode(unitCode);
  const defaults = defaultConfig(sourceBadges);
  if (!code) return defaults;

  try {
    const raw = readAllConfigs()[code];
    if (!raw || !Array.isArray(raw.badges)) return defaults;
    const byId = new Map(raw.badges.map((item) => [item.id, item]));
    const merged = defaults.badges.map((fallback) => {
      const saved = byId.get(fallback.id) || {};
      return {
        id: fallback.id,
        enabled: typeof saved.enabled === "boolean" ? saved.enabled : fallback.enabled,
        order: Number.isFinite(Number(saved.order)) ? Number(saved.order) : fallback.order,
        scale: Number.isFinite(Number(saved.scale)) ? Math.max(0.4, Math.min(2.2, Number(saved.scale))) : 1,
      };
    });

    let goldSeen = false;
    const badges = merged.map((item) => {
      if (!GOLD_IDS.includes(item.id) || !item.enabled) return item;
      if (!goldSeen) { goldSeen = true; return item; }
      return { ...item, enabled: false };
    });

    return {
      gap: Number.isFinite(Number(raw.gap)) ? Math.max(0, Number(raw.gap)) : defaults.gap,
      visibleHeight: Number.isFinite(Number(raw.visibleHeight)) ? Math.max(60, Number(raw.visibleHeight)) : defaults.visibleHeight,
      badges,
    };
  } catch {
    return defaults;
  }
}

function saveConfig(unitCode, config) {
  const code = normalizeUnitCode(unitCode);
  if (!code) return;
  try {
    const all = readAllConfigs();
    all[code] = config;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent("plotflow-campaign-badges-updated", {
      detail: { unitCode: code, config },
    }));
  } catch {
    // localStorage is optional.
  }
}

function fallbackBounds(image) {
  if (!image?.naturalWidth || !image?.naturalHeight) return null;
  return {
    minX: 0,
    minY: 0,
    maxX: image.naturalWidth - 1,
    maxY: image.naturalHeight - 1,
    width: image.naturalWidth,
    height: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
  };
}

function measureVisibleBounds(image) {
  if (!image?.naturalWidth || !image?.naturalHeight) return null;
  const cached = pixelBoundsCache.get(image.src);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fallbackBounds(image);
  ctx.drawImage(image, 0, 0);

  let data;
  try { data = ctx.getImageData(0, 0, canvas.width, canvas.height).data; } catch { return fallbackBounds(image); }

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

  if (maxX < minX || maxY < minY) return fallbackBounds(image);
  const result = {
    minX, minY, maxX, maxY,
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

function normalizeConfigOrders(config) {
  const sorted = orderedConfigBadges(config);
  const active = sorted.filter((item) => item.enabled);
  const inactive = sorted.filter((item) => !item.enabled);
  const orderById = new Map([...active, ...inactive].map((item, index) => [item.id, index]));
  return {
    ...config,
    badges: config.badges.map((item) => ({ ...item, order: orderById.get(item.id) ?? item.order })),
  };
}

export default function CampaignBadgeStrip({
  artboard,
  quickControlsTarget,
  isEditing = false,
  quickPinMode = false,
  pinVisible = false,
  onToggleQuickPin,
  unitCode,
  sourceBadges = [],
}) {
  const sourceBadgeSignature = (Array.isArray(sourceBadges) ? sourceBadges : [])
    .map((item) => typeof item === "string" ? item : item?.id)
    .filter(Boolean)
    .sort()
    .join("|");
  const [config, setConfig] = useState(() => normalizeConfigOrders(readConfig(unitCode, sourceBadges)));
  const [scaleDrafts, setScaleDrafts] = useState({});
  const [boundsById, setBoundsById] = useState({});
  const [errorById, setErrorById] = useState({});
  const [logoVisibleLeft, setLogoVisibleLeft] = useState(28);
  const imageRefs = useRef({});

  useEffect(() => {
    const code = normalizeUnitCode(unitCode);
    setConfig(normalizeConfigOrders(readConfig(unitCode, sourceBadges)));
    setScaleDrafts({});

    const sync = (event) => {
      const eventCode = normalizeUnitCode(event?.detail?.unitCode);
      if (eventCode && eventCode !== code) return;
      setConfig(normalizeConfigOrders(event?.detail?.config || readConfig(unitCode, sourceBadges)));
    };
    const syncStorage = (event) => {
      if (event?.key && event.key !== STORAGE_KEY) return;
      setConfig(normalizeConfigOrders(readConfig(unitCode, sourceBadges)));
    };

    window.addEventListener("plotflow-campaign-badges-updated", sync);
    window.addEventListener("storage", syncStorage);
    return () => {
      window.removeEventListener("plotflow-campaign-badges-updated", sync);
      window.removeEventListener("storage", syncStorage);
    };
  }, [unitCode, sourceBadgeSignature]);

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
    const normalized = normalizeConfigOrders(next);
    setConfig(normalized);
    saveConfig(unitCode, normalized);
  }

  function patchBadge(id, patch) {
    commit({ ...config, badges: config.badges.map((item) => item.id === id ? { ...item, ...patch } : item) });
  }

  function setGoldChoice(nextId) {
    const currentGold = config.badges.find((item) => GOLD_IDS.includes(item.id) && item.enabled);
    const inheritedOrder = currentGold?.order ?? config.badges.find((item) => item.id === nextId)?.order ?? 2;
    const inheritedScale = currentGold?.scale ?? config.badges.find((item) => item.id === nextId)?.scale ?? 1;
    commit({
      ...config,
      badges: config.badges.map((item) => {
        if (!GOLD_IDS.includes(item.id)) return item;
        if (!nextId) return { ...item, enabled: false };
        if (item.id === nextId) return { ...item, enabled: true, order: inheritedOrder, scale: inheritedScale };
        return { ...item, enabled: false };
      }),
    });
  }

  function moveActiveBadge(id, direction) {
    const activeItems = orderedConfigBadges(config).filter((item) => item.enabled);
    if (activeItems.length < 2) return;
    const index = activeItems.findIndex((item) => item.id === id);
    if (index < 0) return;

    const targetIndex = (index + direction + activeItems.length) % activeItems.length;
    const reordered = [...activeItems];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const activeOrderById = new Map(reordered.map((item, nextIndex) => [item.id, nextIndex]));
    const inactiveItems = orderedConfigBadges(config).filter((item) => !item.enabled);
    const inactiveOrderById = new Map(inactiveItems.map((item, nextIndex) => [item.id, reordered.length + nextIndex]));

    commit({
      ...config,
      badges: config.badges.map((item) => ({
        ...item,
        order: item.enabled
          ? activeOrderById.get(item.id)
          : inactiveOrderById.get(item.id),
      })),
    });
  }

  function setScalePercent(id, raw) {
    const parsed = Number(raw);
    const percent = Math.max(40, Math.min(220, Number.isFinite(parsed) ? parsed : 100));
    patchBadge(id, { scale: percent / 100 });
    setScaleDrafts((prev) => ({ ...prev, [id]: String(Math.round(percent)) }));
  }

  function commitScaleDraft(id, fallbackPct) {
    const raw = scaleDrafts[id];
    if (raw === undefined || String(raw).trim() === "") {
      setScaleDrafts((prev) => ({ ...prev, [id]: String(fallbackPct) }));
      return;
    }
    setScalePercent(id, raw);
  }

  function handleLoad(id, event) {
    const image = event.currentTarget;
    imageRefs.current[id] = image;
    const bounds = measureVisibleBounds(image) || fallbackBounds(image);
    if (!bounds) return;
    setErrorById((prev) => ({ ...prev, [id]: false }));
    setBoundsById((prev) => ({ ...prev, [id]: bounds }));
    if (artboard) setLogoVisibleLeft(measureVisibleLogoLeft(artboard));
  }

  function handleError(id) {
    delete imageRefs.current[id];
    setErrorById((prev) => ({ ...prev, [id]: true }));
    setBoundsById((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, id)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  const ordered = useMemo(() => orderedConfigBadges(config), [config]);
  const active = useMemo(() => ordered
    .filter((item) => item.enabled)
    .map((item) => ({ ...item, asset: BADGES.find((badge) => badge.id === item.id) }))
    .filter((item) => item.asset), [ordered]);
  const selectedGold = ordered.find((item) => GOLD_IDS.includes(item.id) && item.enabled)?.id || "";
  const campaignSummary = active.length
    ? active.map((item) => item.asset.shortName || item.asset.name).join(" · ")
    : "Không áp dụng";

  const layouts = useMemo(() => {
    const measured = active
      .filter((item) => boundsById[item.id] && !errorById[item.id])
      .map((item) => {
        const bounds = boundsById[item.id];
        const visibleHeight = config.visibleHeight * item.scale;
        const renderScale = visibleHeight / Math.max(1, bounds.height);
        return { ...item, bounds, renderScale, visibleWidth: bounds.width * renderScale };
      });

    if (!measured.length) return {};

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
  }, [active, boundsById, errorById, config.gap, config.visibleHeight, logoVisibleLeft]);

  const quickControls = !isEditing && quickControlsTarget ? createPortal(
    <section className="campaign-control-card">
      <div className="campaign-control-heading">
        <div>
          <span>CAMPAIGN · {unitCode || "—"}</span>
          <strong>{campaignSummary}</strong>
        </div>
        <label className="campaign-gap-field">
          <span>Gap</span>
          <input type="number" min="0" max="120" value={config.gap} onChange={(event) => commit({ ...config, gap: Math.max(0, Number(event.target.value) || 0) })} />
          <b>px</b>
        </label>
      </div>

      <div className="campaign-toggle-grid">
        {["hotdeal", "veosom"].map((id) => {
          const item = config.badges.find((badge) => badge.id === id);
          const asset = BADGES.find((badge) => badge.id === id);
          return (
            <button key={id} type="button" className={item?.enabled ? "active" : ""} onClick={() => patchBadge(id, { enabled: !item?.enabled })}>
              <span>{item?.enabled ? "✓" : "+"}</span>{asset?.name}
            </button>
          );
        })}
      </div>

      <label className="campaign-gold-field">
        <span>TẶNG VÀNG</span>
        <select value={selectedGold} onChange={(event) => setGoldChoice(event.target.value)}>
          <option value="">Không áp dụng</option>
          {BADGES.filter((badge) => GOLD_IDS.includes(badge.id)).map((badge) => (
            <option key={badge.id} value={badge.id}>{badge.shortName}</option>
          ))}
        </select>
      </label>

      {active.length > 0 && (
        <div className="campaign-active-list">
          <div className="campaign-active-caption"><span>ĐANG HIỂN THỊ</span><small>Order · Scale</small></div>
          {active.map((item) => {
            const pct = Math.round(item.scale * 100);
            const draftValue = Object.prototype.hasOwnProperty.call(scaleDrafts, item.id) ? scaleDrafts[item.id] : String(pct);
            return (
              <div className="campaign-active-row" key={item.id}>
                <strong>{item.asset.name}{errorById[item.id] ? " · lỗi ảnh" : ""}</strong>
                <div className="campaign-order-buttons">
                  <button type="button" onClick={() => moveActiveBadge(item.id, -1)} title="Di chuyển sang trái, có vòng lặp">←</button>
                  <button type="button" onClick={() => moveActiveBadge(item.id, 1)} title="Di chuyển sang phải, có vòng lặp">→</button>
                </div>
                <input className="campaign-scale-slider" type="range" min="40" max="220" step="1" value={pct} onChange={(event) => setScalePercent(item.id, event.target.value)} />
                <label className="campaign-scale-number">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={draftValue}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => {
                      const next = event.target.value.replace(/[^0-9]/g, "");
                      setScaleDrafts((prev) => ({ ...prev, [item.id]: next }));
                    }}
                    onBlur={() => commitScaleDraft(item.id, pct)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") {
                        setScaleDrafts((prev) => ({ ...prev, [item.id]: String(pct) }));
                        event.currentTarget.blur();
                      }
                    }}
                    aria-label={`${item.asset.name} scale percent`}
                  />
                  <span>%</span>
                </label>
              </div>
            );
          })}
        </div>
      )}

      <div className="campaign-pin-tools">
        <button type="button" className={quickPinMode ? "active" : ""} onClick={onToggleQuickPin} disabled={!pinVisible}>
          {quickPinMode ? "✓ Xong đặt 3D Pin" : "✥ Đặt 3D Pin trực tiếp"}
        </button>
        <small>{pinVisible ? "Kéo pin ngay trên poster; zoom preview để đặt chính xác." : "Bật Show 3D Pin trước để đặt vị trí."}</small>
      </div>
    </section>,
    quickControlsTarget
  ) : null;

  return (
    <>
      {BADGES.map((asset) => {
        const item = config.badges.find((badge) => badge.id === asset.id);
        const layout = layouts[asset.id];
        return (
          <img
            key={asset.id}
            ref={(node) => { if (node) imageRefs.current[asset.id] = node; }}
            src={asset.src}
            alt=""
            aria-hidden="true"
            draggable="false"
            onLoad={(event) => handleLoad(asset.id, event)}
            onError={() => handleError(asset.id)}
            style={{
              position: "absolute",
              left: layout ? `${layout.left}px` : "-10000px",
              top: layout ? `${layout.top}px` : "-10000px",
              width: layout ? `${layout.width}px` : "1px",
              height: layout ? `${layout.height}px` : "1px",
              maxWidth: "none",
              display: item?.enabled && !errorById[asset.id] ? "block" : "none",
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