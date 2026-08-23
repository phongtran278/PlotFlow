import { useEffect } from "react";
import { logoCatalog } from "../data/assetCatalog.js";
import "./OverviewAnnotationsRuntime.css";

const PLAQUE_KEY = "plotflow-overview-map-plaque-v4";
const BADGE_KEY = "plotflow-overview-unit-badges-v1";

const DEFAULT_PLAQUE = {
  logoId: "LOGO_WHITE",
  title: "MẶT BẰNG PHÂN KHU A",
  subtitle: "Dòng sản phẩm xây sẵn",
  colorA: "#0f7a64",
  colorB: "#073f39",
  left: 0,
  top: 0,
  width: 100,
  height: 13,
  titleSize: 18,
  subtitleSize: 10,
  logoSize: 92,
  gap: 18,
  font: "sans",
  contentAlign: "center",
  textAlign: "left",
};

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value && typeof value === "object" ? value : fallback;
  } catch { return fallback; }
}
function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function codeFor(card) { return card?.dataset?.unitCode || card?.querySelector(".pf-sell-card-code")?.textContent?.trim() || ""; }
function clamp(value, min, max, fallback) {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
}

export default function OverviewAnnotationsRuntime() {
  useEffect(() => {
    let stage = null;
    let annotationLayer = null;
    let plaque = null;
    let editor = null;
    let disposed = false;
    let frame = 0;
    let attempts = 0;
    let camera = { scale: 1, tx: 0, ty: 0 };
    let pdfBounds = null;
    let plaqueData = { ...DEFAULT_PLAQUE, ...readJson(PLAQUE_KEY, {}) };
    let badges = { ...readJson(BADGE_KEY, {}) };

    function selectedLogo() {
      return logoCatalog.find((item) => item.id === plaqueData.logoId) || logoCatalog.find((item) => item.id === DEFAULT_PLAQUE.logoId) || logoCatalog[0] || null;
    }

    function stagePdfBounds() {
      if (!stage) return null;
      const x = Number(stage.dataset.pfPdfX);
      const y = Number(stage.dataset.pfPdfY);
      const width = Number(stage.dataset.pfPdfWidth);
      const height = Number(stage.dataset.pfPdfHeight);
      if ([x, y, width, height].every(Number.isFinite) && width > 0 && height > 0) return { x, y, width, height };
      return null;
    }

    function applyCamera() {
      if (!annotationLayer) return;
      annotationLayer.style.transformOrigin = "0 0";
      annotationLayer.style.transform = `translate3d(${camera.tx}px,${camera.ty}px,0) scale(${camera.scale})`;
    }

    function renderPlaque() {
      if (!plaque) return;
      const bounds = pdfBounds || stagePdfBounds();
      if (!bounds) {
        plaque.hidden = true;
        return;
      }
      plaque.hidden = false;
      const leftPct = clamp(plaqueData.left, 0, 95, DEFAULT_PLAQUE.left) / 100;
      const topPct = clamp(plaqueData.top, 0, 90, DEFAULT_PLAQUE.top) / 100;
      const widthPct = clamp(plaqueData.width, 20, 100, DEFAULT_PLAQUE.width) / 100;
      const heightPct = clamp(plaqueData.height, 7, 36, DEFAULT_PLAQUE.height) / 100;
      plaque.style.setProperty("--pf-plaque-a", plaqueData.colorA || DEFAULT_PLAQUE.colorA);
      plaque.style.setProperty("--pf-plaque-b", plaqueData.colorB || DEFAULT_PLAQUE.colorB);
      plaque.style.setProperty("--pf-plaque-title-size", `${clamp(plaqueData.titleSize, 10, 48, DEFAULT_PLAQUE.titleSize)}px`);
      plaque.style.setProperty("--pf-plaque-subtitle-size", `${clamp(plaqueData.subtitleSize, 7, 26, DEFAULT_PLAQUE.subtitleSize)}px`);
      plaque.style.setProperty("--pf-plaque-logo-size", `${clamp(plaqueData.logoSize, 36, 180, DEFAULT_PLAQUE.logoSize)}px`);
      plaque.style.setProperty("--pf-plaque-gap", `${clamp(plaqueData.gap, 0, 64, DEFAULT_PLAQUE.gap)}px`);
      plaque.style.left = `${bounds.x + bounds.width * leftPct}px`;
      plaque.style.top = `${bounds.y + bounds.height * topPct}px`;
      plaque.style.width = `${Math.min(bounds.width - bounds.width * leftPct, bounds.width * widthPct)}px`;
      plaque.style.height = `${bounds.height * heightPct}px`;
      plaque.dataset.font = plaqueData.font || "sans";
      plaque.dataset.contentAlign = plaqueData.contentAlign || "center";
      plaque.dataset.textAlign = plaqueData.textAlign || "left";
      const logo = selectedLogo();
      plaque.innerHTML = `<span class="pf-map-plaque-logo">${logo ? `<img src="${logo.src}" alt="${logo.name}">` : "PROJECT"}</span><div class="pf-map-plaque-copy"><strong>${plaqueData.title || "MAP TITLE"}</strong><small>${plaqueData.subtitle || "Project information"}</small></div>`;
    }

    function applyBadges() {
      if (!stage) return;
      stage.querySelectorAll(".pf-live-sales-callout").forEach((card) => {
        const code = codeFor(card);
        let badge = card.querySelector(".pf-unit-card-badge");
        const label = String(badges[code] || "").trim();
        if (!label) { badge?.remove(); return; }
        if (!badge) { badge = document.createElement("span"); badge.className = "pf-unit-card-badge"; card.appendChild(badge); }
        badge.textContent = label;
        badge.title = `${code} · ${label}`;
      });
    }

    function closeEditor() { editor?.remove(); editor = null; plaque?.classList.remove("is-editing"); }

    function openEditor() {
      if (!stage || !plaque || editor?.isConnected) return;
      plaque.classList.add("is-editing");
      editor = document.createElement("div");
      editor.className = "pf-map-plaque-editor";
      const logoOptions = logoCatalog.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
      editor.innerHTML = `
        <header><strong>Map banner</strong><small>Frame coordinates are relative to the PDF page</small></header>
        <label><span>Logo</span><select data-plaque="logoId">${logoOptions}</select></label>
        <label><span>Title</span><input data-plaque="title" type="text"></label>
        <label><span>Subtitle</span><input data-plaque="subtitle" type="text"></label>
        <label><span>Font</span><select data-plaque="font"><option value="sans">IBM Plex Sans</option><option value="serif">IBM Plex Serif</option></select></label>
        <div class="pf-map-plaque-grid">
          <label><span>X</span><input data-plaque="left" type="number" min="0" max="95" step="1"></label>
          <label><span>Y</span><input data-plaque="top" type="number" min="0" max="90" step="1"></label>
          <label><span>W</span><input data-plaque="width" type="number" min="20" max="100" step="1"></label>
          <label><span>H</span><input data-plaque="height" type="number" min="7" max="36" step="1"></label>
          <label><span>Logo px</span><input data-plaque="logoSize" type="number" min="36" max="180" step="1"></label>
          <label><span>Gap px</span><input data-plaque="gap" type="number" min="0" max="64" step="1"></label>
          <label><span>Title px</span><input data-plaque="titleSize" type="number" min="10" max="48" step="1"></label>
          <label><span>Sub px</span><input data-plaque="subtitleSize" type="number" min="7" max="26" step="1"></label>
        </div>
        <div class="pf-map-plaque-align-row">
          <span>Vertical align</span>
          <button type="button" data-plaque-align="start">Top</button>
          <button type="button" data-plaque-align="center">Center</button>
          <button type="button" data-plaque-align="end">Bottom</button>
        </div>
        <label><span>Text align</span><select data-plaque="textAlign"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
        <div class="pf-map-plaque-colors"><label><span>Gradient A</span><input data-plaque="colorA" type="color"></label><label><span>Gradient B</span><input data-plaque="colorB" type="color"></label></div>
        <footer><button type="button" data-plaque-reset>Reset</button><button type="button" data-plaque-close>Done</button></footer>`;
      const keys = ["logoId", "title", "subtitle", "font", "left", "top", "width", "height", "logoSize", "gap", "titleSize", "subtitleSize", "textAlign", "colorA", "colorB"];
      keys.forEach((key) => {
        const input = editor.querySelector(`[data-plaque="${key}"]`);
        input.value = plaqueData[key] ?? DEFAULT_PLAQUE[key] ?? "";
        const sync = () => {
          const numeric = ["left", "top", "width", "height", "logoSize", "gap", "titleSize", "subtitleSize"].includes(key);
          plaqueData = { ...plaqueData, [key]: numeric ? Number(input.value) : input.value };
          saveJson(PLAQUE_KEY, plaqueData);
          renderPlaque();
        };
        input.addEventListener("input", sync);
        input.addEventListener("change", sync);
      });
      editor.querySelectorAll("[data-plaque-align]").forEach((button) => {
        button.classList.toggle("active", button.dataset.plaqueAlign === plaqueData.contentAlign);
        button.addEventListener("click", () => {
          plaqueData = { ...plaqueData, contentAlign: button.dataset.plaqueAlign };
          saveJson(PLAQUE_KEY, plaqueData);
          editor.querySelectorAll("[data-plaque-align]").forEach((item) => item.classList.toggle("active", item === button));
          renderPlaque();
        });
      });
      editor.querySelector("[data-plaque-reset]").addEventListener("click", () => {
        plaqueData = { ...DEFAULT_PLAQUE };
        saveJson(PLAQUE_KEY, plaqueData);
        renderPlaque(); closeEditor(); openEditor();
      });
      editor.querySelector("[data-plaque-close]").addEventListener("click", closeEditor);
      stage.appendChild(editor);
      editor.querySelector("input,select")?.focus();
    }

    function ensureAnnotationLayer() {
      if (!stage) return null;
      if (!annotationLayer?.isConnected) {
        annotationLayer = document.createElement("div");
        annotationLayer.className = "pf-overview-pdf-annotation-layer";
        stage.appendChild(annotationLayer);
        applyCamera();
      }
      return annotationLayer;
    }

    function install() {
      if (disposed) return true;
      const nextStage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (!nextStage) return false;
      stage = nextStage;
      pdfBounds = stagePdfBounds() || pdfBounds;
      const layer = ensureAnnotationLayer();
      if (!plaque?.isConnected) {
        plaque = document.createElement("button");
        plaque.type = "button";
        plaque.className = "pf-overview-map-plaque";
        plaque.title = "Double-click to edit map banner";
        plaque.addEventListener("dblclick", (event) => { event.preventDefault(); event.stopPropagation(); openEditor(); });
        layer.appendChild(plaque);
      }
      renderPlaque();
      applyBadges();
      return true;
    }

    function scheduleInstall() {
      cancelAnimationFrame(frame); attempts = 0;
      const run = () => { if (disposed || install()) return; attempts += 1; if (attempts < 30) frame = requestAnimationFrame(run); };
      frame = requestAnimationFrame(run);
    }

    function onBadgeSet(event) {
      const code = String(event.detail?.code || "").trim(); if (!code) return;
      const label = String(event.detail?.label || "").trim();
      if (label) badges[code] = label; else delete badges[code];
      saveJson(BADGE_KEY, badges); applyBadges(); window.dispatchEvent(new CustomEvent("pf-overview-annotations-changed"));
    }
    function onCamera(event) {
      const detail = event.detail || {};
      if (Number.isFinite(detail.scale)) camera.scale = detail.scale;
      if (Number.isFinite(detail.tx)) camera.tx = detail.tx;
      if (Number.isFinite(detail.ty)) camera.ty = detail.ty;
      applyCamera();
    }
    function onPdfBounds(event) {
      const next = event.detail || {};
      if (![next.x, next.y, next.width, next.height].every(Number.isFinite)) return;
      pdfBounds = next;
      renderPlaque();
    }
    function onEditPlaque() { if (install()) openEditor(); }
    function onOutside(event) { if (editor?.isConnected && !editor.contains(event.target) && !plaque?.contains(event.target)) closeEditor(); }
    function onKey(event) { if (event.key === "Escape") closeEditor(); }

    window.addEventListener("pf-overview-live-units-ready", scheduleInstall);
    window.addEventListener("pf-overview-unit-badge-set", onBadgeSet);
    window.addEventListener("pf-overview-edit-map-label", onEditPlaque);
    window.addEventListener("pf-overview-camera", onCamera);
    window.addEventListener("pf-overview-pdf-bounds", onPdfBounds);
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("keydown", onKey, true);
    scheduleInstall();

    return () => {
      disposed = true; cancelAnimationFrame(frame);
      window.removeEventListener("pf-overview-live-units-ready", scheduleInstall);
      window.removeEventListener("pf-overview-unit-badge-set", onBadgeSet);
      window.removeEventListener("pf-overview-edit-map-label", onEditPlaque);
      window.removeEventListener("pf-overview-camera", onCamera);
      window.removeEventListener("pf-overview-pdf-bounds", onPdfBounds);
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onKey, true);
      closeEditor(); annotationLayer?.remove(); stage?.querySelectorAll(".pf-unit-card-badge").forEach((node) => node.remove());
    };
  }, []);

  return null;
}
