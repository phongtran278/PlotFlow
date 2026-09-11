import { useEffect } from "react";

const MODE_LABELS = {
  smart: "Smart L/R",
  balanced: "Balanced",
  compact: "Compact",
  left: "All left",
  right: "All right",
};

function numberFrom(text, pattern) {
  const match = String(text || "").match(pattern);
  return match ? Number(match[1]) : null;
}

export default function OverviewArrangeHealthRuntime() {
  useEffect(() => {
    let raf = 0;
    let autoAdjusting = false;

    function scheduleSync() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sync);
    }

    function setGap(input, value) {
      if (!input) return;
      const next = Math.max(0, Math.round(value));
      if (Number(input.value) === next) return;
      autoAdjusting = true;
      input.value = String(next);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      requestAnimationFrame(() => {
        autoAdjusting = false;
        scheduleSync();
      });
    }

    function ensureStyles() {
      if (document.getElementById("pf-arrange-health-style")) return;
      const style = document.createElement("style");
      style.id = "pf-arrange-health-style";
      style.textContent = `
        .pf-arrange-health{display:grid;gap:4px;padding:8px;border:1px solid var(--pf-line);border-radius:9px;background:#fbfcfd}
        .pf-arrange-health-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .pf-arrange-health-head strong{font-size:8.5px;color:var(--pf-ink)}
        .pf-arrange-health-badge{padding:3px 6px;border-radius:999px;background:#eaf8f0;color:#157347;font-size:7px;font-weight:800;letter-spacing:.04em}
        .pf-arrange-health[data-state="fitted"] .pf-arrange-health-badge{background:#eef6ff;color:#1268c4}
        .pf-arrange-health[data-state="blocked"] .pf-arrange-health-badge{background:#fff4df;color:#9a6700}
        .pf-arrange-health p{margin:0;font-size:7.5px;line-height:1.4;color:var(--pf-muted)}
        .pf-arrange-health p b{color:var(--pf-ink);font-weight:800}
      `;
      document.head.appendChild(style);
    }

    function sync() {
      const overlay = document.querySelector(".pf-arrange-preview-overlay");
      if (!overlay) return;
      ensureStyles();

      const modes = overlay.querySelector(".pf-arrange-preview-modes");
      const gapControl = overlay.querySelector(".pf-arrange-gap-control");
      const gapInput = overlay.querySelector("[data-arrange-gap]");
      const footerText = overlay.querySelector("footer>span")?.textContent || "";
      if (!modes || !gapControl || !gapInput) return;

      let health = modes.querySelector(".pf-arrange-health");
      if (!health) {
        health = document.createElement("div");
        health.className = "pf-arrange-health";
        health.innerHTML = `
          <div class="pf-arrange-health-head"><strong>Auto solution</strong><span class="pf-arrange-health-badge"></span></div>
          <p data-health-reason></p>`;
        gapControl.after(health);
      }

      const buttons = Array.from(modes.querySelectorAll("[data-arrange-mode]"));
      const feasible = buttons.filter((button) => !button.disabled);
      const active = buttons.find((button) => button.classList.contains("active"));
      const requestedGap = Number(gapInput.value) || 0;
      const fittedGap = numberFrom(footerText, /([0-9.]+)px gap fits/);
      const lanes = numberFrom(footerText, /·\s*([0-9]+) lanes/);
      const badge = health.querySelector(".pf-arrange-health-badge");
      const reason = health.querySelector("[data-health-reason]");

      // Auto Arrange should solve first, not ask the user to diagnose spacing.
      // If the solver already found a smaller safe gap, adopt it automatically.
      if (!autoAdjusting && feasible.length && Number.isFinite(fittedGap) && fittedGap + 0.5 < requestedGap) {
        setGap(gapInput, fittedGap);
        return;
      }

      // If the current requested gap leaves every mode unavailable, retry once at 0.
      // The core solver still keeps zero-overlap / zero-connector-conflict guarantees.
      if (!autoAdjusting && !feasible.length && requestedGap > 0) {
        setGap(gapInput, 0);
        return;
      }

      if (!feasible.length) {
        health.dataset.state = "blocked";
        badge.textContent = "NO SAFE FIT";
        reason.innerHTML = `<b>Auto Arrange exhausted its safe layouts.</b> It will not apply an overlapping or crossing result. You can still refine the preview manually.`;
        return;
      }

      const activeName = active ? MODE_LABELS[active.dataset.arrangeMode] || active.dataset.arrangeMode : MODE_LABELS[feasible[0]?.dataset.arrangeMode] || "Auto";
      const wasFitted = footerText.includes("conflict-safe fallback") || (lanes && lanes > 2);
      health.dataset.state = wasFitted ? "fitted" : "ready";
      badge.textContent = wasFitted ? "AUTO FITTED" : "SOLUTION READY";
      reason.innerHTML = wasFitted
        ? `<b>${activeName}</b> has been adjusted automatically${lanes && lanes > 2 ? ` into ${lanes} lanes` : ""} while keeping zero overlap and zero connector conflicts.`
        : `<b>${activeName}</b> is ready. Auto Arrange has already chosen a conflict-safe solution.`;
    }

    function onClick() { scheduleSync(); }
    function onInput(event) {
      if (event.target?.matches?.("[data-arrange-gap]")) scheduleSync();
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
    window.addEventListener("pf-overview-auto-arranged", scheduleSync);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onInput, true);
      window.removeEventListener("pf-overview-auto-arranged", scheduleSync);
      document.getElementById("pf-arrange-health-style")?.remove();
    };
  }, []);

  return null;
}
