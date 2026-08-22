import { useEffect } from "react";
import "./OverviewControlRailRuntime.css";

export default function OverviewControlRailRuntime() {
  useEffect(() => {
    let observer = null;

    function sync() {
      const rail = document.querySelector(".pf-overview-control-rail");
      const stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (!rail || !stage) return;

      const navigator = stage.querySelector(":scope > .pf-unit-navigator");
      const toolbar = stage.querySelector(":scope > .pf-overview-zoom-toolbar");
      if (navigator && navigator.parentElement !== rail) rail.appendChild(navigator);
      if (toolbar && toolbar.parentElement !== rail) rail.appendChild(toolbar);
    }

    sync();
    observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer?.disconnect();
  }, []);

  return null;
}
