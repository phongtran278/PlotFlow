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

    function scheduleSync() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sync);
    }

    function setGap(input, value) {
      if (!input) return;
      input.value = String(Math.max(0, Math.round(value)));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      scheduleSync();
    }

    function ensureStyles() {
      if (document.getElementById("pf-arrange-health-style")) return;
      const style = document.createElement("style");
      style.id = "pf-arrange-health-style";
      style.textContent = `
        .pf-arrange-health{display:grid;gap:5px;padding:8px;border:1px solid var(--pf-line);border-radius:9px;background:#fbfcfd}
        .pf-arrange-health-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
        .pf-arrange-health-head strong{font-size:8.5px;color:var(--pf-ink)}
        .pf-arrange-health-badge{padding:3px 6px;border-radius:999px;font-size:7px;font-weight:800;letter-spacing:.04em}
        .pf-arrange-health[data-state="ready"] .pf-arrange-health-badge{background:#eaf8f0;color:#157347}
        .pf-arrange-health[data-state="tight"] .pf-arrange-health-badge{background:#fff4df;color:#9a6700}
        .pf-arrange-health[data-state="blocked"] .pf-arrange-health-badge{background:#fff0ee;color:#b42318}
        .pf-arrange-health p{margin:0;font-size:7.5px;line-height:1.35;color:var(--pf-muted)}
        .pf-arrange-health p b{color:var(--pf-ink);font-weight:800}
        .pf-arrange-health button{min-height:28px!important;justify-content:center!important;margin-top:1px;background:#fff!important;font-size:7.5px!important;font-weight:800!important}
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
          <div class="pf-arrange-health-head"><strong>Layout health</strong><span class="pf-arrange-health-badge"></span></div>
          <p data-health-reason></p>
          <p data-health-suggestion></p>
          <button type="button" data-health-fix hidden></button>`;
        gapControl.after(health);
        health.querySelector("[data-health-fix]")?.addEventListener("click", () => {
          const value = Number(health.dataset.fixGap);
          if (Number.isFinite(value)) setGap(gapInput, value);
        });
      }

      const buttons = Array.from(modes.querySelectorAll("[data-arrange-mode]"));
      const feasible = buttons.filter((button) => !button.disabled);
      const active = buttons.find((button) => button.classList.contains("active"));
      const requestedGap = Number(gapInput.value) || 0;
      const fittedGap = numberFrom(footerText, /([0-9.]+)px gap fits/);
      const lanes = numberFrom(footerText, /·\s*([0-9]+) lanes/);
      const fallback = footerText.includes("conflict-safe fallback");
      const fix = health.querySelector("[data-health-fix]");
      const badge = health.querySelector(".pf-arrange-health-badge");
      const reason = health.querySelector("[data-health-reason]");
      const suggestion = health.querySelector("[data-health-suggestion]");

      if (!feasible.length) {
        health.dataset.state = "blocked";
        badge.textContent = "NOT FEASIBLE";
        reason.innerHTML = `<b>${buttons.length ? "No layout mode can satisfy the current geometry." : "Layout cannot be evaluated."}</b> Zero-overlap and zero-connector-conflict rules are being protected.`;
        suggestion.innerHTML = requestedGap > 0
          ? `Try <b>Gap 0 px</b> first. If it is still unavailable, reduce card scale/width before retrying.`
          : `Gap is already <b>0 px</b>. Reduce card scale/width, then reopen Auto Arrange.`;
        if (fix) {
          fix.hidden = requestedGap <= 0;
          fix.textContent = "Set gap to 0 px";
          health.dataset.fixGap = "0";
        }
        return;
      }

      const availableNames = feasible.map((button) => MODE_LABELS[button.dataset.arrangeMode] || button.dataset.arrangeMode).join(", ");
      const isTight = (Number.isFinite(fittedGap) && fittedGap + 0.05 < requestedGap) || (lanes && lanes > 2) || fallback;
      if (isTight) {
        health.dataset.state = "tight";
        badge.textContent = "TIGHT";
        reason.innerHTML = Number.isFinite(fittedGap) && fittedGap + 0.05 < requestedGap
          ? `Requested <b>${requestedGap}px</b>; the safe solution fits about <b>${fittedGap}px</b>.`
          : `A conflict-safe layout exists, but it needs ${lanes && lanes > 2 ? `<b>${lanes} lanes</b>` : "a fallback arrangement"}.`;
        suggestion.innerHTML = `Available now: <b>${availableNames}</b>.${Number.isFinite(fittedGap) && fittedGap + 0.05 < requestedGap ? " Use the fitted gap for a more predictable result." : ""}`;
        if (fix) {
          const safeGap = Number.isFinite(fittedGap) ? fittedGap : requestedGap;
          fix.hidden = !Number.isFinite(fittedGap) || fittedGap + 0.05 >= requestedGap;
          fix.textContent = `Use ${Math.round(safeGap)} px safe gap`;
          health.dataset.fixGap = String(safeGap);
        }
        return;
      }

      health.dataset.state = "ready";
      badge.textContent = "READY";
      reason.innerHTML = `<b>${active ? MODE_LABELS[active.dataset.arrangeMode] || active.dataset.arrangeMode : "Current layout"}</b> is conflict-safe at ${requestedGap}px gap.`;
      suggestion.innerHTML = `Available modes: <b>${availableNames}</b>. Apply when the preview looks right.`;
      if (fix) fix.hidden = true;
    }

    function onClick() { scheduleSync(); }
    function onInput(event) {
      if (event.target?.matches?.("[data-arrange-gap]")) scheduleSync();
    }
    function onKeyDown(event) {
      if (event.key === "Escape") scheduleSync();
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pf-overview-auto-arranged", scheduleSync);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pf-overview-auto-arranged", scheduleSync);
      document.getElementById("pf-arrange-health-style")?.remove();
    };
  }, []);

  return null;
}
