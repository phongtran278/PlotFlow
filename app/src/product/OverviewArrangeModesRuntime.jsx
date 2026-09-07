import { useEffect } from "react";
import "./OverviewArrangeModesRuntime.css";

const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const ARRANGE_UI_KEY = "plotflow-overview-arrange-preview-v1";
const SAFE_TOP_PX = 96;
const SAFE_BOTTOM_PX = 20;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function codeFor(card) {
  return card?.dataset?.unitCode
    || card?.querySelector(".pf-sell-card-code")?.textContent?.trim()
    || "";
}

function objectScale(card) {
  const value = Number(card?.dataset?.pfObjectScale || card?.style?.scale || 1);
  return Number.isFinite(value) ? clamp(value, 0.2, 2.2) : 1;
}

function readArrangeUi() {
  try {
    const value = JSON.parse(localStorage.getItem(ARRANGE_UI_KEY) || "{}");
    return { gap: clamp(value?.gap ?? 14, 0, 120) };
  } catch {
    return { gap: 14 };
  }
}

export default function OverviewArrangeModesRuntime() {
  useEffect(() => {
    let disposed = false;
    let stage = null;
    let overlay = null;
    let canvas = null;
    let mode = "smart";
    let draft = {};
    let items = [];
    let drag = null;
    let resolvedGapPx = 14;
    let resolvedLaneCount = 0;
    let resolvedCrossings = 0;
    let usedSafetyFallback = false;
    let previewConnectorRaf = 0;
    const ui = readArrangeUi();

    function activeLayer() {
      if (!stage) return null;
      return stage.querySelector(".pf-live-overview-callouts:not(.pf-callouts-leaving)")
        || stage.querySelector(".pf-live-overview-callouts");
    }

    const cards = () => {
      const layer = activeLayer();
      return layer ? Array.from(layer.querySelectorAll(".pf-live-sales-callout")) : [];
    };

    function saveArrangeUi() {
      localStorage.setItem(ARRANGE_UI_KEY, JSON.stringify(ui));
    }

    function syncStage() {
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts") || null;
      return stage;
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
      const top = clamp(SAFE_TOP_PX / Math.max(1, bounds.height), 0.04, 0.18);
      const bottom = clamp(SAFE_BOTTOM_PX / Math.max(1, bounds.height), 0.015, 0.08);
      return { top, bottom, height: Math.max(0.2, 1 - top - bottom) };
    }

    function normalizedAppliedCenter(item, point, bounds) {
      if (!item || !point || !bounds) return point;
      const safe = safeArea(bounds);
      const halfW = item.width / Math.max(1, bounds.width) / 2;
      const halfH = item.height / Math.max(1, bounds.height) / 2;
      return {
        x: clamp(point.x, halfW, 1 - halfW),
        y: clamp(point.y, safe.top + halfH, 1 - safe.bottom - halfH),
      };
    }

    function anchorFor(code, bounds) {
      const layer = activeLayer();
      const anchor = Array.from(layer?.querySelectorAll(".pf-live-map-anchor") || [])
        .find((node) => (node.dataset.unitCode || node.textContent?.trim()) === code);
      if (!anchor || !bounds) return { x: 0.5, y: 0.5, resolved: false };
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
      if (!bounds) return [];
      return cards().map((card, index) => {
        const code = codeFor(card);
        const scale = objectScale(card);
        const width = (card.offsetWidth || 192) * scale;
        const height = (card.offsetHeight || 132) * scale;
        const anchor = anchorFor(code, bounds);
        return {
          card,
          code,
          index,
          width,
          height,
          anchor,
          current: {
            x: clamp((card.offsetLeft + width / 2 - bounds.x) / bounds.width, 0.03, 0.97),
            y: clamp((card.offsetTop + height / 2 - bounds.y) / bounds.height, 0.03, 0.97),
          },
        };
      }).filter((item) => item.code);
    }

    function split(itemsForMode, selectedMode) {
      const left = [];
      const right = [];
      const sorted = [...itemsForMode].sort((a, b) => a.anchor.y - b.anchor.y || a.code.localeCompare(b.code));
      if (selectedMode === "left") return { left: sorted, right };
      if (selectedMode === "right") return { left, right: sorted };

      const bounds = pdfBounds();
      if (!bounds) return { left: sorted, right };
      const safe = safeArea(bounds);
      const gap = ui.gap / Math.max(1, bounds.height);
      let leftLoad = 0;
      let rightLoad = 0;

      function addedLoad(list, item) {
        return item.height / Math.max(1, bounds.height) + (list.length ? gap : 0);
      }

      function addTo(side, item) {
        if (side === "left") {
          leftLoad += addedLoad(left, item);
          left.push(item);
        } else {
          rightLoad += addedLoad(right, item);
          right.push(item);
        }
      }

      if (selectedMode === "balanced" || selectedMode === "compact") {
        sorted.forEach((item) => addTo(leftLoad <= rightLoad ? "left" : "right", item));
        return { left, right };
      }

      sorted.forEach((item) => {
        const preferred = item.anchor.x < 0.47 ? "left" : item.anchor.x > 0.53 ? "right" : null;
        if (!preferred) {
          addTo(leftLoad <= rightLoad ? "left" : "right", item);
          return;
        }

        const preferredList = preferred === "left" ? left : right;
        const other = preferred === "left" ? "right" : "left";
        const preferredLoad = preferred === "left" ? leftLoad : rightLoad;
        const otherLoad = preferred === "left" ? rightLoad : leftLoad;
        const preferredNext = preferredLoad + addedLoad(preferredList, item);
        const otherList = other === "left" ? left : right;
        const otherNext = otherLoad + addedLoad(otherList, item);
        const shouldRebalance = preferredNext > safe.height && otherNext < preferredNext;
        addTo(shouldRebalance ? other : preferred, item);
      });
      return { left, right };
    }

    function gapCapacityPx(list, bounds) {
      if (!bounds || list.length <= 1) return ui.gap;
      const safe = safeArea(bounds);
      const cardHeightPx = list.reduce((sum, item) => sum + item.height, 0);
      const safeHeightPx = safe.height * bounds.height;
      return Math.max(0, (safeHeightPx - cardHeightPx) / (list.length - 1));
    }

    function exactVerticalCenters(list, { anchorAware = false, gapPx = ui.gap } = {}) {
      const bounds = pdfBounds();
      const sorted = [...list].sort((a, b) => a.anchor.y - b.anchor.y || a.code.localeCompare(b.code));
      const result = new Map();
      if (!bounds || !sorted.length) return { centers: result };

      const safe = safeArea(bounds);
      const heights = sorted.map((item) => item.height / bounds.height);
      const cardHeight = heights.reduce((sum, value) => sum + value, 0);
      const gap = Math.max(0, gapPx) / bounds.height;
      const total = cardHeight + Math.max(0, sorted.length - 1) * gap;

      const anchorMean = sorted.reduce((sum, item) => sum + item.anchor.y, 0) / sorted.length;
      const targetCenter = anchorAware ? anchorMean : safe.top + safe.height / 2;
      const minStart = safe.top;
      const maxStart = Math.max(minStart, 1 - safe.bottom - total);
      let cursor = clamp(targetCenter - total / 2, minStart, maxStart);

      sorted.forEach((item, index) => {
        const center = cursor + heights[index] / 2;
        result.set(item.code, center);
        cursor += heights[index] + gap;
      });

      return { centers: result };
    }

    function partitionIntoLanes(list, bounds, gapPx) {
      if (!list.length) return [];
      const safe = safeArea(bounds);
      const available = safe.height * bounds.height;
      const sorted = [...list].sort((a, b) => a.anchor.y - b.anchor.y || a.code.localeCompare(b.code));
      const lanes = [[]];
      const loads = [0];

      sorted.forEach((item) => {
        let laneIndex = lanes.length - 1;
        const lane = lanes[laneIndex];
        const extra = item.height + (lane.length ? gapPx : 0);
        if (lane.length && loads[laneIndex] + extra > available + 0.5) {
          lanes.push([]);
          loads.push(0);
          laneIndex += 1;
        }
        const target = lanes[laneIndex];
        loads[laneIndex] += item.height + (target.length ? gapPx : 0);
        target.push(item);
      });
      return lanes;
    }

    function laneCentersX(lanes, side, selectedMode, bounds) {
      if (!lanes.length) return [];
      const widths = lanes.map((lane) => Math.max(...lane.map((item) => item.width), 1));
      const compact = selectedMode === "compact";
      const horizontalGap = compact ? 10 : 18;
      const edgeInset = compact ? Math.min(64, Math.max(28, bounds.width * 0.07)) : 12;
      const centers = [];

      if (side === "left") {
        let cursor = edgeInset;
        widths.forEach((width) => {
          centers.push(clamp((cursor + width / 2) / bounds.width, 0.02, 0.49));
          cursor += width + horizontalGap;
        });
      } else {
        let cursor = bounds.width - edgeInset;
        widths.forEach((width) => {
          centers.push(clamp((cursor - width / 2) / bounds.width, 0.51, 0.98));
          cursor -= width + horizontalGap;
        });
      }
      return centers;
    }

    function solveSide(list, side, selectedMode, next) {
      const bounds = pdfBounds();
      if (!bounds || !list.length) return 0;
      const anchorAware = selectedMode === "smart";
      const lanes = partitionIntoLanes(list, bounds, ui.gap);
      const xs = laneCentersX(lanes, side, selectedMode, bounds);

      lanes.forEach((lane, laneIndex) => {
        const laneGap = Math.min(ui.gap, gapCapacityPx(lane, bounds));
        resolvedGapPx = Math.min(resolvedGapPx, laneGap);
        const solve = exactVerticalCenters(lane, { anchorAware, gapPx: laneGap });
        lane.forEach((item) => {
          next[item.code] = {
            x: xs[laneIndex] ?? (side === "left" ? 0.13 : 0.87),
            y: solve.centers.get(item.code) ?? 0.5,
          };
        });
      });
      return lanes.length;
    }

    function connectorSegment(item, point, bounds) {
      if (!item?.anchor?.resolved || !point || !bounds) return null;
      const halfW = Math.max(item.width / Math.max(1, bounds.width) / 2, 0.0001);
      const halfH = Math.max(item.height / Math.max(1, bounds.height) / 2, 0.0001);
      const dx = item.anchor.x - point.x;
      const dy = item.anchor.y - point.y;
      const denominator = Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH, 0.0001);
      return {
        code: item.code,
        a: { x: point.x + dx / denominator, y: point.y + dy / denominator },
        b: { x: item.anchor.x, y: item.anchor.y },
      };
    }

    function segmentOrientation(a, b, c) {
      return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }

    function pointOnSegment(a, b, p, epsilon = 0.00001) {
      return Math.abs(segmentOrientation(a, b, p)) <= epsilon
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

    function segmentsConflict(first, second, bounds) {
      if (!first || !second || first.code === second.code) return false;
      const a = first.a; const b = first.b; const c = second.a; const d = second.b;
      const o1 = segmentOrientation(a, b, c);
      const o2 = segmentOrientation(a, b, d);
      const o3 = segmentOrientation(c, d, a);
      const o4 = segmentOrientation(c, d, b);
      const epsilon = 0.00001;
      const strictCross = ((o1 > epsilon && o2 < -epsilon) || (o1 < -epsilon && o2 > epsilon))
        && ((o3 > epsilon && o4 < -epsilon) || (o3 < -epsilon && o4 > epsilon));
      if (strictCross) return true;
      const exactOverlap = (Math.abs(o1) <= epsilon && pointOnSegment(a, b, c, epsilon))
        || (Math.abs(o2) <= epsilon && pointOnSegment(a, b, d, epsilon))
        || (Math.abs(o3) <= epsilon && pointOnSegment(c, d, a, epsilon))
        || (Math.abs(o4) <= epsilon && pointOnSegment(c, d, b, epsilon));
      if (exactOverlap) return true;
      return bounds ? segmentDistancePx(first, second, bounds) < 7 : false;
    }

    function countConnectorCrossings(layout) {
      const bounds = pdfBounds();
      if (!bounds) return 0;
      const segments = items.map((item) => connectorSegment(item, layout[item.code], bounds)).filter(Boolean);
      let count = 0;
      for (let i = 0; i < segments.length; i += 1) {
        for (let j = i + 1; j < segments.length; j += 1) {
          if (segmentsConflict(segments[i], segments[j], bounds)) count += 1;
        }
      }
      return count;
    }

    function connectorConflictCodes(layout) {
      const bounds = pdfBounds();
      const codes = new Set();
      if (!bounds) return codes;
      const segments = items.map((item) => connectorSegment(item, layout[item.code], bounds)).filter(Boolean);
      for (let i = 0; i < segments.length; i += 1) {
        for (let j = i + 1; j < segments.length; j += 1) {
          if (!segmentsConflict(segments[i], segments[j], bounds)) continue;
          codes.add(segments[i].code);
          codes.add(segments[j].code);
        }
      }
      return codes;
    }

    function layoutDistance(layout) {
      return items.reduce((sum, item) => {
        const point = layout[item.code];
        if (!point) return sum;
        return sum + Math.hypot(point.x - item.anchor.x, point.y - item.anchor.y);
      }, 0);
    }

    function crossingSafeSplit(itemsForMode) {
      const sorted = [...itemsForMode].sort((a, b) => a.anchor.y - b.anchor.y || a.code.localeCompare(b.code));
      const left = [];
      const right = [];
      sorted.forEach((item) => (item.anchor.x <= 0.5 ? left : right).push(item));
      return { left, right };
    }

    function solveCandidate(groups, selectedMode) {
      const next = {};
      const bounds = pdfBounds();
      resolvedGapPx = ui.gap;
      const leftLanes = solveSide(groups.left || [], "left", selectedMode, next);
      const rightLanes = solveSide(groups.right || [], "right", selectedMode, next);
      if (bounds) {
        items.forEach((item) => {
          if (next[item.code]) next[item.code] = normalizedAppliedCenter(item, next[item.code], bounds);
        });
      }
      return {
        draft: next,
        gap: resolvedGapPx,
        lanes: leftLanes + rightLanes,
        crossings: countConnectorCrossings(next),
        distance: layoutDistance(next),
      };
    }

    function candidateModePenalty(candidate, selectedMode) {
      if (!candidate) return Number.POSITIVE_INFINITY;
      const points = items.map((item) => ({ item, point: candidate.draft[item.code] })).filter((entry) => entry.point);
      if (selectedMode === "left") return points.filter((entry) => entry.point.x > 0.5).length * 50;
      if (selectedMode === "right") return points.filter((entry) => entry.point.x < 0.5).length * 50;
      if (selectedMode === "balanced") {
        const left = points.filter((entry) => entry.point.x < 0.5).length;
        return Math.abs(left - (points.length - left)) * 4;
      }
      if (selectedMode === "compact") return points.reduce((sum, entry) => sum + Math.abs(entry.point.x - 0.5), 0);
      return points.reduce((sum, entry) => {
        const preferredLeft = entry.item.anchor.x < 0.47;
        const preferredRight = entry.item.anchor.x > 0.53;
        return sum + ((preferredLeft && entry.point.x > 0.5) || (preferredRight && entry.point.x < 0.5) ? 6 : 0);
      }, 0);
    }

    function groupSignature(groups) {
      const left = (groups.left || []).map((item) => item.code).sort().join(",");
      const right = (groups.right || []).map((item) => item.code).sort().join(",");
      return `L:${left}|R:${right}`;
    }

    function flipGroup(groups, code) {
      const left = [...(groups.left || [])];
      const right = [...(groups.right || [])];
      const leftIndex = left.findIndex((item) => item.code === code);
      const rightIndex = right.findIndex((item) => item.code === code);
      if (leftIndex >= 0) right.push(left.splice(leftIndex, 1)[0]);
      else if (rightIndex >= 0) left.push(right.splice(rightIndex, 1)[0]);
      return { left, right };
    }

    function boundedConflictSafeCandidates(selectedMode, sorted) {
      const seeds = [
        split(sorted, selectedMode),
        crossingSafeSplit(sorted),
        { left: [...sorted], right: [] },
        { left: [], right: [...sorted] },
      ];
      const seen = new Set();
      const accepted = [];
      let frontier = seeds;
      let budget = Math.max(72, Math.min(220, sorted.length * 14));

      for (let round = 0; round < 7 && frontier.length && budget > 0; round += 1) {
        const evaluated = [];
        for (const groups of frontier) {
          if (budget <= 0) break;
          const signature = groupSignature(groups);
          if (seen.has(signature)) continue;
          seen.add(signature);
          budget -= 1;

          const candidate = solveCandidate(groups, selectedMode);
          candidate.modePenalty = candidateModePenalty(candidate, selectedMode);
          evaluated.push({ groups, candidate });
          accepted.push(candidate);
        }

        const zero = evaluated.filter((entry) => entry.candidate.crossings === 0);
        if (zero.length) break;

        evaluated.sort((a, b) => (
          a.candidate.crossings - b.candidate.crossings
          || a.candidate.modePenalty - b.candidate.modePenalty
          || a.candidate.distance - b.candidate.distance
          || a.candidate.lanes - b.candidate.lanes
        ));

        const next = [];
        evaluated.slice(0, 6).forEach(({ groups, candidate }) => {
          const conflicted = [...connectorConflictCodes(candidate.draft)].slice(0, 12);
          conflicted.forEach((code) => next.push(flipGroup(groups, code)));
        });
        frontier = next;
      }

      return accepted;
    }

    function conflictSafeCandidates(selectedMode) {
      const sorted = [...items].sort((a, b) => a.anchor.y - b.anchor.y || a.code.localeCompare(b.code));
      const candidates = [];
      const n = sorted.length;
      if (!n) return candidates;
      if (n <= 10) {
        const maxMasks = 1 << n;
        for (let mask = 0; mask < maxMasks; mask += 1) {
          const left = []; const right = [];
          sorted.forEach((item, index) => ((mask >> index) & 1 ? right : left).push(item));
          candidates.push(solveCandidate({ left, right }, selectedMode));
        }
        return candidates;
      }
      return boundedConflictSafeCandidates(selectedMode, sorted);
    }
    function buildDraft(selectedMode) {
      mode = selectedMode;
      const primary = solveCandidate(split(items, selectedMode), selectedMode);
      const candidates = [primary];
      if (primary.crossings > 0) {
        candidates.push(solveCandidate(crossingSafeSplit(items), selectedMode));
        const sorted = [...items].sort((a, b) => a.anchor.y - b.anchor.y || a.code.localeCompare(b.code));
        if (selectedMode !== "right") candidates.push(solveCandidate({ left: sorted, right: [] }, selectedMode));
        if (selectedMode !== "left") candidates.push(solveCandidate({ left: [], right: sorted }, selectedMode));
        candidates.push(...conflictSafeCandidates(selectedMode));
      }
      candidates.forEach((candidate) => { candidate.modePenalty = candidateModePenalty(candidate, selectedMode); });
      candidates.sort((a, b) => a.crossings - b.crossings || a.modePenalty - b.modePenalty || a.distance - b.distance || a.lanes - b.lanes);
      const chosen = candidates[0];
      draft = chosen.draft;
      resolvedGapPx = chosen.gap;
      resolvedLaneCount = chosen.lanes;
      resolvedCrossings = chosen.crossings;
      usedSafetyFallback = chosen !== primary;
      renderDraft();
    }
    function updateApplyState() {
      const apply = overlay?.querySelector("[data-arrange-apply]");
      if (!apply) return;
      apply.disabled = false;
      apply.textContent = resolvedCrossings > 0 ? "Resolve & apply" : "Apply layout";
      apply.title = resolvedCrossings > 0
        ? "Try one more conflict-safe solve, then apply only if the layout is safe"
        : "Apply conflict-safe layout";
    }

    function updateFooter() {
      const footer = overlay?.querySelector("footer>span");
      if (!footer) return;
      const resolved = Math.round(resolvedGapPx * 10) / 10;
      const lanes = resolvedLaneCount > 2 ? ` · ${resolvedLaneCount} lanes` : "";
      const crossingStatus = resolvedCrossings === 0 ? " · 0 connector conflicts after clamp" : ` · ${resolvedCrossings} crossing${resolvedCrossings === 1 ? "" : "s"} after clamp · fix required`;
      const fallback = usedSafetyFallback ? " · conflict-safe fallback" : "";
      footer.textContent = resolved + 0.05 < ui.gap
        ? `${items.length} cards · ${ui.gap}px requested · ${resolved}px gap fits${lanes}${crossingStatus}${fallback} · preview only`
        : `${items.length} cards · ${ui.gap}px gap${lanes}${crossingStatus}${fallback} · preview only`;
      updateApplyState();
    }

    function syncPreviewConnectors() {
      if (!canvas) return;
      const svg = canvas.querySelector(".pf-arrange-preview-lines");
      if (!svg) return;
      const svgRect = svg.getBoundingClientRect();
      if (svgRect.width < 1 || svgRect.height < 1) return;

      svg.setAttribute("viewBox", `0 0 ${svgRect.width} ${svgRect.height}`);
      svg.setAttribute("preserveAspectRatio", "none");

      svg.querySelectorAll("line").forEach((line) => {
        const code = line.dataset.code || "";
        const chip = canvas.querySelector(`.pf-arrange-preview-chip[data-code="${CSS.escape(code)}"]`);
        const anchor = canvas.querySelector(`.pf-arrange-preview-anchor[data-code="${CSS.escape(code)}"]`);
        if (!chip || !anchor) return;

        const chipRect = chip.getBoundingClientRect();
        const anchorRect = anchor.getBoundingClientRect();
        const cardLeft = chipRect.left - svgRect.left;
        const cardTop = chipRect.top - svgRect.top;
        const cardRight = chipRect.right - svgRect.left;
        const cardBottom = chipRect.bottom - svgRect.top;
        const cardCenterX = (cardLeft + cardRight) / 2;
        const cardCenterY = (cardTop + cardBottom) / 2;
        const anchorX = anchorRect.left + anchorRect.width / 2 - svgRect.left;
        const anchorY = anchorRect.top + anchorRect.height / 2 - svgRect.top;
        const dx = cardCenterX - anchorX;
        const dy = cardCenterY - anchorY;

        let startX = cardCenterX;
        let startY = cardCenterY;
        if (Math.abs(dx) >= Math.abs(dy)) {
          startX = dx < 0 ? cardRight : cardLeft;
        } else {
          startY = dy > 0 ? cardTop : cardBottom;
        }

        line.setAttribute("x1", String(startX));
        line.setAttribute("y1", String(startY));
        line.setAttribute("x2", String(anchorX));
        line.setAttribute("y2", String(anchorY));
      });
    }

    function renderDraft() {
      if (!canvas) return;
      resolvedCrossings = countConnectorCrossings(draft);
      canvas.querySelectorAll(".pf-arrange-preview-chip").forEach((chip) => {
        const point = draft[chip.dataset.code];
        if (!point) return;
        chip.style.left = `${point.x * 100}%`;
        chip.style.top = `${point.y * 100}%`;
      });
      syncPreviewConnectors();
      if (previewConnectorRaf) window.cancelAnimationFrame(previewConnectorRaf);
      previewConnectorRaf = window.requestAnimationFrame(() => {
        previewConnectorRaf = 0;
        syncPreviewConnectors();
      });
      overlay?.querySelectorAll("[data-arrange-mode]").forEach((button) => {
        button.classList.toggle("active", button.dataset.arrangeMode === mode);
      });
      const label = overlay?.querySelector("[data-arrange-mode-label]");
      if (label) label.textContent = mode === "smart" ? "Smart L/R" : mode === "balanced" ? "Balanced" : mode === "compact" ? "Compact" : mode === "left" ? "All left" : "All right";
      updateFooter();
    }

    function buildCanvas() {
      if (!canvas) return;
      const bounds = pdfBounds();
      if (!bounds) return;
      const safe = safeArea(bounds);
      canvas.innerHTML = "";
      canvas.style.setProperty("--pf-arrange-safe-top", `${safe.top * 100}%`);
      const reserved = document.createElement("div");
      reserved.className = "pf-arrange-preview-safe-top";
      reserved.style.height = `${safe.top * 100}%`;
      reserved.innerHTML = "<span>Reserved banner area</span>";
      canvas.appendChild(reserved);

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("preserveAspectRatio", "none");
      svg.classList.add("pf-arrange-preview-lines");
      canvas.appendChild(svg);

      items.forEach((item) => {
        const anchor = document.createElement("span");
        anchor.className = `pf-arrange-preview-anchor${item.anchor.resolved ? " is-resolved" : ""}`;
        anchor.dataset.code = item.code;
        anchor.style.left = `${item.anchor.x * 100}%`;
        anchor.style.top = `${item.anchor.y * 100}%`;
        anchor.title = `${item.code} · lot point`;
        canvas.appendChild(anchor);

        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.dataset.code = item.code;
        if (!item.anchor.resolved) line.classList.add("is-unresolved");
        svg.appendChild(line);

        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "pf-arrange-preview-chip";
        chip.dataset.code = item.code;
        chip.textContent = item.code;
        chip.style.setProperty("--pf-preview-card-w", `${clamp(item.width / bounds.width * 100, 5.5, 18)}%`);
        chip.style.setProperty("--pf-preview-card-h", `${clamp(item.height / bounds.height * 100, 4, 18)}%`);
        chip.title = `${item.code} · drag to refine preview`;
        chip.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          drag = { code: item.code, pointerId: event.pointerId, node: chip };
          chip.setPointerCapture?.(event.pointerId);
        });
        canvas.appendChild(chip);
      });
    }

    function applyDraft() {
      resolvedCrossings = countConnectorCrossings(draft);
      if (resolvedCrossings > 0) {
        const rescue = conflictSafeCandidates(mode)
          .map((candidate) => ({ ...candidate, modePenalty: candidateModePenalty(candidate, mode) }))
          .filter((candidate) => candidate.crossings === 0)
          .sort((a, b) => a.modePenalty - b.modePenalty || a.distance - b.distance || a.lanes - b.lanes)[0];

        if (rescue) {
          draft = rescue.draft;
          resolvedGapPx = rescue.gap;
          resolvedLaneCount = rescue.lanes;
          resolvedCrossings = 0;
          usedSafetyFallback = true;
          renderDraft();
        } else {
          const footer = overlay?.querySelector("footer>span");
          if (footer) footer.textContent = `${items.length} cards · ${resolvedCrossings} connector conflict${resolvedCrossings === 1 ? "" : "s"} remain · choose another mode or drag a card`;
          updateApplyState();
          return;
        }
      }
      const bounds = pdfBounds();
      if (!bounds) return;
      const safe = safeArea(bounds);
      let layout = {};
      try { layout = JSON.parse(localStorage.getItem(CARD_LAYOUT_KEY) || "{}") || {}; } catch { layout = {}; }
      items.forEach((item) => {
        const rawPoint = draft[item.code];
        if (!rawPoint) return;
        const point = normalizedAppliedCenter(item, rawPoint, bounds);
        draft[item.code] = point;
        const minTop = bounds.y + safe.top * bounds.height;
        const maxLeft = bounds.x + bounds.width - item.width;
        const maxTop = bounds.y + bounds.height - safe.bottom * bounds.height - item.height;
        const left = clamp(bounds.x + point.x * bounds.width - item.width / 2, bounds.x, Math.max(bounds.x, maxLeft));
        const top = clamp(bounds.y + point.y * bounds.height - item.height / 2, minTop, Math.max(minTop, maxTop));
        item.card.style.left = `${left}px`;
        item.card.style.right = "auto";
        item.card.style.top = `${top}px`;
        item.card.dataset.pfAutoSide = point.x <= 0.5 ? "left" : "right";
        layout[item.code] = { ...(layout[item.code] || {}), left, top };
        delete layout[item.code].width;
        delete layout[item.code].height;
      });
      localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify(layout));
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", { detail: { mode: `preview-${mode}`, count: items.length, gap: resolvedGapPx, requestedGap: ui.gap, lanes: resolvedLaneCount } }));
      window.dispatchEvent(new CustomEvent("pf-overview-connector-geometry-request"));
      closePreview();
    }

    function closePreview() {
      drag = null;
      if (previewConnectorRaf) {
        window.cancelAnimationFrame(previewConnectorRaf);
        previewConnectorRaf = 0;
      }
      overlay?.remove();
      overlay = null;
      canvas = null;
    }

    function openPreview() {
      if (disposed || !syncStage()) return;
      items = captureItems();
      if (!items.length) return;
      closePreview();
      overlay = document.createElement("div");
      overlay.className = "pf-arrange-preview-overlay";
      overlay.innerHTML = `
        <section class="pf-arrange-preview-panel" role="dialog" aria-modal="true" aria-label="Arrange preview">
          <header><div><span>AUTO ARRANGE</span><strong>Preview layout before applying</strong></div><button type="button" data-arrange-close aria-label="Close">×</button></header>
          <div class="pf-arrange-preview-body">
            <div class="pf-arrange-preview-map-wrap">
              <div class="pf-arrange-preview-map-head"><span>Layout preview</span><b data-arrange-mode-label>Smart L/R</b></div>
              <div class="pf-arrange-preview-map"></div>
              <small>The top banner area is reserved. Connector conflicts are never applied; dense layouts use a bounded conflict-safe search and can retry once when you Apply.</small>
            </div>
            <aside class="pf-arrange-preview-modes">
              <span>LAYOUT OPTIONS</span>
              <label class="pf-arrange-gap-control"><span>Gap</span><input data-arrange-gap type="number" min="0" max="120" step="1" value="${ui.gap}"><b>px</b></label>
              <button type="button" data-arrange-mode="smart"><strong>Smart L/R</strong><small>Follow lot side; rebalance only when needed</small></button>
              <button type="button" data-arrange-mode="balanced"><strong>Balanced</strong><small>Balance visual card load across both sides</small></button>
              <button type="button" data-arrange-mode="compact"><strong>Compact</strong><small>Balanced lanes closer to the masterplan</small></button>
              <button type="button" data-arrange-mode="left"><strong>All left</strong><small>Use as many left lanes as needed to avoid overlap</small></button>
              <button type="button" data-arrange-mode="right"><strong>All right</strong><small>Use as many right lanes as needed to avoid overlap</small></button>
            </aside>
          </div>
          <footer><span>${items.length} cards · ${ui.gap}px gap · preview only</span><div><button type="button" data-arrange-cancel>Cancel</button><button type="button" class="primary" data-arrange-apply>Apply layout</button></div></footer>
        </section>`;
      document.body.appendChild(overlay);
      canvas = overlay.querySelector(".pf-arrange-preview-map");
      buildCanvas();
      buildDraft("smart");

      overlay.addEventListener("input", (event) => {
        if (!event.target.matches("[data-arrange-gap]")) return;
        ui.gap = clamp(event.target.value, 0, 120);
        saveArrangeUi();
        buildDraft(mode);
      });
      overlay.addEventListener("click", (event) => {
        const modeButton = event.target.closest("[data-arrange-mode]");
        if (modeButton) { buildDraft(modeButton.dataset.arrangeMode); return; }
        if (event.target.closest("[data-arrange-apply]")) { applyDraft(); return; }
        if (event.target.closest("[data-arrange-close],[data-arrange-cancel]")) { closePreview(); return; }
        if (event.target === overlay) closePreview();
      });
    }

    function onPointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId || !canvas) return;
      event.preventDefault();
      const bounds = pdfBounds();
      if (!bounds) return;
      const safe = safeArea(bounds);
      const item = items.find((entry) => entry.code === drag.code);
      const rect = canvas.getBoundingClientRect();
      const halfH = item ? item.height / bounds.height / 2 : 0;
      const x = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0.04, 0.96);
      const y = clamp((event.clientY - rect.top) / Math.max(1, rect.height), safe.top + halfH, 1 - safe.bottom - halfH);
      draft[drag.code] = normalizedAppliedCenter(item, { x, y }, bounds);
      renderDraft();
    }

    function finishDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      try { drag.node.releasePointerCapture?.(event.pointerId); } catch { /* noop */ }
      drag = null;
    }

    function onKeyDown(event) {
      if (event.key === "Escape" && overlay) closePreview();
    }

    function onRequest() {
      openPreview();
    }

    function onGroupChanged() {
      closePreview();
      syncStage();
    }

    syncStage();
    window.addEventListener("pf-overview-arrange-preview-request", onRequest);
    window.addEventListener("pf-overview-group-changed", onGroupChanged);
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", finishDrag, true);
    window.addEventListener("pointercancel", finishDrag, true);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      disposed = true;
      closePreview();
      window.removeEventListener("pf-overview-arrange-preview-request", onRequest);
      window.removeEventListener("pf-overview-group-changed", onGroupChanged);
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", finishDrag, true);
      window.removeEventListener("pointercancel", finishDrag, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
