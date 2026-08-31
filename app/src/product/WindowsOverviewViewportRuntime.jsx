import { useEffect } from "react";

function isWindows() {
  if (typeof navigator === "undefined") return false;
  const value = String(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "").toLowerCase();
  return value.includes("win");
}

function percentToViewport(value, size, offset, scale) {
  const worldPx = (Number(value) || 0) / 100 * size;
  return ((offset + worldPx * scale) / Math.max(1, size)) * 100;
}

function codeFor(card) {
  return card?.dataset?.unitCode || card?.querySelector(".pf-sell-card-code,header strong")?.textContent?.trim() || "";
}

export default function WindowsOverviewViewportRuntime() {
  useEffect(() => {
    if (!isWindows()) return undefined;

    let stage = null;
    let observer = null;
    let lastCamera = { scale: 1, tx: 0, ty: 0 };

    function syncStage() {
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts") || null;
      return stage;
    }

    function clearWorldTransforms() {
      if (!stage) return;
      stage.querySelectorAll(".pf-callout-layer,.pf-overview-coming,.pf-overview-markup-layer").forEach((node) => {
        node.style.transform = "none";
        node.style.willChange = "auto";
        node.style.filter = "none";
        node.style.backfaceVisibility = "visible";
      });
    }

    function positionCards(scale, tx, ty) {
      if (!stage) return;
      stage.querySelectorAll(".pf-live-sales-callout,.pf-sales-callout").forEach((card) => {
        const baseLeft = card.offsetLeft;
        const baseTop = card.offsetTop;
        const targetLeft = tx + baseLeft * scale;
        const targetTop = ty + baseTop * scale;
        card.style.transformOrigin = "0 0";
        card.style.transform = `translate(${targetLeft - baseLeft}px, ${targetTop - baseTop}px)`;
        card.style.willChange = "auto";
      });
    }

    function positionConnectors(scale, tx, ty) {
      if (!stage) return;
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      const cards = Array.from(stage.querySelectorAll(".pf-live-sales-callout,.pf-sales-callout"));
      const anchors = Array.from(stage.querySelectorAll(".pf-live-map-anchor,.pf-map-anchor"));
      const cardByCode = new Map(cards.map((card) => [codeFor(card), card]));
      const anchorByCode = new Map(anchors.map((anchor) => [anchor.dataset.unitCode || anchor.textContent?.trim() || "", anchor]));

      stage.querySelectorAll(".pf-live-callout-lines line,.pf-callout-lines line").forEach((line) => {
        const code = line.dataset.unitCode || "";
        const card = cardByCode.get(code);
        const anchor = anchorByCode.get(code);
        if (!card || !anchor) return;

        const anchorX = Number.parseFloat(anchor.style.left || "50");
        const anchorY = Number.parseFloat(anchor.style.top || "50");
        const anchorPx = anchorX / 100 * w;
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const startPxX = anchorPx >= cardCenter ? card.offsetLeft + card.offsetWidth : card.offsetLeft;
        const startPxY = card.offsetTop + card.offsetHeight / 2;
        const startX = startPxX / w * 100;
        const startY = startPxY / h * 100;

        line.setAttribute("x1", String(percentToViewport(startX, w, tx, scale)));
        line.setAttribute("y1", String(percentToViewport(startY, h, ty, scale)));
        line.setAttribute("x2", String(percentToViewport(anchorX, w, tx, scale)));
        line.setAttribute("y2", String(percentToViewport(anchorY, h, ty, scale)));
      });
    }

    function positionMarkup(scale, tx, ty) {
      if (!stage) return;
      const w = stage.clientWidth || 1;
      const nx = tx / w * 1000;
      const ny = ty / (stage.clientHeight || 1) * 1000;
      stage.querySelectorAll(".pf-overview-markup-layer > *").forEach((shape) => {
        shape.setAttribute("transform", `translate(${nx} ${ny}) scale(${scale})`);
      });
    }

    function applyCamera(detail = {}) {
      if (!syncStage()) return;
      const scale = Number(detail.scale) || 1;
      const tx = Number(detail.tx) || 0;
      const ty = Number(detail.ty) || 0;
      lastCamera = { scale, tx, ty };
      clearWorldTransforms();
      positionCards(scale, tx, ty);
      positionConnectors(scale, tx, ty);
      positionMarkup(scale, tx, ty);
      window.__plotflowWindowsViewportOverlay = {
        active: true,
        scale,
        cards: stage.querySelectorAll(".pf-live-sales-callout,.pf-sales-callout").length,
        giantWorldScale: false,
        liveCardCoordinates: true,
        connectorCoordinatesRebuilt: true,
        penOwnedByPenRuntime: true,
      };
    }

    function onCamera(event) {
      applyCamera(event.detail || {});
    }

    function onLayoutChanged() {
      window.requestAnimationFrame(() => applyCamera(lastCamera));
    }

    syncStage();
    window.addEventListener("pf-overview-camera", onCamera);
    window.addEventListener("pf-overview-auto-arranged", onLayoutChanged);
    window.addEventListener("pf-overview-card-size-changed", onLayoutChanged);
    observer = new MutationObserver(() => {
      if (!stage?.isConnected) syncStage();
      clearWorldTransforms();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.__plotflowWindowsViewportOverlay = { active: true, scale: 1, cards: 0, giantWorldScale: false };

    return () => {
      observer?.disconnect();
      window.removeEventListener("pf-overview-camera", onCamera);
      window.removeEventListener("pf-overview-auto-arranged", onLayoutChanged);
      window.removeEventListener("pf-overview-card-size-changed", onLayoutChanged);
      delete window.__plotflowWindowsViewportOverlay;
    };
  }, []);

  return null;
}
