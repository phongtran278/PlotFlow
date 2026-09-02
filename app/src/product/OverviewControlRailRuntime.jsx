import { useEffect } from "react";
import "./OverviewControlRailRuntime.css";

const CANVAS_CONTROL_SELECTOR = [
  ".pf-overview-zoom-toolbar",
  ".pf-editor-tools",
  ".pf-editor-view-tools",
  ".pf-export-menu",
].join(",");

const ACTION_TITLES = {
  undo: "Undo the last change",
  redo: "Redo the last undone change",
  fit: "Fit PDF to workspace",
  in: "Zoom in",
  out: "Zoom out",
  png: "Export high-resolution PNG",
  pdf: "Export PDF",
};

const TOOL_TITLES = {
  select: "Select and move cards",
  hand: "Pan the PDF",
  zoom: "Zoom tool",
  line: "Draw line",
  rect: "Draw rectangle",
  highlight: "Draw highlight area",
};

const LAYOUT_TITLES = {
  same: "Match size to key object",
  left: "Align left",
  hcenter: "Align horizontal center",
  right: "Align right",
  top: "Align top",
  vcenter: "Align vertical center",
  bottom: "Align bottom",
  "space-v": "Distribute vertically",
};

function readableLabel(element) {
  const action = String(element?.dataset?.action || "").trim().toLowerCase();
  if (ACTION_TITLES[action]) return ACTION_TITLES[action];
  const tool = String(element?.dataset?.tool || "").trim().toLowerCase();
  if (TOOL_TITLES[tool]) return TOOL_TITLES[tool];
  const layout = String(element?.dataset?.layout || "").trim().toLowerCase();
  if (LAYOUT_TITLES[layout]) return LAYOUT_TITLES[layout];
  const align = String(element?.dataset?.align || "").trim().toLowerCase();
  if (align) return element.getAttribute("aria-label") || `Align ${align}`;
  const distribute = String(element?.dataset?.distribute || "").trim().toLowerCase();
  if (distribute) return element.getAttribute("aria-label") || `Distribute ${distribute}`;
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
    let mutationObserver = null;

    function destinationFor(element, primaryTools, canvasTools) {
      if (element?.matches?.(CANVAS_CONTROL_SELECTOR)) return canvasTools;
      return primaryTools;
    }

    function applyControlHints() {
      if (!rail) return;
      rail.querySelectorAll("button,[role='button'],input,select,summary").forEach((control) => {
        const label = readableLabel(control);
        if (!label) return;
        if (!control.getAttribute("title") || /^[LCRTMBS]$/.test(control.getAttribute("title") || "")) control.setAttribute("title", label);
        if (!control.getAttribute("aria-label") && !control.textContent?.trim()) control.setAttribute("aria-label", label);
      });
    }

    function moveDynamicControlsIntoRail() {
      rail = document.querySelector(".pf-overview-control-rail");
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (!rail || !stage) return false;

      rail.classList.remove("is-fixed-toolbar");
      document.querySelectorAll(".pf-overview-control-rail-spacer").forEach((node) => node.remove());

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
      }
    }

    window.addEventListener("plotflow-product-view-changed", onViewChange);
    window.addEventListener("pf-overview-group-changed", scheduleSync);
    window.addEventListener("pf-overview-live-units-ready", scheduleSync);
    watchDynamicControls();
    scheduleSync();

    return () => {
      cancelAnimationFrame(frame);
      mutationObserver?.disconnect();
      window.removeEventListener("plotflow-product-view-changed", onViewChange);
      window.removeEventListener("pf-overview-group-changed", scheduleSync);
      window.removeEventListener("pf-overview-live-units-ready", scheduleSync);
    };
  }, []);

  return null;
}
