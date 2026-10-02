import { useEffect } from "react";
import "./OverviewUnitBadgeRuntime.css";

const BADGE_KEY = "plotflow-overview-unit-badges-v1";

function readBadges() {
  try {
    const value = JSON.parse(localStorage.getItem(BADGE_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function saveBadges(value) {
  localStorage.setItem(BADGE_KEY, JSON.stringify(value));
}

function codeFor(card) {
  return card?.dataset?.unitCode || card?.querySelector(".pf-sell-card-code")?.textContent?.trim() || "";
}

export default function OverviewUnitBadgeRuntime() {
  useEffect(() => {
    let stage = null;
    let disposed = false;
    let frame = 0;
    let attempts = 0;
    let badges = readBadges();

    function applyBadges() {
      if (!stage) return;
      stage.querySelectorAll(".pf-live-sales-callout").forEach((card) => {
        const code = codeFor(card);
        const label = String(badges[code] || "").trim();
        let badge = card.querySelector(".pf-unit-card-badge");
        if (!label) {
          badge?.remove();
          return;
        }
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "pf-unit-card-badge";
          card.appendChild(badge);
        }
        badge.textContent = label;
        badge.title = `${code} · ${label}`;
      });
    }

    function install() {
      if (disposed) return true;
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (!nextStage) return false;
      stage = nextStage;
      applyBadges();
      return true;
    }

    function scheduleInstall() {
      cancelAnimationFrame(frame);
      attempts = 0;
      const run = () => {
        if (disposed || install()) return;
        attempts += 1;
        if (attempts < 30) frame = requestAnimationFrame(run);
      };
      frame = requestAnimationFrame(run);
    }

    function onBadgeSet(event) {
      const code = String(event.detail?.code || "").trim();
      if (!code) return;
      const label = String(event.detail?.label || "").trim();
      if (label) badges[code] = label;
      else delete badges[code];
      saveBadges(badges);
      applyBadges();
      window.dispatchEvent(new CustomEvent("pf-overview-annotations-changed"));
    }

    window.addEventListener("pf-overview-live-units-ready", scheduleInstall);
    window.addEventListener("pf-overview-unit-badge-set", onBadgeSet);
    scheduleInstall();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("pf-overview-live-units-ready", scheduleInstall);
      window.removeEventListener("pf-overview-unit-badge-set", onBadgeSet);
      stage?.querySelectorAll(".pf-unit-card-badge").forEach((node) => node.remove());
    };
  }, []);

  return null;
}
