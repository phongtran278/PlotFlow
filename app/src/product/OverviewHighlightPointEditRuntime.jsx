import { useEffect } from "react";

const STYLE_ID = "pf-overview-highlight-point-edit-style";
const EDIT_CLASS = "pf-highlight-point-editing";

export default function OverviewHighlightPointEditRuntime() {
  useEffect(() => {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .pf-masterplan-stage:not(.${EDIT_CLASS}) .pf-pen-edit-anchor{display:none!important}
      .pf-masterplan-stage.${EDIT_CLASS} .pf-pen-transform-box{display:none!important}
      .pf-masterplan-stage.${EDIT_CLASS} .pf-pen-edit-anchor{display:block!important;width:9px!important;height:9px!important;border-width:1.5px!important;border-radius:2px!important;box-shadow:0 0 0 2px rgba(255,255,255,.86),0 1px 5px rgba(0,0,0,.22)!important;cursor:move!important}
      .pf-masterplan-stage.${EDIT_CLASS} .pf-pen-edit-anchor:hover,
      .pf-masterplan-stage.${EDIT_CLASS} .pf-pen-edit-anchor.is-dragging{width:11px!important;height:11px!important}
      .pf-masterplan-stage.${EDIT_CLASS} .pf-overview-pen-layer .pf-pen-shape{cursor:default!important}
    `;
    document.head.appendChild(style);

    const stageFor = (target) => target?.closest?.(".pf-masterplan-stage") || null;

    function exitPointEdit(stage = document.querySelector(`.pf-masterplan-stage.${EDIT_CLASS}`)) {
      stage?.classList.remove(EDIT_CLASS);
    }

    function onDoubleClick(event) {
      const stage = stageFor(event.target);
      const shape = event.target?.closest?.("[data-pen-shape-id]");

      if (stage && shape) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        document.querySelectorAll(`.pf-masterplan-stage.${EDIT_CLASS}`).forEach((node) => {
          if (node !== stage) node.classList.remove(EDIT_CLASS);
        });
        stage.classList.add(EDIT_CLASS);
        return;
      }

      if (document.querySelector(`.pf-masterplan-stage.${EDIT_CLASS}`)) {
        exitPointEdit();
      }
    }

    function onPointerDown(event) {
      const stage = stageFor(event.target);
      if (!stage?.classList.contains(EDIT_CLASS)) return;
      if (event.target?.closest?.(".pf-pen-edit-anchor")) return;
      if (!event.target?.closest?.("[data-pen-shape-id]")) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    }

    function onKeyDown(event) {
      if (event.key !== "Escape") return;
      const stage = document.querySelector(`.pf-masterplan-stage.${EDIT_CLASS}`);
      if (!stage) return;
      event.preventDefault();
      exitPointEdit(stage);
    }

    function onProductViewChange(event) {
      if (event?.detail?.screen === "project" && event?.detail?.mode === "overview") return;
      document.querySelectorAll(`.pf-masterplan-stage.${EDIT_CLASS}`).forEach((stage) => stage.classList.remove(EDIT_CLASS));
    }

    document.addEventListener("dblclick", onDoubleClick, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("plotflow-product-view-changed", onProductViewChange);

    return () => {
      document.removeEventListener("dblclick", onDoubleClick, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("plotflow-product-view-changed", onProductViewChange);
      document.querySelectorAll(`.pf-masterplan-stage.${EDIT_CLASS}`).forEach((stage) => stage.classList.remove(EDIT_CLASS));
      style.remove();
    };
  }, []);

  return null;
}
