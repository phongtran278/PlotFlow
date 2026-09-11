import { useEffect } from "react";

const STYLE_ID = "pf-overview-highlight-point-edit-style";

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
    `;
    document.head.appendChild(style);

    // Clear the old double-click edit-mode class left by earlier builds. Point handles
    // are now the default selected-shape interaction; dragging the fill moves the shape.
    document.querySelectorAll(".pf-masterplan-stage.pf-highlight-point-editing").forEach((stage) => {
      stage.classList.remove("pf-highlight-point-editing");
    });

    return () => {
      style.remove();
    };
  }, []);

  return null;
}
