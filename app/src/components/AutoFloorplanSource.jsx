import { useEffect, useRef } from "react";
import { releasePreparedFallbackPdf } from "../floorplan/pdfLocator";

// Keep the heavy bundled masterplan lazy. PlotFlow should start light, but Lot Highlight
// must remain discoverable. When the real App button is unavailable because the PDF has
// not been indexed yet, this bridge adds the same action to the stage header. The first
// click loads the bundled masterplan; once App resolves the selected lot, the bridge hands
// control to the real Lot Highlight button and removes itself.
export default function AutoFloorplanSource() {
  const pendingLotHighlightRef = useRef(false);
  const bridgeButtonRef = useRef(null);

  useEffect(() => {
    const root = document.getElementById("root") || document.body;
    let observer;
    let raf = null;
    let lotEditorWasOpen = Boolean(document.querySelector(".lot-editor-shell"));

    function removeBridge() {
      bridgeButtonRef.current?.remove();
      bridgeButtonRef.current = null;
    }

    function releaseRemovedEditorTree(node) {
      if (!(node instanceof Element)) return false;
      const editor = node.matches(".lot-editor-shell")
        ? node
        : node.querySelector?.(".lot-editor-shell");
      if (!editor) return false;

      // Drop decoded editor images immediately. The saved overlay only contains tiny
      // normalized coordinates, so the heavy image is never needed after Save/Cancel.
      editor.querySelectorAll("img").forEach((img) => {
        const src = img.currentSrc || img.src || "";
        try {
          img.removeAttribute("src");
          img.srcset = "";
        } catch {}
        if (src.startsWith("blob:")) {
          try { URL.revokeObjectURL(src); } catch {}
        }
      });
      editor.querySelectorAll("canvas").forEach((canvas) => {
        try {
          canvas.width = 1;
          canvas.height = 1;
        } catch {}
      });
      return true;
    }

    function releaseLotEditorMemory() {
      // Prepared masterplans normally do not need a live PDF at all. If a special view
      // temporarily opened the PDF fallback, destroy it as soon as editing is finished.
      releasePreparedFallbackPdf().catch(() => {});

      // Let the browser finish the unmount before it reclaims decoded image/GPU memory.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("plotflow:lot-memory-released"));
          }
        });
      });
    }

    function findRealLotButton() {
      return document.querySelector(".stage-actions .lot-button:not(.lazy-lot-button)");
    }

    function handOffIfReady() {
      const realButton = findRealLotButton();
      if (!realButton) return false;
      removeBridge();
      if (pendingLotHighlightRef.current) {
        pendingLotHighlightRef.current = false;
        requestAnimationFrame(() => realButton.click());
      }
      return true;
    }

    function connectBundledMasterplan() {
      const buttons = Array.from(document.querySelectorAll(".locator-card button"));
      return buttons.find((button) => String(button.textContent || "").includes("Use Bundled Masterplan"));
    }

    function ensureBridge() {
      raf = null;
      if (handOffIfReady()) return;

      const stage = document.querySelector(".component-stage");
      const actions = stage?.querySelector(".stage-actions");
      const unitCode = actions?.querySelector("strong")?.textContent?.trim();
      const isEditor = stage?.classList.contains("layout-studio-mode") || stage?.classList.contains("finetune-mode");
      if (!actions || !unitCode || unitCode === "NO DATA" || isEditor) {
        removeBridge();
        return;
      }

      if (bridgeButtonRef.current?.isConnected) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "edit-floorplan-top lot-button lazy-lot-button";
      button.textContent = "✦ Lot Highlight";
      button.title = "Load masterplan only when Lot Highlight is needed";
      button.addEventListener("click", () => {
        const realButton = findRealLotButton();
        if (realButton) {
          realButton.click();
          return;
        }

        const bundledButton = connectBundledMasterplan();
        if (!bundledButton || bundledButton.disabled) {
          button.textContent = "✦ Lot Highlight unavailable";
          return;
        }

        pendingLotHighlightRef.current = true;
        button.disabled = true;
        button.textContent = "… Loading Lot Highlight";
        bundledButton.click();
      });

      actions.insertBefore(button, actions.querySelector(".edit-layout-button") || null);
      bridgeButtonRef.current = button;
    }

    function schedule() {
      if (raf != null) return;
      raf = requestAnimationFrame(ensureBridge);
    }

    ensureBridge();
    observer = new MutationObserver((records) => {
      let editorRemoved = false;
      records.forEach((record) => {
        record.removedNodes.forEach((node) => {
          if (releaseRemovedEditorTree(node)) editorRemoved = true;
        });
      });

      const editorIsOpen = Boolean(document.querySelector(".lot-editor-shell"));
      if ((lotEditorWasOpen && !editorIsOpen) || editorRemoved) releaseLotEditorMemory();
      lotEditorWasOpen = editorIsOpen;
      schedule();
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });

    return () => {
      observer?.disconnect();
      if (raf != null) cancelAnimationFrame(raf);
      removeBridge();
    };
  }, []);

  return null;
}
