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

function ensureDisclosure(content, key, label) {
  if (!content) return null;
  let disclosure = content.querySelector(`:scope > [data-overview-disclosure="${key}"]`);
  if (disclosure) return disclosure.querySelector(":scope > .pf-overview-disclosure-content");
  disclosure = document.createElement("details");
  disclosure.className = `pf-overview-disclosure pf-overview-disclosure-${key}`;
  disclosure.dataset.overviewDisclosure = key;
  disclosure.innerHTML = `<summary>${label}<span aria-hidden="true">⌄</span></summary><div class="pf-overview-disclosure-content"></div>`;
  content.appendChild(disclosure);
  return disclosure.querySelector(":scope > .pf-overview-disclosure-content");
}

function ensureToolbarSection(toolbar, key, label) {
  let section = toolbar.querySelector(`:scope > [data-overview-toolbar-section="${key}"]`);
  if (section) return section.querySelector(":scope > .pf-overview-toolbar-section-content");
  section = document.createElement("section");
  section.className = `pf-overview-toolbar-section pf-overview-toolbar-section-${key}`;
  section.dataset.overviewToolbarSection = key;
  const heading = document.createElement("span");
  heading.className = "pf-overview-toolbar-section-label";
  heading.textContent = label;
  const content = document.createElement("div");
  content.className = "pf-overview-toolbar-section-content";
  section.append(heading, content);
  toolbar.appendChild(section);
  return content;
}

function organizeCanvasToolbar(toolbar) {
  if (!toolbar) return;
  const toolsContent = ensureToolbarSection(toolbar, "tools", "Tools");
  const arrangeContent = ensureToolbarSection(toolbar, "arrange", "Arrange");
  const viewContent = ensureToolbarSection(toolbar, "view", "View");
  moveTo(toolbar.querySelector(":scope > .pf-editor-tools"), toolsContent);

  let arrangeDisclosure = arrangeContent.querySelector(":scope > .pf-overview-arrange-disclosure");
  if (!arrangeDisclosure) {
    arrangeDisclosure = document.createElement("details");
    arrangeDisclosure.className = "pf-overview-arrange-disclosure";
    arrangeDisclosure.innerHTML = '<summary>Align & distribute<span aria-hidden="true">⌄</span></summary><div></div>';
    arrangeContent.appendChild(arrangeDisclosure);
  }
  moveTo(toolbar.querySelector(":scope > .pf-editor-layout-tools"), arrangeDisclosure.querySelector(":scope > div"));
  moveTo(toolbar.querySelector(":scope > .pf-editor-view-tools"), viewContent);
  moveTo(toolbar.querySelector(":scope > .pf-export-menu"), viewContent);
}

function ensureConnectorEditProxy(connectorContent) {
  if (!connectorContent) return;
  let proxy = connectorContent.querySelector(":scope > [data-connector-edit-proxy]");
  if (!proxy) {
    proxy = document.createElement("button");
    proxy.type = "button";
    proxy.className = "pf-connector-edit-proxy";
    proxy.dataset.connectorEditProxy = "1";
    proxy.textContent = "Edit connector";
    proxy.title = "Edit the selected unit connector endpoint";
    proxy.addEventListener("click", () => {
      const source = document.querySelector('.pf-unit-navigator [data-nav="adjust"]');
      source?.click();
    });
    connectorContent.appendChild(proxy);
  }
}

function ensureAutoArrangeProxy(objectContent) {
  if (!objectContent) return;
  let proxy = objectContent.querySelector(":scope > [data-auto-arrange-proxy]");
  if (!proxy) {
    proxy = document.createElement("button");
    proxy.type = "button";
    proxy.className = "pf-auto-arrange-proxy";
    proxy.dataset.autoArrangeProxy = "1";
    proxy.innerHTML = '<span aria-hidden="true">✦</span><b>Auto Arrange</b>';
    proxy.title = "Preview and arrange visible cards by their lot positions";
    proxy.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("pf-overview-arrange-preview-request"));
    });
    objectContent.appendChild(proxy);
  }
}

function organizeHeaderControls(header, toolbar, guideControl) {
  if (!header || !toolbar) return;
  let guides = header.querySelector(":scope > .pf-overview-header-guides");
  if (!guides) {
    guides = document.createElement("details");
    guides.className = "pf-overview-header-guides";
    guides.innerHTML = '<summary>Guides<span aria-hidden="true">⌄</span></summary><div></div>';
    header.appendChild(guides);
  }
  moveTo(guideControl, guides.querySelector(":scope > div"));

  let view = header.querySelector(":scope > .pf-overview-header-view");
  if (!view) {
    view = document.createElement("div");
    view.className = "pf-overview-header-view";
    view.innerHTML = '<button type="button" data-header-view="out" aria-label="Zoom out">−</button><output>100%</output><button type="button" data-header-view="in" aria-label="Zoom in">+</button><button type="button" data-header-view="fit">Fit</button>';
    view.addEventListener("click", (event) => {
      const action = event.target.closest?.("[data-header-view]")?.dataset?.headerView;
      if (action) toolbar.querySelector(`[data-action="${action}"]`)?.click();
    });
    header.appendChild(view);
  }
  const sourceOutput = toolbar.querySelector(".pf-editor-view-tools output");
  const output = view.querySelector("output");
  if (sourceOutput && output) output.textContent = sourceOutput.textContent || "100%";
  moveTo(document.querySelector(".pf-export-menu"), header);
}

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
      ensureAutoArrangeProxy(objectContent);
      const connectorDetails = ensureDisclosure(connectorContent, "connector", "Connector settings");
      moveTo(document.querySelector(".pf-connector-control"), connectorDetails);
      ensureConnectorEditProxy(connectorContent);
      const guideControl = document.querySelector(".pf-overview-guide-control");
      moveTo(document.querySelector(".pf-unit-navigator"), unitContent);
      const canvasToolbar = document.querySelector(".pf-overview-zoom-toolbar");
      organizeCanvasToolbar(canvasToolbar);
      moveTo(canvasToolbar, viewContent);
      organizeCanvasToolbar(canvasToolbar);
      organizeHeaderControls(document.querySelector(".pf-overview-header-actions"), canvasToolbar, guideControl);

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
