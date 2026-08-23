import { useEffect } from "react";
import "./OverviewAnnotationsRuntime.css";

const PLAQUE_KEY = "plotflow-overview-map-plaque-v1";
const BADGE_KEY = "plotflow-overview-unit-badges-v1";

const DEFAULT_PLAQUE = {
  logo: "VINHOMES",
  title: "MẶT BẰNG PHÂN KHU A",
  subtitle: "Loại hình nhà ở xây sẵn",
};

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value && typeof value === "object" ? value : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function codeFor(card) {
  return card?.dataset?.unitCode || card?.querySelector(".pf-sell-card-code")?.textContent?.trim() || "";
}

export default function OverviewAnnotationsRuntime() {
  useEffect(() => {
    let stage = null;
    let plaque = null;
    let editor = null;
    let disposed = false;
    let frame = 0;
    let attempts = 0;
    let plaqueData = { ...DEFAULT_PLAQUE, ...readJson(PLAQUE_KEY, {}) };
    let badges = { ...readJson(BADGE_KEY, {}) };

    function renderPlaque() {
      if (!plaque) return;
      plaque.innerHTML = `<span>${plaqueData.logo || "PROJECT"}</span><strong>${plaqueData.title || "MAP TITLE"}</strong><small>${plaqueData.subtitle || "Project information"}</small>`;
    }

    function applyBadges() {
      if (!stage) return;
      stage.querySelectorAll(".pf-live-sales-callout").forEach((card) => {
        const code = codeFor(card);
        let badge = card.querySelector(".pf-unit-badge-tab");
        const label = String(badges[code] || "").trim();
        if (!label) {
          badge?.remove();
          return;
        }
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "pf-unit-badge-tab";
          card.appendChild(badge);
        }
        badge.textContent = label;
      });
    }

    function closeEditor() {
      editor?.remove();
      editor = null;
      plaque?.classList.remove("is-editing");
    }

    function openEditor() {
      if (!stage || !plaque || editor?.isConnected) return;
      plaque.classList.add("is-editing");
      editor = document.createElement("div");
      editor.className = "pf-map-plaque-editor";
      editor.innerHTML = `
        <label><span>Logo text</span><input data-plaque="logo" type="text"></label>
        <label><span>Title</span><input data-plaque="title" type="text"></label>
        <label><span>Subtitle</span><input data-plaque="subtitle" type="text"></label>
        <button type="button" data-plaque-close>Done</button>`;
      ["logo", "title", "subtitle"].forEach((key) => {
        const input = editor.querySelector(`[data-plaque="${key}"]`);
        input.value = plaqueData[key] || "";
        input.addEventListener("input", () => {
          plaqueData = { ...plaqueData, [key]: input.value };
          saveJson(PLAQUE_KEY, plaqueData);
          renderPlaque();
        });
      });
      editor.querySelector("[data-plaque-close]").addEventListener("click", closeEditor);
      stage.appendChild(editor);
      editor.querySelector("input")?.focus();
    }

    function install() {
      if (disposed) return true;
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (!nextStage) return false;
      stage = nextStage;
      if (!plaque?.isConnected) {
        plaque = document.createElement("button");
        plaque.type = "button";
        plaque.className = "pf-overview-map-plaque";
        plaque.title = "Double-click to edit map label";
        plaque.addEventListener("dblclick", (event) => {
          event.preventDefault();
          event.stopPropagation();
          openEditor();
        });
        stage.appendChild(plaque);
        renderPlaque();
      }
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
      saveJson(BADGE_KEY, badges);
      applyBadges();
      window.dispatchEvent(new CustomEvent("pf-overview-annotations-changed"));
    }

    function onEditPlaque() {
      if (!install()) return;
      openEditor();
    }

    function onOutside(event) {
      if (!editor?.isConnected) return;
      if (editor.contains(event.target) || plaque?.contains(event.target)) return;
      closeEditor();
    }

    function onKey(event) {
      if (event.key === "Escape") closeEditor();
    }

    window.addEventListener("pf-overview-live-units-ready", scheduleInstall);
    window.addEventListener("pf-overview-unit-badge-set", onBadgeSet);
    window.addEventListener("pf-overview-edit-map-label", onEditPlaque);
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("keydown", onKey, true);
    scheduleInstall();

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("pf-overview-live-units-ready", scheduleInstall);
      window.removeEventListener("pf-overview-unit-badge-set", onBadgeSet);
      window.removeEventListener("pf-overview-edit-map-label", onEditPlaque);
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onKey, true);
      closeEditor();
      plaque?.remove();
    };
  }, []);

  return null;
}
