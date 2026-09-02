import { useEffect } from "react";

export default function OverviewHeaderExportRuntime() {
  useEffect(() => {
    let observer = null;
    let control = null;

    function sync() {
      const host = document.querySelector("[data-overview-header-actions]");
      const toolbar = document.querySelector(".pf-overview-zoom-toolbar");
      if (!host || !toolbar) return;

      if (!control?.isConnected) {
        control = document.createElement("div");
        control.className = "pf-overview-header-compact-actions";
        control.innerHTML = `
          <button type="button" data-header-action="fit" title="Fit PDF to workspace">Fit</button>
          <span class="pf-overview-header-action-divider"></span>
          <button type="button" data-header-action="png" title="Export PNG">PNG</button>
          <select data-header-resolution aria-label="Export resolution" title="PNG/PDF export resolution">
            <option value="2">2×</option><option value="4" selected>4×</option><option value="6">6×</option>
          </select>
          <button type="button" data-header-action="pdf" title="Export PDF">PDF</button>`;
        control.addEventListener("click", (event) => {
          const action = event.target.closest?.("[data-header-action]")?.dataset?.headerAction;
          if (!action) return;
          toolbar.querySelector(`[data-action="${action}"]`)?.click();
        });
        control.querySelector("[data-header-resolution]")?.addEventListener("change", (event) => {
          const source = toolbar.querySelector("[data-png-resolution]");
          if (!source) return;
          source.value = event.target.value;
          source.dispatchEvent(new Event("change", { bubbles: true }));
        });
        host.appendChild(control);
      }

      const sourceResolution = toolbar.querySelector("[data-png-resolution]");
      const proxyResolution = control.querySelector("[data-header-resolution]");
      if (sourceResolution && proxyResolution && proxyResolution.value !== sourceResolution.value) proxyResolution.value = sourceResolution.value;
    }

    sync();
    observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("pf-overview-live-units-ready", sync);
    window.addEventListener("pf-overview-group-changed", sync);

    return () => {
      observer?.disconnect();
      window.removeEventListener("pf-overview-live-units-ready", sync);
      window.removeEventListener("pf-overview-group-changed", sync);
      control?.remove();
    };
  }, []);

  return null;
}
