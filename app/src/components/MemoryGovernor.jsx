import { useEffect } from "react";
import { getMemoryProfile } from "../runtime/memoryProfile.js";
import { releasePreparedFallbackPdf } from "../floorplan/pdfLocator.js";

function softenImage(img) {
  try {
    img.decoding = "async";
    if (!img.closest(".lot-editor-shell")) img.loading = "lazy";
  } catch {}
}

function cleanDetachedEditorMemory() {
  document.querySelectorAll("canvas").forEach((canvas) => {
    if (canvas.closest(".poster-canvas")) return;
    if (canvas.closest(".lot-editor-shell")) return;
    if (canvas.width > 2200 || canvas.height > 2200) {
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
        cleanupTimer = setTimeout(cleanDetachedEditorMemory, profile.lowMemory ? 0 : 120);
      }
      editorWasOpen = editorOpen;
    });

    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (cleanupTimer) clearTimeout(cleanupTimer);
    };
  }, []);

  return null;
}
