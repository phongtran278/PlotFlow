import { useEffect } from "react";

const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";

function isWindows() {
  if (typeof navigator === "undefined") return false;
  const value = String(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "").toLowerCase();
  return value.includes("win");
}

function percentToViewport(value, size, offset, scale) {
  const worldPx = (Number(value) || 0) / 100 * size;
  return ((offset + worldPx * scale) / Math.max(1, size)) * 100;
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
    if (!isWindows()) return undefined;

    let stage = null;
    let observer = null;
    let drag = null;
    let lastCamera = { scale: 1, tx: 0, ty: 0 };

    function syncStage() {
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts") || null;
      return stage;
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
        const left = card.offsetLeft;
        const top = card.offsetTop;
        const targetLeft = tx + left * scale;
        const targetTop = ty + top * scale;
        card.style.transformOrigin = "0 0";
        card.style.transform = `translate(${targetLeft - left}px, ${targetTop - top}px)`;
        card.style.willChange = "auto";
      });
    }

    function positionConnectors(scale, tx, ty) {
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

        const ax = Number.parseFloat(anchor.style.left || "50");
        const ay = Number.parseFloat(anchor.style.top || "50");
        const anchorWorldX = ax / 100 * w;
        const cardCenterX = card.offsetLeft + card.offsetWidth / 2;
        const cardEdgeX = anchorWorldX >= cardCenterX
          ? card.offsetLeft + card.offsetWidth
          : card.offsetLeft;
        const cardCenterY = card.offsetTop + card.offsetHeight / 2;
        const x1 = cardEdgeX / w * 100;
        const y1 = cardCenterY / h * 100;

        line.setAttribute("x1", String(percentToViewport(x1, w, tx, scale)));
        line.setAttribute("y1", String(percentToViewport(y1, h, ty, scale)));
        line.setAttribute("x2", String(percentToViewport(ax, w, tx, scale)));
        line.setAttribute("y2", String(percentToViewport(ay, h, ty, scale)));
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

      event.preventDefault();
      event.stopPropagation();
      drag = {
        card,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: card.offsetLeft,
        startTop: card.offsetTop,
      };
      card.classList.add("pf-card-selected");
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
      positionCards(lastCamera.scale, lastCamera.tx, lastCamera.ty);
      positionConnectors(lastCamera.scale, lastCamera.tx, lastCamera.ty);
    }

    function finishCardDrag(event) {
      if (!drag || (event?.pointerId != null && event.pointerId !== drag.pointerId)) return;
      event?.preventDefault?.();
      event?.stopPropagation?.();
      const card = drag.card;
      drag = null;
      persistCard(card);
      positionCards(lastCamera.scale, lastCamera.tx, lastCamera.ty);
      positionConnectors(lastCamera.scale, lastCamera.tx, lastCamera.ty);
      window.dispatchEvent(new CustomEvent("pf-overview-card-position-changed", {
        detail: { code: codeForCard(card), left: card.offsetLeft, top: card.offsetTop },
      }));
    }

    function onCamera(event) {
      applyCamera(event.detail || {});
    }

    function onLayoutChanged() {
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
    observer = new MutationObserver(() => {
      if (!stage?.isConnected) syncStage();
      clearWorldTransforms();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.__plotflowWindowsViewportOverlay = { active: true, scale: 1, cards: 0, giantWorldScale: false };

    return () => {
      drag = null;
      observer?.disconnect();
      document.removeEventListener("pointerdown", onCardPointerDown, true);
      window.removeEventListener("pointermove", onCardPointerMove, true);
      window.removeEventListener("pointerup", finishCardDrag, true);
      window.removeEventListener("pointercancel", finishCardDrag, true);
      window.removeEventListener("pf-overview-camera", onCamera);
      window.removeEventListener("pf-overview-auto-arranged", onLayoutChanged);
      window.removeEventListener("pf-overview-card-size-changed", onLayoutChanged);
      delete window.__plotflowWindowsViewportOverlay;
    };
  }, []);

  return null;
}
