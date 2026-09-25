import { useEffect } from "react";
import "./OverviewLayerRevealRuntime.css";

export default function OverviewLayerRevealRuntime() {
  useEffect(() => {
    let timer = 0;

    function reveal(group) {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const list = group?.closest?.(".pf-layer-panel-list");
        if (!list || !group?.isConnected) return;
        const groupRect = group.getBoundingClientRect();
        const listRect = list.getBoundingClientRect();
        if (groupRect.top < listRect.top || groupRect.bottom > listRect.bottom) {
          const delta = groupRect.top < listRect.top
            ? groupRect.top - listRect.top - 8
            : groupRect.bottom - listRect.bottom + 8;
          list.scrollBy({ top: delta, behavior: "smooth" });
        }
        group.classList.add("pf-layer-reveal-pulse");
        window.setTimeout(() => group.classList.remove("pf-layer-reveal-pulse"), 320);
      }, 70);
    }

    function onClick(event) {
      const toggle = event.target.closest?.("[data-layer-toggle]");
      if (!toggle) return;
      const group = toggle.closest(".pf-layer-unit");
      if (group) reveal(group);
    }

    function onGroupChanged() {
      requestAnimationFrame(() => {
        const list = document.querySelector(".pf-layer-panel-list");
        if (list) list.scrollTop = 0;
      });
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("pf-overview-group-changed", onGroupChanged);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pf-overview-group-changed", onGroupChanged);
    };
  }, []);

  return null;
}
