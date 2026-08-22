import { useEffect } from "react";
import "./OverviewFinalUxRuntime.css";

export default function OverviewFinalUxRuntime() {
  useEffect(() => {
    let observer = null;
    let highlightMenu = null;

    function installHighlightMenu() {
      const tools = document.querySelector(".pf-overview-zoom-toolbar .pf-editor-tools");
      if (!tools) return;
      const rect = tools.querySelector('[data-tool="rect"]');
      const pen = tools.querySelector(".pf-pen-tool-button");
      if (!rect || !pen) return;
      rect.classList.add("pf-highlight-source-tool");
      pen.classList.add("pf-highlight-source-tool");
      if (highlightMenu?.isConnected || tools.querySelector(".pf-highlight-menu")) return;

      highlightMenu = document.createElement("details");
      highlightMenu.className = "pf-highlight-menu";
      highlightMenu.innerHTML = `<summary title="Highlight tools">Highlight</summary><div><button type="button" data-highlight="rect">▭ Rectangle</button><button type="button" data-highlight="pen">✒ Pen / Polygon</button></div>`;
      highlightMenu.addEventListener("click", (event) => {
        const type = event.target.closest("button[data-highlight]")?.dataset?.highlight;
        if (!type) return;
        event.preventDefault();
        event.stopPropagation();
        (type === "rect" ? rect : pen).click();
        highlightMenu.removeAttribute("open");
      });
      rect.before(highlightMenu);
    }

    function installAdjustPoint() {
      const nav = document.querySelector(".pf-unit-navigator");
      if (!nav || nav.querySelector('[data-nav="adjust"]')) return;
      const focus = nav.querySelector('[data-nav="focus"]');
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.nav = "adjust";
      button.className = "pf-unit-adjust-button";
      button.textContent = "Adjust point";
      button.title = "Show the connector endpoint. Drag the red dot slightly to avoid covering the lot code.";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
        const select = nav.querySelector("select");
        const code = select?.value || "";
        if (!stage || !code) return;
        select?.dispatchEvent(new Event("change", { bubbles: true }));
        const anchor = Array.from(stage.querySelectorAll(".pf-map-anchor")).find((node) => (node.dataset.unitCode || node.textContent?.trim()) === code);
        if (anchor) {
          anchor.classList.add("pf-anchor-dot-active");
          stage.classList.add("pf-has-active-anchor");
          stage.dataset.pfActiveAnchor = code;
          button.classList.add("active");
          window.setTimeout(() => button.classList.remove("active"), 900);
        }
      });
      focus?.after(button);
    }

    function install() {
      installHighlightMenu();
      installAdjustPoint();
    }

    install();
    observer = new MutationObserver(install);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("pf-overview-live-units-ready", install);
    return () => {
      observer?.disconnect();
      window.removeEventListener("pf-overview-live-units-ready", install);
      highlightMenu?.remove();
    };
  }, []);

  return null;
}
