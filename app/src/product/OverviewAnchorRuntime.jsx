import { useEffect } from "react";
import "./OverviewAnchorRuntime.css";

const STORAGE_KEY = "phongflow-overview-anchor-layout-v2";
const FOCUS_SCALE = 70;

function isWindows() {
  if (typeof navigator === "undefined") return false;
  const value = String(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "").toLowerCase();
  return value.includes("win");
}

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
    const windows = isWindows();
    let stage = null;
    let observer = null;
    let camera = { scale: 1, tx: 0, ty: 0 };
    let activeCode = "";
    let anchors = readAnchors();
    let drag = null;
    let pendingDraft = null;
    let navigator = null;
    let navSelect = null;
    let navStatus = null;

    const cards = () => stage ? Array.from(stage.querySelectorAll(".pf-live-sales-callout,.pf-sales-callout")) : [];
    const codeForCard = (card) => card?.dataset?.unitCode || card?.querySelector(".pf-sell-card-code,header strong")?.textContent?.trim() || "";
    const codes = () => cards().map(codeForCard).filter(Boolean);
    const anchorForCode = (code) => stage ? Array.from(stage.querySelectorAll(".pf-live-map-anchor,.pf-map-anchor")).find((node) => (node.dataset?.unitCode || node.textContent?.trim()) === code) || null : null;
    const lineForCode = (code) => {
      if (!stage) return null;
      const lines = Array.from(stage.querySelectorAll(".pf-live-callout-lines line,.pf-callout-lines line"));
      const direct = lines.find((line) => line.dataset?.unitCode === code);
      if (direct) return direct;
      const index = cards().findIndex((card) => codeForCard(card) === code);
      return index >= 0 ? lines[index] || null : null;
    };

    function applySavedAnchor(code) {
      const anchor = anchorForCode(code);
      const saved = anchors[code];
      if (!anchor || !saved || pendingDraft?.code === code) return;
      anchor.style.left = `${saved.x}%`;
      anchor.style.top = `${saved.y}%`;
      anchor.dataset.saved = "1";
      anchor.dataset.pfCommittedX = String(saved.x);
      anchor.dataset.pfCommittedY = String(saved.y);
      delete anchor.dataset.pfAnchorDraft;
      const line = lineForCode(code);
      if (line) {
        line.classList.remove("pf-connector-needs-placement");
        line.style.opacity = "";
        line.setAttribute("x2", String(saved.x));
        line.setAttribute("y2", String(saved.y));
      }
    }

    function setStatus(message = "") {
      if (!navStatus) return;
      navStatus.textContent = message;
      navStatus.hidden = !message;
    }

    function setDraftUi(active) {
      navigator?.classList.toggle("has-anchor-draft", Boolean(active));
      navigator?.querySelectorAll("[data-nav='save-anchor'],[data-nav='cancel-anchor']").forEach((button) => {
        button.hidden = !active;
      });
    }

    function syncLineToPoint(code, x, y) {
      const line = lineForCode(code);
      if (!line) return;
      line.classList.remove("pf-connector-needs-placement");
      line.style.opacity = "";
      line.setAttribute("x2", String(x));
      line.setAttribute("y2", String(y));
      window.dispatchEvent(new CustomEvent("pf-overview-anchor-changed", { detail: { code, x, y, live: true, draft: true } }));
    }

    function restoreDraftOrigin() {
      if (!pendingDraft) return;
      const { code, originX, originY, wasSaved } = pendingDraft;
      const anchor = anchorForCode(code);
      if (anchor) {
        anchor.style.left = `${originX}%`;
        anchor.style.top = `${originY}%`;
        delete anchor.dataset.pfAnchorDraft;
        if (wasSaved) anchor.dataset.saved = "1";
        else delete anchor.dataset.saved;
      }
      const line = lineForCode(code);
      if (line) {
        line.setAttribute("x2", String(originX));
        line.setAttribute("y2", String(originY));
      }
      pendingDraft = null;
      setDraftUi(false);
      window.dispatchEvent(new CustomEvent("pf-overview-anchor-changed", { detail: { code, x: originX, y: originY, cancelled: true } }));
    }

    function saveDraft() {
      if (!pendingDraft) return;
      const { code, x, y } = pendingDraft;
      anchors[code] = { x: Number(x.toFixed(5)), y: Number(y.toFixed(5)) };
      saveAnchors(anchors);
      const anchor = anchorForCode(code);
      if (anchor) {
        anchor.dataset.saved = "1";
        anchor.dataset.pfCommittedX = String(anchors[code].x);
        anchor.dataset.pfCommittedY = String(anchors[code].y);
        delete anchor.dataset.pfAnchorDraft;
      }
      pendingDraft = null;
      setDraftUi(false);
      setStatus("Position saved · Auto Arrange will use this PDF anchor");
      window.dispatchEvent(new CustomEvent("pf-overview-anchor-changed", { detail: { code, ...anchors[code], saved: true } }));
    }

    function cancelDraft() {
      if (!pendingDraft) return;
      restoreDraftOrigin();
      setStatus("Manual adjustment cancelled");
    }

    function refreshAnchorVisuals() {
      if (!stage) return;
      Array.from(stage.querySelectorAll(".pf-live-map-anchor,.pf-map-anchor")).forEach((anchor) => {
        const code = anchor.dataset?.unitCode || anchor.textContent?.trim() || "";
        applySavedAnchor(code);
        if (!pendingDraft || pendingDraft.code !== code) {
          const x = Number.parseFloat(anchor.style.left || "50");
          const y = Number.parseFloat(anchor.style.top || "50");
          if (Number.isFinite(x)) anchor.dataset.pfCommittedX = String(x);
          if (Number.isFinite(y)) anchor.dataset.pfCommittedY = String(y);
        }
        const active = code === activeCode;
        anchor.classList.toggle("pf-anchor-dot-active", active);
        anchor.setAttribute("aria-label", active ? `Connector endpoint ${code}. Drag to refine.` : `Connector endpoint ${code}`);
        anchor.title = active ? `${code} · drag endpoint to refine` : code;
        const handleScale = 1 / Math.max(camera.scale, 0.0001);
        anchor.style.transform = active
          ? `translate(-50%,-50%) scale(${handleScale})`
          : windows && camera.scale !== 1
            ? `translate(-50%,-50%) scale(${handleScale})`
            : "translate(-50%,-50%)";
      });
    }

    function setActive(code) {
      if (pendingDraft && pendingDraft.code !== code) cancelDraft();
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
      window.dispatchEvent(new CustomEvent("pf-overview-focus-request", { detail: { code, x, y, scale: FOCUS_SCALE, located: anchor.dataset?.located === "1" } }));
    }

    function editConnector(code) {
      if (!code || !stage) return;
      if (pendingDraft && pendingDraft.code !== code) cancelDraft();
      applySavedAnchor(code);
      const anchor = anchorForCode(code);
      if (!anchor) {
        setStatus("No connector endpoint for this unit");
        return;
      }
      setActive(code);
      setStatus("Drag endpoint to adjust · Save position to override PDF anchor");
    }

    function stepNavigator(delta) {
      if (pendingDraft) cancelDraft();
      const list = codes();
      if (!list.length) return;
      const current = navSelect?.value || activeCode || list[0];
      const index = Math.max(0, list.indexOf(current));
      const next = list[(index + delta + list.length) % list.length];
      if (navSelect) navSelect.value = next;
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
        <button type="button" class="pf-unit-adjust-button" data-nav="adjust">Edit connector</button>
        <button type="button" class="pf-unit-save-anchor" data-nav="save-anchor" hidden>Save position</button>
        <button type="button" class="pf-unit-cancel-anchor" data-nav="cancel-anchor" hidden>Cancel</button>
        <small>${list.length} căn</small>
        <em class="pf-unit-focus-status" hidden></em>`;
      navSelect = navigator.querySelector("select");
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
        if (button.dataset.nav === "prev") stepNavigator(-1);
        if (button.dataset.nav === "next") stepNavigator(1);
        if (button.dataset.nav === "focus") focusCode(code);
        if (button.dataset.nav === "adjust") editConnector(code);
        if (button.dataset.nav === "save-anchor") saveDraft();
        if (button.dataset.nav === "cancel-anchor") cancelDraft();
      });
      navSelect.addEventListener("change", () => {
        if (pendingDraft) cancelDraft();
        setStatus("");
        setActive(navSelect.value);
      });
      document.querySelector(".pf-overview-control-rail")?.appendChild(navigator);
      setDraftUi(Boolean(pendingDraft));
    }

    function onCamera(event) {
      const detail = event.detail || {};
      if (Number.isFinite(detail.scale)) camera.scale = detail.scale;
      if (Number.isFinite(detail.tx)) camera.tx = detail.tx;
      if (Number.isFinite(detail.ty)) camera.ty = detail.ty;
      refreshAnchorVisuals();
    }

    function onAnchorPointerDown(event) {
      const anchor = event.target.closest?.(".pf-live-map-anchor.pf-anchor-dot-active,.pf-map-anchor.pf-anchor-dot-active");
      if (!anchor || !stage?.contains(anchor) || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const code = anchor.dataset?.unitCode || anchor.textContent?.trim() || activeCode;
      if (pendingDraft && pendingDraft.code !== code) cancelDraft();
      const startX = Number.parseFloat(anchor.style.left || "50");
      const startY = Number.parseFloat(anchor.style.top || "50");
      const committed = anchors[code];
      pendingDraft = {
        code,
        originX: Number.isFinite(committed?.x) ? committed.x : startX,
        originY: Number.isFinite(committed?.y) ? committed.y : startY,
        x: startX,
        y: startY,
        wasSaved: Boolean(committed || anchor.dataset.saved === "1"),
      };
      drag = {
        anchor,
        code,
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        startX,
        startY,
      };
      anchor.dataset.pfAnchorDraft = "1";
      anchor.classList.add("is-dragging");
      anchor.setPointerCapture?.(event.pointerId);
      setDraftUi(false);
    }

    function onAnchorPointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId || !stage) return;
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      const scale = Math.max(camera.scale, 0.0001);
      const x = Math.max(-20, Math.min(120, drag.startX + ((event.clientX - drag.clientX) / (rect.width * scale)) * 100));
      const y = Math.max(-20, Math.min(120, drag.startY + ((event.clientY - drag.clientY) / (rect.height * scale)) * 100));
      drag.anchor.style.left = `${x}%`;
      drag.anchor.style.top = `${y}%`;
      drag.anchor.dataset.pfAnchorDraft = "1";
      pendingDraft = { ...pendingDraft, x, y };
      syncLineToPoint(drag.code, x, y);
    }

    function finishAnchorDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      drag.anchor.classList.remove("is-dragging");
      drag.anchor.releasePointerCapture?.(event.pointerId);
      drag = null;
      setDraftUi(true);
      setStatus("Unsaved adjustment · Save position to use it as the PDF anchor, or Cancel");
    }

    function onDoubleClick(event) {
      const card = event.target.closest?.(".pf-live-sales-callout,.pf-sales-callout");
      if (!card || !stage?.contains(card)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      focusCode(codeForCard(card));
    }

    function onCardClick(event) {
      const card = event.target.closest?.(".pf-live-sales-callout,.pf-sales-callout");
      if (!card || !stage?.contains(card)) return;
      const code = codeForCard(card);
      if (code && navSelect) navSelect.value = code;
      if (code) setActive(code);
    }

    function onLiveUnitsReady() {
      requestAnimationFrame(() => { refreshAnchorVisuals(); buildNavigator(); });
    }

    function detachStage() {
      if (pendingDraft) restoreDraftOrigin();
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
