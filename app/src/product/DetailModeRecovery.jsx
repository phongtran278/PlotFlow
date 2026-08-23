import { useEffect } from "react";
import "./DetailModeRecovery.css";

function findButton(root, matcher) {
  return Array.from(root?.querySelectorAll?.("button") || []).find((button) => matcher.test(String(button.textContent || "").trim()));
}

export default function DetailModeRecovery() {
  useEffect(() => {
    let backButton = null;
    let activeExit = null;

    function removeBack() {
      backButton?.remove();
      backButton = null;
      activeExit = null;
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

    function sync() {
      if (!document.body.classList.contains("pf-product-detail")) {
        removeBack();
        return;
      }

      const lot = document.querySelector(".lot-editor-shell");
      if (lot) {
        const cancel = findButton(lot, /^(cancel|back|close)$/i);
        installBack("Back to Detail", () => cancel?.click(), "pf-detail-lot-mode");
        return;
      }

      const fine = document.querySelector(".component-stage.finetune-mode");
      if (fine) {
        const cancel = findButton(fine, /cancel|back|close/i);
        installBack("Back to Detail", () => cancel?.click(), "pf-detail-finetune-mode");
        return;
      }

      const layout = document.querySelector(".component-stage.layout-studio-mode");
      if (layout) {
        const done = document.querySelector(".edit-layout-button.active") || findButton(layout, /done|exit edit layout|back/i);
        installBack("Back to Preview", () => done?.click(), "pf-detail-layout-mode");
        return;
      }

      removeBack();
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
    sync();

    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", onKeyDown, true);
      removeBack();
    };
  }, []);

  return null;
}
