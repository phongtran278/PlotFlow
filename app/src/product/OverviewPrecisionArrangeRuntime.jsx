import { useEffect } from "react";
import "./OverviewPrecisionArrangeRuntime.css";

const UI_KEY = "plotflow-overview-precision-arrange-v3";
const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const LEGACY_LAYOUT_UI_KEY = "phongflow-overview-layout-ui-v1";
const GROUP_STYLE_KEY = "plotflow-overview-group-style-v1";
const BASE_CARD_WIDTH = 192;
const DEFAULT_CARD_HEIGHT = 132;
const DEFAULT_STYLE = { scale: 100, gap: 14, cardRadius: 16, innerRadius: 11 };

function clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); }
function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value && typeof value === "object" ? value : fallback;
  } catch { return fallback; }
}
function saveJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ } }
function normalizeStyle(value = {}) {
  return {
    scale: clamp(value.scale ?? DEFAULT_STYLE.scale, 20, 220),
    gap: clamp(value.gap ?? DEFAULT_STYLE.gap, 0, 120),
    cardRadius: clamp(value.cardRadius ?? DEFAULT_STYLE.cardRadius, 0, 40),
    innerRadius: clamp(value.innerRadius ?? DEFAULT_STYLE.innerRadius, 0, 32),
  };
}
function codeFor(card) { return card?.dataset?.unitCode || card?.querySelector(".pf-sell-card-code")?.textContent?.trim() || ""; }
function icon(kind) {
  const common = 'viewBox="0 0 20 20" aria-hidden="true"';
  const icons = {
    lock: `<svg ${common}><rect x="5.5" y="9" width="9" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7.5 9V6.8a2.5 2.5 0 0 1 5 0V9" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
    unlock: `<svg ${common}><rect x="5.5" y="9" width="9" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12.5 9V6.8a2.5 2.5 0 0 0-4.7-1.2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`,
    left: `<svg ${common}><path d="M4 3v14M7 6h8v3H7zM7 11h5v3H7z" fill="none" stroke="currentColor" stroke-width="1.35"/></svg>`,
    center: `<svg ${common}><path d="M10 3v14M5 6h10v3H5zM7 11h6v3H7z" fill="none" stroke="currentColor" stroke-width="1.35"/></svg>`,
    right: `<svg ${common}><path d="M16 3v14M5 6h8v3H5zM8 11h5v3H8z" fill="none" stroke="currentColor" stroke-width="1.35"/></svg>`,
    top: `<svg ${common}><path d="M3 4h14M6 7v8h3V7zM11 7v5h3V7z" fill="none" stroke="currentColor" stroke-width="1.35"/></svg>`,
    middle: `<svg ${common}><path d="M3 10h14M6 5v10h3V5zM11 7v6h3V7z" fill="none" stroke="currentColor" stroke-width="1.35"/></svg>`,
    bottom: `<svg ${common}><path d="M3 16h14M6 5v8h3V5zM11 8v5h3V8z" fill="none" stroke="currentColor" stroke-width="1.35"/></svg>`,
    distributeH: `<svg ${common}><path d="M3 4v12M17 4v12M6 8h3v4H6zM11 8h3v4h-3z" fill="none" stroke="currentColor" stroke-width="1.35"/></svg>`,
    distributeV: `<svg ${common}><path d="M4 3h12M4 17h12M8 6h4v3H8zM8 11h4v3H8z" fill="none" stroke="currentColor" stroke-width="1.35"/></svg>`,
  };
  return icons[kind] || "";
}

export default function OverviewPrecisionArrangeRuntime() {
  useEffect(() => {
    let disposed = false;
    let panel = null;
    let quickScale = null;
    let stage = null;
    let rail = null;
    let frame = 0;
    let railObserver = null;
    let locked = readJson(UI_KEY, { locked: true }).locked !== false;
    let groupStyles = readJson(GROUP_STYLE_KEY, {});

    const cards = () => stage ? Array.from(stage.querySelectorAll(".pf-live-sales-callout")) : [];
    const selected = () => cards().filter((card) => card.classList.contains("pf-card-selected"));
    const keyCard = (list) => list.find((card) => card.classList.contains("pf-card-key")) || list[0] || null;

    function currentGroup() {
      return String(stage?.dataset?.overviewGroup || document.querySelector(".pf-overview-groups button.active")?.textContent?.trim() || "Overview").trim();
    }
    function styleForGroup(group = currentGroup()) { return normalizeStyle(groupStyles[group] || DEFAULT_STYLE); }
    function saveGroupStyle(patch = {}) {
      const group = currentGroup();
      const next = normalizeStyle({ ...styleForGroup(group), ...patch });
      groupStyles = { ...groupStyles, [group]: next };
      saveJson(GROUP_STYLE_KEY, groupStyles);
      return next;
    }
    function objectScale(card) { return clamp(card?.dataset?.pfObjectScale || 1, 0.2, 2.2); }
    function visualWidth(card) { return (card?.offsetWidth || BASE_CARD_WIDTH) * objectScale(card); }
    function visualHeight(card) { return (card?.offsetHeight || DEFAULT_CARD_HEIGHT) * objectScale(card); }

    function persist() {
      const layout = readJson(CARD_LAYOUT_KEY, {});
      cards().forEach((card) => {
        const code = codeFor(card);
        if (!code) return;
        layout[code] = { ...(layout[code] || {}), left: card.offsetLeft, top: card.offsetTop, width: card.offsetWidth, height: card.offsetHeight };
      });
      saveJson(CARD_LAYOUT_KEY, layout);
    }

    function updateConnectors() {
      window.dispatchEvent(new CustomEvent("pf-overview-connector-geometry-request"));
    }

    function applyCornerRadii(card, style = styleForGroup()) {
      if (!card) return;
      const scale = objectScale(card);
      card.style.setProperty("border-radius", `${style.cardRadius / scale}px`, "important");
      const priceBox = card.querySelector(".pf-sell-card-pricebox");
      if (priceBox) priceBox.style.setProperty("border-radius", `${style.innerRadius / scale}px`, "important");
    }

    function setObjectScale(card, scale, style = styleForGroup()) {
      if (!card) return;
      const next = clamp(scale, 0.2, 2.2);
      card.dataset.pfObjectScale = String(next);
      card.style.transformOrigin = "0 0";
      card.style.scale = String(next);
      applyCornerRadii(card, style);
    }

    function applyScale(percent, { save = true } = {}) {
      const next = clamp(percent, 20, 220);
      const style = save ? saveGroupStyle({ scale: next }) : normalizeStyle({ ...styleForGroup(), scale: next });
      cards().forEach((card) => setObjectScale(card, next / 100, style));
      if (save) persist();
      requestAnimationFrame(() => { updateConnectors(); syncPanel(); });
    }

    function applyGroupStyle() {
      const style = styleForGroup();
      cards().forEach((card) => setObjectScale(card, style.scale / 100, style));
      syncGap(style.gap);
      requestAnimationFrame(() => { updateConnectors(); syncPanel(); });
    }

    function applyRadii(cardRadius, innerRadius) {
      const style = saveGroupStyle({ cardRadius, innerRadius });
      cards().forEach((card) => applyCornerRadii(card, style));
      requestAnimationFrame(syncPanel);
    }

    function syncGap(value) {
      const gap = clamp(value, 0, 120);
      try {
        const legacy = JSON.parse(localStorage.getItem(LEGACY_LAYOUT_UI_KEY) || "{}") || {};
        legacy.gap = gap;
        localStorage.setItem(LEGACY_LAYOUT_UI_KEY, JSON.stringify(legacy));
      } catch { /* noop */ }
      window.dispatchEvent(new CustomEvent("pf-overview-precision-gap", { detail: { gap } }));
    }

    function applyLockedDimension(axis, requested) {
      const list = selected();
      const key = keyCard(list);
      if (!key || !list.length) return;
      const current = axis === "width" ? visualWidth(key) : visualHeight(key);
      if (current <= 0) return;
      const target = clamp(requested, axis === "width" ? 24 : 24, 900);
      const nextScale = clamp(objectScale(key) * (target / current), 0.2, 2.2);
      list.forEach((card) => setObjectScale(card, nextScale, styleForGroup()));
      requestAnimationFrame(() => { persist(); updateConnectors(); syncPanel(); });
    }

    function applyFreeDimension(axis, requested) {
      const list = selected();
      if (!list.length) return;
      list.forEach((card) => {
        if (axis === "width") {
          const width = clamp(requested, 64, 420);
          card.style.setProperty("--pf-card-width", `${width}px`);
          card.style.width = `${width}px`;
          card.style.right = "auto";
        } else {
          const height = clamp(requested, 56, 420);
          card.style.setProperty("--pf-card-height", `${height}px`);
          card.style.height = `${height}px`;
          card.style.minHeight = `${height}px`;
        }
      });
      requestAnimationFrame(() => { persist(); updateConnectors(); syncPanel(); });
    }

    function applyDimension(axis, value) {
      if (locked) applyLockedDimension(axis, value);
      else applyFreeDimension(axis, value);
    }

    function align(kind) {
      const list = selected();
      if (list.length < 2) return;
      const key = keyCard(list);
      if (!key) return;
      const k = { left: key.offsetLeft, top: key.offsetTop, width: visualWidth(key), height: visualHeight(key) };
      list.forEach((card) => {
        if (card === key) return;
        const width = visualWidth(card);
        const height = visualHeight(card);
        if (kind === "left") card.style.left = `${k.left}px`;
        if (kind === "center") card.style.left = `${k.left + k.width / 2 - width / 2}px`;
        if (kind === "right") card.style.left = `${k.left + k.width - width}px`;
        if (kind === "top") card.style.top = `${k.top}px`;
        if (kind === "middle") card.style.top = `${k.top + k.height / 2 - height / 2}px`;
        if (kind === "bottom") card.style.top = `${k.top + k.height - height}px`;
        card.style.right = "auto";
      });
      persist(); updateConnectors();
    }

    function distribute(axis) {
      const list = [...selected()];
      if (list.length < 2) return;
      const gap = styleForGroup().gap;
      if (axis === "horizontal") {
        list.sort((a, b) => a.offsetLeft - b.offsetLeft);
        let left = list[0].offsetLeft;
        list.forEach((card) => { card.style.left = `${left}px`; card.style.right = "auto"; left += visualWidth(card) + gap; });
      } else {
        list.sort((a, b) => a.offsetTop - b.offsetTop);
        let top = list[0].offsetTop;
        list.forEach((card) => { card.style.top = `${top}px`; top += visualHeight(card) + gap; });
      }
      persist(); updateConnectors();
    }

    function syncPanel() {
      const list = selected();
      const key = keyCard(list);
      const style = styleForGroup();
      if (quickScale?.isConnected) {
        const range = quickScale.querySelector("[data-quick-scale-range]");
        const number = quickScale.querySelector("[data-quick-scale-number]");
        if (range && document.activeElement !== range) range.value = String(Math.round(style.scale));
        if (number && document.activeElement !== number) number.value = String(Math.round(style.scale));
      }
      if (!panel?.isConnected) return;
      const width = panel.querySelector("[data-precision-width]");
      const height = panel.querySelector("[data-precision-height]");
      const cardRadius = panel.querySelector("[data-card-radius]");
      const innerRadius = panel.querySelector("[data-inner-radius]");
      const gap = panel.querySelector("[data-precision-gap]");
      const group = panel.querySelector("[data-style-group]");
      const lock = panel.querySelector("[data-ratio-lock]");
      if (key && width && document.activeElement !== width) width.value = String(Math.round(visualWidth(key)));
      if (key && height && document.activeElement !== height) height.value = String(Math.round(visualHeight(key)));
      if (cardRadius && document.activeElement !== cardRadius) cardRadius.value = String(Math.round(style.cardRadius));
      if (innerRadius && document.activeElement !== innerRadius) innerRadius.value = String(Math.round(style.innerRadius));
      if (gap && document.activeElement !== gap) gap.value = String(Math.round(style.gap));
      if (group) group.textContent = currentGroup();
      if (lock) {
        lock.classList.toggle("is-locked", locked);
        lock.setAttribute("aria-pressed", String(locked));
        lock.setAttribute("title", locked ? "Unlock width and height" : "Lock proportions");
        lock.innerHTML = icon(locked ? "lock" : "unlock");
      }
    }

    function installQuickScale() {
      if (!rail || quickScale?.isConnected) return;
      quickScale = document.createElement("div");
      quickScale.className = "pf-card-quick-scale";
      quickScale.innerHTML = `<span>Scale</span><input data-quick-scale-range type="range" min="20" max="220" step="1" value="100" aria-label="Card scale"><label><input data-quick-scale-number type="number" min="20" max="220" step="1" value="100" aria-label="Card scale"><b>%</b></label>`;
      const range = quickScale.querySelector("[data-quick-scale-range]");
      const number = quickScale.querySelector("[data-quick-scale-number]");
      const live = (value) => {
        const next = clamp(value, 20, 220);
        range.value = String(next);
        number.value = String(Math.round(next));
        applyScale(next, { save: false });
      };
      const commit = (value) => {
        const next = clamp(value, 20, 220);
        range.value = String(next);
        number.value = String(Math.round(next));
        applyScale(next, { save: true });
      };
      range.addEventListener("input", () => live(range.value));
      range.addEventListener("change", () => commit(range.value));
      number.addEventListener("input", () => live(number.value));
      number.addEventListener("change", () => commit(number.value));
      number.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); commit(number.value); number.blur(); } });
      rail.appendChild(quickScale);
    }

    function bindEnter(input, fn) {
      input.addEventListener("change", fn);
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        fn();
        input.blur();
      });
    }

    function installPanel() {
      if (!rail || panel?.isConnected) return;
      panel = document.createElement("details");
      panel.className = "pf-precision-arrange";
      panel.innerHTML = `
        <summary>Transform</summary>
        <div class="pf-precision-popover">
          <header><div><strong>Card controls</strong><em data-style-group>Overview</em></div><small>Scale is global for this group. Size fields affect selected cards only.</small></header>
          <div class="pf-style-system-grid">
            <label><span>Card radius</span><input data-card-radius type="number" min="0" max="40" step="1"><b>px</b></label>
            <label><span>Inner radius</span><input data-inner-radius type="number" min="0" max="32" step="1"><b>px</b></label>
          </div>
          <div class="pf-precision-section-label">Size</div>
          <div class="pf-size-lock-row">
            <label><span>W</span><input data-precision-width type="number" min="24" max="900" step="1"><b>px</b></label>
            <button type="button" data-ratio-lock aria-label="Lock proportions"></button>
            <label><span>H</span><input data-precision-height type="number" min="24" max="900" step="1"><b>px</b></label>
          </div>
          <label><span>Gap</span><input data-precision-gap type="number" min="0" max="120" step="1"><b>px</b></label>
          <div class="pf-precision-group"><span>Align to key object</span><div>
            <button type="button" data-align="left" title="Align left" aria-label="Align left">${icon("left")}</button>
            <button type="button" data-align="center" title="Align horizontal center" aria-label="Align horizontal center">${icon("center")}</button>
            <button type="button" data-align="right" title="Align right" aria-label="Align right">${icon("right")}</button>
            <button type="button" data-align="top" title="Align top" aria-label="Align top">${icon("top")}</button>
            <button type="button" data-align="middle" title="Align vertical center" aria-label="Align vertical center">${icon("middle")}</button>
            <button type="button" data-align="bottom" title="Align bottom" aria-label="Align bottom">${icon("bottom")}</button>
          </div></div>
          <div class="pf-precision-group"><span>Distribute with current gap</span><div class="pf-distribute-icons">
            <button type="button" data-distribute="horizontal" title="Distribute horizontally" aria-label="Distribute horizontally">${icon("distributeH")}</button>
            <button type="button" data-distribute="vertical" title="Distribute vertically" aria-label="Distribute vertically">${icon("distributeV")}</button>
          </div></div>
        </div>`;

      const width = panel.querySelector("[data-precision-width]");
      const height = panel.querySelector("[data-precision-height]");
      const lock = panel.querySelector("[data-ratio-lock]");
      const gap = panel.querySelector("[data-precision-gap]");
      const cardRadius = panel.querySelector("[data-card-radius]");
      const innerRadius = panel.querySelector("[data-inner-radius]");

      bindEnter(width, () => applyDimension("width", width.value));
      bindEnter(height, () => applyDimension("height", height.value));
      lock.addEventListener("click", () => {
        locked = !locked;
        saveJson(UI_KEY, { locked });
        syncPanel();
      });
      const updateRadii = () => applyRadii(clamp(cardRadius.value, 0, 40), clamp(innerRadius.value, 0, 32));
      cardRadius.addEventListener("input", updateRadii);
      innerRadius.addEventListener("input", updateRadii);
      bindEnter(cardRadius, updateRadii);
      bindEnter(innerRadius, updateRadii);
      bindEnter(gap, () => {
        const next = clamp(gap.value, 0, 120);
        saveGroupStyle({ gap: next });
        syncGap(next);
        syncPanel();
      });
      panel.querySelectorAll("[data-align]").forEach((button) => button.addEventListener("click", () => align(button.dataset.align)));
      panel.querySelectorAll("[data-distribute]").forEach((button) => button.addEventListener("click", () => distribute(button.dataset.distribute)));
      rail.appendChild(panel);
    }

    function hideLegacySizing() {
      if (!rail) return;
      rail.querySelectorAll('.pf-card-layout-control [data-layout-ui="size"],.pf-card-layout-control [data-layout-ui="gap"]').forEach((input) => {
        const label = input.closest("label");
        if (label) label.style.display = "none";
      });
    }

    function install() {
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      const nextRail = document.querySelector(".pf-overview-control-rail");
      if (!nextStage || !nextRail) return false;
      stage = nextStage;
      rail = nextRail;
      hideLegacySizing();
      installQuickScale();
      installPanel();
      if (!railObserver) {
        railObserver = new MutationObserver(() => { hideLegacySizing(); installQuickScale(); installPanel(); });
        railObserver.observe(rail, { childList: true, subtree: true });
      }
      applyGroupStyle();
      syncPanel();
      return true;
    }

    function onSelectionChange() { requestAnimationFrame(syncPanel); }
    function onUnitsReady() { requestAnimationFrame(() => { install(); applyGroupStyle(); }); }
    function onGroupChange() { requestAnimationFrame(() => { applyGroupStyle(); syncPanel(); }); }
    function tick() { if (disposed || install()) return; frame = requestAnimationFrame(tick); }

    tick();
    window.addEventListener("pf-overview-live-units-ready", onUnitsReady);
    window.addEventListener("pf-overview-group-changed", onGroupChange);
    window.addEventListener("pf-overview-auto-arranged", () => requestAnimationFrame(updateConnectors));
    document.addEventListener("pointerup", onSelectionChange, true);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      railObserver?.disconnect();
      window.removeEventListener("pf-overview-live-units-ready", onUnitsReady);
      window.removeEventListener("pf-overview-group-changed", onGroupChange);
      document.removeEventListener("pointerup", onSelectionChange, true);
      quickScale?.remove();
      panel?.remove();
    };
  }, []);

  return null;
}