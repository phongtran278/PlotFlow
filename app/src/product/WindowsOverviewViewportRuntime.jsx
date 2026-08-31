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

export default function WindowsOverviewViewportRuntime() {
  useEffect(() => {
    if (!isWindows()) return undefined;

    let stage = null;
    let observer = null;
    const cardBase = new WeakMap();

    function syncStage() {
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts") || null;
      return stage;
    }

    function baseForCard(card) {
      let base = cardBase.get(card);
      if (!base) {
        base = { left: card.offsetLeft, top: card.offsetTop };
        cardBase.set(card, base);
      }
      return base;
    }

    function clearWorldTransforms() {
      if (!stage) return;
      stage.querySelectorAll(".pf-callout-layer,.pf-overview-coming,.pf-overview-markup-layer,.pf-overview-pen-layer").forEach((node) => {
        node.style.transform = "none";
        node.style.willChange = "auto";
        node.style.filter = "none";
        node.style.backfaceVisibility = "visible";
      });
    }

    function positionCards(scale, tx, ty) {
      if (!stage) return;
      stage.querySelectorAll(".pf-live-sales-callout,.pf-sales-callout").forEach((card) => {
        const base = baseForCard(card);
        const targetLeft = tx + base.left * scale;
        const targetTop = ty + base.top * scale;
        const dx = targetLeft - base.left;
        const dy = targetTop - base.top;
        card.style.transformOrigin = "0 0";
        card.style.transform = `translate(${dx}px, ${dy}px)`;
        card.style.willChange = "auto";
      });
    }

    function positionConnectors(scale, tx, ty) {
      if (!stage) return;
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      stage.querySelectorAll(".pf-live-callout-lines line,.pf-callout-lines line").forEach((line) => {
        const x1 = Number(line.getAttribute("x1"));
        const y1 = Number(line.getAttribute("y1"));
        const x2 = Number(line.getAttribute("x2"));
        const y2 = Number(line.getAttribute("y2"));
        if (![x1, y1, x2, y2].every(Number.isFinite)) return;
        line.setAttribute("x1", String(percentToViewport(x1, w, tx, scale)));
        line.setAttribute("y1", String(percentToViewport(y1, h, ty, scale)));
        line.setAttribute("x2", String(percentToViewport(x2, w, tx, scale)));
        line.setAttribute("y2", String(percentToViewport(y2, h, ty, scale)));
      });
    }

    function positionMarkup(scale, tx, ty) {
      if (!stage) return;
      const w = stage.clientWidth || 1;
      const h = stage.clientHeight || 1;
      const nx = tx / w * 1000;
      const ny = ty / h * 1000;
      stage.querySelectorAll(".pf-overview-markup-layer > *").forEach((shape) => {
        shape.setAttribute("transform", `translate(${nx} ${ny}) scale(${scale})`);
      });
      stage.querySelectorAll(".pf-overview-pen-layer > *").forEach((shape) => {
        shape.setAttribute("transform", `translate(${tx / w * 100} ${ty / h * 100}) scale(${scale})`);
      });
    }

    function applyCamera(detail = {}) {
      if (!syncStage()) return;
      const scale = Number(detail.scale) || 1;
      const tx = Number(detail.tx) || 0;
      const ty = Number(detail.ty) || 0;
      clearWorldTransforms();
      positionCards(scale, tx, ty);
      positionConnectors(scale, tx, ty);
      positionMarkup(scale, tx, ty);
      window.__plotflowWindowsViewportOverlay = {
        active: true,
        scale,
        cards: stage.querySelectorAll(".pf-live-sales-callout,.pf-sales-callout").length,
        giantWorldScale: false,
      };
    }

    function onCamera(event) {
      applyCamera(event.detail || {});
    }

    function onLayoutChanged() {
      cardBase.clear?.();
      window.requestAnimationFrame(() => applyCamera({ scale: Number(stage?.style.getPropertyValue("--pf-overview-zoom")) || 1, tx: 0, ty: 0 }));
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
