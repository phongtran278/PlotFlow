import { useEffect } from "react";

const STYLE_ID = "pf-overview-highlight-point-edit-style";
const CLEARED_CLASS = "pf-highlight-selection-cleared";

export default function OverviewHighlightPointEditRuntime() {
  useEffect(() => {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .pf-masterplan-stage .pf-pen-transform-box{display:none!important}
      .pf-masterplan-stage .pf-pen-edit-anchor{display:block!important;width:9px!important;height:9px!important;border-width:1.5px!important;border-radius:2px!important;box-shadow:0 0 0 2px rgba(255,255,255,.86),0 1px 5px rgba(0,0,0,.22)!important;cursor:move!important}
      .pf-masterplan-stage .pf-pen-edit-anchor:hover,
      .pf-masterplan-stage .pf-pen-edit-anchor.is-dragging{width:11px!important;height:11px!important}
      .pf-masterplan-stage .pf-overview-pen-layer .pf-pen-shape{cursor:move!important}
      .pf-masterplan-stage .pf-overview-pen-layer .pf-pen-shape:active{cursor:grabbing!important}
      .pf-masterplan-stage.${CLEARED_CLASS} .pf-pen-edit-anchor{display:none!important}
      .pf-masterplan-stage.${CLEARED_CLASS} .pf-overview-pen-layer .pf-pen-shape.is-selected{filter:none!important}
    `;
    document.head.appendChild(style);

    function clearSelection(stage) {
      if (!stage) return;
      stage.classList.add(CLEARED_CLASS);
      document.querySelector(".pf-pen-style-menu[open]")?.removeAttribute("open");
    }

    function restoreSelection(stage) {
      stage?.classList.remove(CLEARED_CLASS);
    }

    function onPointerDown(event) {
      const stage = event.target?.closest?.(".pf-masterplan-stage");
      if (!stage) return;

      if (event.target?.closest?.("[data-pen-shape-id],.pf-pen-edit-anchor")) {
        restoreSelection(stage);
        return;
      }

      // While the Highlight drawing tool is active, empty-space clicks are drawing
      // points. Outside-click deselection applies once the tool is no longer drawing.
      if (stage.classList.contains("pf-pen-active")) return;
      if (event.target?.closest?.(".pf-overview-control-rail,.pf-overview-zoom-toolbar,.pf-unit-navigator,.pf-overview-v2-controls,.pf-pen-style-menu")) return;
      clearSelection(stage);
    }

    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      const stage = document.querySelector(".pf-masterplan-stage");
      if (stage) clearSelection(stage);
    }

    function onProductViewChange(event) {
      if (event?.detail?.screen === "project" && event?.detail?.mode === "overview") return;
      document.querySelectorAll(`.pf-masterplan-stage.${CLEARED_CLASS}`).forEach((stage) => stage.classList.remove(CLEARED_CLASS));
    }

    document.querySelectorAll(".pf-masterplan-stage.pf-highlight-point-editing").forEach((stage) => {
      stage.classList.remove("pf-highlight-point-editing");
    });

    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("plotflow-product-view-changed", onProductViewChange);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("plotflow-product-view-changed", onProductViewChange);
      document.querySelectorAll(`.pf-masterplan-stage.${CLEARED_CLASS}`).forEach((stage) => stage.classList.remove(CLEARED_CLASS));
      style.remove();
    };
  }, []);

  return null;
}
