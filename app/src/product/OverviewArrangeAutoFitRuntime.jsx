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

    function applyTemporaryScale(scale) {
      const next = clamp(scale, 0.2, 2.2);
      cards().forEach((card) => {
        card.dataset.pfObjectScale = String(next);
        card.style.transformOrigin = "0 0";
        card.style.scale = String(next);
      });
      window.dispatchEvent(new CustomEvent("pf-overview-connector-geometry-request"));
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

    function restoreOriginal() {
      if (!session || session.committed) return;
      applyTemporaryScale(session.originalScale);
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
      const percent = Math.round(session.testScale * 100);
      root.dataset.autoFitScale = String(percent);
      const footer = root.querySelector("footer>span");
      if (footer && percent !== Math.round(session.originalScale * 100) && !footer.textContent.includes("Auto-fit")) {
        footer.textContent = `${footer.textContent} · Auto-fit ${percent}%`;
      }
      const health = root.querySelector(".pf-arrange-health");
      if (health) {
        const badge = health.querySelector(".pf-arrange-health-badge");
        const suggestion = health.querySelector("[data-health-suggestion]");
        if (badge) badge.textContent = "AUTO FIT";
        if (suggestion) suggestion.innerHTML = `PlotFlow found a conflict-safe layout at <b>${percent}% card scale</b>. Apply it, then fine-tune manually if needed.`;
      }
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

      session.step += 1;
      if (session.step >= session.scales.length) {
        const health = root.querySelector(".pf-arrange-health");
        const suggestion = health?.querySelector("[data-health-suggestion]");
        if (suggestion) suggestion.textContent = "Auto-fit tried the safe scale range but this geometry still has no zero-conflict solution. Manual refinement is required.";
        return;
      }

      session.testScale = session.scales[session.step];
      applyTemporaryScale(session.testScale);
      if (!closeForRetry()) return;
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => reopen());
      });
    }

    function startSession() {
      const originalScale = currentScale();
      const scales = [];
      SCALE_STEPS.forEach((factor) => {
        const next = clamp(originalScale * factor, 0.2, originalScale);
        if (!scales.some((value) => Math.abs(value - next) < 0.005)) scales.push(next);
      });
      if (!scales.some((value) => Math.abs(value - 0.2) < 0.005)) scales.push(0.2);
      session = { originalScale, scales, step: 0, testScale: scales[0], committed: false };
    }

    function onArrangeRequest() {
      if (internalReopen) {
        internalReopen = false;
      } else {
        restoreOriginal();
        startSession();
      }
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(inspect);
      });
    }

    function onClick(event) {
      const root = overlay();
      if (!root || !session) return;
      if (event.target.closest?.("[data-arrange-apply]")) {
        persistScale(session.testScale);
        session.committed = true;
        window.setTimeout(() => { session = null; }, 0);
        return;
      }
      if (internalReopen) return;
      if (event.target.closest?.("[data-arrange-close],[data-arrange-cancel]") || event.target === root) {
        restoreOriginal();
        session = null;
      }
    }

    function onKeyDown(event) {
      if (event.key !== "Escape" || !overlay() || !session) return;
      restoreOriginal();
      session = null;
    }

    function onGroupChanged() {
      if (session) restoreOriginal();
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
      window.removeEventListener("pf-overview-arrange-preview-request", onArrangeRequest);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pf-overview-group-changed", onGroupChanged);
    };
  }, []);

  return null;
}
