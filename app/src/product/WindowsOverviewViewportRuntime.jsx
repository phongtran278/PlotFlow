import { useEffect } from "react";

const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";

function isWindows() {
  if (typeof navigator === "undefined") return false;
  const value = String(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "").toLowerCase();
  return value.includes("win");
}

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

export default function WindowsOverviewViewportRuntime() {
  useEffect(() => {
    const windows = isWindows();
    let stage = null;
    let observer = null;
    let drag = null;
    let lastCamera = { scale: 1, tx: 0, ty: 0 };

    function syncStage() {
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts") || null;
      return stage;
    }

    function clearWorldTransforms() {
      if (!windows || !stage) return;
      stage.querySelectorAll(".pf-callout-layer,.pf-overview-coming,.pf-overview-markup-layer").forEach((node) => {
        node.style.transform = "none";
        node.style.willChange = "auto";
        node.style.filter = "none";
        node.style.backfaceVisibility = "visible";
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

    function positionAnchors(scale, tx, ty) {
      if (!windows || !stage) return;
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      stage.querySelectorAll(".pf-live-map-anchor,.pf-map-anchor").forEach((anchor) => {
        const point = worldAnchorPoint(anchor);
        const worldX = point.x / 100 * w;
        const worldY = point.y / 100 * h;
        const dx = tx + worldX * scale - worldX;
        const dy = ty + worldY * scale - worldY;
        anchor.style.translate = `${dx}px ${dy}px`;
      });
    }

    function positionCards(scale, tx, ty) {
      if (!windows || !stage) return;
      stage.querySelectorAll(".pf-live-sales-callout,.pf-sales-callout").forEach((card) => {
        const left = card.offsetLeft;
        const top = card.offsetTop;
        const targetLeft = tx + left * scale;
        const targetTop = ty + top * scale;
        card.style.transformOrigin = "0 0";
        card.style.transform = `translate(${targetLeft - left}px, ${targetTop - top}px)`;
        card.style.willChange = "auto";
      });
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
        const cardCenterX = card.offsetLeft + card.offsetWidth / 2;
        const cardEdgeX = anchorWorldX >= cardCenterX
          ? card.offsetLeft + card.offsetWidth
          : card.offsetLeft;
        const cardCenterY = card.offsetTop + card.offsetHeight / 2;
        line.dataset.pfWorldX1 = String(cardEdgeX / w * 100);
        line.dataset.pfWorldY1 = String(cardCenterY / h * 100);
        line.dataset.pfWorldX2 = String(point.x);
        line.dataset.pfWorldY2 = String(point.y);
        if (!windows) {
          line.setAttribute("x1", line.dataset.pfWorldX1);
          line.setAttribute("y1", line.dataset.pfWorldY1);
          line.setAttribute("x2", line.dataset.pfWorldX2);
          line.setAttribute("y2", line.dataset.pfWorldY2);
        }
      });
    }

    function positionConnectors(scale, tx, ty) {
      if (!windows || !stage) return;
      positionConnectorsWorld();
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      stage.querySelectorAll(".pf-live-callout-lines line,.pf-callout-lines line").forEach((line) => {
        const x1 = Number(line.dataset.pfWorldX1);
        const y1 = Number(line.dataset.pfWorldY1);
        const x2 = Number(line.dataset.pfWorldX2);
        const y2 = Number(line.dataset.pfWorldY2);
        if (![x1, y1, x2, y2].every(Number.isFinite)) return;
        line.setAttribute("x1", String(((tx + (x1 / 100 * w) * scale) / w) * 100));
        line.setAttribute("y1", String(((ty + (y1 / 100 * h) * scale) / h) * 100));
        line.setAttribute("x2", String(((tx + (x2 / 100 * w) * scale) / w) * 100));
        line.setAttribute("y2", String(((ty + (y2 / 100 * h) * scale) / h) * 100));
      });
    }

    function positionMarkup(scale, tx, ty) {
      if (!windows || !stage) return;
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      const nx = tx / w * 1000;
      const ny = ty / h * 1000;
      stage.querySelectorAll(".pf-overview-markup-layer > *").forEach((shape) => {
        shape.setAttribute("transform", `translate(${nx} ${ny}) scale(${scale})`);
      });
    }

    function applyCamera(detail = {}) {
      const scale = Number(detail.scale) || 1;
      const tx = Number(detail.tx) || 0;
      const ty = Number(detail.ty) || 0;
      lastCamera = { scale, tx, ty };
      if (!windows || !syncStage()) return;
      clearWorldTransforms();
      positionCards(scale, tx, ty);
      positionAnchors(scale, tx, ty);
      positionConnectors(scale, tx, ty);
      positionMarkup(scale, tx, ty);
      window.__plotflowWindowsViewportOverlay = {
        active: true,
        scale,
        cards: stage.querySelectorAll(".pf-live-sales-callout,.pf-sales-callout").length,
        giantWorldScale: false,
      };
    }

    function persistCard(card) {
      const code = codeForCard(card);
      if (!code) return;
      const layout = readCardLayout();
      layout[code] = {
        ...(layout[code] || {}),
        left: +card.offsetLeft.toFixed(2),
        top: +card.offsetTop.toFixed(2),
        width: +card.offsetWidth.toFixed(2),
        height: +card.offsetHeight.toFixed(2),
      };
      localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify(layout));
    }

    function onCardPointerDown(event) {
      if (event.button !== 0) return;
      if (!syncStage()) return;
      if ((stage.dataset.overviewTool || "select") !== "select") return;
      const card = event.target?.closest?.(".pf-live-sales-callout,.pf-sales-callout");
      if (!card || !stage.contains(card)) return;
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
      if (windows) {
        positionCards(lastCamera.scale, lastCamera.tx, lastCamera.ty);
        positionAnchors(lastCamera.scale, lastCamera.tx, lastCamera.ty);
        positionConnectors(lastCamera.scale, lastCamera.tx, lastCamera.ty);
      } else {
        positionConnectorsWorld();
      }
    }

    function finishCardDrag(event) {
      if (!drag || (event?.pointerId != null && event.pointerId !== drag.pointerId)) return;
      const card = drag.card;
      drag = null;
      persistCard(card);
      if (windows) {
        positionCards(lastCamera.scale, lastCamera.tx, lastCamera.ty);
        positionAnchors(lastCamera.scale, lastCamera.tx, lastCamera.ty);
        positionConnectors(lastCamera.scale, lastCamera.tx, lastCamera.ty);
      } else {
        positionConnectorsWorld();
      }
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
      if (windows) applyCamera(detail);
    }

    function onAnchorChanged() {
      if (!windows) return;
      window.requestAnimationFrame(() => applyCamera(lastCamera));
    }

    function onLayoutChanged() {
      if (!windows) return;
      window.requestAnimationFrame(() => applyCamera(lastCamera));
    }

    syncStage();
    document.addEventListener("pointerdown", onCardPointerDown, true);
    window.addEventListener("pointermove", onCardPointerMove, true);
    window.addEventListener("pointerup", finishCardDrag, true);
    window.addEventListener("pointercancel", finishCardDrag, true);
    window.addEventListener("pf-overview-camera", onCamera);
    window.addEventListener("pf-overview-auto-arranged", onLayoutChanged);
    window.addEventListener("pf-overview-card-size-changed", onLayoutChanged);
    window.addEventListener("pf-overview-anchor-changed", onAnchorChanged);

    if (windows) {
      observer = new MutationObserver(() => {
        if (!stage?.isConnected) syncStage();
        clearWorldTransforms();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      window.__plotflowWindowsViewportOverlay = { active: true, scale: 1, cards: 0, giantWorldScale: false };
    }

    return () => {
      drag = null;
      observer?.disconnect();
      if (stage && windows) {
        stage.querySelectorAll(".pf-live-map-anchor,.pf-map-anchor").forEach((anchor) => { anchor.style.translate = ""; });
      }
      document.removeEventListener("pointerdown", onCardPointerDown, true);
      window.removeEventListener("pointermove", onCardPointerMove, true);
      window.removeEventListener("pointerup", finishCardDrag, true);
      window.removeEventListener("pointercancel", finishCardDrag, true);
      window.removeEventListener("pf-overview-camera", onCamera);
      window.removeEventListener("pf-overview-auto-arranged", onLayoutChanged);
      window.removeEventListener("pf-overview-card-size-changed", onLayoutChanged);
      window.removeEventListener("pf-overview-anchor-changed", onAnchorChanged);
      if (windows) delete window.__plotflowWindowsViewportOverlay;
    };
  }, []);

  return null;
}
