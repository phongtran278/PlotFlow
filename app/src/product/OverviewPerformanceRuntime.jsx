import { useEffect } from "react";
import "./OverviewPerformanceRuntime.css";

function heapSnapshot() {
  const memory = performance?.memory;
  if (!memory || !Number.isFinite(memory.usedJSHeapSize)) return null;
  return {
    used: memory.usedJSHeapSize / 1024 / 1024,
    total: memory.totalJSHeapSize / 1024 / 1024,
    limit: memory.jsHeapSizeLimit / 1024 / 1024,
  };
}

function pressureFor(mb) {
  if (!Number.isFinite(mb)) return { level: "Unknown", tone: "unknown" };
  if (mb < 250) return { level: "Low", tone: "low" };
  if (mb < 600) return { level: "Medium", tone: "medium" };
  return { level: "High", tone: "high" };
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
      const pressure = pressureFor(heap?.used);
      const used = heap ? `${Math.round(heap.used)} MB` : "RAM n/a";
      const state = hidden ? "Releasing background cache" : `${pressure.level} memory load`;
      meter.dataset.pressure = hidden ? "suspended" : pressure.tone;
      meter.innerHTML = `
        <span class="pf-performance-dot"></span>
        <div><strong>${used}</strong><b>${state}</b></div>
        <small>${hidden ? "Overview suspends rebuildable PDF buffers while inactive." : `${nodes} UI nodes · cache releases when this tab goes inactive.`}</small>`;
      meter.title = heap
        ? `PlotFlow can read JavaScript heap (${Math.round(heap.used)} MB used, ${Math.round(heap.total)} MB allocated), but browsers do not expose total tab/process RAM reliably. PDF/GPU/browser memory may be higher. When the tab is inactive, PlotFlow releases rebuildable PDF buffers; Chromium decides when that memory is returned to the operating system.`
        : "This browser does not expose JavaScript heap usage. PlotFlow still suspends rebuildable PDF buffers when the tab is inactive; the browser decides when memory is returned to the operating system.";
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
