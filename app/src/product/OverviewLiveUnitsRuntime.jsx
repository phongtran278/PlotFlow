import { useEffect } from "react";
import "./OverviewLiveUnitsRuntime.css";

const QUICK_TEXT_KEY = "plotflow-quick-text-overrides-v1";

function normalizeCode(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function readOverrides() {
  try { return JSON.parse(localStorage.getItem(QUICK_TEXT_KEY) || "{}"); }
  catch { return {}; }
}

function readUnits() {
  const overrides = readOverrides();
  return Array.from(document.querySelectorAll(".unit-select")).map((button) => {
    const code = button.querySelector(".unit-main strong")?.textContent?.trim() || "";
    const normalized = normalizeCode(code);
    const override = overrides[normalized] || {};
    const rawPrice = Array.from(button.children).at(-1)?.textContent?.trim() || "—";
    return {
      code,
      handover: override.handover || "Hoàn thiện",
      land: override.landArea ? `${override.landArea}` : "—",
      floor: override.constructionArea ? `${override.constructionArea}` : "—",
      price1: override.priceEarly ? `${override.priceEarly} tỷ` : rawPrice,
      price2: override.price18 ? `${override.price18} tỷ` : "—",
    };
  }).filter((item) => item.code);
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
    let manifest = null;
    let disposed = false;
    let lastSignature = "";

    async function loadManifest() {
      try {
        const response = await fetch("/masterplan/generated/manifest.json", { cache: "no-cache" });
        if (!response.ok) return null;
        return await response.json();
      } catch {
        return null;
      }
    }

    function locate(code, index, total) {
      const normalized = normalizeCode(code);
      const entry = manifest?.index?.[normalized]?.[0];
      const page = entry ? manifest?.pages?.[String(entry.pageNumber)] : null;
      if (entry && page?.width && page?.height) {
        const x = ((Number(entry.x || 0) + Number(entry.width || 0) / 2) / Number(page.width)) * 100;
        const y = 100 - (((Number(entry.y || 0) - Number(entry.height || 0) / 2) / Number(page.height)) * 100);
        return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)), found: true };
      }
      const angle = (index / Math.max(1, total)) * Math.PI * 2;
      return { x: 50 + Math.cos(angle) * 10, y: 50 + Math.sin(angle) * 10, found: false };
    }

    function render(force = false) {
      if (!stage) return;
      const units = readUnits();
      if (!units.length) return;
      const signature = JSON.stringify(units);
      if (!force && signature === lastSignature && layer?.isConnected) return;
      lastSignature = signature;

      layer?.remove();
      layer = makeNode("div", "pf-callout-layer pf-live-overview-callouts");
      layer.setAttribute("aria-label", "Live overview unit callouts");

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "pf-callout-lines pf-live-callout-lines");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("preserveAspectRatio", "none");
      layer.appendChild(svg);

      const split = Math.ceil(units.length / 2);
      units.forEach((unit, index) => {
        const side = index < split ? "left" : "right";
        const row = side === "left" ? index : index - split;
        const sideCount = side === "left" ? split : units.length - split;
        const topPct = sideCount <= 1 ? 46 : 5 + (row * 88) / (sideCount - 1);
        const pos = locate(unit.code, index, units.length);

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.dataset.unitCode = unit.code;
        line.setAttribute("x1", side === "left" ? "20" : "80");
        line.setAttribute("y1", String(topPct + 5));
        line.setAttribute("x2", String(pos.x));
        line.setAttribute("y2", String(pos.y));
        svg.appendChild(line);

        const anchor = makeNode("button", "pf-map-anchor pf-live-map-anchor");
        anchor.type = "button";
        anchor.dataset.unitCode = unit.code;
        anchor.dataset.located = pos.found ? "1" : "0";
        anchor.textContent = unit.code;
        anchor.style.left = `${pos.x}%`;
        anchor.style.top = `${pos.y}%`;
        anchor.title = pos.found ? `${unit.code} · PDF text anchor` : `${unit.code} · approximate anchor`;
        layer.appendChild(anchor);

        const card = makeNode("article", `pf-sales-callout pf-live-sales-callout side-${side}`);
        card.dataset.unitCode = unit.code;
        card.style.top = `${topPct}%`;
        if (side === "left") card.style.left = "1.5%";
        else card.style.right = "1.5%";
        card.innerHTML = `
          <button type="button" class="pf-sales-callout-hit" aria-label="Chọn ${unit.code}"></button>
          <header><strong>${unit.code}</strong><span>${unit.handover}</span></header>
          <div class="pf-sales-specs"><span>Đất <b>${unit.land}</b></span><span>XD <b>${unit.floor}</b></span></div>
          <div class="pf-sales-prices"><span><small>Giá</small><b>${unit.price1}</b></span><span><small>18TH</small><b>${unit.price2}</b></span></div>
        `;
        layer.appendChild(card);
      });

      stage.appendChild(layer);
      stage.classList.add("pf-live-overview-ready");
      window.dispatchEvent(new CustomEvent("pf-overview-live-units-ready", { detail: { count: units.length } }));
    }

    async function attach(nextStage) {
      if (!nextStage || nextStage === stage) return;
      stage = nextStage;
      lastSignature = "";
      manifest = manifest || await loadManifest();
      if (disposed || !stage) return;
      render(true);
    }

    function sync(force = false) {
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (nextStage && nextStage !== stage) {
        attach(nextStage);
        return;
      }
      if (stage && document.querySelectorAll(".unit-select").length) render(force);
    }

    sync();
    observer = new MutationObserver(() => {
      window.clearTimeout(window.__pfOverviewLiveUnitSyncTimer);
      window.__pfOverviewLiveUnitSyncTimer = window.setTimeout(() => sync(false), 80);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const onQuickText = () => sync(true);
    window.addEventListener("plotflow-quick-text-updated", onQuickText);

    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener("plotflow-quick-text-updated", onQuickText);
      layer?.remove();
      stage?.classList.remove("pf-live-overview-ready");
    };
  }, []);

  return null;
}
