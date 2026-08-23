import { useEffect } from "react";
import "./OverviewAnchorRuntime.css";

const STORAGE_KEY = "phongflow-overview-anchor-layout-v2";
const FOCUS_SCALE = 70;
const NUDGE_STEP = 0.35;
const NUDGE_STEP_LARGE = 1.5;

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
    let navigator = null;
    let navSelect = null;
    let navStatus = null;

    function cards() {
      return stage ? Array.from(stage.querySelectorAll(".pf-sales-callout")) : [];
    }

    function codeForCard(card) {
      return card?.dataset?.unitCode || card?.querySelector("header strong")?.textContent?.trim() || "";
    }

    function codes() {
      return cards().map(codeForCard).filter(Boolean);
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
      anchor.dataset.saved = "1";
      const line = lineForCode(code);
      if (line) {
        line.classList.remove("pf-connector-needs-placement");
        line.style.opacity = "";
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
        anchor.setAttribute("aria-label", active ? `Connector point ${code}. Drag to refine.` : `Connector point ${code}`);
        anchor.title = active ? `${code} · drag or use arrow nudges` : code;
        if (active) anchor.style.transform = `translate(-50%,-50%) scale(${1 / Math.max(camera.scale, 0.0001)})`;
        else anchor.style.transform = "translate(-50%,-50%)";
      });
    }

    function setStatus(message = "") {
      if (!navStatus) return;
      navStatus.textContent = message;
      navStatus.hidden = !message;
    }

    function setActive(code) {
      activeCode = code;
      refreshAnchorVisuals();
      stage?.classList.toggle("pf-has-active-anchor", Boolean(activeCode));
      if (stage) stage.dataset.pfActiveAnchor = activeCode;
      if (navSelect && code && Array.from(navSelect.options).some((option) => option.value === code)) navSelect.value = code;
      cards().forEach((item) => item.classList.toggle("pf-focus-card-active", codeForCard(item) === code));
    }

    function focusCode(code) {
      if (!code || !stage) return;
      applySavedAnchor(code);
      const anchor = anchorForCode(code);
      if (!anchor) return;
      const x = Number.parseFloat(anchor.style.left || "50");
      const y = Number.parseFloat(anchor.style.top || "50");
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;

      setActive(code);
      const verified = anchor.dataset?.located === "1" || anchor.dataset?.saved === "1";
      setStatus(verified ? "" : `${code} · needs placement`);
      window.dispatchEvent(new CustomEvent("pf-overview-focus-request", {
        detail: { code, x, y, scale: FOCUS_SCALE, located: anchor.dataset?.located === "1" },
      }));
    }

    function adjustCode(code) {
      if (!code || !stage) return;
      applySavedAnchor(code);
      const anchor = anchorForCode(code);
      if (!anchor) {
        setStatus("No connector point for this unit");
        return;
      }
      setActive(code);
      navigator?.classList.add("is-adjusting");
      setStatus("Adjust connector · drag red point or use arrows · Shift = larger step");
    }

    function moveAnchor(code, dx, dy) {
      const anchor = anchorForCode(code);
      if (!anchor) return;
      const x = Math.max(-20, Math.min(120, Number.parseFloat(anchor.style.left || "50") + dx));
      const y = Math.max(-20, Math.min(120, Number.parseFloat(anchor.style.top || "50") + dy));
      anchor.style.left = `${x}%`;
      anchor.style.top = `${y}%`;
      anchor.dataset.saved = "1";
      const line = lineForCode(code);
      if (line) {
        line.classList.remove("pf-connector-needs-placement");
        line.style.opacity = "";
        line.setAttribute("x2", String(x));
        line.setAttribute("y2", String(y));
      }
      anchors[code] = { x: Number(x.toFixed(5)), y: Number(y.toFixed(5)) };
      saveAnchors(anchors);
      setActive(code);
      setStatus(`Connector · ${x.toFixed(1)}%, ${y.toFixed(1)}%`);
      window.dispatchEvent(new CustomEvent("pf-overview-anchor-changed", { detail: { code, x, y } }));
    }

    function onDoubleClick(event) {
      const card = event.target.closest?.(".pf-sales-callout");
      if (!card || !stage?.contains(card)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      focusCode(codeForCard(card));
    }

    function onCardClick(event) {
      const card = event.target.closest?.(".pf-sales-callout");
      if (!card || !stage?.contains(card)) return;
      const code = codeForCard(card);
      if (code && navSelect) navSelect.value = code;
      if (code) setActive(code);
    }

    function stepNavigator(delta) {
      const list = codes();
      if (!list.length) return;
      const current = navSelect?.value || activeCode || list[0];
      const currentIndex = Math.max(0, list.indexOf(current));
      const next = list[(currentIndex + delta + list.length) % list.length];
      if (navSelect) navSelect.value = next;
      navigator?.classList.remove("is-adjusting");
      setStatus("");
      setActive(next);
    }

    function buildNavigator() {
      if (!stage) return;
      const list = codes();
      if (!list.length) return;
      navigator?.remove();
      navigator = document.createElement("div");
      navigator.className = "pf-unit-navigator";
      navigator.innerHTML = `
        <span class="pf-unit-navigator-label">UNIT</span>
        <button type="button" data-nav="prev" title="Previous unit">‹</button>
        <select aria-label="Chọn mã căn"></select>
        <button type="button" data-nav="next" title="Next unit">›</button>
        <button type="button" class="pf-unit-focus-button" data-nav="focus">Focus</button>
        <button type="button" class="pf-unit-adjust-button" data-nav="adjust">Adjust connector</button>
        <div class="pf-anchor-nudge" aria-label="Connector fine tune">
          <button type="button" data-nav="nudge-left" title="Left · Shift-click for larger step">←</button>
          <button type="button" data-nav="nudge-up" title="Up · Shift-click for larger step">↑</button>
          <button type="button" data-nav="nudge-down" title="Down · Shift-click for larger step">↓</button>
          <button type="button" data-nav="nudge-right" title="Right · Shift-click for larger step">→</button>
        </div>
        <small>${list.length} căn</small>
        <em class="pf-unit-focus-status" hidden></em>`;
      navSelect = navigator.querySelector(":scope > select");
      navStatus = navigator.querySelector(".pf-unit-focus-status");
      list.forEach((code) => {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = code;
        navSelect.appendChild(option);
      });
      if (activeCode && list.includes(activeCode)) navSelect.value = activeCode;
      navigator.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-nav]");
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        const code = navSelect?.value || list[0];
        const step = event.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP;
        if (button.dataset.nav === "prev") stepNavigator(-1);
        if (button.dataset.nav === "next") stepNavigator(1);
        if (button.dataset.nav === "focus") focusCode(code);
        if (button.dataset.nav === "adjust") adjustCode(code);
        if (button.dataset.nav === "nudge-left") moveAnchor(code, -step, 0);
        if (button.dataset.nav === "nudge-right") moveAnchor(code, step, 0);
        if (button.dataset.nav === "nudge-up") moveAnchor(code, 0, -step);
        if (button.dataset.nav === "nudge-down") moveAnchor(code, 0, step);
      });
      navSelect.addEventListener("change", () => {
        navigator?.classList.remove("is-adjusting");
        setStatus("");
        setActive(navSelect.value);
      });
      document.querySelector(".pf-overview-control-rail")?.appendChild(navigator);
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
      drag.anchor.dataset.saved = "1";
      const line = lineForCode(drag.code);
      if (line) {
        line.classList.remove("pf-connector-needs-placement");
        line.style.opacity = "";
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
      setStatus("Connector position saved");
      window.dispatchEvent(new CustomEvent("pf-overview-anchor-changed", { detail: { code: drag.code, ...anchors[drag.code] } }));
      drag = null;
    }

    function onLiveUnitsReady() {
      requestAnimationFrame(() => {
        refreshAnchorVisuals();
        buildNavigator();
      });
    }

    function detachStage() {
      stage?.removeEventListener("dblclick", onDoubleClick, true);
      stage?.removeEventListener("click", onCardClick, true);
      stage?.removeEventListener("pointerdown", onAnchorPointerDown, true);
      stage?.removeEventListener("pointermove", onAnchorPointerMove, true);
      stage?.removeEventListener("pointerup", finishAnchorDrag, true);
      stage?.removeEventListener("pointercancel", finishAnchorDrag, true);
      navigator?.remove();
      navigator = null;
      navSelect = null;
      navStatus = null;
    }

    function attach(nextStage) {
      if (!nextStage || nextStage === stage) return;
      detachStage();
      stage = nextStage;
      stage.addEventListener("dblclick", onDoubleClick, true);
      stage.addEventListener("click", onCardClick, true);
      stage.addEventListener("pointerdown", onAnchorPointerDown, true);
      stage.addEventListener("pointermove", onAnchorPointerMove, true);
      stage.addEventListener("pointerup", finishAnchorDrag, true);
      stage.addEventListener("pointercancel", finishAnchorDrag, true);
      refreshAnchorVisuals();
      buildNavigator();
    }

    function sync() {
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (nextStage) attach(nextStage);
    }

    sync();
    observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("pf-overview-camera", onCamera);
    window.addEventListener("pf-overview-live-units-ready", onLiveUnitsReady);

    return () => {
      observer?.disconnect();
      window.removeEventListener("pf-overview-camera", onCamera);
      window.removeEventListener("pf-overview-live-units-ready", onLiveUnitsReady);
      detachStage();
    };
  }, []);

  return null;
}
