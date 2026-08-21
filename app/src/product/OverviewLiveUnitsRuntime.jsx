import { useEffect } from "react";
import "./OverviewLiveUnitsRuntime.css";

const SELL_STORAGE_KEY = "plotflow-overview-sell-units-v1";

function readSellUnits() {
  if (Array.isArray(window.__plotflowOverviewSellUnits)) return window.__plotflowOverviewSellUnits;
  try {
    const value = JSON.parse(localStorage.getItem(SELL_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
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
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function signature(units, group) {
  return JSON.stringify({ group, units });
}

function makeNode(tag, className = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export default function OverviewLiveUnitsRuntime() {
  useEffect(() => {
    let stage = null;
    let layer = null;
    let observer = null;
    let timer = 0;
    let lastSignature = "";
    let disposed = false;

    function currentGroup() {
      return stage?.dataset?.overviewGroup || document.querySelector(".pf-overview-groups button.active")?.textContent?.trim() || "";
    }

    function sourceUnits() {
      const sell = readSellUnits();
      return sell.length ? sell : readFallbackUnits();
    }

    function visibleUnits() {
      const all = sourceUnits();
      const group = currentGroup();
      if (!group || !all.some((item) => item.handover)) return all;
      return all.filter((item) => String(item.handover || "").trim() === group);
    }

    function render(force = false) {
      if (!stage || disposed) return;
      const group = currentGroup();
      const units = visibleUnits();
      const nextSignature = signature(units, group);
      if (!force && nextSignature === lastSignature && layer?.isConnected) return;
      lastSignature = nextSignature;

      if (!units.length) {
        layer?.remove();
        layer = null;
        stage.classList.remove("pf-live-overview-ready");
        window.dispatchEvent(new CustomEvent("pf-overview-live-units-ready", { detail: { count: 0, located: 0, group } }));
        return;
      }

      const nextLayer = makeNode("div", "pf-callout-layer pf-live-overview-callouts");
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
        line.setAttribute("x1", side === "left" ? "19" : "81");
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
        card.dataset.unitCode = unit.code;
        card.dataset.handover = unit.handover || "";
        card.style.top = `${topPct}%`;
        if (side === "left") card.style.left = "1.5%";
        else card.style.right = "1.5%";
        card.innerHTML = `
          <button type="button" class="pf-sales-callout-hit" aria-label="Chọn ${escapeHtml(unit.code)}"></button>
          <div class="pf-sell-card-code">${escapeHtml(unit.code)}</div>
          <div class="pf-sell-card-specs">
            <span>DIỆN TÍCH ĐẤT:</span><b>${escapeHtml(formatArea(unit.land))}</b>
            <span>DIỆN TÍCH SÀN:</span><b>${escapeHtml(formatArea(unit.floor))}</b>
            <span>LOẠI HÌNH:</span><b>${escapeHtml(unit.type || "—")}</b>
            <span>TCBG:</span><b>${escapeHtml(unit.handover || "—")}</b>
          </div>
          <div class="pf-sell-card-pricebox">
            <small>GIÁ ĐẤT &amp; GT TM (ĐÃ VAT)</small>
            <strong>${escapeHtml(formatPrice(unit.priceLandVat))}</strong>
            <small>GIÁ ALL-IN</small>
            <strong>${escapeHtml(formatPrice(unit.priceAllIn))}</strong>
          </div>`;
        nextLayer.appendChild(card);
      });

      layer?.replaceWith(nextLayer);
      if (!nextLayer.isConnected) stage.appendChild(nextLayer);
      layer = nextLayer;
      stage.classList.add("pf-live-overview-ready");
      window.dispatchEvent(new CustomEvent("pf-overview-live-units-ready", { detail: { count: units.length, located: 0, group, source: "sell-sheet" } }));
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

    function schedule(force = false) {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => sync(force), 80);
    }

    const onSell = () => schedule(true);
    const onGroup = () => schedule(true);
    window.addEventListener("plotflow-overview-sell-units", onSell);
    window.addEventListener("pf-overview-group-changed", onGroup);

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
      window.clearTimeout(timer);
      layer?.remove();
      stage?.classList.remove("pf-live-overview-ready");
    };
  }, []);

  return null;
}
