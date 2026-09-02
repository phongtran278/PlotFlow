import { useEffect } from "react";
import "./OverviewControlRailRuntime.css";

const ACTION_TITLES = {
  undo: "Undo the last change", redo: "Redo the last undone change", fit: "Fit PDF to workspace",
  in: "Zoom in", out: "Zoom out", png: "Export high-resolution PNG", pdf: "Export PDF",
};
const TOOL_TITLES = { select: "Select and move cards", hand: "Pan the PDF", zoom: "Zoom tool", line: "Draw line", rect: "Draw rectangle", highlight: "Draw highlight area" };
const LAYOUT_TITLES = { same: "Match size to key object", left: "Align left", hcenter: "Align horizontal center", right: "Align right", top: "Align top", vcenter: "Align vertical center", bottom: "Align bottom", "space-v": "Distribute vertically" };

function readableLabel(element) {
  const action = String(element?.dataset?.action || "").trim().toLowerCase(); if (ACTION_TITLES[action]) return ACTION_TITLES[action];
  const tool = String(element?.dataset?.tool || "").trim().toLowerCase(); if (TOOL_TITLES[tool]) return TOOL_TITLES[tool];
  const layout = String(element?.dataset?.layout || "").trim().toLowerCase(); if (LAYOUT_TITLES[layout]) return LAYOUT_TITLES[layout];
  const aria = element?.getAttribute?.("aria-label")?.trim(); if (aria) return aria;
  const text = element?.textContent?.replace(/\s+/g, " ")?.trim(); return text && text.length <= 48 ? text : "";
}

function ensureGroup(parent, key, label) {
  let group = parent.querySelector(`:scope > [data-overview-function-group="${key}"]`);
  if (group) return group;
  group = document.createElement("section");
  group.className = `pf-overview-function-group pf-overview-function-${key}`;
  group.dataset.overviewFunctionGroup = key;
  const heading = document.createElement("span"); heading.className = "pf-overview-function-label"; heading.textContent = label;
  const content = document.createElement("div"); content.className = "pf-overview-function-content";
  group.append(heading, content); parent.appendChild(group); return group;
}
function groupContent(group) { return group?.querySelector(":scope > .pf-overview-function-content") || group; }
function moveTo(node, destination) { if (node && destination && node.parentElement !== destination) destination.appendChild(node); }

export default function OverviewControlRailRuntime() {
  useEffect(() => {
    let frame = 0; let rail = null; let mutationObserver = null;

    function applyControlHints() {
      if (!rail) return;
      rail.querySelectorAll("button,[role='button'],input,select,summary").forEach((control) => {
        const label = readableLabel(control); if (!label) return;
        if (!control.getAttribute("title") || /^[LCRTMBS]$/.test(control.getAttribute("title") || "")) control.setAttribute("title", label);
        if (!control.getAttribute("aria-label") && !control.textContent?.trim()) control.setAttribute("aria-label", label);
      });
    }

    function groupControls() {
      rail = document.querySelector(".pf-overview-control-rail");
      const stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (!rail || !stage) return false;
      rail.classList.remove("is-fixed-toolbar");
      document.querySelectorAll(".pf-overview-control-rail-spacer").forEach((node) => node.remove());

      const primaryTools = rail.querySelector("[data-overview-primary-tools]");
      const canvasTools = rail.querySelector("[data-overview-canvas-tools]");
      if (!primaryTools || !canvasTools) return false;

      const objectContent = groupContent(ensureGroup(primaryTools, "object", "Object"));
      const connectorContent = groupContent(ensureGroup(primaryTools, "connector", "Connector"));
      const guideContent = groupContent(ensureGroup(primaryTools, "guides", "Guides"));
      const unitContent = groupContent(ensureGroup(primaryTools, "unit", "Unit"));
      const viewContent = groupContent(ensureGroup(canvasTools, "view", "View"));

      // Preserve functional owner wrappers. Several runtimes use delegated listeners on these parents.
      moveTo(document.querySelector(".pf-card-quick-scale"), objectContent);
      moveTo(document.querySelector(".pf-precision-arrange"), objectContent);
      moveTo(document.querySelector(".pf-overview-v2-controls"), objectContent);
      moveTo(document.querySelector(".pf-connector-control"), connectorContent);
      moveTo(document.querySelector(".pf-overview-guide-control"), guideContent);
      moveTo(document.querySelector(".pf-unit-navigator"), unitContent);
      moveTo(document.querySelector(".pf-overview-zoom-toolbar"), viewContent);
      moveTo(document.querySelector(".pf-export-menu"), viewContent);

      rail.querySelectorAll(".pf-overview-function-group").forEach((group) => {
        const content = groupContent(group); group.hidden = !content?.children.length;
      });
      applyControlHints();
      return true;
    }

    function scheduleSync() { cancelAnimationFrame(frame); frame = requestAnimationFrame(groupControls); }
    mutationObserver = new MutationObserver((records) => {
      if (!document.body.classList.contains("pf-product-overview")) return;
      if (records.some((record) => record.addedNodes?.length || record.removedNodes?.length)) scheduleSync();
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("plotflow-product-view-changed", scheduleSync);
    window.addEventListener("pf-overview-group-changed", scheduleSync);
    window.addEventListener("pf-overview-live-units-ready", scheduleSync);
    scheduleSync();

    return () => {
      cancelAnimationFrame(frame); mutationObserver?.disconnect();
      window.removeEventListener("plotflow-product-view-changed", scheduleSync);
      window.removeEventListener("pf-overview-group-changed", scheduleSync);
      window.removeEventListener("pf-overview-live-units-ready", scheduleSync);
    };
  }, []);
  return null;
}
