import { useEffect } from "react";
import "./OverviewControlRailRuntime.css";

// Presentation organizer only: controls may move, but functional runtimes keep behavior ownership.

const ACTION_TITLES = { undo: "Undo the last change", redo: "Redo the last undone change", fit: "Fit PDF to workspace", in: "Zoom in", out: "Zoom out", png: "Export high-resolution PNG", pdf: "Export PDF" };
const TOOL_TITLES = { select: "Select and move cards", hand: "Pan the PDF", zoom: "Zoom tool", line: "Draw line", rect: "Draw rectangle", highlight: "Draw highlight area" };
const LAYOUT_TITLES = { same: "Match size to key object", left: "Align left", hcenter: "Align horizontal center", right: "Align right", top: "Align top", vcenter: "Align vertical center", bottom: "Align bottom", "space-v": "Distribute vertically" };
const HIGHLIGHT_OWNER_KEY = "plotflow-overview-highlight-owners-v1";

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
  group = document.createElement("section"); group.className = `pf-overview-function-group pf-overview-function-${key}`; group.dataset.overviewFunctionGroup = key;
  const heading = document.createElement("span"); heading.className = "pf-overview-function-label"; heading.textContent = label;
  const content = document.createElement("div"); content.className = "pf-overview-function-content"; group.append(heading, content); parent.appendChild(group); return group;
}
function groupContent(group) { return group?.querySelector(":scope > .pf-overview-function-content") || group; }
function moveTo(node, destination) { if (node && destination && node.parentElement !== destination) destination.appendChild(node); }
function ensureDisclosure(content, key, label) {
  if (!content) return null;
  let disclosure = content.querySelector(`:scope > [data-overview-disclosure="${key}"]`);
  if (disclosure) return disclosure.querySelector(":scope > .pf-overview-disclosure-content");
  disclosure = document.createElement("details"); disclosure.className = `pf-overview-disclosure pf-overview-disclosure-${key}`; disclosure.dataset.overviewDisclosure = key;
  disclosure.innerHTML = `<summary>${label}<span aria-hidden="true">⌄</span></summary><div class="pf-overview-disclosure-content"></div>`; content.appendChild(disclosure);
  return disclosure.querySelector(":scope > .pf-overview-disclosure-content");
}
function ensureToolbarSection(toolbar, key, label) {
  let section = toolbar.querySelector(`:scope > [data-overview-toolbar-section="${key}"]`);
  if (section) return section.querySelector(":scope > .pf-overview-toolbar-section-content");
  section = document.createElement("section"); section.className = `pf-overview-toolbar-section pf-overview-toolbar-section-${key}`; section.dataset.overviewToolbarSection = key;
  const heading = document.createElement("span"); heading.className = "pf-overview-toolbar-section-label"; heading.textContent = label;
  const content = document.createElement("div"); content.className = "pf-overview-toolbar-section-content"; section.append(heading, content); toolbar.appendChild(section); return content;
}
function organizeCanvasToolbar(toolbar) {
  if (!toolbar) return;
  const toolsContent = ensureToolbarSection(toolbar, "tools", "Common");
  const arrangeContent = ensureToolbarSection(toolbar, "arrange", "Arrange");
  const viewContent = ensureToolbarSection(toolbar, "view", "Canvas");
  moveTo(toolbar.querySelector(":scope > .pf-editor-tools"), toolsContent);
  let arrangeDisclosure = arrangeContent.querySelector(":scope > .pf-overview-arrange-disclosure");
  if (!arrangeDisclosure) { arrangeDisclosure = document.createElement("details"); arrangeDisclosure.className = "pf-overview-arrange-disclosure"; arrangeDisclosure.innerHTML = '<summary>Align & distribute<span aria-hidden="true">⌄</span></summary><div></div>'; arrangeContent.appendChild(arrangeDisclosure); }
  moveTo(toolbar.querySelector(":scope > .pf-editor-layout-tools"), arrangeDisclosure.querySelector(":scope > div"));
  moveTo(toolbar.querySelector(":scope > .pf-editor-view-tools"), viewContent);
}
function ensureAutoArrangeProxy(destination) {
  if (!destination) return null;
  let button = document.querySelector("[data-auto-arrange-proxy]");
  if (!button) {
    button = document.createElement("button"); button.type = "button"; button.className = "pf-auto-arrange-proxy"; button.dataset.autoArrangeProxy = "1";
    button.innerHTML = '<span aria-hidden="true">✦</span><b>Auto Arrange</b>'; button.title = "Preview and arrange visible cards by their lot positions";
    button.addEventListener("click", () => window.dispatchEvent(new CustomEvent("pf-overview-arrange-preview-request")));
  }
  moveTo(button, destination);
  return button;
}
export default function OverviewControlRailRuntime() {
  useEffect(() => {
    let frame = 0; let rail = null; let stage = null; let mutationObserver = null;

    function setInspectorObject(next) {
      if (!rail) return;
      const value = ["canvas", "card", "connector", "highlight"].includes(next) ? next : "canvas";
      rail.dataset.inspectorObject = value;
      rail.querySelectorAll("details[open]").forEach((details) => {
        if (value === "card" && details.closest(".pf-overview-function-object")) return;
        if (value === "connector" && details.closest(".pf-overview-function-connector")) return;
        if (value === "highlight" && details.closest(".pf-overview-function-highlight")) return;
        details.removeAttribute("open");
      });
      const changed = rail.dataset.lastInspectorObject !== value;
      if (changed && value === "connector") rail.querySelector('.pf-overview-function-connector [data-overview-disclosure="connector"]')?.setAttribute("open", "");
      if (changed && value === "highlight") rail.querySelector(".pf-overview-function-highlight .pf-pen-style-menu")?.setAttribute("open", "");
      rail.dataset.lastInspectorObject = value;
    }
    function currentCards() {
      if (!stage) return [];
      const group = String(stage.dataset.overviewGroup || "").trim();
      return Array.from(stage.querySelectorAll(".pf-live-sales-callout,.pf-sales-callout")).filter((card) => !group || !card.dataset.handover || card.dataset.handover === group);
    }
    function ensureConnectorDraftControls(content) {
      if (!content) return;
      let controls = content.querySelector(":scope > .pf-connector-endpoint-actions");
      if (!controls) {
        controls = document.createElement("div"); controls.className = "pf-connector-endpoint-actions";
        controls.innerHTML = '<button type="button" data-connector-proxy="edit">Edit endpoint</button><button type="button" data-connector-proxy="save">Save position</button><button type="button" data-connector-proxy="reset">Reset position</button><button type="button" data-connector-proxy="cancel">Cancel</button><small data-connector-draft-status>Endpoint changes require Save position.</small>';
        controls.addEventListener("click", (event) => {
          const action = event.target.closest("[data-connector-proxy]")?.dataset?.connectorProxy; if (!action) return;
          const map = { edit: "adjust", save: "save-anchor", reset: "reset-anchor", cancel: "cancel-anchor" };
          document.querySelector(`.pf-unit-navigator [data-nav="${map[action]}"]`)?.click(); requestAnimationFrame(scheduleSync);
        });
        content.prepend(controls);
      }
      const owner = document.querySelector(".pf-unit-navigator"); const draft = Boolean(owner?.classList.contains("has-anchor-draft"));
      controls.dataset.draft = draft ? "1" : "0";
      const save = controls.querySelector('[data-connector-proxy="save"]'); const cancel = controls.querySelector('[data-connector-proxy="cancel"]');
      if (save) save.hidden = !draft; if (cancel) cancel.hidden = !draft;
      const status = controls.querySelector("[data-connector-draft-status]"); if (status) status.textContent = draft ? "Unsaved endpoint · Save position or Cancel." : "Edit endpoint, drag the lot point, then Save position.";
    }
    function syncCardSelectionSummary(content) {
      if (!content) return;
      const count = currentCards().filter((card) => card.classList.contains("pf-card-selected")).length;
      if (rail) {
        rail.dataset.cardSelectionCount = String(count);
        rail.dataset.cardSelectionMode = count >= 2 ? "multi" : count === 1 ? "single" : "none";
      }
      let summary = content.querySelector(":scope > .pf-card-selection-summary"); if (!summary) { summary = document.createElement("div"); summary.className = "pf-card-selection-summary"; content.prepend(summary); }
      summary.dataset.multi = count >= 2 ? "1" : "0";
      summary.textContent = count >= 2 ? count + " cards selected · Align & Gap" : count === 1 ? "1 card selected" : "Card";
      const precision = content.querySelector(":scope > .pf-precision-arrange");
      if (precision) { precision.dataset.multiSelection = count >= 2 ? "1" : "0"; if (count >= 2) { precision.open = true; precision.dataset.autoOpened = "1"; } else if (precision.dataset.autoOpened === "1") { precision.open = false; delete precision.dataset.autoOpened; } }
    }
    function syncObjectAudit() {
      if (!stage) return; const panel = document.querySelector(".pf-overview-layer-panel"); if (!panel) return;
      const cardList = currentCards(); const validCodes = new Set(cardList.map((card) => card.dataset.unitCode || card.querySelector(".pf-sell-card-code")?.textContent?.trim() || "").filter(Boolean));
      const lines = Array.from(stage.querySelectorAll(".pf-live-callout-lines line,.pf-callout-lines line")).filter((line) => validCodes.has(line.dataset.unitCode || ""));
      let owners = {}; try { owners = JSON.parse(localStorage.getItem(HIGHLIGHT_OWNER_KEY) || "{}") || {}; } catch { owners = {}; }
      const shapes = Array.from(stage.querySelectorAll(".pf-pen-shape,[data-pen-shape-id]")).filter((shape) => validCodes.has(owners[shape.dataset.penShapeId || ""] || ""));
      const head = panel.querySelector(".pf-layer-panel-head"); const title = head?.querySelector("strong"); if (title) title.textContent = "Object audit";
      let audit = panel.querySelector(":scope > .pf-object-audit-counts"); if (!audit) { audit = document.createElement("div"); audit.className = "pf-object-audit-counts"; head?.insertAdjacentElement("afterend", audit); }
      const chip = (label, value, mismatch) => `<span class="pf-object-audit-chip${mismatch ? " is-mismatch" : ""}"><b>${label}</b><strong>${value}</strong>${mismatch ? '<i title="Count differs from cards">!</i>' : ""}</span>`;
      audit.innerHTML = chip("Cards", cardList.length, false) + chip("Connectors", lines.length, lines.length !== cardList.length) + chip("Highlights", shapes.length, shapes.length !== cardList.length);
    }
    function organizeHeaderControls(header, toolbar, guideControl) {
      if (!header || !toolbar) return;
      let bar = header.querySelector(":scope > .pf-overview-header-commandbar"); if (!bar) { bar = document.createElement("div"); bar.className = "pf-overview-header-commandbar"; header.appendChild(bar); }
      let guides = header.querySelector(":scope > .pf-overview-header-guides") || bar.querySelector(":scope > .pf-overview-header-guides");
      if (!guides) { guides = document.createElement("details"); guides.className = "pf-overview-header-guides"; guides.innerHTML = '<summary>Guides<span aria-hidden="true">⌄</span></summary><div></div>'; }
      moveTo(guideControl, guides.querySelector(":scope > div"));
      let view = bar.querySelector(":scope > .pf-overview-header-view");
      if (!view) { view = document.createElement("div"); view.className = "pf-overview-header-view"; view.innerHTML = '<button type="button" data-header-view="out" aria-label="Zoom out">−</button><output>100%</output><button type="button" data-header-view="in" aria-label="Zoom in">+</button><button type="button" data-header-view="fit">Fit</button>'; view.addEventListener("click", (event) => { const action = event.target.closest?.("[data-header-view]")?.dataset?.headerView; if (action) toolbar.querySelector(`[data-action="${action}"]`)?.click(); }); }
      const sourceOutput = toolbar.querySelector(".pf-editor-view-tools output"); const output = view.querySelector("output"); if (sourceOutput && output) output.textContent = sourceOutput.textContent || "100%";
      const tools = toolbar.querySelector(".pf-editor-tools") || header.querySelector(".pf-editor-tools");
      const arrange = ensureAutoArrangeProxy(bar);
      const exportMenu = document.querySelector(".pf-export-menu");
      [tools, arrange, guides, view, exportMenu].forEach((node) => moveTo(node, bar));
      const highlightButton = tools?.querySelector(".pf-pen-tool-button");
      if (highlightButton && highlightButton.dataset.inspectorBound !== "1") {
        highlightButton.dataset.inspectorBound = "1";
        highlightButton.addEventListener("click", () => requestAnimationFrame(() => {
          const hasSelectedHighlight = Boolean(stage?.querySelector(".pf-pen-shape.is-selected"));
          setInspectorObject(highlightButton.classList.contains("active") || hasSelectedHighlight ? "highlight" : "canvas");
          scheduleSync();
        }));
      }
    }
    function applyControlHints() {
      document.querySelectorAll(".pf-overview-control-rail button,.pf-overview-control-rail input,.pf-overview-control-rail select,.pf-overview-control-rail summary,.pf-overview-header-actions button").forEach((control) => { const label = readableLabel(control); if (!label) return; if (!control.getAttribute("title") || /^[LCRTMBS]$/.test(control.getAttribute("title") || "")) control.setAttribute("title", label); if (!control.getAttribute("aria-label") && !control.textContent?.trim()) control.setAttribute("aria-label", label); });
    }
    function distanceToSegment(px, py, x1, y1, x2, y2) { const dx = x2 - x1; const dy = y2 - y1; if (!dx && !dy) return Math.hypot(px - x1, py - y1); const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)); }
    function screenEndpoints(line) { try { const svg = line?.ownerSVGElement; const matrix = line?.getScreenCTM?.(); if (!svg || !matrix) return null; const a = svg.createSVGPoint(); const b = svg.createSVGPoint(); a.x = line.x1.baseVal.value; a.y = line.y1.baseVal.value; b.x = line.x2.baseVal.value; b.y = line.y2.baseVal.value; const p1 = a.matrixTransform(matrix); const p2 = b.matrixTransform(matrix); return { x1:p1.x,y1:p1.y,x2:p2.x,y2:p2.y }; } catch { return null; } }
    function selectConnector(line) { if (!stage || !line) return false; stage.querySelectorAll('[data-pf-connector-selected="1"]').forEach((node) => delete node.dataset.pfConnectorSelected); line.dataset.pfConnectorSelected = "1"; setInspectorObject("connector"); requestAnimationFrame(scheduleSync); return true; }
    function nearestConnector(clientX, clientY, tolerance = 12) { if (!stage) return null; const valid = new Set(currentCards().map((card) => card.dataset.unitCode || "").filter(Boolean)); let best = null; let bestDistance = tolerance; stage.querySelectorAll(".pf-live-callout-lines line,.pf-callout-lines line").forEach((line) => { if (line.dataset.unitCode && !valid.has(line.dataset.unitCode)) return; const points = screenEndpoints(line); if (!points) return; const distance = distanceToSegment(clientX, clientY, points.x1, points.y1, points.x2, points.y2); if (distance <= bestDistance) { best = line; bestDistance = distance; } }); return best; }
    function onStageClick(event) {
      if (!stage || !rail) return; const card = event.target.closest?.(".pf-live-sales-callout,.pf-sales-callout"); if (card) { setInspectorObject("card"); requestAnimationFrame(scheduleSync); return; }
      const line = event.target.closest?.(".pf-live-callout-lines line,.pf-callout-lines line"); if (line && selectConnector(line)) return;
      const highlight = event.target.closest?.(".pf-pen-shape,[data-pen-shape-id]"); if (highlight) { setInspectorObject("highlight"); return; }
      if (!event.target.closest?.(".pf-overview-control-rail,.pf-overview-header-actions")) { const nearby = nearestConnector(event.clientX, event.clientY); if (nearby && selectConnector(nearby)) return; setInspectorObject("canvas"); }
    }
    function groupControls() {
      rail = document.querySelector(".pf-overview-control-rail"); const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts"); if (!rail || !nextStage) return false;
      if (stage !== nextStage) { stage?.removeEventListener("click", onStageClick); stage = nextStage; stage.addEventListener("click", onStageClick); }
      if (!rail.dataset.inspectorObject) rail.dataset.inspectorObject = "canvas"; rail.dataset.overviewUiOwner = "control-rail-runtime"; rail.classList.remove("is-fixed-toolbar"); document.querySelectorAll(".pf-overview-control-rail-spacer").forEach((node) => node.remove());
      const primary = rail.querySelector("[data-overview-primary-tools]"); const canvas = rail.querySelector("[data-overview-canvas-tools]"); if (!primary || !canvas) return false;
      const cardContent = groupContent(ensureGroup(primary, "object", "Card"));
      const connectorContent = groupContent(ensureGroup(primary, "connector", "Connector"));
      const highlightContent = groupContent(ensureGroup(primary, "highlight", "Highlight"));
      const unitContent = groupContent(ensureGroup(primary, "unit", "Unit"));
      const viewContent = groupContent(ensureGroup(canvas, "view", "Shared"));
      moveTo(document.querySelector(".pf-card-quick-scale"), cardContent); moveTo(document.querySelector(".pf-precision-arrange"), cardContent); moveTo(document.querySelector(".pf-overview-v2-controls"), cardContent);
      const connectorDetails = ensureDisclosure(connectorContent, "connector", "Connector settings"); moveTo(document.querySelector(".pf-connector-control"), connectorDetails); ensureConnectorDraftControls(connectorContent);
      moveTo(document.querySelector(".pf-pen-style-menu"), highlightContent);
      moveTo(document.querySelector(".pf-unit-navigator"), unitContent);
      const toolbar = document.querySelector(".pf-overview-zoom-toolbar"); organizeCanvasToolbar(toolbar); moveTo(toolbar, viewContent); organizeCanvasToolbar(toolbar);
      organizeHeaderControls(document.querySelector(".pf-overview-header-actions"), toolbar, document.querySelector(".pf-overview-guide-control"));
      syncCardSelectionSummary(cardContent); syncObjectAudit(); ensureConnectorDraftControls(connectorContent);
      // Organizer sync must not reopen a contextual disclosure after outside click or Escape.
      rail.querySelectorAll(".pf-overview-function-group").forEach((group) => { group.hidden = !groupContent(group)?.children.length; }); applyControlHints(); return true;
    }
    function scheduleSync() { cancelAnimationFrame(frame); frame = requestAnimationFrame(groupControls); }
    function onGroupChanged() { setInspectorObject("canvas"); scheduleSync(); }
    function onHighlightsChanged(event) {
      if (event.detail?.selectedId || document.querySelector(".pf-pen-tool-button.active")) setInspectorObject("highlight");
      else if (rail?.dataset.inspectorObject === "highlight") setInspectorObject("canvas");
      scheduleSync();
    }
    function onConnectorEndpointSelected() { setInspectorObject("connector"); scheduleSync(); }
    mutationObserver = new MutationObserver((records) => { if (document.body.classList.contains("pf-product-overview") && records.some((record) => record.addedNodes?.length || record.removedNodes?.length)) scheduleSync(); });
    mutationObserver.observe(document.body, { childList:true, subtree:true });
    window.addEventListener("plotflow-product-view-changed", scheduleSync);
    window.addEventListener("pf-overview-group-changed", onGroupChanged);
    window.addEventListener("pf-overview-live-units-ready", scheduleSync);
    window.addEventListener("pf-overview-anchor-changed", scheduleSync);
    window.addEventListener("pf-overview-highlights-changed", onHighlightsChanged);
    window.addEventListener("pf-overview-select-highlight", onHighlightsChanged);
    window.addEventListener("pf-overview-select-connector-end", onConnectorEndpointSelected);
    scheduleSync();
    return () => {
      cancelAnimationFrame(frame); mutationObserver?.disconnect(); stage?.removeEventListener("click", onStageClick);
      window.removeEventListener("plotflow-product-view-changed", scheduleSync);
      window.removeEventListener("pf-overview-group-changed", onGroupChanged);
      window.removeEventListener("pf-overview-live-units-ready", scheduleSync);
      window.removeEventListener("pf-overview-anchor-changed", scheduleSync);
      window.removeEventListener("pf-overview-highlights-changed", onHighlightsChanged);
      window.removeEventListener("pf-overview-select-highlight", onHighlightsChanged);
      window.removeEventListener("pf-overview-select-connector-end", onConnectorEndpointSelected);
    };
  }, []);
  return null;
}
