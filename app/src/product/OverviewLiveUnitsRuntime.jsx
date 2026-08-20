import { useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import "./OverviewLiveUnitsRuntime.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const QUICK_TEXT_KEY = "plotflow-quick-text-overrides-v1";
const PDF_URL = "/masterplan/masterplan.pdf";

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
      normalized,
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

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function OverviewLiveUnitsRuntime() {
  useEffect(() => {
    let stage = null;
    let layer = null;
    let observer = null;
    let disposed = false;
    let pdf = null;
    let pdfIndex = new Map();
    let indexedSignature = "";
    let renderTimer = 0;

    async function ensurePdfIndex(units) {
      const wanted = new Set(units.map((unit) => unit.normalized).filter(Boolean));
      const signature = [...wanted].sort().join("|");
      if (!signature || signature === indexedSignature) return;

      const nextIndex = new Map();
      try {
        if (!pdf) pdf = await pdfjsLib.getDocument({ url: PDF_URL, isEvalSupported: false }).promise;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          if (disposed) return;
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1 });
          const content = await page.getTextContent();

          for (const item of content.items || []) {
            if (!item?.str) continue;
            const normalizedText = normalizeCode(item.str);
            if (!normalizedText) continue;

            for (const code of wanted) {
              if (nextIndex.has(code)) continue;
              const hitIndex = normalizedText.indexOf(code);
              if (hitIndex < 0) continue;

              const x = Number(item.transform?.[4] || 0);
              const y = Number(item.transform?.[5] || 0);
              const width = Math.max(0, Number(item.width || 0));
              const height = Math.max(0, Number(item.height || Math.abs(item.transform?.[3] || 0) || 0));
              const charCount = Math.max(1, normalizedText.length);
              const centerFraction = clampFraction((hitIndex + code.length / 2) / charCount);
              const textCenterX = x + width * centerFraction;
              const textCenterY = y + height / 2;
              const [viewX, viewY] = viewport.convertToViewportPoint(textCenterX, textCenterY);

              nextIndex.set(code, {
                x: Math.max(0, Math.min(100, (viewX / viewport.width) * 100)),
                y: Math.max(0, Math.min(100, (viewY / viewport.height) * 100)),
                pageNumber,
                sourceText: item.str,
                exactSubstring: normalizedText !== code,
              });
            }
          }

          page.cleanup?.();
          if (nextIndex.size === wanted.size) break;
        }

        if (!disposed) {
          pdfIndex = nextIndex;
          indexedSignature = signature;
        }
      } catch (error) {
        console.warn("Overview live PDF text index unavailable", error);
        pdfIndex = new Map();
        indexedSignature = signature;
      }
    }

    function clampFraction(value) {
      return Math.max(0, Math.min(1, Number(value) || 0));
    }

    function locate(unit, index, total) {
      const exact = pdfIndex.get(unit.normalized);
      if (exact) return { ...exact, found: true };
      const angle = (index / Math.max(1, total)) * Math.PI * 2;
      return { x: 50 + Math.cos(angle) * 8, y: 50 + Math.sin(angle) * 8, found: false };
    }

    function render(units = readUnits()) {
      if (!stage) return;
      if (!units.length) {
        layer?.remove();
        layer = null;
        stage.classList.remove("pf-live-overview-ready");
        return;
      }

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
        const pos = locate(unit, index, units.length);

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
        anchor.dataset.pageNumber = String(pos.pageNumber || 1);
        anchor.textContent = unit.code;
        anchor.style.left = `${pos.x}%`;
        anchor.style.top = `${pos.y}%`;
        anchor.title = pos.found ? `${unit.code} · exact PDF text anchor` : `${unit.code} · chưa thấy text trong PDF, kéo chấm để chỉnh`;
        layer.appendChild(anchor);

        const card = makeNode("article", `pf-sales-callout pf-live-sales-callout side-${side}`);
        card.dataset.unitCode = unit.code;
        card.dataset.located = pos.found ? "1" : "0";
        card.style.top = `${topPct}%`;
        if (side === "left") card.style.left = "1.5%";
        else card.style.right = "1.5%";
        card.innerHTML = `
          <button type="button" class="pf-sales-callout-hit" aria-label="Chọn ${escapeHtml(unit.code)}"></button>
          <header><strong>${escapeHtml(unit.code)}</strong><span>${escapeHtml(unit.handover)}</span></header>
          <div class="pf-sales-specs"><span>Đất <b>${escapeHtml(unit.land)}</b></span><span>XD <b>${escapeHtml(unit.floor)}</b></span></div>
          <div class="pf-sales-prices"><span><small>Giá</small><b>${escapeHtml(unit.price1)}</b></span><span><small>18TH</small><b>${escapeHtml(unit.price2)}</b></span></div>
        `;
        layer.appendChild(card);
      });

      stage.appendChild(layer);
      stage.classList.add("pf-live-overview-ready");
      window.dispatchEvent(new CustomEvent("pf-overview-live-units-ready", {
        detail: { count: units.length, located: units.filter((unit) => pdfIndex.has(unit.normalized)).length },
      }));
    }

    async function rebuild() {
      if (!stage || disposed) return;
      const units = readUnits();
      await ensurePdfIndex(units);
      if (!disposed && stage) render(units);
    }

    async function attach(nextStage) {
      if (!nextStage || nextStage === stage) return;
      stage = nextStage;
      await rebuild();
    }

    function scheduleSync() {
      window.clearTimeout(renderTimer);
      renderTimer = window.setTimeout(() => {
        const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
        if (nextStage && nextStage !== stage) attach(nextStage);
        else if (stage) rebuild();
      }, 100);
    }

    scheduleSync();
    observer = new MutationObserver(scheduleSync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("plotflow-quick-text-updated", scheduleSync);

    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener("plotflow-quick-text-updated", scheduleSync);
      window.clearTimeout(renderTimer);
      layer?.remove();
      stage?.classList.remove("pf-live-overview-ready");
      try { pdf?.destroy?.(); } catch { /* noop */ }
    };
  }, []);

  return null;
}
