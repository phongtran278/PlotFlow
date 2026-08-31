import { useEffect } from "react";

const MANIFEST_URL = "/masterplan/generated/manifest.json";
const FLOORPLAN_OVERRIDE_KEY = "plotflow-floorplan-overrides-v6";

function normalizeUnitCode(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function readJson(key, fallback = {}) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
  } catch { return fallback; }
}

function codesFromStage(stage) {
  return Array.from(stage?.querySelectorAll(".pf-live-sales-callout") || [])
    .map((card) => card.dataset.unitCode || card.querySelector(".pf-sell-card-code")?.textContent?.trim() || "")
    .filter(Boolean);
}

function anchorFor(stage, code) {
  return Array.from(stage.querySelectorAll(".pf-live-map-anchor")).find((anchor) =>
    (anchor.dataset.unitCode || anchor.textContent?.trim()) === code
  ) || null;
}

function lineFor(stage, code) {
  return Array.from(stage.querySelectorAll(".pf-live-callout-lines line")).find((line) => line.dataset?.unitCode === code) || null;
}

function markUnresolved(anchor, line, rawCode) {
  if (!anchor) return;
  anchor.dataset.located = "0";
  anchor.dataset.anchorMode = "needs-placement";
  anchor.title = `${rawCode} · Needs placement`;
  if (line) {
    line.style.opacity = "";
    line.classList.add("pf-connector-needs-placement");
  }
}

export default function OverviewDetailLocatorBridge() {
  useEffect(() => {
    let disposed = false;
    let observer = null;
    let timer = 0;
    let manifestPromise = null;
    let lastSignature = "";

    function loadManifest() {
      if (!manifestPromise) {
        manifestPromise = fetch(MANIFEST_URL, { cache: "force-cache" })
          .then((response) => {
            if (!response.ok) throw new Error(`Overview manifest unavailable (${response.status})`);
            return response.json();
          })
          .catch((error) => {
            manifestPromise = null;
            throw error;
          });
      }
      return manifestPromise;
    }

    async function sync(force = false) {
      if (disposed) return;
      const stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (!stage) return;
      const codes = codesFromStage(stage);
      if (!codes.length) return;

      const overrides = readJson(FLOORPLAN_OVERRIDE_KEY, {});
      const signature = JSON.stringify({
        group: stage.dataset.overviewGroup || "",
        codes: codes.map((code) => [normalizeUnitCode(code), overrides[normalizeUnitCode(code)]?.selectedMatchIndex ?? 0]),
      });
      if (!force && signature === lastSignature && stage.dataset.pfDetailLocatorBridge === "1") return;

      try {
        const manifest = await loadManifest();
        if (disposed) return;
        const page = manifest?.pages?.["1"] || manifest?.pages?.[1];
        const pageWidth = Number(page?.width || 0);
        const pageHeight = Number(page?.height || 0);
        const index = manifest?.index || {};
        if (!(pageWidth > 0 && pageHeight > 0)) throw new Error("Overview manifest page geometry missing");

        let located = 0;
        let ambiguous = 0;
        let unresolved = 0;

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
            markUnresolved(anchor, line, rawCode);
            unresolved += 1;
            continue;
          }

          const centerX = Number(match.x || 0) + Number(match.width || 0) / 2;
          const centerYFromBottom = Number(match.y || 0) + Number(match.height || 0) / 2;
          const x = (centerX / pageWidth) * 100;
          const y = ((pageHeight - centerYFromBottom) / pageHeight) * 100;

          anchor.style.left = `${x}%`;
          anchor.style.top = `${y}%`;
          anchor.dataset.located = "1";
          anchor.dataset.anchorMode = "prepared-manifest";
          anchor.dataset.selectedMatchIndex = String(selectedIndex);
          anchor.dataset.matchCount = String(matches.length);
          anchor.dataset.pageNumber = String(match.pageNumber || 1);
          anchor.title = `${rawCode} · ${stage.dataset.overviewGroup || "Overview"} · candidate ${selectedIndex + 1}/${matches.length}`;

          if (line) {
            line.classList.remove("pf-connector-needs-placement");
            line.setAttribute("x2", String(x));
            line.setAttribute("y2", String(y));
            line.style.opacity = "";
          }
          located += 1;
          if (matches.length > 1) ambiguous += 1;
        }

        stage.dataset.pfDetailLocatorBridge = "1";
        stage.dataset.pfLocatorSource = "prepared-manifest";
        lastSignature = signature;
        window.__plotflowOverviewLocator = {
          mode: "prepared-manifest-only",
          pdfOpened: false,
          count: codes.length,
          located,
          ambiguous,
          unresolved,
        };
        window.dispatchEvent(new CustomEvent("pf-overview-live-units-ready", {
          detail: { count: codes.length, located, ambiguous, unresolved, source: "prepared-manifest", anchorMode: "prepared-manifest" },
        }));
      } catch (error) {
        console.warn("Overview prepared locator unavailable", error);
      }
    }

    function schedule(force = false) {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => sync(force), 80);
    }

    function resetAndSchedule() {
      const stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (stage) delete stage.dataset.pfDetailLocatorBridge;
      lastSignature = "";
      schedule(true);
    }

    observer = new MutationObserver((records) => {
      const relevant = records.some((record) => Array.from(record.addedNodes || []).some((node) =>
        node instanceof Element && (node.matches?.(".pf-live-overview-callouts") || node.querySelector?.(".pf-live-overview-callouts"))
      ));
      if (relevant) schedule(true);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("plotflow-floorplan-locator-updated", resetAndSchedule);
    window.addEventListener("pf-overview-group-changed", resetAndSchedule);
    window.addEventListener("plotflow-overview-sell-units", resetAndSchedule);
    schedule(true);

    return () => {
      disposed = true;
      observer?.disconnect();
      window.clearTimeout(timer);
      window.removeEventListener("plotflow-floorplan-locator-updated", resetAndSchedule);
      window.removeEventListener("pf-overview-group-changed", resetAndSchedule);
      window.removeEventListener("plotflow-overview-sell-units", resetAndSchedule);
      delete window.__plotflowOverviewLocator;
    };
  }, []);

  return null;
}
