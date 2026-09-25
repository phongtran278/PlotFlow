import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const STORAGE_KEY = "plotflow-campaign-badges-by-unit-v2";
const DEFAULT_GAP = 18;
const DEFAULT_VISIBLE_HEIGHT = 156;
const ALPHA_THRESHOLD = 8;

const BADGES = [
  { id: "hotdeal", name: "Hot Deal", src: "/assets/badges/hotdeal.png" },
  { id: "veosom", name: "Về ở sớm", src: "/assets/badges/veosom.png" },
  { id: "gold1", name: "Tặng 1 chỉ vàng", shortName: "1 chỉ vàng", src: "/assets/ui/gold_1.png" },
  { id: "gold3", name: "Tặng 3 chỉ vàng", shortName: "3 chỉ vàng", src: "/assets/ui/gold_3.png" },
  { id: "gold5", name: "Tặng 5 chỉ vàng", shortName: "5 chỉ vàng", src: "/assets/ui/gold_5.png" },
  { id: "gold6", name: "Tặng 6 chỉ vàng", shortName: "6 chỉ vàng", src: "/assets/ui/gold_6.png" },
  { id: "gold9", name: "Tặng 9 chỉ vàng", shortName: "9 chỉ vàng", src: "/assets/ui/gold_9.png" },
];
const GOLD_IDS = BADGES.filter((item) => item.id.startsWith("gold")).map((item) => item.id);
const boundsCache = new Map();

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

function normalizeConfig(config, sourceBadges = []) {
  const defaults = defaultConfig(sourceBadges);
  const byId = new Map((config?.badges || []).map((item) => [item.id, item]));
  let goldSeen = false;
  const badges = defaults.badges.map((fallback) => {
    const saved = byId.get(fallback.id) || {};
    let enabled = typeof saved.enabled === "boolean" ? saved.enabled : fallback.enabled;
    if (GOLD_IDS.includes(fallback.id) && enabled) {
      if (goldSeen) enabled = false;
      else goldSeen = true;
    }
    return {
      id: fallback.id,
      enabled,
      order: Number.isFinite(Number(saved.order)) ? Number(saved.order) : fallback.order,
      scale: Number.isFinite(Number(saved.scale)) ? Math.max(.4, Math.min(2.2, Number(saved.scale))) : 1,
    };
  });
  return {
    gap: Number.isFinite(Number(config?.gap)) ? Math.max(0, Number(config.gap)) : defaults.gap,
    visibleHeight: Number.isFinite(Number(config?.visibleHeight)) ? Math.max(60, Number(config.visibleHeight)) : defaults.visibleHeight,
    badges,
  };
}

function readConfig(unitCode, sourceBadges = []) {
  const code = normalizeUnitCode(unitCode);
  if (!code) return defaultConfig(sourceBadges);
  return normalizeConfig(readAllConfigs()[code], sourceBadges);
}

function saveConfig(unitCode, config) {
  const code = normalizeUnitCode(unitCode);
  if (!code) return;
  try {
    const all = readAllConfigs();
    all[code] = config;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent("plotflow-campaign-badges-updated", { detail: { unitCode: code, config } }));
  } catch {
    // Storage is optional; preview should still work.
  }
}

function fallbackBounds(image) {
  if (!image?.naturalWidth || !image?.naturalHeight) return null;
  return {
    minX: 0,
    minY: 0,
    width: image.naturalWidth,
    height: image.naturalHeight,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
  };
}

function measureVisibleBounds(image) {
  if (!image?.naturalWidth || !image?.naturalHeight) return null;
  const cached = boundsCache.get(image.src);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return fallbackBounds(image);
  ctx.drawImage(image, 0, 0);

  let pixels;
  try {
    pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    return fallbackBounds(image);
  }

  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < canvas.height; y += 1) {
    const row = y * canvas.width * 4;
    for (let x = 0; x < canvas.width; x += 1) {
      if (pixels[row + x * 4 + 3] <= ALPHA_THRESHOLD) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  const result = maxX >= minX && maxY >= minY
    ? {
        minX,
        minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
        naturalWidth: canvas.width,
        naturalHeight: canvas.height,
      }
    : fallbackBounds(image);
  if (result) boundsCache.set(image.src, result);
  return result;
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
  const sourceSignature = (Array.isArray(sourceBadges) ? sourceBadges : [])
    .map((item) => typeof item === "string" ? item : item?.id)
    .filter(Boolean)
    .sort()
    .join("|");
  const [config, setConfig] = useState(() => readConfig(unitCode, sourceBadges));
  const [scaleDrafts, setScaleDrafts] = useState({});
  const [failed, setFailed] = useState({});
  const [boundsById, setBoundsById] = useState({});

  useEffect(() => {
    const code = normalizeUnitCode(unitCode);
    setConfig(readConfig(unitCode, sourceBadges));
    setScaleDrafts({});
    setFailed({});
    setBoundsById({});
    const sync = (event) => {
      const eventCode = normalizeUnitCode(event?.detail?.unitCode);
      if (eventCode && eventCode !== code) return;
      setConfig(normalizeConfig(event?.detail?.config || readConfig(unitCode, sourceBadges), sourceBadges));
    };
    const storage = (event) => {
      if (event?.key && event.key !== STORAGE_KEY) return;
      setConfig(readConfig(unitCode, sourceBadges));
    };
    window.addEventListener("plotflow-campaign-badges-updated", sync);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("plotflow-campaign-badges-updated", sync);
      window.removeEventListener("storage", storage);
    };
  }, [unitCode, sourceSignature]);

  useEffect(() => {
    const legacy = quickControlsTarget?.querySelector(".dock-badges");
    if (!legacy) return undefined;
    const previous = legacy.style.display;
    legacy.style.display = "none";
    return () => { legacy.style.display = previous; };
  }, [quickControlsTarget]);

  function commit(next) {
    const normalized = normalizeConfig(next, sourceBadges);
    setConfig(normalized);
    saveConfig(unitCode, normalized);
  }

  function patchBadge(id, patch) {
    commit({ ...config, badges: config.badges.map((item) => item.id === id ? { ...item, ...patch } : item) });
  }

  function setGoldChoice(nextId) {
    const current = config.badges.find((item) => GOLD_IDS.includes(item.id) && item.enabled);
    const order = current?.order ?? config.badges.find((item) => item.id === nextId)?.order ?? 2;
    const scale = current?.scale ?? config.badges.find((item) => item.id === nextId)?.scale ?? 1;
    commit({
      ...config,
      badges: config.badges.map((item) => {
        if (!GOLD_IDS.includes(item.id)) return item;
        return {
          ...item,
          enabled: Boolean(nextId && item.id === nextId),
          order: item.id === nextId ? order : item.order,
          scale: item.id === nextId ? scale : item.scale,
        };
      }),
    });
  }

  const ordered = useMemo(() => [...config.badges].sort((a, b) => a.order - b.order), [config.badges]);
  const active = useMemo(() => ordered
    .filter((item) => item.enabled)
    .map((item) => ({ ...item, asset: BADGES.find((badge) => badge.id === item.id) }))
    .filter((item) => item.asset), [ordered]);
  const selectedGold = ordered.find((item) => GOLD_IDS.includes(item.id) && item.enabled)?.id || "";
  const summary = active.length ? active.map((item) => item.asset.shortName || item.asset.name).join(" · ") : "Không áp dụng";

  function move(id, direction) {
    const activeItems = active.map((item) => item.id);
    const index = activeItems.indexOf(id);
    if (index < 0 || activeItems.length < 2) return;
    const target = (index + direction + activeItems.length) % activeItems.length;
    [activeItems[index], activeItems[target]] = [activeItems[target], activeItems[index]];
    const activeOrder = new Map(activeItems.map((badgeId, i) => [badgeId, i]));
    const inactive = ordered.filter((item) => !item.enabled).map((item) => item.id);
    const inactiveOrder = new Map(inactive.map((badgeId, i) => [badgeId, activeItems.length + i]));
    commit({
      ...config,
      badges: config.badges.map((item) => ({
        ...item,
        order: item.enabled ? activeOrder.get(item.id) : inactiveOrder.get(item.id),
      })),
    });
  }

  function setScale(id, raw) {
    const pct = Math.max(40, Math.min(220, Number(raw) || 100));
    patchBadge(id, { scale: pct / 100 });
    setScaleDrafts((prev) => ({ ...prev, [id]: String(Math.round(pct)) }));
  }

  function handleLoad(id, event) {
    const bounds = measureVisibleBounds(event.currentTarget) || fallbackBounds(event.currentTarget);
    setFailed((prev) => ({ ...prev, [id]: false }));
    if (bounds) setBoundsById((prev) => ({ ...prev, [id]: bounds }));
  }

  const artwork = artboard ? createPortal(
    <div
      className="campaign-artwork-strip"
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        right: 28,
        zIndex: 19,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "flex-end",
        gap: `${config.gap}px`,
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      {active.map((item) => {
        const targetHeight = Math.round(config.visibleHeight * item.scale);
        const bounds = boundsById[item.id];
        const renderScale = bounds ? targetHeight / Math.max(1, bounds.height) : 1;
        const wrapperStyle = bounds
          ? {
              position: "relative",
              flex: "0 0 auto",
              width: `${bounds.width * renderScale}px`,
              height: `${targetHeight}px`,
              overflow: "visible",
            }
          : {
              position: "relative",
              flex: "0 0 auto",
              height: `${targetHeight}px`,
            };
        const imageStyle = bounds
          ? {
              position: "absolute",
              left: `${-bounds.minX * renderScale}px`,
              top: `${-bounds.minY * renderScale}px`,
              width: `${bounds.naturalWidth * renderScale}px`,
              height: `${bounds.naturalHeight * renderScale}px`,
              maxWidth: "none",
            }
          : {
              display: "block",
              width: "auto",
              height: `${targetHeight}px`,
              maxWidth: "none",
            };
        return (
          <span key={item.id} className="campaign-artwork-item" style={{ ...wrapperStyle, display: failed[item.id] ? "none" : "block" }}>
            <img
              src={item.asset.src}
              alt=""
              draggable="false"
              onLoad={(event) => handleLoad(item.id, event)}
              onError={() => setFailed((prev) => ({ ...prev, [item.id]: true }))}
              style={{ ...imageStyle, objectFit: "contain", pointerEvents: "none", userSelect: "none" }}
            />
          </span>
        );
      })}
    </div>,
    artboard
  ) : null;

  const controls = !isEditing && quickControlsTarget ? createPortal(
    <section className="campaign-control-card">
      <div className="campaign-control-heading">
        <div><span>CAMPAIGN · {unitCode || "—"}</span><strong>{summary}</strong></div>
        <label className="campaign-gap-field"><span>Gap</span><input type="number" min="0" max="120" value={config.gap} onChange={(event) => commit({ ...config, gap: Math.max(0, Number(event.target.value) || 0) })} /><b>px</b></label>
      </div>

      <div className="campaign-toggle-grid">
        {["hotdeal", "veosom"].map((id) => {
          const item = config.badges.find((badge) => badge.id === id);
          const asset = BADGES.find((badge) => badge.id === id);
          return <button key={id} type="button" className={item?.enabled ? "active" : ""} onClick={() => patchBadge(id, { enabled: !item?.enabled })}><span>{item?.enabled ? "✓" : "+"}</span>{asset?.name}</button>;
        })}
      </div>

      <label className="campaign-gold-field">
        <span>TẶNG VÀNG</span>
        <select value={selectedGold} onChange={(event) => setGoldChoice(event.target.value)}>
          <option value="">Không áp dụng</option>
          {BADGES.filter((badge) => GOLD_IDS.includes(badge.id)).map((badge) => <option key={badge.id} value={badge.id}>{badge.shortName}</option>)}
        </select>
      </label>

      {active.length > 0 && <div className="campaign-active-list">
        <div className="campaign-active-caption"><span>ĐANG HIỂN THỊ</span><small>Order · Scale</small></div>
        {active.map((item) => {
          const pct = Math.round(item.scale * 100);
          const draft = Object.prototype.hasOwnProperty.call(scaleDrafts, item.id) ? scaleDrafts[item.id] : String(pct);
          return <div className="campaign-active-row" key={item.id}>
            <strong>{item.asset.name}{failed[item.id] ? " · lỗi ảnh" : ""}</strong>
            <div className="campaign-order-buttons"><button type="button" onClick={() => move(item.id, -1)}>←</button><button type="button" onClick={() => move(item.id, 1)}>→</button></div>
            <input className="campaign-scale-slider" type="range" min="40" max="220" step="1" value={pct} onChange={(event) => setScale(item.id, event.target.value)} />
            <label className="campaign-scale-number"><input type="text" inputMode="numeric" value={draft} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setScaleDrafts((prev) => ({ ...prev, [item.id]: event.target.value.replace(/[^0-9]/g, "") }))} onBlur={() => setScale(item.id, draft || pct)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /><span>%</span></label>
          </div>;
        })}
      </div>}

      <div className="campaign-pin-tools">
        <button type="button" className={quickPinMode ? "active" : ""} onClick={onToggleQuickPin} disabled={!pinVisible}>{quickPinMode ? "✓ Xong đặt 3D Pin" : "✥ Đặt 3D Pin trực tiếp"}</button>
        <small>{pinVisible ? "Kéo pin ngay trên poster; zoom preview để đặt chính xác." : "Bật Show 3D Pin trước để đặt vị trí."}</small>
      </div>
    </section>,
    quickControlsTarget
  ) : null;

  return <>{artwork}{controls}</>;
}
