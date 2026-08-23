import { useEffect } from "react";

export default function OverviewLayerDisclosureRuntime() {
  useEffect(() => {
    let panel = null;
    let observer = null;
    let openCode = "";

    function applyOpenState() {
      if (!panel) return;
      panel.querySelectorAll(".pf-layer-unit[data-unit-code]").forEach((group) => {
        group.open = Boolean(openCode && group.dataset.unitCode === openCode);
      });
    }

    function attachPanel() {
      const next = document.querySelector(".pf-overview-layer-panel");
      if (!next || next === panel) return Boolean(next);
      observer?.disconnect();
      panel = next;
      observer = new MutationObserver(applyOpenState);
      observer.observe(panel, { childList: true, subtree: true });
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

    function onOverviewRefresh() {
      requestAnimationFrame(() => {
        attachPanel();
        applyOpenState();
      });
    }

    document.addEventListener("click", onClick, true);
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
      window.removeEventListener("pf-overview-live-units-ready", onOverviewRefresh);
      window.removeEventListener("pf-overview-highlights-changed", onOverviewRefresh);
      window.removeEventListener("pf-overview-annotations-changed", onOverviewRefresh);
      window.removeEventListener("plotflow-product-view-changed", onOverviewRefresh);
    };
  }, []);

  return null;
}
