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
    let guide = null;
    let observer = null;
    let drag = null;
    let state = {
      visible: true,
      snap: true,
      x: 0.08,
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
      if (!bounds) return null;
      return bounds.x + clamp(state.x, 0, 1) * bounds.width;
    }

    function renderGuide() {
      if (!stage) return;
      const bounds = pdfBounds();
      const x = guideX();
      if (!bounds || !Number.isFinite(x)) return;

      if (!guide?.isConnected) {
        guide = document.createElement("div");
        guide.className = "pf-overview-guide-line is-vertical";
        guide.innerHTML = '<span title="Drag guide">↔</span>';
        stage.appendChild(guide);
      }

      guide.hidden = !state.visible;
      guide.style.left = `${x}px`;
      guide.style.top = `${bounds.y}px`;
      guide.style.height = `${bounds.height}px`;
      panel?.querySelector("[data-guide-toggle]")?.classList.toggle("active", state.visible);
      panel?.querySelector("[data-guide-snap]")?.classList.toggle("active", state.snap);
    }

    function onGuidePointerDown(event) {
      const line = event.target.closest?.(".pf-overview-guide-line");
      if (!line || line !== guide || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      drag = { pointerId: event.pointerId };
      line.setPointerCapture?.(event.pointerId);
    }

    function onGuidePointerMove(event) {
      if (!drag || event.pointerId !== drag.pointerId || !stage) return;
      const bounds = pdfBounds();
      if (!bounds) return;
      const rect = stage.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      state.x = clamp((localX - bounds.x) / bounds.width, 0, 1);
      renderGuide();
    }

    function finishGuideDrag(event) {
      if (!drag || event.pointerId !== drag.pointerId) return;
      try { guide?.releasePointerCapture?.(event.pointerId); } catch {}
      drag = null;
      saveState();
    }

    function snapCardsAfterDrag(event) {
      if (!stage || !state.visible || !state.snap) return;
      const target = event.target.closest?.(".pf-live-sales-callout");
      if (!target || !stage.contains(target)) return;
      const x = guideX();
      const bounds = pdfBounds();
      if (!Number.isFinite(x) || !bounds) return;

      const candidates = [
        x - target.offsetLeft,
        x - (target.offsetLeft + target.offsetWidth / 2),
        x - (target.offsetLeft + target.offsetWidth),
      ];
      const dx = candidates.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
      if (Math.abs(dx) > SNAP_PX) return;

      const selected = cards().filter((card) => card.classList.contains("pf-card-selected"));
      const list = selected.length ? selected : [target];
      list.forEach((card) => {
        const nextLeft = clamp(card.offsetLeft + dx, bounds.x, bounds.x + bounds.width - card.offsetWidth);
        card.style.left = `${nextLeft}px`;
        card.style.right = "auto";
      });
      persistCards(list);
      window.dispatchEvent(new CustomEvent("pf-overview-auto-arranged", { detail: { mode: "guide-snap" } }));
    }

    function resetGuide() {
      state = { visible: true, snap: true, x: 0.08 };
      saveState();
      renderGuide();
    }

    function installPanel() {
      const rail = document.querySelector(".pf-overview-control-rail");
      if (!rail) return;
      if (!panel?.isConnected) {
        panel = document.createElement("div");
        panel.className = "pf-overview-guide-control";
        panel.innerHTML = `
          <button type="button" data-guide-toggle title="Show or hide guide">Guide</button>
          <button type="button" data-guide-snap title="Snap cards to guide">Snap</button>
          <button type="button" data-guide-reset title="Reset guide position">Reset guide</button>`;
        panel.querySelector("[data-guide-toggle]").addEventListener("click", () => {
          state.visible = !state.visible;
          saveState();
          renderGuide();
        });
        panel.querySelector("[data-guide-snap]").addEventListener("click", () => {
          state.snap = !state.snap;
          saveState();
          renderGuide();
        });
        panel.querySelector("[data-guide-reset]").addEventListener("click", resetGuide);
        rail.appendChild(panel);
      }
      renderGuide();
    }

    function detachStage() {
      if (!stage) return;
      stage.removeEventListener("pointerdown", onGuidePointerDown, true);
      stage.removeEventListener("pointermove", onGuidePointerMove, true);
      stage.removeEventListener("pointerup", finishGuideDrag, true);
      stage.removeEventListener("pointercancel", finishGuideDrag, true);
      stage.removeEventListener("pointerup", snapCardsAfterDrag);
      guide?.remove();
      guide = null;
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
      renderGuide();
    }

    function sync() {
      if (disposed) return;
      installPanel();
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (nextStage && nextStage !== stage) attach(nextStage);
      else renderGuide();
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
