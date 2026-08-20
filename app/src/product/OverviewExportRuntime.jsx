import { useEffect } from "react";
import { toPng } from "html-to-image";

export default function OverviewExportRuntime() {
  useEffect(() => {
    async function onClick(event) {
      const button = event.target.closest?.(".pf-overview-editor-toolbar [data-action='pdf']");
      if (!button) return;
      const stage = button.closest(".pf-masterplan-stage");
      if (!stage) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      const toolbar = stage.querySelector(".pf-overview-editor-toolbar");
      const previous = toolbar?.style.display || "";
      if (toolbar) toolbar.style.display = "none";
      stage.classList.add("is-exporting-overview");

      try {
        const dataUrl = await toPng(stage, { pixelRatio: 2.5, cacheBust: true, backgroundColor: "#ffffff" });
        const popup = window.open("", "_blank");
        if (!popup) return;
        popup.opener = null;
        popup.document.write(`<!doctype html><html><head><title>PhongFlow Overview</title><style>@page{size:landscape;margin:0}html,body{margin:0;width:100%;height:100%;background:#fff}body{display:grid;place-items:center}img{display:block;max-width:100vw;max-height:100vh;width:100%;height:100%;object-fit:contain}</style></head><body><img src="${dataUrl}" onload="setTimeout(()=>window.print(),180)"></body></html>`);
        popup.document.close();
      } finally {
        if (toolbar) toolbar.style.display = previous;
        stage.classList.remove("is-exporting-overview");
      }
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
