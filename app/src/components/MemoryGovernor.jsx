import { useEffect } from "react";
import { getMemoryProfile } from "../runtime/memoryProfile.js";
import { releasePreparedFallbackPdf } from "../floorplan/pdfLocator.js";

function softenImage(img) {
  try {
    img.decoding = "async";
    if (!img.closest(".lot-editor-shell")) img.loading = "lazy";
  } catch {}
}

function cleanDetachedEditorMemory({ aggressive = false } = {}) {
  document.querySelectorAll("canvas").forEach((canvas) => {
    const persistent = canvas.closest(".poster-canvas,.lot-editor-shell");
    if (persistent) return;
    const overviewBuffer = canvas.classList.contains("pf-overview-pdf-canvas");
    if (overviewBuffer || canvas.width > 2200 || canvas.height > 2200 || (aggressive && !canvas.isConnected)) {
      try { canvas.width = 1; canvas.height = 1; } catch {}
    }
  });
  releasePreparedFallbackPdf?.().catch?.(() => {});
}

export default function MemoryGovernor() {
  useEffect(() => {
    const profile = getMemoryProfile();
    const root = document.getElementById("root") || document.body;
    let editorWasOpen = Boolean(document.querySelector(".lot-editor-shell"));
    let cleanupTimer = null;

    document.querySelectorAll("img").forEach(softenImage);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.tagName === "IMG") softenImage(node);
          node.querySelectorAll?.("img").forEach(softenImage);
        });
      }

      const editorOpen = Boolean(document.querySelector(".lot-editor-shell"));
      if (editorWasOpen && !editorOpen) {
        if (cleanupTimer) clearTimeout(cleanupTimer);
        cleanupTimer = setTimeout(() => cleanDetachedEditorMemory(), profile.lowMemory ? 0 : 120);
      }
      editorWasOpen = editorOpen;
    });

    function publishMemoryVisibility(hidden, reason) {
      window.dispatchEvent(new CustomEvent("pf-memory-visibility", { detail: { hidden, reason } }));
    }

    function onVisibilityChange() {
      const hidden = document.visibilityState === "hidden";
      publishMemoryVisibility(hidden, "document");
      if (!hidden) return;
      if (cleanupTimer) clearTimeout(cleanupTimer);
      cleanupTimer = setTimeout(() => cleanDetachedEditorMemory({ aggressive: true }), profile.lowMemory ? 0 : 180);
    }

    function onProductViewChange(event) {
      const mode = String(event?.detail?.mode || "");
      // OverviewPdfRuntime stays mounted across ProductShell modes. Explicitly suspend it
      // outside Overview so detached PDF canvases/pages cannot remain retained in Detail.
      publishMemoryVisibility(mode !== "overview", "product-mode");
      if (mode === "overview") return;
      if (cleanupTimer) clearTimeout(cleanupTimer);
      cleanupTimer = setTimeout(() => cleanDetachedEditorMemory({ aggressive: true }), profile.lowMemory ? 0 : 120);
    }

    observer.observe(root, { childList: true, subtree: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("plotflow-product-view-changed", onProductViewChange);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("plotflow-product-view-changed", onProductViewChange);
      if (cleanupTimer) clearTimeout(cleanupTimer);
    };
  }, []);

  return null;
}
