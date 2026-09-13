import { useEffect } from "react";

const GROUP_STYLE_KEY = "plotflow-overview-group-style-v1";
const SCALE_STEPS = [1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.44, 0.36, 0.28, 0.2];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function readJson(key, fallback = {}) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

export default function OverviewArrangeAutoFitRuntime() {
  useEffect(() => {
    let session = null;
    let internalReopen = false;
    let raf = 0;
    const scanClass = "pf-arrange-autofit-scanning";
    const style = document.createElement("style");
    style.dataset.pfArrangeAutofit = "1";
    style.textContent = `body.${scanClass} .pf-arrange-preview-overlay{visibility:hidden!important;pointer-events:none!important;}`;
    document.head.appendChild(style);

    const stage = () => document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
    const overlay = () => document.querySelector(".pf-arrange-preview-overlay");
    const cards = () => {
      const root = stage()?.querySelector(".pf-live-overview-callouts:not(.pf-callouts-leaving)")
        || stage()?.querySelector(".pf-live-overview-callouts");
      return root ? Array.from(root.querySelectorAll(".pf-live-sales-callout")) : [];
    };

    function currentGroup() {
      return String(stage()?.dataset?.overviewGroup || "Overview").trim();
    }

    function currentScale() {
      const first = cards()[0];
      const raw = Number(first?.dataset?.pfObjectScale || first?.style?.scale || 1);
      return clamp(Number.isFinite(raw) ? raw : 1, 0.2, 2.2);
    }

    function currentGap(root = overlay()) {
      const raw = Number(root?.querySelector("[data-arrange-gap]")?.value);
      return Number.isFinite(raw) ? clamp(raw, 0, 120) : 14;
    }

    function gapSteps(originalGap) {
      const candidates = [originalGap, Math.min(originalGap, 10), Math.min(originalGap, 6), Math.min(originalGap, 2), 0];
      return candidates.filter((value, index, list) => list.findIndex((item) => Math.abs(item - value) < 0.1) === index);
    }

    function scheduleInspect() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(inspect);
      });
    }

    function applyTemporaryScale(scale) {
      const next = clamp(scale, 0.2, 2.2);
      cards().forEach((card) => {
        card.dataset.pfObjectScale = String(next);
        card.style.transformOrigin = "0 0";
        card.style.scale = String(next);
      });
      window.dispatchEvent(new CustomEvent("pf-overview-connector-geometry-request"));
    }

    function setGap(root, value) {
      const input = root?.querySelector("[data-arrange-gap]");
      if (!input) return false;
      const next = clamp(value, 0, 120);
      input.value = String(next);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }

    function persistScale(scale) {
      const group = currentGroup();
      const styles = readJson(GROUP_STYLE_KEY, {});
      const current = styles[group] && typeof styles[group] === "object" ? styles[group] : {};
      const percent = Math.round(clamp(scale, 0.2, 2.2) * 100);
      styles[group] = { ...current, scale: percent };
      writeJson(GROUP_STYLE_KEY, styles);
      document.querySelectorAll("[data-quick-scale-range],[data-quick-scale-number]").forEach((input) => {
        input.value = String(percent);
      });
    }

    function stopScanning() {
      document.body.classList.remove(scanClass);
    }

    function restoreOriginal() {
      if (!session || session.committed) return;
      applyTemporaryScale(session.originalScale);
      const root = overlay();
      if (root) setGap(root, session.originalGap);
    }

    function closeForRetry() {
      const root = overlay();
      if (!root) return false;
      internalReopen = true;
      root.querySelector("[data-arrange-close]")?.click();
      return true;
    }

    function reopen() {
      window.dispatchEvent(new CustomEvent("pf-overview-arrange-preview-request"));
    }

    function markAutoFit(root) {
      if (!session || !root) return;
      stopScanning();
      const percent = Math.round(session.testScale * 100);
      const gap = session.testGap;
      root.dataset.autoFitScale = String(percent);
      root.dataset.autoFitGap = String(gap);
      const footer = root.querySelector("footer>span");
      const adjustments = [];
      if (percent !== Math.round(session.originalScale * 100)) adjustments.push(`Auto-fit ${percent}%`);
      if (Math.abs(gap - session.originalGap) > 0.1) adjustments.push(`${gap}px gap`);
      if (footer && adjustments.length && !footer.textContent.includes("Auto-fit")) {
        footer.textContent = `${footer.textContent} · ${adjustments.join(" · ")}`;
      }
      const health = root.querySelector(".pf-arrange-health");
      if (health) {
        const badge = health.querySelector(".pf-arrange-health-badge");
        const suggestion = health.querySelector("[data-health-suggestion]");
        if (badge) badge.textContent = "AUTO FIT";
        if (suggestion) suggestion.innerHTML = `PlotFlow found a zero-conflict layout at <b>${percent}% card scale</b> with <b>${gap}px gap</b>. Apply it, then fine-tune manually if needed.`;
      }
    }

    function markExhausted(root) {
      stopScanning();
      if (!root || !session) return;
      const health = root.querySelector(".pf-arrange-health");
      const suggestion = health?.querySelector("[data-health-suggestion]");
      if (suggestion) suggestion.textContent = "Auto-fit checked the safe card-scale and spacing range but this geometry still has no zero-conflict layout.";
    }

    function advanceGap(root) {
      if (!session || session.gapIndex + 1 >= session.gaps.length) return false;
      session.gapIndex += 1;
      session.testGap = session.gaps[session.gapIndex];
      if (!setGap(root, session.testGap)) return false;
      scheduleInspect();
      return true;
    }

    function advanceScale() {
      if (!session || session.scaleIndex + 1 >= session.scales.length) return false;
      session.scaleIndex += 1;
      session.testScale = session.scales[session.scaleIndex];
      session.gapIndex = 0;
      session.testGap = session.gaps[0];
      applyTemporaryScale(session.testScale);
      if (!closeForRetry()) return false;
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => reopen());
      });
      return true;
    }

    function inspect() {
      const root = overlay();
      if (!root || !session) return;
      const modeButtons = Array.from(root.querySelectorAll("[data-arrange-mode]"));
      const feasible = modeButtons.filter((button) => !button.disabled);
      if (feasible.length) {
        markAutoFit(root);
        return;
      }
      if (advanceGap(root)) return;
      if (advanceScale()) return;
      markExhausted(root);
    }

    function startSession() {
      const root = overlay();
      const originalScale = currentScale();
      const originalGap = currentGap(root);
      const scales = [];
      SCALE_STEPS.forEach((factor) => {
        const next = clamp(originalScale * factor, 0.2, originalScale);
        if (!scales.some((value) => Math.abs(value - next) < 0.005)) scales.push(next);
      });
      if (!scales.some((value) => Math.abs(value - 0.2) < 0.005)) scales.push(0.2);
      const gaps = gapSteps(originalGap);
      session = {
        originalScale,
        originalGap,
        scales,
        gaps,
        scaleIndex: 0,
        gapIndex: 0,
        testScale: scales[0],
        testGap: gaps[0],
        committed: false,
      };
      document.body.classList.add(scanClass);
    }

    function onArrangeRequest() {
      if (internalReopen) {
        internalReopen = false;
        const root = overlay();
        if (root && session) setGap(root, session.testGap);
      } else {
        restoreOriginal();
        stopScanning();
        startSession();
      }
      scheduleInspect();
    }

    function onClick(event) {
      const root = overlay();
      if (!root || !session) return;
      if (event.target.closest?.("[data-arrange-apply]")) {
        persistScale(session.testScale);
        session.committed = true;
        stopScanning();
        window.setTimeout(() => { session = null; }, 0);
        return;
      }
      if (internalReopen) return;
      if (event.target.closest?.("[data-arrange-close],[data-arrange-cancel]") || event.target === root) {
        restoreOriginal();
        stopScanning();
        session = null;
      }
    }

    function onKeyDown(event) {
      if (event.key !== "Escape" || !overlay() || !session) return;
      restoreOriginal();
      stopScanning();
      session = null;
    }

    function onGroupChanged() {
      if (session) restoreOriginal();
      stopScanning();
      session = null;
      internalReopen = false;
    }

    window.addEventListener("pf-overview-arrange-preview-request", onArrangeRequest);
    document.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pf-overview-group-changed", onGroupChanged);

    return () => {
      cancelAnimationFrame(raf);
      restoreOriginal();
      stopScanning();
      style.remove();
      window.removeEventListener("pf-overview-arrange-preview-request", onArrangeRequest);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pf-overview-group-changed", onGroupChanged);
    };
  }, []);

  return null;
}
