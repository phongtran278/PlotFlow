const STYLE_ID = "plotflow-preview-pan-styles";
const INTERACTIVE_SELECTOR = "button, input, select, textarea, a, [contenteditable='true'], [role='button']";
const PAN_IGNORE_SELECTOR = ".quick-pin-overlay, .quick-pin-overlay *, [data-preview-pan-ignore='true'], [data-preview-pan-ignore='true'] *";

function ensurePreviewPanStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .layout-studio:not(.is-editing) .studio-canvas-scroll {
      overflow: auto !important;
      max-height: calc(100vh - 185px);
      overscroll-behavior: contain;
      scrollbar-gutter: stable;
      cursor: grab;
      -webkit-overflow-scrolling: touch;
    }

    .component-stage.preview-pan-active,
    .component-stage.preview-pan-active .component-canvas,
    .layout-studio:not(.is-editing) .studio-canvas-scroll.is-preview-panning {
      cursor: grabbing;
      user-select: none;
    }

    .component-stage.preview-pan-active *:not(button):not(input):not(select):not(textarea):not(a) {
      cursor: grabbing !important;
    }
  `;
  document.head.appendChild(style);
}

function getPreviewScroller(target) {
  const stage = target?.closest?.(".component-stage");
  if (!stage || stage.classList.contains("layout-studio-mode") || stage.classList.contains("finetune-mode")) return null;
  const scroller = stage.querySelector(".component-canvas .studio-canvas-scroll");
  if (!scroller) return null;
  const studio = scroller.closest(".layout-studio");
  if (!studio || studio.classList.contains("is-editing")) return null;
  return scroller;
}

function canPanFromTarget(target) {
  if (!target?.closest) return false;
  if (target.closest(PAN_IGNORE_SELECTOR)) return false;
  if (target.closest(INTERACTIVE_SELECTOR)) return false;
  return Boolean(target.closest(".component-canvas, .stage-header, .studio-canvas-scroll, .design-assignment-dock"));
}

export function installPreviewInteractions() {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};
  ensurePreviewPanStyles();

  let drag = null;

  function finishDrag(pointerId) {
    if (!drag) return;
    const { scroller, stage, captureTarget } = drag;
    try {
      if (pointerId != null && captureTarget?.hasPointerCapture?.(pointerId)) captureTarget.releasePointerCapture(pointerId);
    } catch {
      // Pointer capture can already be released by the browser.
    }
    scroller.classList.remove("is-preview-panning");
    stage?.classList.remove("preview-pan-active");
    drag = null;
  }

  function onPointerDown(event) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey) return;
    const scroller = getPreviewScroller(event.target);
    if (!scroller || !canPanFromTarget(event.target)) return;
    if (scroller.scrollHeight <= scroller.clientHeight && scroller.scrollWidth <= scroller.clientWidth) return;

    const stage = event.target.closest(".component-stage");
    const captureTarget = event.target instanceof Element ? event.target : scroller;
    drag = {
      scroller,
      stage,
      captureTarget,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: scroller.scrollLeft,
      startTop: scroller.scrollTop,
    };

    scroller.classList.add("is-preview-panning");
    stage?.classList.add("preview-pan-active");
    try { captureTarget.setPointerCapture?.(event.pointerId); } catch { /* optional */ }
    event.preventDefault();
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    drag.scroller.scrollLeft = drag.startLeft - dx;
    drag.scroller.scrollTop = drag.startTop - dy;
    event.preventDefault();
  }

  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    finishDrag(event.pointerId);
  }

  function onWheel(event) {
    if (event.ctrlKey || event.metaKey) return;
    const scroller = getPreviewScroller(event.target);
    if (!scroller) return;
    if (event.target?.closest?.("input[type='range'], input[type='number'], select, textarea")) return;

    // Native two-finger scrolling is already ideal while the pointer is over the artwork.
    // Everywhere else in the preview stage (header / Design Assignment / blank canvas),
    // proxy the touchpad gesture into the same artwork scroller.
    if (scroller.contains(event.target)) return;

    const canScrollY = scroller.scrollHeight > scroller.clientHeight;
    const canScrollX = scroller.scrollWidth > scroller.clientWidth;
    if (!canScrollY && !canScrollX) return;

    const beforeTop = scroller.scrollTop;
    const beforeLeft = scroller.scrollLeft;
    scroller.scrollTop += canScrollY ? event.deltaY : 0;
    scroller.scrollLeft += canScrollX ? event.deltaX : 0;

    if (scroller.scrollTop !== beforeTop || scroller.scrollLeft !== beforeLeft) {
      event.preventDefault();
    }
  }

  document.addEventListener("pointerdown", onPointerDown, { passive: false });
  document.addEventListener("pointermove", onPointerMove, { passive: false });
  document.addEventListener("pointerup", onPointerUp);
  document.addEventListener("pointercancel", onPointerUp);
  document.addEventListener("wheel", onWheel, { passive: false });

  return () => {
    finishDrag(drag?.pointerId);
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);
    document.removeEventListener("wheel", onWheel);
  };
}
