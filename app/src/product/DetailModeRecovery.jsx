import { useEffect } from "react";
import "./DetailModeRecovery.css";

const DETAIL_MODE_CLASSES = [
  "pf-detail-submode-active",
  "pf-detail-lot-mode",
  "pf-detail-finetune-mode",
  "pf-detail-layout-mode",
];

function findButton(root, matcher) {
  return Array.from(root?.querySelectorAll?.("button") || []).find((button) => matcher.test(String(button.textContent || "").trim()));
}

export default function DetailModeRecovery() {
  useEffect(() => {
    let backButton = null;
    let activeExit = null;
    let lastPreviewUnit = "";
    let fitTimer = null;
    let layoutNote = null;
    let saveExitButton = null;
    let syncRaf = null;

    function hasDetailModeClass() {
      return DETAIL_MODE_CLASSES.some((className) => document.body.classList.contains(className));
    }

    function removeLayoutChrome() {
      layoutNote?.remove();
      layoutNote = null;
      saveExitButton?.remove();
      saveExitButton = null;
    }

    function removeBack() {
      backButton?.remove();
      backButton = null;
      activeExit = null;
      removeLayoutChrome();
      if (hasDetailModeClass()) {
        document.body.classList.remove(...DETAIL_MODE_CLASSES);
      }
    }

    function installBack(label, exit, modeClass) {
      activeExit = exit;
      if (!document.body.classList.contains("pf-detail-submode-active")) {
        document.body.classList.add("pf-detail-submode-active");
      }
      if (!document.body.classList.contains(modeClass)) {
        document.body.classList.add(modeClass);
      }
      if (!backButton) {
        backButton = document.createElement("button");
        backButton.type = "button";
        backButton.className = "pf-detail-mode-back";
        backButton.addEventListener("click", () => activeExit?.());
        document.body.appendChild(backButton);
      }
      backButton.textContent = `← ${label}`;
    }

    function cancelLayout() {
      const done = document.querySelector(".edit-layout-button.active");
      done?.click();
      window.setTimeout(() => window.location.reload(), 60);
    }

    function saveAndExitLayout() {
      document.querySelector(".component-stage.layout-studio-mode .save-layout-button")?.click();
      document.querySelector(".edit-layout-button.active")?.click();
    }

    function installLayoutChrome(layout) {
      const layers = layout.querySelector(".layers-panel");
      if (layers && !layoutNote?.isConnected) {
        layoutNote = document.createElement("div");
        layoutNote.className = "pf-layout-protected-note";
        layoutNote.innerHTML = "<strong>MASTER LAYOUT · HẠN CHẾ SỬA</strong><span>Layout này đã chốt. Chỉ vào đây khi thật sự bất khả kháng; ưu tiên chỉnh nội dung ở Preview.</span>";
        const heading = layers.querySelector(".studio-panel-heading");
        heading?.insertAdjacentElement("afterend", layoutNote);
      }

      const history = layout.querySelector(".history-controls");
      if (history && !saveExitButton?.isConnected) {
        saveExitButton = document.createElement("button");
        saveExitButton.type = "button";
        saveExitButton.className = "pf-layout-save-exit";
        saveExitButton.textContent = "Save & Exit";
        saveExitButton.addEventListener("click", saveAndExitLayout);
        history.appendChild(saveExitButton);
      }
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
      if (!document.body.classList.contains("pf-product-detail")) {
        if (backButton || layoutNote || saveExitButton || hasDetailModeClass()) {
          removeBack();
        }
        lastPreviewUnit = "";
        return;
      }

      const lot = document.querySelector(".lot-editor-shell");
      if (lot) {
        removeLayoutChrome();
        const cancel = findButton(lot, /^(cancel|back|close)$/i);
        installBack("Cancel · Don’t save", () => cancel?.click(), "pf-detail-lot-mode");
        return;
      }

      const fine = document.querySelector(".component-stage.finetune-mode");
      if (fine) {
        removeLayoutChrome();
        const cancel = findButton(fine, /cancel|back|close/i);
        installBack("Cancel · Don’t save", () => cancel?.click(), "pf-detail-finetune-mode");
        return;
      }

      const layout = document.querySelector(".component-stage.layout-studio-mode");
      if (layout) {
        installBack("Cancel · Don’t save", cancelLayout, "pf-detail-layout-mode");
        installLayoutChrome(layout);
        return;
      }

      removeBack();
      schedulePreviewFit();
    }

    function queueSync(records = []) {
      const inDetail = document.body.classList.contains("pf-product-detail");
      if (!inDetail) {
        const bodyClassChanged = records.some((record) => (
          record.type === "attributes"
          && record.target === document.body
          && record.attributeName === "class"
        ));
        const needsCleanup = Boolean(backButton || layoutNote || saveExitButton || hasDetailModeClass());
        if (!bodyClassChanged && !needsCleanup) return;
      }

      if (syncRaf !== null) return;
      syncRaf = requestAnimationFrame(() => {
        syncRaf = null;
        sync();
      });
    }

    function onKeyDown(event) {
      if (event.key !== "Escape" || !activeExit) return;
      const tag = document.activeElement?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
      event.preventDefault();
      activeExit();
    }

    const observer = new MutationObserver((records) => queueSync(records));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    window.addEventListener("keydown", onKeyDown, true);
    sync();

    return () => {
      observer.disconnect();
      if (syncRaf !== null) cancelAnimationFrame(syncRaf);
      window.removeEventListener("keydown", onKeyDown, true);
      window.clearTimeout(fitTimer);
      removeBack();
    };
  }, []);

  return null;
}
