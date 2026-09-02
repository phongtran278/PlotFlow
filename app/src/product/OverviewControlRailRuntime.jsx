import { useEffect } from "react";
import "./OverviewControlRailRuntime.css";

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

function ensureGroup(parent, key, label) {
  let group = parent.querySelector(`:scope > [data-overview-function-group="${key}"]`);
  if (group) return group;
  group = document.createElement("section");
  group.className = `pf-overview-function-group pf-overview-function-${key}`;
  group.dataset.overviewFunctionGroup = key;
  if (label) {
    const heading = document.createElement("span");
    heading.className = "pf-overview-function-label";
    heading.textContent = label;
    group.appendChild(heading);
  }
  const content = document.createElement("div");
  content.className = "pf-overview-function-content";
  group.appendChild(content);
  parent.appendChild(group);
  return group;
}

function groupContent(group) {
  return group?.querySelector(":scope > .pf-overview-function-content") || group;
}

function buttonWithText(root, text) {
  const expected = String(text).trim().toLowerCase();
  return Array.from(root?.querySelectorAll?.("button") || []).find((button) => button.textContent?.replace(/\s+/g, " ")?.trim().toLowerCase() === expected) || null;
}

export default function OverviewControlRailRuntime() {
  useEffect(() => {
    let frame = 0;
    let rail = null;
    let stage = null;
    let mutationObserver = null;

    function applyControlHints() {
      if (!rail) return;
      rail.querySelectorAll("button,[role='button'],input,select,summary").forEach((control) => {
        const label = readableLabel(control);
        if (!label) return;
        if (!control.getAttribute("title") || /^[LCRTMBS]$/.test(control.getAttribute("title") || "")) control.setAttribute("title", label);
        if (!control.getAttribute("aria-label") && !control.textContent?.trim()) control.setAttribute("aria-label", label);
      });
    }

    function resetFunctionGroups(primaryTools, canvasTools) {
      [primaryTools, canvasTools].forEach((root) => {
        root.querySelectorAll(":scope > .pf-overview-function-group").forEach((group) => {
          const content = groupContent(group);
          Array.from(content?.children || []).forEach((child) => root.appendChild(child));
          group.remove();
        });
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
      if (navigator && !rail.contains(navigator)) primaryTools.appendChild(navigator);
      if (toolbar && !rail.contains(toolbar)) canvasTools.appendChild(toolbar);

      Array.from(rail.children).forEach((child) => {
        if (child.matches?.("[data-overview-control-row]")) return;
        primaryTools.appendChild(child);
      });

      resetFunctionGroups(primaryTools, canvasTools);

      const objectGroup = ensureGroup(primaryTools, "object", "Object");
      const connectorGroup = ensureGroup(primaryTools, "connector", "Connector");
      const guideGroup = ensureGroup(primaryTools, "guides", "Guides");
      const unitGroup = ensureGroup(primaryTools, "unit", "Unit");
      const viewGroup = ensureGroup(canvasTools, "view", "View");
      const layoutGroup = ensureGroup(canvasTools, "align", "Align");

      const objectContent = groupContent(objectGroup);
      const connectorContent = groupContent(connectorGroup);
      const guideContent = groupContent(guideGroup);
      const unitContent = groupContent(unitGroup);
      const viewContent = groupContent(viewGroup);
      const layoutContent = groupContent(layoutGroup);

      const precision = primaryTools.querySelector(".pf-precision-arrange");
      const style = primaryTools.querySelector(".pf-v2-style");
      const connectorControl = primaryTools.querySelector(".pf-connector-control");
      const arrangeButton = connectorControl?.querySelector('[data-card-action="arrange"]');
      const connectorStyle = connectorControl?.querySelector(".pf-connector-style-control");
      const quickScale = primaryTools.querySelector(".pf-card-quick-scale");

      [quickScale, precision, style, arrangeButton].filter(Boolean).forEach((node) => objectContent.appendChild(node));
      if (connectorStyle) connectorContent.appendChild(connectorStyle);

      const editConnector = buttonWithText(primaryTools, "Edit connector") || buttonWithText(navigator, "Edit connector");
      if (editConnector) connectorContent.appendChild(editConnector);

      const guideButtons = ["Guides", "Snap", "Reset"].map((text) => buttonWithText(primaryTools, text)).filter(Boolean);
      guideButtons.forEach((button) => guideContent.appendChild(button));

      if (navigator) unitContent.appendChild(navigator);

      const editorTools = canvasTools.querySelector(".pf-editor-tools");
      const editorViewTools = canvasTools.querySelector(".pf-editor-view-tools");
      const exportMenu = canvasTools.querySelector(".pf-export-menu");
      [editorTools, editorViewTools, exportMenu].filter(Boolean).forEach((node) => viewContent.appendChild(node));

      const editorLayoutTools = canvasTools.querySelector(".pf-editor-layout-tools");
      if (editorLayoutTools) layoutContent.appendChild(editorLayoutTools);

      const leftovers = Array.from(primaryTools.children).filter((child) => !child.matches?.(".pf-overview-function-group"));
      leftovers.forEach((child) => {
        if (child === connectorControl && child.children.length === 0) child.remove();
        else if (child.classList?.contains("pf-overview-v2-controls") && child.children.length === 0) child.remove();
        else connectorContent.appendChild(child);
      });

      Array.from(canvasTools.children).filter((child) => !child.matches?.(".pf-overview-function-group")).forEach((child) => viewContent.appendChild(child));

      objectGroup.hidden = objectContent.children.length === 0;
      connectorGroup.hidden = connectorContent.children.length === 0;
      guideGroup.hidden = guideContent.children.length === 0;
      unitGroup.hidden = unitContent.children.length === 0;
      viewGroup.hidden = viewContent.children.length === 0;
      layoutGroup.hidden = layoutContent.children.length === 0;

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
