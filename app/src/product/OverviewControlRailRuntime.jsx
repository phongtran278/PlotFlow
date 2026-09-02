import { useEffect } from "react";
import "./OverviewControlRailRuntime.css";
import "./OverviewControlRailTwoRows.css";

function topOffset() {
  if (window.innerWidth <= 680) return 66;
  if (window.innerWidth <= 1180) return 72;
  return 78;
}

const CANVAS_CONTROL_SELECTOR = [
  ".pf-overview-zoom-toolbar",
  ".pf-editor-tools",
  ".pf-editor-view-tools",
  ".pf-export-menu",
].join(",");

const ACTION_TITLES = {
  undo: "Undo the last change",
  redo: "Redo the last undone change",
  fit: "Fit the PDF to the workspace",
  "zoom-in": "Zoom in",
  "zoom-out": "Zoom out",
  hand: "Pan the PDF",
  pan: "Pan the PDF",
  select: "Select and move cards",
  highlight: "Draw a highlight area",
  underline: "Toggle highlight outline",
  stroke: "Adjust outline thickness",
  "stroke-width": "Adjust outline thickness",
};

function readableLabel(element) {
  const action = String(element?.dataset?.action || "").trim().toLowerCase();
  if (ACTION_TITLES[action]) return ACTION_TITLES[action];
  const aria = element?.getAttribute?.("aria-label")?.trim();
  if (aria) return aria;
  const text = element?.textContent?.replace(/\s+/g, " ")?.trim();
  return text && text.length <= 48 ? text : "";
}

export default function OverviewControlRailRuntime() {
  useEffect(() => {
    let frame = 0;
    let rail = null;
    let stage = null;
    let spacer = null;
    let resizeObserver = null;
    let mutationObserver = null;

    function ensureSpacer() {
      if (!rail) return null;
      if (!spacer?.isConnected) {
        spacer = document.createElement("div");
        spacer.className = "pf-overview-control-rail-spacer";
        rail.before(spacer);
      }
      return spacer;
    }

    function releaseFixed() {
      rail?.classList.remove("is-fixed-toolbar");
      rail?.style.removeProperty("--pf-fixed-rail-left");
      rail?.style.removeProperty("--pf-fixed-rail-width");
      if (spacer) spacer.style.height = "0px";
    }

    function updateFixed() {
      if (!rail?.isConnected || !spacer?.isConnected) return;
      if (!document.body.classList.contains("pf-product-overview")) {
        releaseFixed();
        return;
      }
      const rect = spacer.getBoundingClientRect();
      const top = topOffset();
      const shouldFix = rect.top <= top;
      if (!shouldFix) {
        releaseFixed();
        return;
      }
      const width = Math.max(1, rect.width || rail.getBoundingClientRect().width);
      rail.style.setProperty("--pf-fixed-rail-left", `${rect.left}px`);
      rail.style.setProperty("--pf-fixed-rail-width", `${width}px`);
      rail.classList.add("is-fixed-toolbar");
      spacer.style.height = `${rail.offsetHeight + 6}px`;
    }

    function scheduleFixed() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateFixed);
    }

    function destinationFor(element, primaryTools, canvasTools) {
      if (element?.matches?.(CANVAS_CONTROL_SELECTOR)) return canvasTools;
      return primaryTools;
    }

    function applyControlHints() {
      if (!rail) return;
      rail.querySelectorAll("button,[role='button'],input,select").forEach((control) => {
        if (control.getAttribute("title")) return;
        const label = readableLabel(control);
        if (!label) return;
        control.setAttribute("title", label);
        if (!control.getAttribute("aria-label") && !control.textContent?.trim()) control.setAttribute("aria-label", label);
      });
    }

    function moveDynamicControlsIntoRail() {
      rail = document.querySelector(".pf-overview-control-rail");
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (!rail || !stage) return false;

      const primaryTools = rail.querySelector("[data-overview-primary-tools]");
      const canvasTools = rail.querySelector("[data-overview-canvas-tools]");
      if (!primaryTools || !canvasTools) return false;

      const navigator = document.querySelector(".pf-unit-navigator");
      const toolbar = document.querySelector(".pf-overview-zoom-toolbar");
      if (navigator && navigator.parentElement !== primaryTools) primaryTools.appendChild(navigator);
      if (toolbar && toolbar.parentElement !== canvasTools) canvasTools.appendChild(toolbar);

      Array.from(rail.children).forEach((child) => {
        if (child.matches?.("[data-overview-control-row]")) return;
        const destination = destinationFor(child, primaryTools, canvasTools);
        destination.appendChild(child);
      });

      applyControlHints();
      ensureSpacer();
      if (!resizeObserver) {
        resizeObserver = new ResizeObserver(scheduleFixed);
        resizeObserver.observe(rail);
      }
      scheduleFixed();
      return true;
    }

    function scheduleSync() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(moveDynamicControlsIntoRail);
    }

    function watchDynamicControls() {
      mutationObserver?.disconnect();
      mutationObserver = new MutationObserver(() => {
        if (!document.body.classList.contains("pf-product-overview")) return;
        scheduleSync();
      });
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    function onViewChange(event) {
      if (event.detail?.screen === "project" && event.detail?.mode === "overview") {
        scheduleSync();
        watchDynamicControls();
      } else {
        releaseFixed();
      }
    }

    window.addEventListener("plotflow-product-view-changed", onViewChange);
    window.addEventListener("pf-overview-group-changed", scheduleSync);
    window.addEventListener("pf-overview-live-units-ready", scheduleSync);
    window.addEventListener("resize", scheduleFixed);
    document.addEventListener("scroll", scheduleFixed, true);
    watchDynamicControls();
    scheduleSync();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      releaseFixed();
      spacer?.remove();
      window.removeEventListener("plotflow-product-view-changed", onViewChange);
      window.removeEventListener("pf-overview-group-changed", scheduleSync);
      window.removeEventListener("pf-overview-live-units-ready", scheduleSync);
      window.removeEventListener("resize", scheduleFixed);
      document.removeEventListener("scroll", scheduleFixed, true);
    };
  }, []);

  return null;
}
