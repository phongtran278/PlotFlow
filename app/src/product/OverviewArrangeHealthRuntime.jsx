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
        .pf-arrange-health p{margin:0;font-size:7.5px;line-height:1.4;color:var(--pf-muted)}
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
      const connectorConflicts = numberFrom(footerText, /·\s*([0-9]+) connector conflict/);
      const cardOverlaps = numberFrom(footerText, /·\s*([0-9]+) card overlap/);
      const modeViolations = numberFrom(footerText, /·\s*([0-9]+) mode-fit violation/);
      const fallback = footerText.includes("conflict-safe fallback");
      const fix = health.querySelector("[data-health-fix]");
      const badge = health.querySelector(".pf-arrange-health-badge");
      const reason = health.querySelector("[data-health-reason]");
      const suggestion = health.querySelector("[data-health-suggestion]");

      if (!feasible.length) {
        health.dataset.state = "blocked";
        badge.textContent = "BLOCKED";

        if ((connectorConflicts || 0) > 0 && (cardOverlaps || 0) === 0) {
          reason.innerHTML = `<b>Card size is not the blocker.</b> The current preview still has <b>${connectorConflicts} connector conflict${connectorConflicts === 1 ? "" : "s"}</b>.`;
          suggestion.innerHTML = `Keep the card size as-is. The problem is routing geometry, so changing card scale smaller is unlikely to help. Try another side/balance mode or refine the preview positions.`;
          if (fix) fix.hidden = true;
          return;
        }

        if ((cardOverlaps || 0) > 0) {
          reason.innerHTML = `<b>${cardOverlaps} card overlap${cardOverlaps === 1 ? "" : "s"}</b> remain in the best preview${(connectorConflicts || 0) > 0 ? `, plus ${connectorConflicts} connector conflict${connectorConflicts === 1 ? "" : "s"}` : ""}.`;
          suggestion.innerHTML = requestedGap > 0
            ? `First try <b>Gap 0 px</b>. Only consider reducing card scale if overlap still remains at 0 px.`
            : `Gap is already <b>0 px</b>. This is a real packing constraint, not a generic “make cards smaller” warning.`;
        } else if ((modeViolations || 0) > 0) {
          reason.innerHTML = `<b>The selected side rule is the blocker.</b> ${modeViolations} card${modeViolations === 1 ? "" : "s"} cannot fit that mode without crossing the center boundary.`;
          suggestion.innerHTML = `Use <b>Smart L/R</b>, <b>Balanced</b>, or <b>Compact</b> instead of forcing every card to one side.`;
        } else {
          reason.innerHTML = `<b>No conflict-safe solution was found for this geometry.</b>`;
          suggestion.innerHTML = requestedGap > 0
            ? `Try <b>Gap 0 px</b> once. If it is still blocked, the issue is geometry/routing rather than simply card size.`
            : `Gap is already <b>0 px</b>. Keep card size unchanged and adjust the distribution/preview instead.`;
        }

        if (fix) {
          fix.hidden = requestedGap <= 0 || (cardOverlaps || 0) === 0;
          fix.textContent = "Try gap 0 px";
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
          ? `Requested <b>${requestedGap}px</b>; the conflict-safe solution fits about <b>${fittedGap}px</b>.`
          : `A conflict-safe layout exists, but it needs ${lanes && lanes > 2 ? `<b>${lanes} lanes</b>` : "an alternate safe arrangement"}.`;
        suggestion.innerHTML = `Available now: <b>${availableNames}</b>. Card size does not need to change unless the preview actually reports card overlap.`;
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
