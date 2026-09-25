import { useEffect } from "react";

const DEFAULT_EXPORT_WIDTH = 4000;

export default function OverviewHeaderExportRuntime() {
  useEffect(() => {
    let observer = null;
    let menu = null;

    function syncWidth(value) {
      const width = Math.max(1000, Math.min(7000, Math.round(Number(value) || DEFAULT_EXPORT_WIDTH)));
      const source = document.querySelector(".pf-overview-zoom-toolbar [data-png-width]");
      const input = menu?.querySelector?.("[data-export-width-input]");
      if (source) source.value = String(width);
      if (input && input.value !== String(width)) input.value = String(width);
      menu?.querySelectorAll?.("[data-export-width-preset]").forEach((button) => {
        button.classList.toggle("active", Number(button.dataset.exportWidthPreset) === width);
      });
      return width;
    }

    function install() {
      const toolbar = document.querySelector(".pf-overview-zoom-toolbar");
      const viewTools = toolbar?.querySelector?.(".pf-editor-view-tools");
      if (!toolbar || !viewTools) return false;

      document.querySelector(".pf-overview-header-compact-actions")?.remove();
      if (menu?.isConnected) return true;

      menu = document.createElement("details");
      menu.className = "pf-export-menu";
      menu.innerHTML = `
        <summary>Export <span aria-hidden="true">⌄</span></summary>
        <div class="pf-export-popover">
          <header><strong>Export overview</strong><small>Actual output width</small></header>
          <section>
            <span class="pf-export-format-label">PNG</span>
            <div class="pf-export-width-presets" role="group" aria-label="PNG width presets">
              <button type="button" data-export-width-preset="2000">2000 px</button>
              <button type="button" data-export-width-preset="4000">4000 px</button>
              <button type="button" data-export-width-preset="6000">6000 px</button>
            </div>
            <label class="pf-export-width-input"><span>Width</span><input type="number" min="1000" max="7000" step="100" value="${DEFAULT_EXPORT_WIDTH}" data-export-width-input><b>px</b></label>
            <button type="button" class="pf-export-primary" data-export-proxy="png">Export PNG</button>
          </section>
          <section class="pf-export-pdf-row">
            <div><span class="pf-export-format-label">PDF</span><small>Same artboard aspect ratio</small></div>
            <button type="button" data-export-proxy="pdf">Export PDF</button>
          </section>
        </div>`;

      menu.addEventListener("click", (event) => {
        const preset = event.target.closest?.("[data-export-width-preset]");
        if (preset) syncWidth(preset.dataset.exportWidthPreset);
        const action = event.target.closest?.("[data-export-proxy]")?.dataset?.exportProxy;
        if (!action) return;
        syncWidth(menu.querySelector("[data-export-width-input]")?.value);
        toolbar.querySelector(`[data-action="${action}"]`)?.click();
      });
      menu.querySelector("[data-export-width-input]")?.addEventListener("change", (event) => syncWidth(event.target.value));
      viewTools.after(menu);
      syncWidth(toolbar.querySelector("[data-png-width]")?.value);
      return true;
    }

    install();
    observer = new MutationObserver(() => install());
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("pf-overview-live-units-ready", install);
    window.addEventListener("pf-overview-group-changed", install);

    return () => {
      observer?.disconnect();
      window.removeEventListener("pf-overview-live-units-ready", install);
      window.removeEventListener("pf-overview-group-changed", install);
      menu?.remove();
    };
  }, []);

  return null;
}
