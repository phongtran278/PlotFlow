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

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export default function WindowsOverviewViewportRuntime() {
  useEffect(() => {
    if (!isWindows()) return undefined;

    let stage = null;
    let observer = null;
    let frame = 0;
    let lastCamera = { scale: 1, tx: 0, ty: 0 };
    const style = document.createElement("style");
    style.dataset.plotflowWindowsLowGpu = "1";
    style.textContent = `
      html[data-plotflow-windows-low-gpu="1"] .pf-overview,
      html[data-plotflow-windows-low-gpu="1"] .pf-overview * {
        -webkit-backdrop-filter: none !important;
        backdrop-filter: none !important;
      }
      html[data-plotflow-windows-low-gpu="1"] .pf-masterplan-stage .pf-live-sales-callout,
      html[data-plotflow-windows-low-gpu="1"] .pf-masterplan-stage .pf-sales-callout {
        transform: none !important;
        will-change: auto !important;
        backface-visibility: visible !important;
      }
      html[data-plotflow-windows-low-gpu="1"] .pf-masterplan-stage > .pf-callout-layer,
      html[data-plotflow-windows-low-gpu="1"] .pf-masterplan-stage > .pf-overview-coming,
      html[data-plotflow-windows-low-gpu="1"] .pf-masterplan-stage > .pf-overview-markup-layer {
        will-change: auto !important;
        transform-style: flat !important;
        backface-visibility: visible !important;
        filter: none !important;
      }
    `;
    document.head.appendChild(style);
    document.documentElement.dataset.plotflowWindowsLowGpu = "1";

    function syncStage() {
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts") || null;
      return stage;
    }

    function cards() {
      return stage ? Array.from(stage.querySelectorAll(".pf-live-sales-callout,.pf-sales-callout")) : [];
    }

    function ensureWorldMetric(card) {
      if (!card) return null;
      const storedLeft = Number(card.dataset.pfWorldLeft);
      const storedTop = Number(card.dataset.pfWorldTop);
      if (Number.isFinite(storedLeft) && Number.isFinite(storedTop)) {
        return { left: storedLeft, top: storedTop, width: card.offsetWidth, height: card.offsetHeight };
      }
      const metric = { left: card.offsetLeft, top: card.offsetTop, width: card.offsetWidth, height: card.offsetHeight };
      card.dataset.pfWorldLeft = String(metric.left);
      card.dataset.pfWorldTop = String(metric.top);
      return metric;
    }

    function restoreWorldPositions() {
      cards().forEach((card) => {
        const metric = ensureWorldMetric(card);
        if (!metric) return;
        card.style.transform = "none";
        card.style.left = `${metric.left}px`;
        card.style.top = `${metric.top}px`;
        card.style.right = "auto";
        delete card.dataset.pfWindowsScreenSpace;
      });
    }

    function captureWorldPositionsFromStyle() {
      cards().forEach((card) => {
        if (card.dataset.pfWindowsScreenSpace === "1") return;
        card.dataset.pfWorldLeft = String(card.offsetLeft);
        card.dataset.pfWorldTop = String(card.offsetTop);
      });
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
      cards().forEach((card) => {
        const metric = ensureWorldMetric(card);
        if (!metric) return;
        const targetLeft = tx + metric.left * scale;
        const targetTop = ty + metric.top * scale;
        card.style.transform = "none";
        card.style.left = `${targetLeft}px`;
        card.style.top = `${targetTop}px`;
        card.style.right = "auto";
        card.style.willChange = "auto";
        card.dataset.pfWindowsScreenSpace = "1";
      });
    }

    function positionConnectors(scale, tx, ty) {
      if (!stage) return;
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      const cardList = cards();
      const anchors = Array.from(stage.querySelectorAll(".pf-live-map-anchor,.pf-map-anchor"));
      const cardByCode = new Map(cardList.map((card) => [codeFor(card), card]));
      const anchorByCode = new Map(anchors.map((anchor) => [anchor.dataset.unitCode || anchor.textContent?.trim() || "", anchor]));

      stage.querySelectorAll(".pf-live-callout-lines line,.pf-callout-lines line").forEach((line) => {
        const code = line.dataset.unitCode || "";
        const card = cardByCode.get(code);
        const anchor = anchorByCode.get(code);
        if (!card || !anchor) return;

        const metric = ensureWorldMetric(card);
        if (!metric) return;
        const anchorX = finite(Number.parseFloat(anchor.style.left || "50"), 50);
        const anchorY = finite(Number.parseFloat(anchor.style.top || "50"), 50);
        const anchorPx = anchorX / 100 * w;
        const cardCenter = metric.left + metric.width / 2;
        const startPxX = anchorPx >= cardCenter ? metric.left + metric.width : metric.left;
        const startPxY = metric.top + metric.height / 2;
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
      const scale = finite(detail.scale, 1) || 1;
      const tx = finite(detail.tx, 0);
      const ty = finite(detail.ty, 0);
      lastCamera = { scale, tx, ty };
      captureWorldPositionsFromStyle();
      clearWorldTransforms();
      positionCards(scale, tx, ty);
      positionConnectors(scale, tx, ty);
      positionMarkup(scale, tx, ty);
      window.__plotflowWindowsViewportOverlay = {
        active: true,
        scale,
        cards: cards().length,
        giantWorldScale: false,
        cardTransforms: false,
        screenSpaceLeftTop: true,
        connectorCoordinatesRebuilt: true,
        penOwnedByPenRuntime: true,
        backdropFilter: false,
      };
    }

    function scheduleApply() {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        applyCamera(lastCamera);
      });
    }

    function onCamera(event) {
      applyCamera(event.detail || {});
    }

    function onLayoutChanged() {
      restoreWorldPositions();
      requestAnimationFrame(() => {
        captureWorldPositionsFromStyle();
        applyCamera(lastCamera);
      });
    }

    function onPointerCapture(event) {
      if (!stage?.contains(event.target)) return;
      const card = event.target.closest?.(".pf-live-sales-callout,.pf-sales-callout");
      if (!card) return;
      restoreWorldPositions();
    }

    function onPointerReleaseCapture(event) {
      if (!stage?.contains(event.target)) return;
      const card = event.target.closest?.(".pf-live-sales-callout,.pf-sales-callout");
      if (!card) return;
      captureWorldPositionsFromStyle();
      scheduleApply();
    }

    syncStage();
    window.addEventListener("pointerdown", onPointerCapture, true);
    window.addEventListener("pointerup", onPointerReleaseCapture, true);
    window.addEventListener("pointercancel", onPointerReleaseCapture, true);
    window.addEventListener("pf-overview-camera", onCamera);
    window.addEventListener("pf-overview-auto-arranged", onLayoutChanged);
    window.addEventListener("pf-overview-card-size-changed", onLayoutChanged);
    observer = new MutationObserver(() => {
      if (!stage?.isConnected) syncStage();
      clearWorldTransforms();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.__plotflowWindowsViewportOverlay = {
      active: true,
      scale: 1,
      cards: 0,
      giantWorldScale: false,
      cardTransforms: false,
      screenSpaceLeftTop: true,
      backdropFilter: false,
    };

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      restoreWorldPositions();
      cards().forEach((card) => {
        delete card.dataset.pfWorldLeft;
        delete card.dataset.pfWorldTop;
        delete card.dataset.pfWindowsScreenSpace;
      });
      window.removeEventListener("pointerdown", onPointerCapture, true);
      window.removeEventListener("pointerup", onPointerReleaseCapture, true);
      window.removeEventListener("pointercancel", onPointerReleaseCapture, true);
      window.removeEventListener("pf-overview-camera", onCamera);
      window.removeEventListener("pf-overview-auto-arranged", onLayoutChanged);
      window.removeEventListener("pf-overview-card-size-changed", onLayoutChanged);
      style.remove();
      delete document.documentElement.dataset.plotflowWindowsLowGpu;
      delete window.__plotflowWindowsViewportOverlay;
    };
  }, []);

  return null;
}
