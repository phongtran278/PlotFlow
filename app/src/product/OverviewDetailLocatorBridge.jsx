import { useEffect } from "react";
import {
  attachMatchToPageRender,
  buildFloorplanIndex,
  normalizeUnitCode,
  openVectorPdf,
  renderPdfPageBase,
} from "../floorplan/pdfLocator";

const PDF_URL = "/masterplan/masterplan.pdf";
const FLOORPLAN_OVERRIDE_KEY = "plotflow-floorplan-overrides-v6";

function readFloorplanOverrides() {
  try {
    const value = JSON.parse(localStorage.getItem(FLOORPLAN_OVERRIDE_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function codesFromStage(stage) {
  return Array.from(stage?.querySelectorAll(".pf-live-sales-callout") || [])
    .map((card) => card.dataset.unitCode || card.querySelector("header strong")?.textContent?.trim() || "")
    .filter(Boolean);
}

function anchorFor(stage, code) {
  return Array.from(stage.querySelectorAll(".pf-live-map-anchor")).find((anchor) =>
    (anchor.dataset.unitCode || anchor.textContent?.trim()) === code
  ) || null;
}

function lineFor(stage, code) {
  return Array.from(stage.querySelectorAll(".pf-live-callout-lines line")).find((line) => line.dataset.unitCode === code) || null;
}

function pagePointToStagePercent(stage, pageRender) {
  const rect = stage.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2 || pageRender.width < 2 || pageRender.height < 2) return null;

  const fit = Math.min(rect.width / pageRender.width, rect.height / pageRender.height);
  const renderedWidth = pageRender.width * fit;
  const renderedHeight = pageRender.height * fit;
  const baseX = (rect.width - renderedWidth) / 2;
  const baseY = (rect.height - renderedHeight) / 2;
  const stageX = baseX + pageRender.anchorX * fit;
  const stageY = baseY + pageRender.anchorY * fit;

  return {
    x: (stageX / rect.width) * 100,
    y: (stageY / rect.height) * 100,
  };
}

export default function OverviewDetailLocatorBridge() {
  useEffect(() => {
    let disposed = false;
    let observer = null;
    let running = false;
    let lastSignature = "";
    let locatorUpdateHandler = null;

    async function sync(force = false) {
      if (disposed || running) return;
      const stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (!stage) return;
      const codes = codesFromStage(stage);
      if (!codes.length) return;

      const overrides = readFloorplanOverrides();
      const stageRect = stage.getBoundingClientRect();
      const signature = JSON.stringify({
        codes: codes.map((code) => [normalizeUnitCode(code), overrides[normalizeUnitCode(code)]?.selectedMatchIndex ?? 0]),
        size: [Math.round(stageRect.width), Math.round(stageRect.height)],
      });
      if (!force && signature === lastSignature && stage.dataset.pfDetailLocatorBridge === "1") return;

      running = true;
      try {
        const pdfDoc = await openVectorPdf(PDF_URL);
        if (disposed) return;
        const index = await buildFloorplanIndex(pdfDoc);
        if (disposed) return;

        const pageBases = new Map();
        let located = 0;
        let ambiguous = 0;

        for (const rawCode of codes) {
          const code = normalizeUnitCode(rawCode);
          const matches = index[code] || [];
          const override = overrides[code] || {};
          const requestedIndex = Math.max(0, Number(override.selectedMatchIndex) || 0);
          const selectedIndex = matches.length ? Math.min(requestedIndex, matches.length - 1) : -1;
          const match = selectedIndex >= 0 ? matches[selectedIndex] : null;
          const anchor = anchorFor(stage, rawCode);
          const line = lineFor(stage, rawCode);

          if (!anchor || !match) {
            if (anchor) {
              anchor.dataset.located = "0";
              anchor.dataset.anchorMode = "detail-not-found";
            }
            if (line) line.style.opacity = "0";
            continue;
          }

          let pageBase = pageBases.get(match.pageNumber);
          if (!pageBase) {
            pageBase = await renderPdfPageBase(pdfDoc, match.pageNumber, 1);
            pageBases.set(match.pageNumber, pageBase);
          }
          const pageRender = attachMatchToPageRender(pageBase, match);
          const point = pagePointToStagePercent(stage, pageRender);
          if (!point) continue;

          anchor.style.left = `${point.x}%`;
          anchor.style.top = `${point.y}%`;
          anchor.dataset.located = "1";
          anchor.dataset.anchorMode = "detail-locator";
          anchor.dataset.selectedMatchIndex = String(selectedIndex);
          anchor.dataset.matchCount = String(matches.length);
          anchor.dataset.pageNumber = String(match.pageNumber);
          delete anchor.dataset.saved;
          anchor.title = `${rawCode} · Detail locator · candidate ${selectedIndex + 1}/${matches.length}`;

          if (line) {
            line.setAttribute("x2", String(point.x));
            line.setAttribute("y2", String(point.y));
            line.style.opacity = "";
          }
          located += 1;
          if (matches.length > 1) ambiguous += 1;
        }

        stage.dataset.pfDetailLocatorBridge = "1";
        lastSignature = signature;
        window.dispatchEvent(new CustomEvent("pf-overview-live-units-ready", {
          detail: { count: codes.length, located, ambiguous, source: "detail-locator" },
        }));
      } catch (error) {
        console.warn("Overview Detail locator bridge unavailable", error);
      } finally {
        running = false;
      }
    }

    const schedule = (force = false) => {
      window.clearTimeout(schedule.timer);
      schedule.timer = window.setTimeout(() => sync(force), 140);
    };

    schedule(true);
    observer = new MutationObserver((records) => {
      const relevant = records.some((record) => {
        const target = record.target instanceof Element ? record.target : record.target?.parentElement;
        if (target?.closest?.(".pf-overview-control-rail")) return false;
        return !document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts")?.dataset?.pfDetailLocatorBridge
          || Array.from(record.addedNodes || []).some((node) => node instanceof Element && (node.matches?.(".pf-live-overview-callouts") || node.querySelector?.(".pf-live-overview-callouts")));
      });
      if (relevant) schedule(false);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const onStorage = (event) => {
      if (!event || event.key === FLOORPLAN_OVERRIDE_KEY) schedule(true);
    };
    locatorUpdateHandler = () => schedule(true);
    window.addEventListener("storage", onStorage);
    window.addEventListener("plotflow-floorplan-locator-updated", locatorUpdateHandler);
    window.addEventListener("resize", locatorUpdateHandler);

    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("plotflow-floorplan-locator-updated", locatorUpdateHandler);
      window.removeEventListener("resize", locatorUpdateHandler);
      window.clearTimeout(schedule.timer);
    };
  }, []);

  return null;
}
