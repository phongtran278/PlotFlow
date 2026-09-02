import { useEffect } from "react";
import "./OverviewControlRailRuntime.css";

function topOffset() {
  if (window.innerWidth <= 680) return 66;
  if (window.innerWidth <= 1180) return 72;
  return 78;
}

export default function OverviewControlRailRuntime() {
  useEffect(() => {
    let frame = 0;
    let rail = null;
    let stage = null;
    let spacer = null;
    let resizeObserver = null;
    let mutationObserver = null;

    function ensureSpacer() {
      if (!rail) return null;
      if (!spacer?.isConnected) {
        spacer = document.createElement("div");
        spacer.className = "pf-overview-control-rail-spacer";
        rail.before(spacer);
      }
      return spacer;
    }

    function releaseFixed() {
      rail?.classList.remove("is-fixed-toolbar");
      rail?.style.removeProperty("--pf-fixed-rail-left");
      rail?.style.removeProperty("--pf-fixed-rail-width");
      if (spacer) spacer.style.height = "0px";
    }

    function updateFixed() {
      if (!rail?.isConnected || !spacer?.isConnected) return;
      if (!document.body.classList.contains("pf-product-overview")) {
        releaseFixed();
        return;
      }
      const rect = spacer.getBoundingClientRect();
      const top = topOffset();
      const shouldFix = rect.top <= top;
      if (!shouldFix) {
        releaseFixed();
        return;
      }
      const width = Math.max(1, rect.width || rail.getBoundingClientRect().width);
      rail.style.setProperty("--pf-fixed-rail-left", `${rect.left}px`);
      rail.style.setProperty("--pf-fixed-rail-width", `${width}px`);
      rail.classList.add("is-fixed-toolbar");
      spacer.style.height = `${rail.offsetHeight + 6}px`;
    }

    function scheduleFixed() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateFixed);
    }

    function moveDynamicControlsIntoRail() {
      rail = document.querySelector(".pf-overview-control-rail");
      stage = document.querySelector(".pf-masterplan-stage.has-real-pdf.has-callouts");
      if (!rail || !stage) return false;

      const navigator = document.querySelector(".pf-unit-navigator");
      const toolbar = document.querySelector(".pf-overview-zoom-toolbar");
      if (navigator && navigator.parentElement !== rail) rail.appendChild(navigator);
      if (toolbar && toolbar.parentElement !== rail) rail.appendChild(toolbar);

      ensureSpacer();
      if (!resizeObserver) {
        resizeObserver = new ResizeObserver(scheduleFixed);
        resizeObserver.observe(rail);
      }
      scheduleFixed();
      return true;
    }

    function scheduleSync() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(moveDynamicControlsIntoRail);
    }

    function watchDynamicControls() {
      mutationObserver?.disconnect();
      mutationObserver = new MutationObserver(() => {
        if (!document.body.classList.contains("pf-product-overview")) return;
        scheduleSync();
      });
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    function onViewChange(event) {
      if (event.detail?.screen === "project" && event.detail?.mode === "overview") {
        scheduleSync();
        watchDynamicControls();
      } else {
        releaseFixed();
      }
    }

    window.addEventListener("plotflow-product-view-changed", onViewChange);
    window.addEventListener("pf-overview-group-changed", scheduleSync);
    window.addEventListener("pf-overview-live-units-ready", scheduleSync);
    window.addEventListener("resize", scheduleFixed);
    document.addEventListener("scroll", scheduleFixed, true);
    watchDynamicControls();
    scheduleSync();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      releaseFixed();
      spacer?.remove();
      window.removeEventListener("plotflow-product-view-changed", onViewChange);
      window.removeEventListener("pf-overview-group-changed", scheduleSync);
      window.removeEventListener("pf-overview-live-units-ready", scheduleSync);
      window.removeEventListener("resize", scheduleFixed);
      document.removeEventListener("scroll", scheduleFixed, true);
    };
  }, []);

  return null;
}
