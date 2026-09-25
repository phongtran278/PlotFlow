import { useEffect } from "react";
import "./OverviewArrangeModesRuntime.css";

const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const ARRANGE_UI_KEY = "plotflow-overview-arrange-preview-v1";
const GROUP_STYLE_KEY = "plotflow-overview-group-style-v1";
const SAFE_TOP_PX = 96;
const SAFE_BOTTOM_PX = 20;
const EDGE_PAD_PX = 14;
const CENTER_PAD_PX = 18;
const LANE_GAP_PX = 16;
const CONNECTOR_CLEARANCE_PX = 6;
const MIN_AUTO_SCALE = 0.72;
const MODES = ["smart", "balanced", "compact", "left", "right"];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function readJson(key, fallback = {}) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

function codeFor(card) {
  return card?.dataset?.unitCode
    || card?.querySelector(".pf-sell-card-code")?.textContent?.trim()
    || "";
}

function scaleFor(card) {
  const value = Number(card?.dataset?.pfObjectScale || card?.style?.scale || 1);
  return Number.isFinite(value) ? clamp(value, 0.2, 2.2) : 1;
}

function orientation(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function pointOnSegment(a, b, p, epsilon = 0.00001) {
  return Math.abs(orientation(a, b, p)) <= epsilon
    && p.x >= Math.min(a.x, b.x) - epsilon && p.x <= Math.max(a.x, b.x) + epsilon
    && p.y >= Math.min(a.y, b.y) - epsilon && p.y <= Math.max(a.y, b.y) + epsilon;
}

function pointSegmentDistancePx(point, a, b, bounds) {
  const px = point.x * bounds.width;
  const py = point.y * bounds.height;
  const ax = a.x * bounds.width;
  const ay = a.y * bounds.height;
  const bx = b.x * bounds.width;
  const by = b.y * bounds.height;
  const dx = bx - ax;
  const dy = by - ay;
  const length2 = dx * dx + dy * dy;
  if (length2 <= 0.0001) return Math.hypot(px - ax, py - ay);
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / length2, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function segmentDistancePx(first, second, bounds) {
  return Math.min(
    pointSegmentDistancePx(first.a, second.a, second.b, bounds),
    pointSegmentDistancePx(first.b, second.a, second.b, bounds),
    pointSegmentDistancePx(second.a, first.a, first.b, bounds),
    pointSegmentDistancePx(second.b, first.a, first.b, bounds),
  );
}

export default function OverviewArrangeLogicRuntimeV3() {
  useEffect(() => {
    let disposed = false;
    let overlay = null;
    let stage = null;
    let canvas = null;
    let items = [];
    let solutions = new Map();
    let selectedMode = "smart";
    let selectedSolution = null;
    let drag = null;
    const ui = { gap: clamp(readJson(ARRANGE_UI_KEY, {}).gap ?? 14, 0, 120) };

    function currentGroup() {
      return String(stage?.dataset?.overviewGroup || "").trim();
    }

    function syncStage() {
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts") || null;
      return stage;
    }

    function activeLayer() {
      if (!stage) return null;
      const group = currentGroup();
      const layers = Array.from(stage.querySelectorAll(".pf-live-overview-callouts:not(.pf-callouts-leaving)"));
      if (!group) return layers[0] || stage.querySelector(".pf-live-overview-callouts");
      return layers.find((node) => String(node.dataset.overviewGroup || "").trim() === group) || null;
    }

    function pdfBounds() {
      if (!stage) return null;
      const x = Number(stage.dataset.pfPdfX);
      const y = Number(stage.dataset.pfPdfY);
      const width = Number(stage.dataset.pfPdfWidth);
      const height = Number(stage.dataset.pfPdfHeight);
      if (![x, y, width, height].every(Number.isFinite) || width < 2 || height < 2) return null;
      return { x, y, width, height };
    }

    function safeArea(bounds) {
      const topPx = clamp(SAFE_TOP_PX, 0, bounds.height * 0.18);
      const bottomPx = clamp(SAFE_BOTTOM_PX, 0, bounds.height * 0.08);
      return {
        topPx,
        bottomPx,
        top: topPx / bounds.height,
        bottom: bottomPx / bounds.height,
        heightPx: Math.max(1, bounds.height - topPx - bottomPx),
      };
    }

    function anchorFor(code, bounds) {
      const layer = activeLayer();
      const anchor = Array.from(layer?.querySelectorAll(".pf-live-map-anchor") || [])
        .find((node) => (node.dataset.unitCode || node.textContent?.trim()) === code);
      if (!anchor) return { x: 0.5, y: 0.5, resolved: false };
      const stageW = stage.clientWidth || 1;
      const stageH = stage.clientHeight || 1;
      const px = Number.parseFloat(anchor.style.left || "50") / 100 * stageW;
      const py = Number.parseFloat(anchor.style.top || "50") / 100 * stageH;
      return {
        x: clamp((px - bounds.x) / bounds.width, 0.02, 0.98),
        y: clamp((py - bounds.y) / bounds.height, 0.02, 0.98),
        resolved: anchor.dataset.located === "1" || anchor.dataset.saved === "1",
      };
    }

    function captureItems() {
      const bounds = pdfBounds();
      const layer = activeLayer();
      if (!bounds || !layer) return [];
      return Array.from(layer.querySelectorAll(".pf-live-sales-callout"))
        .map((card, index) => {
          const code = codeFor(card);
          return {
            card,
            code,
            index,
            rawWidth: card.offsetWidth || 192,
            rawHeight: card.offsetHeight || 132,
            baseScale: scaleFor(card),
            anchor: anchorFor(code, bounds),
          };
        })
        .filter((item) => item.code);
    }

    function sized(item, ratio) {
      return {
        width: item.rawWidth * item.baseScale * ratio,
        height: item.rawHeight * item.baseScale * ratio,
      };
    }

    function scaleRatios() {
      const ratios = [1, 0.94, 0.9, 0.86, 0.82, 0.78, 0.74, 0.72]
        .filter((ratio) => items.every((item) => item.baseScale * ratio >= MIN_AUTO_SCALE - 0.001));
      return ratios.length ? ratios : [1];
    }

    function gapCandidates() {
      const preferred = clamp(ui.gap, 0, 120);
      const candidates = [preferred, 32, 24, 20, 16, 14, 12, 10, 8, 6, 4, 2, 0]
        .filter((gap) => gap <= preferred + 0.001);
      return [...new Set(candidates)].sort((a, b) => b - a);
    }

    function loadOf(list, ratio, gapPx) {
      return list.reduce((sum, item) => sum + sized(item, ratio).height, 0)
        + Math.max(0, list.length - 1) * gapPx;
    }

    function primarySplit(mode, ratio, gapPx) {
      const sorted = [...items].sort((a, b) => a.anchor.y - b.anchor.y || a.code.localeCompare(b.code));
      if (mode === "left") return { left: sorted, right: [] };
      if (mode === "right") return { left: [], right: sorted };
      if (mode === "smart") {
        const left = [];
        const right = [];
        let leftLoad = 0;
        let rightLoad = 0;
        sorted.forEach((item) => {
          const preferred = item.anchor.x < 0.47 ? "left" : item.anchor.x > 0.53 ? "right" : null;
          if (preferred === "left") { left.push(item); leftLoad += sized(item, ratio).height + gapPx; return; }
          if (preferred === "right") { right.push(item); rightLoad += sized(item, ratio).height + gapPx; return; }
          if (leftLoad <= rightLoad) { left.push(item); leftLoad += sized(item, ratio).height + gapPx; }
          else { right.push(item); rightLoad += sized(item, ratio).height + gapPx; }
        });
        return { left, right };
      }
      const left = [];
      const right = [];
      sorted.forEach((item) => {
        if (loadOf(left, ratio, gapPx) <= loadOf(right, ratio, gapPx)) left.push(item);
        else right.push(item);
      });
      return { left, right };
    }

    function splitPenalty(mode, groups, ratio, gapPx) {
      if (mode === "left" || mode === "right") return 0;
      const leftSet = new Set(groups.left.map((item) => item.code));
      const leftLoad = loadOf(groups.left, ratio, gapPx);
      const rightLoad = loadOf(groups.right, ratio, gapPx);
      const balance = Math.abs(leftLoad - rightLoad) / Math.max(1, leftLoad + rightLoad);
      if (mode === "smart") {
        let wrongSide = 0;
        items.forEach((item) => {
          const onLeft = leftSet.has(item.code);
          const preferredLeft = item.anchor.x < 0.47;
          const preferredRight = item.anchor.x > 0.53;
          if ((preferredLeft && !onLeft) || (preferredRight && onLeft)) wrongSide += 1;
        });
        return wrongSide * 1000 + balance * 10;
      }
      return Math.abs(groups.left.length - groups.right.length) * 100 + balance * 10;
    }

    function candidateSplits(mode, ratio, gapPx) {
      const primary = primarySplit(mode, ratio, gapPx);
      if (mode === "left" || mode === "right") return [primary];
      if (items.length > 10) return [primary];
      const sorted = [...items].sort((a, b) => a.anchor.y - b.anchor.y || a.code.localeCompare(b.code));
      const entries = [];
      const seen = new Set();
      const push = (groups) => {
        const signature = groups.left.map((item) => item.code).sort().join(",");
        if (seen.has(signature)) return;
        seen.add(signature);
        entries.push({ groups, penalty: splitPenalty(mode, groups, ratio, gapPx) });
      };
      push(primary);
      const masks = 1 << sorted.length;
      for (let mask = 0; mask < masks; mask += 1) {
        const left = [];
        const right = [];
        sorted.forEach((item, index) => ((mask >> index) & 1 ? right : left).push(item));
        push({ left, right });
      }
      entries.sort((a, b) => a.penalty - b.penalty);
      return entries.map((entry) => entry.groups);
    }

    function packLanes(list, ratio, bounds, gapPx) {
      if (!list.length) return [];
      const safe = safeArea(bounds);
      const sorted = [...list].sort((a, b) => a.anchor.y - b.anchor.y || a.code.localeCompare(b.code));
      const lanes = [[]];
      const loads = [0];
      sorted.forEach((item) => {
        const height = sized(item, ratio).height;
        let laneIndex = lanes.length - 1;
        const current = lanes[laneIndex];
        const extra = height + (current.length ? gapPx : 0);
        if (current.length && loads[laneIndex] + extra > safe.heightPx + 0.5) {
          lanes.push([]);
          loads.push(0);
          laneIndex += 1;
        }
        const lane = lanes[laneIndex];
        loads[laneIndex] += height + (lane.length ? gapPx : 0);
        lane.push(item);
      });
      return lanes;
    }

    function laneXPositions(lanes, side, ratio, bounds, compact) {
      if (!lanes.length) return [];
      const widths = lanes.map((lane) => Math.max(...lane.map((item) => sized(item, ratio).width), 1));
      const laneGap = compact ? 10 : LANE_GAP_PX;
      const available = bounds.width / 2 - EDGE_PAD_PX - CENTER_PAD_PX;
      const required = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * laneGap;
      if (required > available + 0.5) return null;
      const positions = [];
      if (side === "left") {
        let cursor = EDGE_PAD_PX;
        widths.forEach((width) => {
          positions.push((cursor + width / 2) / bounds.width);
          cursor += width + laneGap;
        });
      } else {
        let cursor = bounds.width - EDGE_PAD_PX;
        widths.forEach((width) => {
          positions.push((cursor - width / 2) / bounds.width);
          cursor -= width + laneGap;
        });
      }
      return positions;
    }

    function placeSide(list, side, mode, ratio, gapPx, bounds, layout) {
      if (!list.length) return { feasible: true, lanes: 0 };
      const safe = safeArea(bounds);
      const lanes = packLanes(list, ratio, bounds, gapPx);
      const xs = laneXPositions(lanes, side, ratio, bounds, mode === "compact");
      if (!xs) return { feasible: false, reason: `${side} side needs more horizontal room` };
      for (let laneIndex = 0; laneIndex < lanes.length; laneIndex += 1) {
        const lane = lanes[laneIndex];
        const totalHeight = loadOf(lane, ratio, gapPx);
        if (totalHeight > safe.heightPx + 0.5) return { feasible: false, reason: "Cards exceed usable PDF height" };
        const anchorMean = lane.reduce((sum, item) => sum + item.anchor.y, 0) / Math.max(1, lane.length);
        const targetCenterPx = mode === "smart" ? anchorMean * bounds.height : safe.topPx + safe.heightPx / 2;
        const minStart = safe.topPx;
        const maxStart = Math.max(minStart, bounds.height - safe.bottomPx - totalHeight);
        let cursor = clamp(targetCenterPx - totalHeight / 2, minStart, maxStart);
        lane.forEach((item) => {
          const size = sized(item, ratio);
          layout[item.code] = { x: xs[laneIndex], y: (cursor + size.height / 2) / bounds.height };
          cursor += size.height + gapPx;
        });
      }
      return { feasible: true, lanes: lanes.length };
    }

    function sideContractSatisfied(mode, layout, ratio, bounds) {
      if (mode !== "left" && mode !== "right") return true;
      const centerPad = CENTER_PAD_PX / bounds.width;
      return items.every((item) => {
        const point = layout[item.code];
        if (!point) return false;
        const halfW = sized(item, ratio).width / bounds.width / 2;
        return mode === "left"
          ? point.x + halfW <= 0.5 - centerPad + 0.0001
          : point.x - halfW >= 0.5 + centerPad - 0.0001;
      });
    }

    function connectorSegment(item, point, ratio, bounds) {
      if (!item.anchor.resolved || !point) return null;
      const size = sized(item, ratio);
      const halfW = Math.max(size.width / bounds.width / 2, 0.0001);
      const halfH = Math.max(size.height / bounds.height / 2, 0.0001);
      const dx = item.anchor.x - point.x;
      const dy = item.anchor.y - point.y;
      const denominator = Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH, 0.0001);
      return {
        code: item.code,
        a: { x: point.x + dx / denominator, y: point.y + dy / denominator },
        b: { x: item.anchor.x, y: item.anchor.y },
      };
    }

    function trimmed(segment, bounds) {
      const ax = segment.a.x * bounds.width;
      const ay = segment.a.y * bounds.height;
      const bx = segment.b.x * bounds.width;
      const by = segment.b.y * bounds.height;
      const length = Math.hypot(bx - ax, by - ay);
      const anchorTrimPx = clamp(Math.min(bounds.width, bounds.height) * 0.085, 28, 52);
      const cardTrimPx = 4;
      if (length <= cardTrimPx + anchorTrimPx + 2) return null;
      const startT = clamp(cardTrimPx / length, 0, 0.42);
      const endT = clamp(1 - anchorTrimPx / length, 0.58, 1);
      if (endT <= startT) return null;
      const at = (t) => ({
        x: segment.a.x + (segment.b.x - segment.a.x) * t,
        y: segment.a.y + (segment.b.y - segment.a.y) * t,
      });
      return { code: segment.code, a: at(startT), b: at(endT) };
    }

    function segmentsConflict(first, second, bounds) {
      const aBody = trimmed(first, bounds);
      const bBody = trimmed(second, bounds);
      if (!aBody || !bBody) return false;
      const a = aBody.a; const b = aBody.b; const c = bBody.a; const d = bBody.b;
      const o1 = orientation(a, b, c);
      const o2 = orientation(a, b, d);
      const o3 = orientation(c, d, a);
      const o4 = orientation(c, d, b);
      const epsilon = 0.00001;
      const strictCross = ((o1 > epsilon && o2 < -epsilon) || (o1 < -epsilon && o2 > epsilon))
        && ((o3 > epsilon && o4 < -epsilon) || (o3 < -epsilon && o4 > epsilon));
      if (strictCross) return true;
      const exactOverlap = (Math.abs(o1) <= epsilon && pointOnSegment(a, b, c, epsilon))
        || (Math.abs(o2) <= epsilon && pointOnSegment(a, b, d, epsilon))
        || (Math.abs(o3) <= epsilon && pointOnSegment(c, d, a, epsilon))
        || (Math.abs(o4) <= epsilon && pointOnSegment(c, d, b, epsilon));
      if (exactOverlap) return true;
      return segmentDistancePx(aBody, bBody, bounds) < CONNECTOR_CLEARANCE_PX;
    }

    function connectorConflictCount(layout, ratio, bounds) {
      const segments = items
        .map((item) => connectorSegment(item, layout[item.code], ratio, bounds))
        .filter(Boolean);
      let conflicts = 0;
      for (let i = 0; i < segments.length; i += 1) {
        for (let j = i + 1; j < segments.length; j += 1) {
          if (segmentsConflict(segments[i], segments[j], bounds)) conflicts += 1;
        }
      }
      return conflicts;
    }

    function solve(mode) {
      const bounds = pdfBounds();
      if (!bounds) return { feasible: false, reason: "PDF bounds are not ready" };
      let lastReason = "No safe geometry found";
      for (const ratio of scaleRatios()) {
        for (const gapPx of gapCandidates()) {
          for (const groups of candidateSplits(mode, ratio, gapPx)) {
            const layout = {};
            const left = placeSide(groups.left, "left", mode, ratio, gapPx, bounds, layout);
            if (!left.feasible) { lastReason = left.reason; continue; }
            const right = placeSide(groups.right, "right", mode, ratio, gapPx, bounds, layout);
            if (!right.feasible) { lastReason = right.reason; continue; }
            if (!sideContractSatisfied(mode, layout, ratio, bounds)) {
              lastReason = `${mode === "left" ? "Left" : "Right"} side cannot contain every card safely`;
              continue;
            }
            const conflicts = connectorConflictCount(layout, ratio, bounds);
            if (conflicts > 0) { lastReason = `${conflicts} body connector conflict${conflicts === 1 ? "" : "s"} remain`; continue; }
            return {
              feasible: true,
              mode,
              layout,
              ratio,
              gap: gapPx,
              lanes: left.lanes + right.lanes,
            };
          }
        }
      }
      if (mode === "left" || mode === "right") {
        return { feasible: false, mode, reason: `${items.length} cards cannot fit entirely on the ${mode} safely` };
      }
      return { feasible: false, mode, reason: lastReason };
    }

    function solveAll() {
      solutions = new Map(MODES.map((mode) => [mode, solve(mode)]));
    }

    function modeLabel(mode) {
      return mode === "smart" ? "Smart L/R"
        : mode === "balanced" ? "Balanced"
          : mode === "compact" ? "Compact"
            : mode === "left" ? "All left" : "All right";
    }

    function syncModeButtons() {
      overlay?.querySelectorAll("[data-arrange-mode]").forEach((button) => {
        const solution = solutions.get(button.dataset.arrangeMode);
        button.disabled = !solution?.feasible;
        button.setAttribute("aria-disabled", solution?.feasible ? "false" : "true");
        button.title = solution?.feasible ? "Layout available" : solution?.reason || "Layout unavailable";
        const small = button.querySelector("small");
        if (small) small.dataset.baseText ||= small.textContent;
        if (small) small.textContent = solution?.feasible
          ? `${small.dataset.baseText}${solution.gap < ui.gap ? ` · auto gap ${solution.gap}px` : ""}`
          : `Not feasible · ${solution?.reason || "insufficient space"}`;
      });
    }

    function renderEmptyState() {
      if (!canvas) return;
      const reasons = MODES
        .map((mode) => solutions.get(mode)?.reason)
        .filter(Boolean);
      const reason = reasons[0] || "No safe geometry found";
      canvas.innerHTML = `<div style="height:100%;display:grid;place-items:center;padding:32px;text-align:center;color:#666;font-size:13px;line-height:1.5"><div><strong style="display:block;color:#222;margin-bottom:6px">No safe layout found</strong>${reason}. Auto Arrange kept body connector crossings at zero and ignored only the natural fan-in zone beside lot points.</div></div>`;
    }

    function renderSelected() {
      if (!canvas || !selectedSolution?.feasible) return;
      const bounds = pdfBounds();
      if (!bounds) return;
      const safe = safeArea(bounds);
      canvas.innerHTML = "";
      const reserved = document.createElement("div");
      reserved.className = "pf-arrange-preview-safe-top";
      reserved.style.height = `${safe.top * 100}%`;
      reserved.innerHTML = "<span>Reserved banner area</span>";
      canvas.appendChild(reserved);
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.classList.add("pf-arrange-preview-lines");
      svg.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
      svg.setAttribute("preserveAspectRatio", "none");
      canvas.appendChild(svg);

      items.forEach((item) => {
        const point = selectedSolution.layout[item.code];
        if (!point) return;
        const size = sized(item, selectedSolution.ratio);
        const anchor = document.createElement("span");
        anchor.className = `pf-arrange-preview-anchor${item.anchor.resolved ? " is-resolved" : ""}`;
        anchor.style.left = `${item.anchor.x * 100}%`;
        anchor.style.top = `${item.anchor.y * 100}%`;
        canvas.appendChild(anchor);

        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "pf-arrange-preview-chip";
        chip.dataset.code = item.code;
        chip.textContent = item.code;
        chip.style.left = `${point.x * 100}%`;
        chip.style.top = `${point.y * 100}%`;
        chip.style.setProperty("--pf-preview-card-w", `${clamp(size.width / bounds.width * 100, 4, 20)}%`);
        chip.style.setProperty("--pf-preview-card-h", `${clamp(size.height / bounds.height * 100, 3.5, 20)}%`);
        chip.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          drag = { code: item.code, pointerId: event.pointerId, node: chip };
          chip.setPointerCapture?.(event.pointerId);
        });
        canvas.appendChild(chip);

        const segment = connectorSegment(item, point, selectedSolution.ratio, bounds);
        if (segment) {
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", String(segment.a.x * bounds.width));
          line.setAttribute("y1", String(segment.a.y * bounds.height));
          line.setAttribute("x2", String(segment.b.x * bounds.width));
          line.setAttribute("y2", String(segment.b.y * bounds.height));
          svg.appendChild(line);
        }
      });

      overlay.querySelectorAll("[data-arrange-mode]").forEach((button) => {
        button.classList.toggle("active", button.dataset.arrangeMode === selectedMode);
      });
      const label = overlay.querySelector("[data-arrange-mode-label]");
      if (label) label.textContent = modeLabel(selectedMode);
      const footer = overlay.querySelector("footer>span");
      const percent = Math.round((items[0]?.baseScale || 1) * selectedSolution.ratio * 100);
      const gapText = selectedSolution.gap < ui.gap ? `auto gap ${selectedSolution.gap}px` : `${selectedSolution.gap}px gap`;
      if (footer) footer.textContent = `${items.length} cards · ${gapText} · ${selectedSolution.lanes} lane${selectedSolution.lanes === 1 ? "" : "s"}${selectedSolution.ratio < 0.999 ? ` · auto-fit ${percent}%` : ""} · 0 body connector conflicts`;
      const apply = overlay.querySelector("[data-arrange-apply]");
      if (apply) { apply.disabled = false; apply.textContent = "Apply layout"; }
    }

    function selectMode(mode) {
      const solution = solutions.get(mode);
      if (!solution?.feasible) return;
      selectedMode = mode;
      selectedSolution = structuredClone(solution);
      renderSelected();
    }

    function persistScale(ratio) {
      if (ratio >= 0.999 || !items.length) return;
      const group = currentGroup();
      const styles = readJson(GROUP_STYLE_KEY, {});
      const finalScale = clamp(items[0].baseScale * ratio, 0.2, 2.2);
      styles[group] = { ...(styles[group] || {}), scale: Math.round(finalScale * 100) };
      localStorage.setItem(GROUP_STYLE_KEY, JSON.stringify(styles));
      items.forEach((item) => {
        const scale = clamp(item.baseScale * ratio, 0.2, 2.2);
        item.card.dataset.pfObjectScale = String(scale);
        item.card.style.transformOrigin = "0 0";
        item.card.style.scale = String(scale);
      });
    }

    function applySelected() {
      if (!selectedSolution?.feasible) return;
      const bounds = pdfBounds();
      if (!bounds) return;
      if (!sideContractSatisfied(selectedMode, selectedSolution.layout, selectedSolution.ratio, bounds)) return;
      if (connectorConflictCount(selectedSolution.layout, selectedSolution.ratio, bounds) > 0) return;
      const safe = safeArea(bounds);
      persistScale(selectedSolution.ratio);
      const layout = readJson(CARD_LAYOUT_KEY, {});
      items.forEach((item) => {
        const point = selectedSolution.layout[item.code];
        if (!point) return;
        const size = sized(item, selectedSolution.ratio);
        const minTop = bounds.y + safe.topPx;
        const maxTop = bounds.y + bounds.height - safe.bottomPx - size.height;
        const left = clamp(bounds.x + point.x * bounds.width - size.width / 2, bounds.x, bounds.x + bounds.width - size.width);
        const top = clamp(bounds.y + point.y * bounds.height - size.height / 2, minTop, Math.max(minTop, maxTop));
        item.card.style.left = `${left}px`;
        item.card.style.right = "auto";
        item.card.style.top = `${top}px`;
        item.card.dataset.pfAutoSide = selectedMode === "left" ? "left" : selectedMode === "right" ? "right" : point.x < 0.5 ? "left" : "right";
        layout[item.code] = { ...(layout[item.code] || {}), left, top };
        delete layout[item.code].width;
        delete layout[item.code].height;
      });
      localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify(layout));
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", {
        detail: {
          mode: selectedMode,
          count: items.length,
          gap: selectedSolution.gap,
          requestedGap: ui.gap,
          lanes: selectedSolution.lanes,
        },
      }));
      window.dispatchEvent(new CustomEvent("pf-overview-connector-geometry-request"));
      closePreview();
    }

    function closePreview() {
      drag = null;
      overlay?.remove();
      overlay = null;
      canvas = null;
      selectedSolution = null;
    }

    function openPreview() {
      if (disposed || !syncStage()) return;
      items = captureItems();
      if (!items.length) return;
      solveAll();
      closePreview();
      overlay = document.createElement("div");
      overlay.className = "pf-arrange-preview-overlay";
      overlay.innerHTML = `
        <section class="pf-arrange-preview-panel" role="dialog" aria-modal="true" aria-label="Arrange preview">
          <header><div><span>AUTO ARRANGE</span><strong>Choose a layout solution</strong></div><button type="button" data-arrange-close aria-label="Close">×</button></header>
          <div class="pf-arrange-preview-body">
            <div class="pf-arrange-preview-map-wrap">
              <div class="pf-arrange-preview-map-head"><span>Layout preview</span><b data-arrange-mode-label>Smart L/R</b></div>
              <div class="pf-arrange-preview-map"></div>
              <small>Auto Arrange keeps connector bodies conflict-free while allowing a small natural fan-in zone beside clustered lot points. Preferred gap is reduced automatically when needed. All left/right stay strict.</small>
            </div>
            <aside class="pf-arrange-preview-modes">
              <span>LAYOUT OPTIONS</span>
              <label class="pf-arrange-gap-control"><span>Preferred gap</span><input data-arrange-gap type="number" min="0" max="120" step="1" value="${ui.gap}"><b>px</b></label>
              <button type="button" data-arrange-mode="smart"><strong>Smart L/R</strong><small>Follow lot side first, then solve conflicts</small></button>
              <button type="button" data-arrange-mode="balanced"><strong>Balanced</strong><small>Balance visual load across both sides</small></button>
              <button type="button" data-arrange-mode="compact"><strong>Compact</strong><small>Balanced with tighter lane spacing</small></button>
              <button type="button" data-arrange-mode="left"><strong>All left</strong><small>Every card must stay completely on the left</small></button>
              <button type="button" data-arrange-mode="right"><strong>All right</strong><small>Every card must stay completely on the right</small></button>
            </aside>
          </div>
          <footer><span>${items.length} cards · finding solutions</span><div><button type="button" data-arrange-cancel>Cancel</button><button type="button" class="primary" data-arrange-apply>Apply layout</button></div></footer>
        </section>`;
      document.body.appendChild(overlay);
      canvas = overlay.querySelector(".pf-arrange-preview-map");
      syncModeButtons();
      const firstMode = MODES.find((mode) => solutions.get(mode)?.feasible);
      if (firstMode) selectMode(firstMode);
      else {
        renderEmptyState();
        const apply = overlay.querySelector("[data-arrange-apply]");
        if (apply) { apply.disabled = true; apply.textContent = "No feasible layout"; }
        const footer = overlay.querySelector("footer>span");
        if (footer) footer.textContent = `${items.length} cards · no safe layout after automatic side/gap/size search`;
      }

      overlay.addEventListener("click", (event) => {
        const button = event.target.closest("[data-arrange-mode]");
        if (button && !button.disabled) { selectMode(button.dataset.arrangeMode); return; }
        if (event.target.closest("[data-arrange-apply]")) { applySelected(); return; }
        if (event.target.closest("[data-arrange-close],[data-arrange-cancel]")) { closePreview(); return; }
        if (event.target === overlay) closePreview();
      });

      overlay.addEventListener("input", (event) => {
        if (!event.target.matches("[data-arrange-gap]")) return;
        ui.gap = clamp(event.target.value, 0, 120);
        localStorage.setItem(ARRANGE_UI_KEY, JSON.stringify(ui));
        solveAll();
        syncModeButtons();
        const next = solutions.get(selectedMode)?.feasible
          ? selectedMode
          : MODES.find((mode) => solutions.get(mode)?.feasible);
        if (next) selectMode(next);
        else {
          selectedSolution = null;
          renderEmptyState();
          const apply = overlay.querySelector("[data-arrange-apply]");
          if (apply) { apply.disabled = true; apply.textContent = "No feasible layout"; }
        }
      });
    }

    function onPointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId || !canvas || !selectedSolution) return;
      const bounds = pdfBounds();
      const item = items.find((entry) => entry.code === drag.code);
      if (!bounds || !item) return;
      const rect = canvas.getBoundingClientRect();
      const size = sized(item, selectedSolution.ratio);
      const halfW = size.width / bounds.width / 2;
      const halfH = size.height / bounds.height / 2;
      const safe = safeArea(bounds);
      let minX = halfW;
      let maxX = 1 - halfW;
      if (selectedMode === "left") maxX = 0.5 - CENTER_PAD_PX / bounds.width - halfW;
      if (selectedMode === "right") minX = 0.5 + CENTER_PAD_PX / bounds.width + halfW;
      const x = clamp((event.clientX - rect.left) / Math.max(1, rect.width), minX, maxX);
      const y = clamp((event.clientY - rect.top) / Math.max(1, rect.height), safe.top + halfH, 1 - safe.bottom - halfH);
      selectedSolution.layout[drag.code] = { x, y };
      const conflicts = connectorConflictCount(selectedSolution.layout, selectedSolution.ratio, bounds);
      const sideOk = sideContractSatisfied(selectedMode, selectedSolution.layout, selectedSolution.ratio, bounds);
      renderSelected();
      const apply = overlay.querySelector("[data-arrange-apply]");
      if (apply) {
        apply.disabled = conflicts > 0 || !sideOk;
        apply.textContent = !sideOk ? "Keep cards on selected side" : conflicts > 0 ? "Resolve connector conflict" : "Apply layout";
      }
    }

    function finishDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      try { drag.node.releasePointerCapture?.(event.pointerId); } catch { /* noop */ }
      drag = null;
    }

    function onKeyDown(event) {
      if (event.key === "Escape" && overlay) closePreview();
    }

    function onGroupChanged() {
      closePreview();
      syncStage();
    }

    syncStage();
    window.addEventListener("pf-overview-arrange-preview-request", openPreview);
    window.addEventListener("pf-overview-group-changed", onGroupChanged);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", finishDrag, true);
    window.addEventListener("pointercancel", finishDrag, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      disposed = true;
      closePreview();
      window.removeEventListener("pf-overview-arrange-preview-request", openPreview);
      window.removeEventListener("pf-overview-group-changed", onGroupChanged);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", finishDrag, true);
      window.removeEventListener("pointercancel", finishDrag, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
