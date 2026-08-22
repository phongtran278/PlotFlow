import { useEffect } from "react";
import { toPng } from "html-to-image";

export default function OverviewPngExportRuntime() {
  useEffect(() => {
    let busy = false;

    async function onClick(event) {
      const button = event.target?.closest?.('[data-action="png"]');
      if (!button || busy) return;
      const stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (!stage) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      busy = true;
      stage.classList.add("is-exporting-overview");
      try {
        const pixelRatio = Math.max(1, Math.min(4, Number(window.__PLOTFLOW_OVERVIEW_PNG_SCALE__) || 3));
        const dataUrl = await toPng(stage, { pixelRatio, cacheBust: true, backgroundColor: "#fff" });
        const anchor = document.createElement("a");
        anchor.href = dataUrl;
        anchor.download = `PlotFlow-Overview-${pixelRatio}x.png`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } catch (error) {
        console.warn("Overview PNG export failed", error);
      } finally {
        stage.classList.remove("is-exporting-overview");
        busy = false;
      }
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
