import { useEffect } from "react";

function connectorPoint(stage, code, type) {
  const line = Array.from(stage?.querySelectorAll(".pf-live-callout-lines line") || []).find((node) => node.dataset.unitCode === code);
  if (!line) return null;
  return type === "connector-start"
    ? { x: Number(line.getAttribute("x1")), y: Number(line.getAttribute("y1")) }
    : { x: Number(line.getAttribute("x2")), y: Number(line.getAttribute("y2")) };
}

export default function OverviewLayerDisclosureRuntime() {
  useEffect(() => {
    let panel = null;
    let observer = null;
    let openCode = "";
    let raf = 0;

    function setGroupOpen(group, open) {
      group.classList.toggle("is-open", open);
      group.toggleAttribute("open", open);
      const summary = group.querySelector(":scope > summary");
      const body = group.querySelector(":scope > div");
      summary?.setAttribute("aria-expanded", String(open));
      if (body) {
        body.hidden = !open;
        body.setAttribute("aria-hidden", String(!open));
      }
    }

    function applyOpenState() {
      if (!panel) return;
      panel.querySelectorAll(".pf-layer-unit[data-unit-code]").forEach((group) => {
        setGroupOpen(group, Boolean(openCode && group.dataset.unitCode === openCode));
      });
    }

    function scheduleApply() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(applyOpenState);
    }

    function attachPanel() {
      const next = document.querySelector(".pf-overview-layer-panel");
      if (!next) return false;
      if (next !== panel) {
        observer?.disconnect();
        panel = next;
        observer = new MutationObserver(scheduleApply);
        observer.observe(panel, { childList: true, subtree: true });
      }
      applyOpenState();
      return true;
    }

    function toggleFromEvent(event) {
      const summary = event.target.closest?.(".pf-overview-layer-panel .pf-layer-unit[data-unit-code] > summary");
      if (!summary) return false;
      const group = summary.parentElement;
      const code = group?.dataset?.unitCode || "";
      if (!code) return false;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      openCode = openCode === code ? "" : code;
      applyOpenState();
      return true;
    }

    function onPointerDown(event) {
      toggleFromEvent(event);
    }

    function onClick(event) {
      const summary = event.target.closest?.(".pf-overview-layer-panel .pf-layer-unit[data-unit-code] > summary");
      if (!summary) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }

    function onDoubleClick(event) {
      const endpoint = event.target.closest?.(".pf-overview-layer-panel [data-layer-focus='connector-start'],.pf-overview-layer-panel [data-layer-focus='connector-end']");
      if (!endpoint) return;
      const group = endpoint.closest(".pf-layer-unit[data-unit-code]");
      const code = group?.dataset.unitCode || "";
      const stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      const point = connectorPoint(stage, code, endpoint.dataset.layerFocus);
      if (!code || !point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      window.dispatchEvent(new CustomEvent("pf-overview-focus-request", {
        detail: { code, x: point.x, y: point.y, scale: 58, animate: true, target: endpoint.dataset.layerFocus },
      }));
    }

    function onOverviewRefresh() {
      requestAnimationFrame(() => {
        attachPanel();
        applyOpenState();
      });
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("dblclick", onDoubleClick, true);
    window.addEventListener("pf-overview-live-units-ready", onOverviewRefresh);
    window.addEventListener("pf-overview-highlights-changed", onOverviewRefresh);
    window.addEventListener("pf-overview-annotations-changed", onOverviewRefresh);
    window.addEventListener("plotflow-product-view-changed", onOverviewRefresh);

    const retry = window.setInterval(() => {
      if (attachPanel()) window.clearInterval(retry);
    }, 200);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(retry);
      observer?.disconnect();
      document.removeEventListener("pointerdown", onPointerDown, true);
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
