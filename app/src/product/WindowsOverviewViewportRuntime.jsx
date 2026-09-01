import { useEffect } from "react";

const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";

function codeForCard(card) {
  return card?.dataset?.unitCode
    || card?.querySelector(".pf-sell-card-code,header strong")?.textContent?.trim()
    || "";
}

function readCardLayout() {
  try {
    const value = JSON.parse(localStorage.getItem(CARD_LAYOUT_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function objectScale(card) {
  const value = Number(card?.dataset?.pfObjectScale || card?.style?.scale || 1);
  return Number.isFinite(value) ? Math.max(0.2, Math.min(2.2, value)) : 1;
}

export default function WindowsOverviewViewportRuntime() {
  useEffect(() => {
    let stage = null;
    let drag = null;
    let activeCode = "";
    let lastCamera = { scale: 1, tx: 0, ty: 0 };

    function syncStage() {
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts") || null;
      return stage;
    }

    function overviewCards() {
      return stage ? Array.from(stage.querySelectorAll(".pf-live-sales-callout,.pf-sales-callout")) : [];
    }

    function selectedCards() {
      return overviewCards().filter((card) => card.classList.contains("pf-card-selected"));
    }

    function clearKeyCard() {
      overviewCards().forEach((card) => card.classList.remove("pf-card-key"));
    }

    function emitSelectionChanged() {
      const selected = selectedCards();
      const key = selected.find((card) => card.classList.contains("pf-card-key")) || null;
      window.dispatchEvent(new CustomEvent("pf-overview-card-selection-changed", {
        detail: {
          codes: selected.map(codeForCard).filter(Boolean),
          key: codeForCard(key),
        },
      }));
    }

    function updateCardSelection(card, event) {
      const current = selectedCards();
      const alreadySelected = card.classList.contains("pf-card-selected");

      if (event.shiftKey) {
        if (alreadySelected) {
          card.classList.remove("pf-card-selected", "pf-card-key");
        } else {
          card.classList.add("pf-card-selected");
        }
        if (selectedCards().length < 2) clearKeyCard();
        emitSelectionChanged();
        return "selection-only";
      }

      if (alreadySelected && current.length > 1) {
        clearKeyCard();
        card.classList.add("pf-card-key");
        emitSelectionChanged();
        return "key";
      }

      overviewCards().forEach((item) => item.classList.remove("pf-card-selected", "pf-card-key"));
      card.classList.add("pf-card-selected");
      emitSelectionChanged();
      return "single";
    }

    function normalizeOverlayOwnership() {
      if (!stage) return;
      stage.querySelectorAll(".pf-live-sales-callout,.pf-sales-callout").forEach((card) => {
        card.style.transform = "";
        card.style.transformOrigin = "0 0";
        card.style.willChange = "";
      });
      stage.querySelectorAll(".pf-live-map-anchor,.pf-map-anchor").forEach((anchor) => {
        anchor.style.translate = "";
      });
      stage.querySelectorAll(".pf-overview-markup-layer > *").forEach((shape) => {
        shape.removeAttribute("transform");
      });
    }

    function worldAnchorPoint(anchor) {
      if (!anchor) return { x: 50, y: 50 };
      const x = Number.parseFloat(anchor.style.left || "50");
      const y = Number.parseFloat(anchor.style.top || "50");
      return {
        x: Number.isFinite(x) ? x : 50,
        y: Number.isFinite(y) ? y : 50,
      };
    }

    function connectorSideFor(card, anchorWorldX, anchorWorldY) {
      const manual = String(card?.dataset?.pfConnectorSide || "").toLowerCase();
      if (["left", "right", "top", "bottom"].includes(manual)) return manual;

      const scale = objectScale(card);
      const width = card.offsetWidth * scale;
      const height = card.offsetHeight * scale;
      const left = card.offsetLeft;
      const top = card.offsetTop;
      const right = left + width;
      const bottom = top + height;

      if (anchorWorldX < left) return "left";
      if (anchorWorldX > right) return "right";
      if (anchorWorldY < top) return "top";
      if (anchorWorldY > bottom) return "bottom";

      const centerX = left + width / 2;
      const centerY = top + height / 2;
      const dx = centerX - anchorWorldX;
      const dy = centerY - anchorWorldY;
      if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? "right" : "left";
      return dy > 0 ? "top" : "bottom";
    }

    function connectorStart(card, anchorWorldX, anchorWorldY) {
      const scale = objectScale(card);
      const left = card.offsetLeft;
      const top = card.offsetTop;
      const width = card.offsetWidth * scale;
      const height = card.offsetHeight * scale;
      const right = left + width;
      const bottom = top + height;
      const centerX = left + width / 2;
      const centerY = top + height / 2;
      const dx = anchorWorldX - centerX;
      const dy = anchorWorldY - centerY;
      const halfW = Math.max(width / 2, 0.0001);
      const halfH = Math.max(height / 2, 0.0001);
      const denominator = Math.max(Math.abs(dx) / halfW, Math.abs(dy) / halfH, 0.0001);
      const startX = centerX + dx / denominator;
      const startY = centerY + dy / denominator;
      const side = connectorSideFor(card, anchorWorldX, anchorWorldY);

      return {
        x: Math.max(left, Math.min(right, startX)),
        y: Math.max(top, Math.min(bottom, startY)),
        side,
      };
    }

    function positionConnectorsWorld() {
      if (!stage) return;
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      const cards = Array.from(stage.querySelectorAll(".pf-live-sales-callout,.pf-sales-callout"));
      const anchors = Array.from(stage.querySelectorAll(".pf-live-map-anchor,.pf-map-anchor"));
      const lines = Array.from(stage.querySelectorAll(".pf-live-callout-lines line,.pf-callout-lines line"));

      cards.forEach((card) => {
        const code = codeForCard(card);
        if (!code) return;
        const line = lines.find((item) => item.dataset?.unitCode === code);
        const anchor = anchors.find((item) => (item.dataset?.unitCode || item.textContent?.trim()) === code);
        if (!line || !anchor) return;

        const point = worldAnchorPoint(anchor);
        const anchorWorldX = point.x / 100 * w;
        const anchorWorldY = point.y / 100 * h;
        const start = connectorStart(card, anchorWorldX, anchorWorldY);

        card.dataset.pfConnectorAutoSide = start.side;
        line.dataset.pfConnectorSide = start.side;
        line.setAttribute("x1", String(start.x / w * 100));
        line.setAttribute("y1", String(start.y / h * 100));
        line.setAttribute("x2", String(point.x));
        line.setAttribute("y2", String(point.y));
      });
    }

    function syncLinkedSelection(preferredCard = null) {
      if (!stage) return;
      const selected = preferredCard
        || stage.querySelector(".pf-live-sales-callout.pf-card-key,.pf-live-sales-callout.pf-card-selected,.pf-live-sales-callout.pf-focus-card-active");
      if (selected) activeCode = codeForCard(selected);
      const code = activeCode;
      stage.classList.toggle("pf-has-linked-selection", Boolean(code));

      const anchors = Array.from(stage.querySelectorAll(".pf-live-map-anchor"));
      stage.querySelectorAll(".pf-live-sales-callout").forEach((card) => {
        card.classList.toggle("pf-linked-active", Boolean(code) && codeForCard(card) === code);
      });
      stage.querySelectorAll(".pf-live-callout-lines line").forEach((line) => {
        const lineCode = line.dataset.unitCode || "";
        const anchor = anchors.find((item) => (item.dataset.unitCode || item.textContent?.trim()) === lineCode);
        const resolved = anchor && (anchor.dataset.located === "1" || anchor.dataset.saved === "1");
        const active = Boolean(code) && lineCode === code;
        line.classList.toggle("pf-linked-active", active);
        line.style.opacity = resolved ? (active ? "1" : "0.28") : "0";
      });
      anchors.forEach((anchor) => {
        const anchorCode = anchor.dataset.unitCode || anchor.textContent?.trim() || "";
        const resolved = anchor.dataset.located === "1" || anchor.dataset.saved === "1";
        anchor.classList.toggle("pf-linked-active", resolved && Boolean(code) && anchorCode === code);
      });
    }

    function persistCard(card) {
      const code = codeForCard(card);
      if (!code) return;
      const layout = readCardLayout();
      layout[code] = {
        ...(layout[code] || {}),
        left: +card.offsetLeft.toFixed(2),
        top: +card.offsetTop.toFixed(2),
      };
      delete layout[code].width;
      delete layout[code].height;
      localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify(layout));
    }

    function onCardPointerDown(event) {
      if (event.button !== 0) return;
      if (!syncStage()) return;
      if ((stage.dataset.overviewTool || "select") !== "select") return;
      const card = event.target?.closest?.(".pf-live-sales-callout,.pf-sales-callout");
      if (!card || !stage.contains(card)) return;

      event.preventDefault();
      event.stopPropagation();
      const selectionMode = updateCardSelection(card, event);
      activeCode = codeForCard(card);
      syncLinkedSelection(card);
      if (selectionMode === "selection-only") return;

      drag = {
        card,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: card.offsetLeft,
        startTop: card.offsetTop,
      };
    }

    function onCardPointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      const scale = Math.max(0.0001, Number(lastCamera.scale) || 1);
      const left = drag.startLeft + (event.clientX - drag.startX) / scale;
      const top = drag.startTop + (event.clientY - drag.startY) / scale;
      drag.card.style.left = `${left}px`;
      drag.card.style.top = `${top}px`;
      drag.card.style.right = "auto";
      positionConnectorsWorld();
      syncLinkedSelection(drag.card);
    }

    function finishCardDrag(event) {
      if (!drag || (event?.pointerId != null && event.pointerId !== drag.pointerId)) return;
      const card = drag.card;
      drag = null;
      persistCard(card);
      positionConnectorsWorld();
      syncLinkedSelection(card);
      window.dispatchEvent(new CustomEvent("pf-overview-card-position-changed", {
        detail: { code: codeForCard(card), left: card.offsetLeft, top: card.offsetTop },
      }));
    }

    function onCamera(event) {
      const detail = event.detail || {};
      lastCamera = {
        scale: Number(detail.scale) || 1,
        tx: Number(detail.tx) || 0,
        ty: Number(detail.ty) || 0,
      };
      if (!syncStage()) return;
      normalizeOverlayOwnership();
      positionConnectorsWorld();
      syncLinkedSelection();
    }

    function onLayoutChanged() {
      window.requestAnimationFrame(() => {
        if (!syncStage()) return;
        normalizeOverlayOwnership();
        positionConnectorsWorld();
        syncLinkedSelection();
      });
    }

    function onPointerUpSelection(event) {
      const card = event.target?.closest?.(".pf-live-sales-callout,.pf-sales-callout");
      if (card && stage?.contains(card)) {
        activeCode = codeForCard(card);
        window.requestAnimationFrame(() => syncLinkedSelection(card));
      }
    }

    function onGroupChanged() {
      activeCode = "";
      drag = null;
      overviewCards().forEach((card) => card.classList.remove("pf-card-selected", "pf-card-key"));
      emitSelectionChanged();
      onLayoutChanged();
    }

    syncStage();
    normalizeOverlayOwnership();
    positionConnectorsWorld();
    syncLinkedSelection();
    document.addEventListener("pointerdown", onCardPointerDown, true);
    document.addEventListener("pointerup", onPointerUpSelection, true);
    window.addEventListener("pointermove", onCardPointerMove, true);
    window.addEventListener("pointerup", finishCardDrag, true);
    window.addEventListener("pointercancel", finishCardDrag, true);
    window.addEventListener("pf-overview-camera", onCamera);
    window.addEventListener("pf-overview-auto-arranged", onLayoutChanged);
    window.addEventListener("pf-overview-card-size-changed", onLayoutChanged);
    window.addEventListener("pf-overview-anchor-changed", onLayoutChanged);
    window.addEventListener("pf-overview-live-units-ready", onLayoutChanged);
    window.addEventListener("pf-overview-group-changed", onGroupChanged);
    window.addEventListener("pf-overview-connector-geometry-request", onLayoutChanged);

    return () => {
      drag = null;
      document.removeEventListener("pointerdown", onCardPointerDown, true);
      document.removeEventListener("pointerup", onPointerUpSelection, true);
      window.removeEventListener("pointermove", onCardPointerMove, true);
      window.removeEventListener("pointerup", finishCardDrag, true);
      window.removeEventListener("pointercancel", finishCardDrag, true);
      window.removeEventListener("pf-overview-camera", onCamera);
      window.removeEventListener("pf-overview-auto-arranged", onLayoutChanged);
      window.removeEventListener("pf-overview-card-size-changed", onLayoutChanged);
      window.removeEventListener("pf-overview-anchor-changed", onLayoutChanged);
      window.removeEventListener("pf-overview-live-units-ready", onLayoutChanged);
      window.removeEventListener("pf-overview-group-changed", onGroupChanged);
      window.removeEventListener("pf-overview-connector-geometry-request", onLayoutChanged);
    };
  }, []);

  return null;
}
