import { useEffect } from "react";
import "./DetailModeRecovery.css";

const CAMPAIGN_KEY = "plotflow-campaign-badges-by-unit-v2";

function findButton(root, matcher) {
  return Array.from(root?.querySelectorAll?.("button") || []).find((button) => matcher.test(String(button.textContent || "").trim()));
}

function normalizeCode(value = "") {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[Đđ]/g, "D").toUpperCase().replace(/\s+/g, "").trim();
}

function activeUnitCode() {
  const campaign = String(document.querySelector(".campaign-control-heading > div > span")?.textContent || "");
  const fromCampaign = campaign.split("·").at(-1)?.trim();
  return normalizeCode(fromCampaign || document.querySelector(".unit-select.active .unit-main strong")?.textContent || "");
}

function readCampaign(code) {
  try {
    const all = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) || "{}");
    return all?.[code] || null;
  } catch {
    return null;
  }
}

const FALLBACK_LABELS = {
  hotdeal: { label: "HOT DEAL", tone: "hot" },
  veosom: { label: "VỀ Ở SỚM", tone: "early" },
  gold1: { label: "TẶNG 1 CHỈ VÀNG", tone: "gold" },
  gold3: { label: "TẶNG 3 CHỈ VÀNG", tone: "gold" },
  gold5: { label: "TẶNG 5 CHỈ VÀNG", tone: "gold" },
  gold6: { label: "TẶNG 6 CHỈ VÀNG", tone: "gold" },
  gold9: { label: "TẶNG 9 CHỈ VÀNG", tone: "gold" },
};

export default function DetailModeRecovery() {
  useEffect(() => {
    let backButton = null;
    let activeExit = null;
    let lastPreviewUnit = "";
    let fitTimer = null;
    let layoutSafetyNote = null;

    function removeBack() {
      backButton?.remove();
      backButton = null;
      activeExit = null;
      layoutSafetyNote?.remove();
      layoutSafetyNote = null;
      document.body.classList.remove("pf-detail-submode-active", "pf-detail-lot-mode", "pf-detail-finetune-mode", "pf-detail-layout-mode");
    }

    function installBack(label, exit, modeClass) {
      activeExit = exit;
      document.body.classList.add("pf-detail-submode-active", modeClass);
      if (!backButton) {
        backButton = document.createElement("button");
        backButton.type = "button";
        backButton.className = "pf-detail-mode-back";
        backButton.addEventListener("click", () => activeExit?.());
        document.body.appendChild(backButton);
      }
      backButton.textContent = `← ${label}`;
    }

    function installLayoutSafetyNote(layout) {
      if (layoutSafetyNote?.isConnected) return;
      const host = layout.querySelector(".studio-toolbar") || layout.querySelector(".layout-studio") || layout;
      if (!host) return;
      layoutSafetyNote = document.createElement("aside");
      layoutSafetyNote.className = "pf-layout-safety-note";
      layoutSafetyNote.innerHTML = "<strong>MASTER LAYOUT · HẠN CHẾ SỬA</strong><span>Layout này thường đã chốt với Sales. Chỉ chỉnh khi thật sự cần. Save Layout sẽ ghi đè preset; Cancel sẽ bỏ toàn bộ thay đổi chưa lưu.</span>";
      host.prepend(layoutSafetyNote);
    }

    function cancelLayout() {
      const done = document.querySelector(".edit-layout-button.active");
      done?.click();
      window.setTimeout(() => window.location.reload(), 80);
    }

    function syncSettingsEducation() {
      const helper = document.querySelector(".project-settings-helper");
      if (helper) helper.textContent = "Export = tạo bản sao lưu. Import = khôi phục bản sao lưu. Muốn chuyển sang máy khác: Export ở máy này → Import ở máy kia. File .plotflow chỉ là gói backup, bạn không cần mở hay hiểu JSON.";
      const sectionTitle = document.querySelector(".project-settings-section-title small");
      if (sectionTitle && /backup|move/i.test(sectionTitle.textContent || "")) sectionTitle.textContent = "Backup · Restore · Move device";
    }

    function syncFallbackBadges() {
      if (!document.body.classList.contains("pf-product-detail")) return;
      const artboard = document.querySelector(".poster-canvas");
      if (!artboard) return;
      const code = activeUnitCode();
      if (!code) return;
      const config = readCampaign(code);
      const enabled = Array.isArray(config?.badges) ? [...config.badges].filter((item) => item?.enabled).sort((a, b) => (a.order || 0) - (b.order || 0)) : [];

      let layer = artboard.querySelector(":scope > .pf-campaign-fallback-layer");
      if (!layer) {
        layer = document.createElement("div");
        layer.className = "pf-campaign-fallback-layer";
        layer.setAttribute("aria-hidden", "true");
        artboard.appendChild(layer);
      }
      layer.replaceChildren();

      enabled.forEach((item) => {
        const meta = FALLBACK_LABELS[item.id];
        if (!meta) return;
        const image = Array.from(artboard.querySelectorAll("img")).find((img) => {
          const src = String(img.getAttribute("src") || "");
          if (item.id === "hotdeal") return /hotdeal|badge_hotdeal/i.test(src);
          if (item.id === "veosom") return /veosom|badge_veosom/i.test(src);
          if (item.id.startsWith("gold")) return src.includes(`${item.id.replace("gold", "")} chỉ`);
          return false;
        });
        const imageIsReal = Boolean(image?.complete && image.naturalWidth > 8 && image.naturalHeight > 8);
        if (imageIsReal) return;
        const badge = document.createElement("div");
        badge.className = `pf-campaign-fallback-badge is-${meta.tone}`;
        badge.textContent = meta.label;
        layer.appendChild(badge);
      });
    }

    function schedulePreviewFit() {
      const unit = String(document.querySelector(".unit-select.active strong")?.textContent || "").trim();
      if (!unit || unit === lastPreviewUnit) return;
      lastPreviewUnit = unit;
      window.clearTimeout(fitTimer);
      fitTimer = window.setTimeout(() => {
        if (!document.body.classList.contains("pf-product-detail")) return;
        if (document.querySelector(".lot-editor-shell,.component-stage.finetune-mode,.component-stage.layout-studio-mode")) return;
        document.querySelector(".workspace-fit")?.click();
      }, 140);
    }

    function sync() {
      syncSettingsEducation();
      syncFallbackBadges();

      if (!document.body.classList.contains("pf-product-detail")) {
        removeBack();
        lastPreviewUnit = "";
        return;
      }

      const lot = document.querySelector(".lot-editor-shell");
      if (lot) {
        const cancel = findButton(lot, /^(cancel|back|close)$/i);
        installBack("Cancel · Don’t save", () => cancel?.click(), "pf-detail-lot-mode");
        return;
      }

      const fine = document.querySelector(".component-stage.finetune-mode");
      if (fine) {
        const cancel = findButton(fine, /cancel|back|close/i);
        installBack("Cancel · Don’t save", () => cancel?.click(), "pf-detail-finetune-mode");
        return;
      }

      const layout = document.querySelector(".component-stage.layout-studio-mode");
      if (layout) {
        installLayoutSafetyNote(layout);
        installBack("Cancel · Don’t save", cancelLayout, "pf-detail-layout-mode");
        return;
      }

      removeBack();
      schedulePreviewFit();
    }

    function onKeyDown(event) {
      if (event.key !== "Escape" || !activeExit) return;
      const tag = document.activeElement?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      event.preventDefault();
      activeExit();
    }

    const observer = new MutationObserver(() => requestAnimationFrame(sync));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("plotflow-campaign-badges-updated", syncFallbackBadges);
    window.addEventListener("storage", syncFallbackBadges);
    sync();

    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("plotflow-campaign-badges-updated", syncFallbackBadges);
      window.removeEventListener("storage", syncFallbackBadges);
      window.clearTimeout(fitTimer);
      document.querySelectorAll(".pf-campaign-fallback-layer").forEach((node) => node.remove());
      removeBack();
    };
  }, []);

  return null;
}
