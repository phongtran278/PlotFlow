import { useEffect } from "react";
import "./OverviewPerformanceRuntime.css";

function heapSnapshot() {
  const memory = performance?.memory;
  if (!memory || !Number.isFinite(memory.usedJSHeapSize)) return null;
  return {
    used: memory.usedJSHeapSize / 1024 / 1024,
    limit: memory.jsHeapSizeLimit / 1024 / 1024,
  };
}

export default function OverviewPerformanceRuntime() {
  useEffect(() => {
    let meter = null;
    let timer = 0;
    let disposed = false;

    function render() {
      if (!meter) return;
      const heap = heapSnapshot();
      const nodes = document.querySelector(".pf-overview")?.querySelectorAll("*").length || 0;
      const hidden = document.hidden;
      const heapText = heap ? `${Math.round(heap.used)} MB heap` : "Heap n/a";
      meter.innerHTML = `<span class="pf-performance-dot ${hidden ? "is-suspended" : ""}"></span><strong>${heapText}</strong><small>${nodes} nodes · ${hidden ? "suspended" : "active"}</small>`;
      meter.title = heap
        ? `JavaScript heap: ${Math.round(heap.used)} MB / ${Math.round(heap.limit)} MB limit. This is diagnostic heap usage, not total browser-process RAM.`
        : "Browser does not expose JavaScript heap metrics here. This meter still reports DOM size and suspension state.";
    }

    function install() {
      const rail = document.querySelector(".pf-overview-control-rail");
      if (!rail) return false;
      if (!meter?.isConnected) {
        meter = document.createElement("div");
        meter.className = "pf-overview-performance-meter";
        rail.appendChild(meter);
      }
      render();
      return true;
    }

    function tick() {
      if (disposed) return;
      install();
      render();
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, document.hidden ? 5000 : 1800);
    }

    function onVisibility() {
      render();
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, document.hidden ? 5000 : 250);
    }

    tick();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("plotflow-product-view-changed", tick);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("plotflow-product-view-changed", tick);
      meter?.remove();
    };
  }, []);

  return null;
}
