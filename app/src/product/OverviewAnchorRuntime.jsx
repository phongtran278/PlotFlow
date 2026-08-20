import { useEffect } from "react";
import "./OverviewAnchorRuntime.css";

const STORAGE_KEY = "phongflow-overview-anchor-layout-v1";
const FOCUS_SCALE = 70;

function readAnchors() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function saveAnchors(value) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export default function OverviewAnchorRuntime() {
  useEffect(() => {
    let stage = null;
    let observer = null;
    let camera = { scale: 1, tx: 0, ty: 0 };
    let activeCode = "";
    let anchors = readAnchors();
    let drag = null;

    function cards() {
      return stage ? Array.from(stage.querySelectorAll(".pf-sales-callout")) : [];
    }

    function codeForCard(card) {
      return card?.dataset?.unitCode || card?.querySelector("header strong")?.textContent?.trim() || "";
    }

    function anchorForCode(code) {
      if (!stage) return null;
      return Array.from(stage.querySelectorAll(".pf-map-anchor")).find((node) =>
        (node.dataset?.unitCode || node.textContent?.trim()) === code
      ) || null;
    }

    function lineForCode(code) {
      if (!stage) return null;
      const direct = Array.from(stage.querySelectorAll(".pf-callout-lines line")).find((line) => line.dataset?.unitCode === code);
      if (direct) return direct;
      const index = cards().findIndex((card) => codeForCard(card) === code);
      const lines = Array.from(stage.querySelectorAll(".pf-callout-lines line"));
      return index >= 0 ? lines[index] : null;
    }

    function applySavedAnchor(code) {
      const anchor = anchorForCode(code);
      const saved = anchors[code];
      if (!anchor || !saved) return;
      anchor.style.left = `${saved.x}%`;
      anchor.style.top = `${saved.y}%`;
      const line = lineForCode(code);
      if (line) {
        line.setAttribute("x2", String(saved.x));
        line.setAttribute("y2", String(saved.y));
      }
    }

    function refreshAnchorVisuals() {
      if (!stage) return;
      Array.from(stage.querySelectorAll(".pf-map-anchor")).forEach((anchor) => {
        const code = anchor.dataset?.unitCode || anchor.textContent?.trim() || "";
        applySavedAnchor(code);
        const active = code === activeCode;
        anchor.classList.toggle("pf-anchor-dot-active", active);
        anchor.setAttribute("aria-label", active ? `Anchor ${code}. Drag to refine lot position.` : `Anchor ${code}`);
        anchor.title = active ? `${code} · kéo chấm để chỉnh vị trí` : code;
        if (active) anchor.style.transform = `translate(-50%,-50%) scale(${1 / Math.max(camera.scale, 0.0001)})`;
        else anchor.style.transform = "translate(-50%,-50%)";
      });
    }

    function setActive(code) {
      activeCode = code;
      refreshAnchorVisuals();
      stage?.classList.toggle("pf-has-active-anchor", Boolean(activeCode));
      if (stage) stage.dataset.pfActiveAnchor = activeCode;
    }

    function focusCard(card) {
      const code = codeForCard(card);
      if (!code || !stage) return;
      applySavedAnchor(code);
      const anchor = anchorForCode(code);
      if (!anchor) return;

      const x = Number.parseFloat(anchor.style.left || "50");
      const y = Number.parseFloat(anchor.style.top || "50");
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      setActive(code);
      cards().forEach((item) => item.classList.toggle("pf-focus-card-active", item === card));
      window.dispatchEvent(new CustomEvent("pf-overview-focus-request", {
        detail: {
          code,
          x,
          y,
          scale: FOCUS_SCALE,
          located: anchor.dataset?.located === "1",
        },
      }));
    }

    function onDoubleClick(event) {
      const card = event.target.closest?.(".pf-sales-callout");
      if (!card || !stage?.contains(card)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      focusCard(card);
    }

    function onCamera(event) {
      const detail = event.detail || {};
      if (Number.isFinite(detail.scale)) camera.scale = detail.scale;
      if (Number.isFinite(detail.tx)) camera.tx = detail.tx;
      if (Number.isFinite(detail.ty)) camera.ty = detail.ty;
      refreshAnchorVisuals();
    }

    function onAnchorPointerDown(event) {
      const anchor = event.target.closest?.(".pf-map-anchor.pf-anchor-dot-active");
      if (!anchor || !stage?.contains(anchor) || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const code = anchor.dataset?.unitCode || anchor.textContent?.trim() || activeCode;
      const startX = Number.parseFloat(anchor.style.left || "50");
      const startY = Number.parseFloat(anchor.style.top || "50");
      drag = { anchor, code, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, startX, startY };
      anchor.classList.add("is-dragging");
      anchor.setPointerCapture?.(event.pointerId);
    }

    function onAnchorPointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId || !stage) return;
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      const scale = Math.max(camera.scale, 0.0001);
      const dx = ((event.clientX - drag.clientX) / (rect.width * scale)) * 100;
      const dy = ((event.clientY - drag.clientY) / (rect.height * scale)) * 100;
      const x = Math.max(-20, Math.min(120, drag.startX + dx));
      const y = Math.max(-20, Math.min(120, drag.startY + dy));
      drag.anchor.style.left = `${x}%`;
      drag.anchor.style.top = `${y}%`;
      const line = lineForCode(drag.code);
      if (line) {
        line.setAttribute("x2", String(x));
        line.setAttribute("y2", String(y));
      }
      anchors[drag.code] = { x: Number(x.toFixed(5)), y: Number(y.toFixed(5)) };
    }

    function finishAnchorDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag.anchor.classList.remove("is-dragging");
      drag.anchor.releasePointerCapture?.(event.pointerId);
      saveAnchors(anchors);
      drag = null;
    }

    function onLiveUnitsReady() {
      requestAnimationFrame(refreshAnchorVisuals);
    }

    function attach(nextStage) {
      if (!nextStage || nextStage === stage) return;
      stage?.removeEventListener("dblclick", onDoubleClick, true);
      stage?.removeEventListener("pointerdown", onAnchorPointerDown, true);
      stage?.removeEventListener("pointermove", onAnchorPointerMove, true);
      stage?.removeEventListener("pointerup", finishAnchorDrag, true);
      stage?.removeEventListener("pointercancel", finishAnchorDrag, true);
      stage = nextStage;
      stage.addEventListener("dblclick", onDoubleClick, true);
      stage.addEventListener("pointerdown", onAnchorPointerDown, true);
      stage.addEventListener("pointermove", onAnchorPointerMove, true);
      stage.addEventListener("pointerup", finishAnchorDrag, true);
      stage.addEventListener("pointercancel", finishAnchorDrag, true);
      refreshAnchorVisuals();
    }

    function sync() {
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (nextStage) attach(nextStage);
    }

    sync();
    observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    window.addEventListener("pf-overview-camera", onCamera);
    window.addEventListener("pf-overview-live-units-ready", onLiveUnitsReady);

    return () => {
      observer?.disconnect();
      window.removeEventListener("pf-overview-camera", onCamera);
      window.removeEventListener("pf-overview-live-units-ready", onLiveUnitsReady);
      stage?.removeEventListener("dblclick", onDoubleClick, true);
      stage?.removeEventListener("pointerdown", onAnchorPointerDown, true);
      stage?.removeEventListener("pointermove", onAnchorPointerMove, true);
      stage?.removeEventListener("pointerup", finishAnchorDrag, true);
      stage?.removeEventListener("pointercancel", finishAnchorDrag, true);
    };
  }, []);

  return null;
}
