import { useEffect } from "react";
import "./OverviewGuideRuntime.css";

const GUIDE_KEY = "plotflow-overview-guides-v3";
const CARD_LAYOUT_KEY = "phongflow-overview-card-layout-v2";
const SNAP_PX = 18;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function codeFor(card) {
  return card?.dataset?.unitCode || card?.querySelector(".pf-sell-card-code")?.textContent?.trim() || "";
}

export default function OverviewGuideRuntime() {
  useEffect(() => {
    let disposed = false;
    let stage = null;
    let panel = null;
    let verticalGuide = null;
    let horizontalGuide = null;
    let observer = null;
    let drag = null;
    let state = {
      visible: true,
      snap: true,
      x: 0.08,
      y: 0.08,
      ...readJson(GUIDE_KEY, {}),
    };

    const cards = () => stage ? Array.from(stage.querySelectorAll(".pf-live-sales-callout")) : [];

    function pdfBounds() {
      if (!stage) return null;
      const x = Number(stage.dataset.pfPdfX);
      const y = Number(stage.dataset.pfPdfY);
      const width = Number(stage.dataset.pfPdfWidth);
      const height = Number(stage.dataset.pfPdfHeight);
      if (![x, y, width, height].every(Number.isFinite) || width < 2 || height < 2) return null;
      return { x, y, width, height };
    }

    function saveState() {
      localStorage.setItem(GUIDE_KEY, JSON.stringify(state));
    }

    function persistCards(list) {
      const layout = readJson(CARD_LAYOUT_KEY, {});
      list.forEach((card) => {
        const code = codeFor(card);
        if (!code) return;
        layout[code] = {
          left: card.offsetLeft,
          top: card.offsetTop,
          width: card.offsetWidth,
          height: card.offsetHeight,
        };
      });
      localStorage.setItem(CARD_LAYOUT_KEY, JSON.stringify(layout));
    }

    function guideX() {
      const bounds = pdfBounds();
      return bounds ? bounds.x + clamp(state.x, 0, 1) * bounds.width : null;
    }

    function guideY() {
      const bounds = pdfBounds();
      return bounds ? bounds.y + clamp(state.y, 0, 1) * bounds.height : null;
    }

    function ensureGuides() {
      if (!stage) return;
      if (!verticalGuide?.isConnected) {
        verticalGuide = document.createElement("div");
        verticalGuide.className = "pf-overview-guide-line is-vertical";
        verticalGuide.dataset.guideAxis = "x";
        verticalGuide.innerHTML = '<span title="Drag vertical guide">↔</span>';
        stage.appendChild(verticalGuide);
      }
      if (!horizontalGuide?.isConnected) {
        horizontalGuide = document.createElement("div");
        horizontalGuide.className = "pf-overview-guide-line is-horizontal";
        horizontalGuide.dataset.guideAxis = "y";
        horizontalGuide.innerHTML = '<span title="Drag horizontal guide">↕</span>';
        stage.appendChild(horizontalGuide);
      }
    }

    function renderGuides() {
      if (!stage) return;
      const bounds = pdfBounds();
      const x = guideX();
      const y = guideY();
      if (!bounds || !Number.isFinite(x) || !Number.isFinite(y)) return;
      ensureGuides();

      verticalGuide.hidden = !state.visible;
      verticalGuide.style.left = `${x}px`;
      verticalGuide.style.top = `${bounds.y}px`;
      verticalGuide.style.height = `${bounds.height}px`;

      horizontalGuide.hidden = !state.visible;
      horizontalGuide.style.left = `${bounds.x}px`;
      horizontalGuide.style.top = `${y}px`;
      horizontalGuide.style.width = `${bounds.width}px`;

      panel?.querySelector("[data-guide-toggle]")?.classList.toggle("active", state.visible);
      panel?.querySelector("[data-guide-snap]")?.classList.toggle("active", state.snap);
    }

    function onGuidePointerDown(event) {
      const line = event.target.closest?.(".pf-overview-guide-line");
      if (!line || !stage?.contains(line) || event.button !== 0) return;
      const axis = line.dataset.guideAxis;
      if (axis !== "x" && axis !== "y") return;
      event.preventDefault();
      event.stopPropagation();
      drag = { pointerId: event.pointerId, axis, line };
      line.setPointerCapture?.(event.pointerId);
    }

    function onGuidePointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId || !stage) return;
      const bounds = pdfBounds();
      if (!bounds) return;
      const rect = stage.getBoundingClientRect();
      if (drag.axis === "x") {
        const localX = event.clientX - rect.left;
        state.x = clamp((localX - bounds.x) / bounds.width, 0, 1);
      } else {
        const localY = event.clientY - rect.top;
        state.y = clamp((localY - bounds.y) / bounds.height, 0, 1);
      }
      renderGuides();
    }

    function finishGuideDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      try { drag.line?.releasePointerCapture?.(event.pointerId); } catch {}
      drag = null;
      saveState();
    }

    function snapCardsAfterDrag(event) {
      if (!stage || !state.visible || !state.snap) return;
      const target = event.target.closest?.(".pf-live-sales-callout");
      if (!target || !stage.contains(target)) return;
      const x = guideX();
      const y = guideY();
      const bounds = pdfBounds();
      if (!Number.isFinite(x) || !Number.isFinite(y) || !bounds) return;

      const dxCandidates = [
        x - target.offsetLeft,
        x - (target.offsetLeft + target.offsetWidth / 2),
        x - (target.offsetLeft + target.offsetWidth),
      ];
      const dyCandidates = [
        y - target.offsetTop,
        y - (target.offsetTop + target.offsetHeight / 2),
        y - (target.offsetTop + target.offsetHeight),
      ];
      const dx = dxCandidates.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
      const dy = dyCandidates.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
      const snapX = Math.abs(dx) <= SNAP_PX;
      const snapY = Math.abs(dy) <= SNAP_PX;
      if (!snapX && !snapY) return;

      const selected = cards().filter((card) => card.classList.contains("pf-card-selected"));
      const list = selected.length ? selected : [target];
      list.forEach((card) => {
        if (snapX) {
          const nextLeft = clamp(card.offsetLeft + dx, bounds.x, bounds.x + bounds.width - card.offsetWidth);
          card.style.left = `${nextLeft}px`;
          card.style.right = "auto";
        }
        if (snapY) {
          const nextTop = clamp(card.offsetTop + dy, bounds.y, bounds.y + bounds.height - card.offsetHeight);
          card.style.top = `${nextTop}px`;
        }
      });
      persistCards(list);
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", { detail: { mode: "guide-snap", axes: { x: snapX, y: snapY } } }));
    }

    function resetGuide() {
      state = { visible: true, snap: true, x: 0.08, y: 0.08 };
      saveState();
      renderGuides();
    }

    function installPanel() {
      const rail = document.querySelector(".pf-overview-control-rail");
      if (!rail) return;
      if (!panel?.isConnected) {
        panel = document.createElement("div");
        panel.className = "pf-overview-guide-control";
        panel.innerHTML = `
          <button type="button" data-guide-toggle title="Show or hide vertical and horizontal guides">Guides</button>
          <button type="button" data-guide-snap title="Snap cards to either guide">Snap</button>
          <button type="button" data-guide-reset title="Reset both guide positions">Reset</button>`;
        panel.querySelector("[data-guide-toggle]").addEventListener("click", () => {
          state.visible = !state.visible;
          saveState();
          renderGuides();
        });
        panel.querySelector("[data-guide-snap]").addEventListener("click", () => {
          state.snap = !state.snap;
          saveState();
          renderGuides();
        });
        panel.querySelector("[data-guide-reset]").addEventListener("click", resetGuide);
        rail.appendChild(panel);
      }
      renderGuides();
    }

    function detachStage() {
      if (!stage) return;
      stage.removeEventListener("pointerdown", onGuidePointerDown, true);
      stage.removeEventListener("pointermove", onGuidePointerMove, true);
      stage.removeEventListener("pointerup", finishGuideDrag, true);
      stage.removeEventListener("pointercancel", finishGuideDrag, true);
      stage.removeEventListener("pointerup", snapCardsAfterDrag);
      verticalGuide?.remove();
      horizontalGuide?.remove();
      verticalGuide = null;
      horizontalGuide = null;
      stage = null;
    }

    function attach(nextStage) {
      if (!nextStage || nextStage === stage) return;
      detachStage();
      stage = nextStage;
      stage.addEventListener("pointerdown", onGuidePointerDown, true);
      stage.addEventListener("pointermove", onGuidePointerMove, true);
      stage.addEventListener("pointerup", finishGuideDrag, true);
      stage.addEventListener("pointercancel", finishGuideDrag, true);
      stage.addEventListener("pointerup", snapCardsAfterDrag);
      renderGuides();
    }

    function sync() {
      if (disposed) return;
      installPanel();
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (nextStage && nextStage !== stage) attach(nextStage);
      else renderGuides();
    }

    window.addEventListener("pf-overview-pdf-bounds", sync);
    window.addEventListener("pf-overview-live-units-ready", sync);
    observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    sync();

    return () => {
      disposed = true;
      observer?.disconnect();
      window.removeEventListener("pf-overview-pdf-bounds", sync);
      window.removeEventListener("pf-overview-live-units-ready", sync);
      detachStage();
      panel?.remove();
    };
  }, []);

  return null;
}
