import { useEffect } from "react";
import "./OverviewLiveUnitsRuntime.css";

const SELL_STORAGE_KEY = "plotflow-overview-sell-units-v1";
const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const GROUP_STYLE_KEY = "plotflow-overview-group-style-v1";

function canonicalOverviewGroup(value = "") {
  const raw = String(value).trim();
  const normalized = raw.toLowerCase();
  if (normalized.includes("hoàn thiện") || normalized.includes("hoan thien")) return "Hoàn thiện";
  if (normalized.includes("giãn xây") || normalized.includes("gian xay")) return "Giãn xây";
  if (normalized.includes("xây thô") || normalized.includes("xay tho") || normalized.includes("bàn giao thô") || normalized.includes("ban giao tho")) return "Xây thô";
  return raw;
}

function readSellUnits() {
  if (Array.isArray(window.__plotflowOverviewSellUnits)) return window.__plotflowOverviewSellUnits;
  try {
    const value = JSON.parse(localStorage.getItem(SELL_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

function readSavedCardLayout() {
  try {
    const value = JSON.parse(localStorage.getItem(CARD_LAYOUT_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}

function readGroupScale(group) {
  try {
    const styles = JSON.parse(localStorage.getItem(GROUP_STYLE_KEY) || "{}") || {};
    const raw = Number(styles?.[group]?.scale);
    return Number.isFinite(raw) ? clamp(raw / 100, 0.2, 2.2) : 1;
  } catch { return 1; }
}

function saveCardLayout(value) {
  try { localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify(value)); } catch { /* noop */ }
}

function readFallbackUnits() {
  return Array.from(document.querySelectorAll(".unit-select")).map((button) => ({
    code: button.querySelector(".unit-main strong")?.textContent?.trim() || "",
    handover: "",
    land: "",
    floor: "",
    type: "",
    priceLandVat: Array.from(button.children).at(-1)?.textContent?.trim() || "",
    priceAllIn: "",
  })).filter((item) => item.code);
}

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function formatArea(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  if (/m\s*[²2]/i.test(raw)) return raw.replace(/m\s*2/ig, "M²");
  return `${raw} M²`;
}

function formatPrice(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  if (/tỷ|ty\b/i.test(raw)) return raw;
  return `${raw} tỷ`;
}

function signature(units, group) { return JSON.stringify({ group, units }); }
function makeNode(tag, className = "") { const node = document.createElement(tag); if (className) node.className = className; return node; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function objectScale(card) {
  const value = Number(card?.dataset?.pfObjectScale || card?.style?.scale || 1);
  return Number.isFinite(value) ? clamp(value, 0.2, 2.2) : 1;
}

export default function OverviewLiveUnitsRuntime() {
  useEffect(() => {
    let stage = null;
    let layer = null;
    let observer = null;
    let timer = 0;
    let clampTimer = 0;
    let groupFallbackTimer = 0;
    let groupSwitchPending = false;
    let lastSignature = "";
    let disposed = false;

    function currentGroup() {
      return canonicalOverviewGroup(stage?.dataset?.overviewGroup || document.querySelector(".pf-overview-groups button.active")?.textContent?.trim() || "");
    }

    function sourceUnits() {
      const sell = readSellUnits();
      return sell.length ? sell : readFallbackUnits();
    }

    function visibleUnits() {
      const all = sourceUnits();
      const group = currentGroup();
      if (!group || !all.some((item) => item.handover)) return all;
      return all.filter((item) => canonicalOverviewGroup(item.handover) === group);
    }

    function syncConnectorStarts() {
      window.dispatchEvent(new CustomEvent("pf-overview-connector-geometry-request"));
    }

    function clampCardsInsidePdf({ arrangeUnsaved = true } = {}) {
      if (!stage || !layer) return false;
      const pdfX = Number(stage.dataset.pfPdfX);
      const pdfY = Number(stage.dataset.pfPdfY);
      const pdfWidth = Number(stage.dataset.pfPdfWidth);
      const pdfHeight = Number(stage.dataset.pfPdfHeight);
      if (![pdfX, pdfY, pdfWidth, pdfHeight].every(Number.isFinite) || pdfWidth < 2 || pdfHeight < 2) return false;

      const savedLayout = readSavedCardLayout();
      const inset = 14;
      const cards = Array.from(layer.querySelectorAll(".pf-live-sales-callout"));
      const leftCards = cards.filter((card) => card.classList.contains("side-left"));
      const rightCards = cards.filter((card) => card.classList.contains("side-right"));
      let changed = false;
      let layoutDirty = false;

      function targetTop(index, count, cardHeight) {
        const minTop = pdfY + inset;
        const maxTop = Math.max(minTop, pdfY + pdfHeight - inset - cardHeight);
        const centerY = count <= 1 ? pdfY + pdfHeight / 2 : pdfY + inset + ((pdfHeight - inset * 2) * index) / Math.max(1, count - 1);
        return clamp(centerY - cardHeight / 2, minTop, maxTop);
      }

      function place(list, side) {
        list.forEach((card, index) => {
          const code = card.dataset.unitCode || "";
          const saved = code ? savedLayout[code] : null;
          card.style.removeProperty("--pf-card-width");
          card.style.removeProperty("--pf-card-height");
          card.style.removeProperty("width");
          card.style.removeProperty("height");
          card.style.removeProperty("min-height");

          const scale = objectScale(card);
          const cardWidth = (card.offsetWidth || 192) * scale;
          const cardHeight = (card.offsetHeight || 140) * scale;
          const minLeft = pdfX + inset;
          const maxLeft = Math.max(minLeft, pdfX + pdfWidth - inset - cardWidth);
          const minTop = pdfY + inset;
          const maxTop = Math.max(minTop, pdfY + pdfHeight - inset - cardHeight);

          let nextLeft;
          let nextTop;
          if (saved) {
            nextLeft = clamp(Number(saved.left) || card.offsetLeft, minLeft, maxLeft);
            nextTop = clamp(Number(saved.top) || card.offsetTop, minTop, maxTop);
          } else if (arrangeUnsaved) {
            nextLeft = side === "left" ? minLeft : maxLeft;
            nextTop = targetTop(index, list.length, cardHeight);
          } else {
            nextLeft = clamp(card.offsetLeft, minLeft, maxLeft);
            nextTop = clamp(card.offsetTop, minTop, maxTop);
          }

          if (Math.abs(card.offsetLeft - nextLeft) > 0.5 || Math.abs(card.offsetTop - nextTop) > 0.5) changed = true;
          card.style.left = `${nextLeft}px`;
          card.style.right = "auto";
          card.style.top = `${nextTop}px`;

          if (code && !saved) {
            savedLayout[code] = { left: nextLeft, top: nextTop };
            layoutDirty = true;
          }
        });
      }

      place(leftCards, "left");
      place(rightCards, "right");
      if (layoutDirty) saveCardLayout(savedLayout);
      syncConnectorStarts();
      return changed;
    }

    function enforcePdfBoundsSoon() {
      if (groupSwitchPending) return;
      window.clearTimeout(clampTimer);
      requestAnimationFrame(() => {
        if (!groupSwitchPending) clampCardsInsidePdf({ arrangeUnsaved: true });
      });
      clampTimer = window.setTimeout(() => {
        if (!groupSwitchPending) clampCardsInsidePdf({ arrangeUnsaved: false });
      }, 220);
    }

    function render(force = false) {
      if (!stage || disposed) return;
      const group = currentGroup();
      const units = visibleUnits();
      const nextSignature = signature(units, group);
      if (!force && nextSignature === lastSignature && layer?.isConnected) return;
      lastSignature = nextSignature;

      if (!units.length) {
        layer?.remove(); layer = null; stage.classList.remove("pf-live-overview-ready");
        window.dispatchEvent(new CustomEvent("pf-overview-live-units-ready", { detail: { count: 0, located: 0, group } }));
        return;
      }

      const savedLayout = readSavedCardLayout();
      const groupScale = readGroupScale(group);
      const nextLayer = makeNode("div", "pf-callout-layer pf-live-overview-callouts");
      nextLayer.style.visibility = "hidden";
      nextLayer.setAttribute("aria-label", `Overview sell cards · ${group || "all"}`);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "pf-callout-lines pf-live-callout-lines");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("preserveAspectRatio", "none");
      nextLayer.appendChild(svg);

      const split = Math.ceil(units.length / 2);
      units.forEach((unit, index) => {
        const side = index < split ? "left" : "right";
        const row = side === "left" ? index : index - split;
        const sideCount = side === "left" ? split : units.length - split;
        const topPct = sideCount <= 1 ? 46 : 4 + (row * 90) / (sideCount - 1);

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.dataset.unitCode = unit.code;
        line.setAttribute("x1", side === "left" ? "16" : "84");
        line.setAttribute("y1", String(topPct + 5));
        line.setAttribute("x2", "50");
        line.setAttribute("y2", "50");
        line.style.opacity = "0";
        svg.appendChild(line);

        const anchor = makeNode("button", "pf-map-anchor pf-live-map-anchor");
        anchor.type = "button";
        anchor.dataset.unitCode = unit.code;
        anchor.dataset.located = "0";
        anchor.dataset.anchorMode = "detail-pending";
        anchor.textContent = unit.code;
        anchor.style.left = "50%";
        anchor.style.top = "50%";
        nextLayer.appendChild(anchor);

        const card = makeNode("article", `pf-sales-callout pf-live-sales-callout pf-sell-reference-card side-${side}`);
        const saved = savedLayout[unit.code];
        card.dataset.unitCode = unit.code;
        card.dataset.handover = canonicalOverviewGroup(unit.handover || "");
        card.dataset.pfObjectScale = String(groupScale);
        card.style.transformOrigin = "0 0";
        card.style.scale = String(groupScale);
        if (saved) {
          card.style.left = `${Number(saved.left) || 0}px`;
          card.style.right = "auto";
          card.style.top = `${Number(saved.top) || 0}px`;
        } else {
          card.style.top = `${topPct}%`;
          if (side === "left") card.style.left = "5.5%";
          else card.style.right = "5.5%";
        }
        card.innerHTML = `
          <button type="button" class="pf-sales-callout-hit" aria-label="Chọn ${escapeHtml(unit.code)}"></button>
          <div class="pf-sell-card-code">${escapeHtml(unit.code)}</div>
          <div class="pf-sell-card-specs">
            <span>DIỆN TÍCH ĐẤT:</span><b>${escapeHtml(formatArea(unit.land))}</b>
            <span>DIỆN TÍCH SÀN:</span><b>${escapeHtml(formatArea(unit.floor))}</b>
            <span>LOẠI HÌNH:</span><b>${escapeHtml(unit.type || "—")}</b>
            <span>TCBG:</span><b>${escapeHtml(canonicalOverviewGroup(unit.handover || "—"))}</b>
          </div>
          <div class="pf-sell-card-pricebox">
            <small>GIÁ ĐẤT &amp; GT TM (ĐÃ VAT)</small><strong>${escapeHtml(formatPrice(unit.priceLandVat))}</strong>
            <small>GIÁ ALL-IN</small><strong>${escapeHtml(formatPrice(unit.priceAllIn))}</strong>
          </div>`;
        nextLayer.appendChild(card);
      });

      layer?.replaceWith(nextLayer);
      if (!nextLayer.isConnected) stage.appendChild(nextLayer);
      layer = nextLayer;
      stage.classList.add("pf-live-overview-ready");

      clampCardsInsidePdf({ arrangeUnsaved: true });
      window.dispatchEvent(new CustomEvent("pf-overview-live-units-ready", { detail: { count: units.length, located: 0, group, source: "sell-sheet" } }));
      clampCardsInsidePdf({ arrangeUnsaved: false });
      syncConnectorStarts();
      nextLayer.style.visibility = "";

      requestAnimationFrame(() => {
        if (disposed || layer !== nextLayer || !nextLayer.isConnected) return;
        clampCardsInsidePdf({ arrangeUnsaved: false });
        syncConnectorStarts();
      });
    }

    function attach(nextStage) {
      if (!nextStage || nextStage === stage) return;
      layer?.remove();
      stage = nextStage;
      lastSignature = "";
      render(true);
    }

    function sync(force = false) {
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (nextStage && nextStage !== stage) attach(nextStage);
      else if (stage) render(force);
    }

    function schedule(force = false, delay = 80) {
      if (groupSwitchPending) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => sync(force), delay);
    }

    const onSell = () => schedule(true);
    const onGroup = () => {
      groupSwitchPending = true;
      window.clearTimeout(timer);
      window.clearTimeout(clampTimer);
      window.clearTimeout(groupFallbackTimer);
      groupFallbackTimer = window.setTimeout(() => {
        if (!groupSwitchPending || disposed) return;
        groupSwitchPending = false;
        sync(true);
      }, 1200);
    };
    const onPdfFrameReady = () => {
      if (!groupSwitchPending || disposed) return;
      groupSwitchPending = false;
      window.clearTimeout(groupFallbackTimer);
      sync(true);
    };
    const onPdfBounds = () => enforcePdfBoundsSoon();

    window.addEventListener("plotflow-overview-sell-units", onSell);
    window.addEventListener("pf-overview-group-changed", onGroup);
    window.addEventListener("pf-overview-pdf-frame-ready", onPdfFrameReady);
    window.addEventListener("pf-overview-pdf-bounds", onPdfBounds);

    observer = new MutationObserver((records) => {
      const relevant = records.some((record) => {
        const target = record.target instanceof Element ? record.target : record.target?.parentElement;
        if (target?.closest?.(".pf-live-overview-callouts")) return false;
        return !stage?.isConnected || Array.from(record.addedNodes || []).some((node) => node instanceof Element && (node.matches?.(".unit-select") || node.querySelector?.(".unit-select")));
      });
      if (relevant) schedule(false);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    schedule(true);

    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener("plotflow-overview-sell-units", onSell);
      window.removeEventListener("pf-overview-group-changed", onGroup);
      window.removeEventListener("pf-overview-pdf-frame-ready", onPdfFrameReady);
      window.removeEventListener("pf-overview-pdf-bounds", onPdfBounds);
      window.clearTimeout(timer);
      window.clearTimeout(clampTimer);
      window.clearTimeout(groupFallbackTimer);
      layer?.remove();
      stage?.classList.remove("pf-live-overview-ready");
    };
  }, []);

  return null;
}
