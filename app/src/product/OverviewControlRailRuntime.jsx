import { useEffect } from "react";
import "./OverviewControlRailRuntime.css";

export default function OverviewControlRailRuntime() {
  useEffect(() => {
    let frame = 0;
    let attempts = 0;

    function sync() {
      const rail = document.querySelector(".pf-overview-control-rail");
      const stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (!rail || !stage) return false;

      const navigator = stage.querySelector(":scope > .pf-unit-navigator");
      const toolbar = stage.querySelector(":scope > .pf-overview-zoom-toolbar");
      if (navigator && navigator.parentElement !== rail) rail.appendChild(navigator);
      if (toolbar && toolbar.parentElement !== rail) rail.appendChild(toolbar);
      return Boolean(navigator || toolbar);
    }

    function scheduleSync() {
      cancelAnimationFrame(frame);
      attempts = 0;
      const run = () => {
        attempts += 1;
        if (sync() || attempts >= 8) return;
        frame = requestAnimationFrame(run);
      };
      frame = requestAnimationFrame(run);
    }

    function onViewChange(event) {
      if (event.detail?.screen === "project" && event.detail?.mode === "overview") scheduleSync();
    }

    window.addEventListener("plotflow-product-view-changed", onViewChange);
    scheduleSync();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("plotflow-product-view-changed", onViewChange);
    };
  }, []);

  return null;
}