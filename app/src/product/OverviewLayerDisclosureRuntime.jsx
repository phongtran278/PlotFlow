import { useEffect } from "react";

function linePoint(stage, code, type) {
  const line = Array.from(stage?.querySelectorAll(".pf-live-callout-lines line") || []).find((node) => node.dataset.unitCode === code);
  if (!line) return null;
  if (type === "connector-start") return { x: Number(line.getAttribute("x1")), y: Number(line.getAttribute("y1")) };
  if (type === "connector-end") return { x: Number(line.getAttribute("x2")), y: Number(line.getAttribute("y2")) };
  return null;
}

export default function OverviewLayerDisclosureRuntime() {
  useEffect(() => {
    let panel = null;
    let observer = null;
    let openCode = "";

    function applyOpenState() {
      if (!panel) return;
      panel.querySelectorAll(".pf-layer-unit[data-unit-code]").forEach((group) => {
        const open = Boolean(openCode && group.dataset.unitCode === openCode);
        group.classList.toggle("is-open", open);
        group.open = open;
        const body = group.querySelector(":scope > div");
        if (body) {
          body.hidden = !open;
          body.style.display = open ? "grid" : "none";
        }
        group.querySelector(":scope > summary")?.setAttribute("aria-expanded", String(open));
      });
    }

    function attachPanel() {
      const next = document.querySelector(".pf-overview-layer-panel");
      if (!next) return false;
      if (next !== panel) {
        observer?.disconnect();
        panel = next;
        observer = new MutationObserver(() => requestAnimationFrame(applyOpenState));
        observer.observe(panel, { childList: true, subtree: true });
      }
      applyOpenState();
      return true;
    }

    function onClick(event) {
      const summary = event.target.closest?.(".pf-overview-layer-panel .pf-layer-unit[data-unit-code] > summary");
      if (!summary) return;
      const group = summary.parentElement;
      const code = group?.dataset?.unitCode || "";
      if (!code) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      openCode = openCode === code ? "" : code;
      applyOpenState();
    }

    function onDoubleClick(event) {
      const endpoint = event.target.closest?.(".pf-overview-layer-panel [data-layer-focus='connector-start'],.pf-overview-layer-panel [data-layer-focus='connector-end']");
      if (!endpoint) return;
      const group = endpoint.closest(".pf-layer-unit[data-unit-code]");
      const code = group?.dataset.unitCode || "";
      const stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      const point = linePoint(stage, code, endpoint.dataset.layerFocus);
      if (!code || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      window.dispatchEvent(new CustomEvent("pf-overview-focus-request", { detail: { code, x: point.x, y: point.y, scale: 58 } }));
    }

    function onOverviewRefresh() {
      requestAnimationFrame(() => {
        attachPanel();
        applyOpenState();
      });
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("dblclick", onDoubleClick, true);
    window.addEventListener("pf-overview-live-units-ready", onOverviewRefresh);
    window.addEventListener("pf-overview-highlights-changed", onOverviewRefresh);
    window.addEventListener("pf-overview-annotations-changed", onOverviewRefresh);
    window.addEventListener("plotflow-product-view-changed", onOverviewRefresh);
    const retry = window.setInterval(() => {
      if (attachPanel()) window.clearInterval(retry);
    }, 250);

    return () => {
      window.clearInterval(retry);
      observer?.disconnect();
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("dblclick", onDoubleClick, true);
      window.removeEventListener("pf-overview-live-units-ready", onOverviewRefresh);
      window.removeEventListener("pf-overview-highlights-changed", onOverviewRefresh);
      window.removeEventListener("pf-overview-annotations-changed", onOverviewRefresh);
      window.removeEventListener("plotflow-product-view-changed", onOverviewRefresh);
    };
  }, []);

  return null;
}
