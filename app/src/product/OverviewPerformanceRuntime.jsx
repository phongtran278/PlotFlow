import { useEffect } from "react";
import "./OverviewPerformanceRuntime.css";

function heapSnapshot() {
  const memory = performance?.memory;
  if (!memory || !Number.isFinite(memory.usedJSHeapSize)) return null;
  return {
    used: memory.usedJSHeapSize / 1024 / 1024,
    total: memory.totalJSHeapSize / 1024 / 1024,
  };
}

function pressureFor(mb) {
  if (!Number.isFinite(mb)) return { level: "Unknown", tone: "unknown" };
  if (mb < 350) return { level: "Low", tone: "low" };
  if (mb < 800) return { level: "Medium", tone: "medium" };
  return { level: "High", tone: "high" };
}

async function pageMemorySnapshot() {
  if (typeof performance?.measureUserAgentSpecificMemory !== "function") return null;
  try {
    const result = await performance.measureUserAgentSpecificMemory();
    if (!Number.isFinite(result?.bytes)) return null;
    return result.bytes / 1024 / 1024;
  } catch {
    return null;
  }
}

export default function OverviewPerformanceRuntime() {
  useEffect(() => {
    let meter = null;
    let timer = 0;
    let disposed = false;
    let measuredPageMb = null;
    let lastReleaseAt = 0;
    let measuring = false;

    async function refreshPageMemory() {
      if (measuring || document.hidden) return;
      measuring = true;
      const value = await pageMemorySnapshot();
      measuring = false;
      if (disposed) return;
      measuredPageMb = value;
      render();
    }

    function render() {
      if (!meter) return;
      const heap = heapSnapshot();
      const hidden = document.hidden;
      const recentlyReleased = !hidden && lastReleaseAt && Date.now() - lastReleaseAt < 8000;
      const hasPageMeasurement = Number.isFinite(measuredPageMb);
      const metricMb = hasPageMeasurement ? measuredPageMb : heap?.used;
      const pressure = hasPageMeasurement ? pressureFor(metricMb) : { level: "Partial", tone: "partial" };
      const main = hasPageMeasurement
        ? `${Math.round(metricMb)} MB page`
        : heap
          ? `${Math.round(heap.used)} MB JS`
          : "Memory unavailable";
      const state = hidden
        ? "Releasing PDF cache"
        : recentlyReleased
          ? "Background cache released"
          : hasPageMeasurement
            ? `${pressure.level} page load`
            : "Partial metric only";
      const detail = hidden
        ? "Rebuildable PDF canvases are suspended while inactive."
        : recentlyReleased
          ? "PDF buffers were released while this tab was inactive; Chromium decides when OS RAM drops."
          : hasPageMeasurement
            ? "Browser-provided page memory estimate."
            : "This browser does not expose total page RAM; shown value is JavaScript heap only.";

      meter.dataset.pressure = hidden ? "suspended" : recentlyReleased ? "released" : pressure.tone;
      meter.innerHTML = `
        <span class="pf-performance-dot"></span>
        <div><strong>${main}</strong><b>${state}</b></div>
        <small>${detail}</small>`;
      meter.title = hasPageMeasurement
        ? `Browser page-memory estimate: ${Math.round(metricMb)} MB. PlotFlow releases rebuildable PDF buffers when inactive. The operating system and Chromium decide when released memory is physically returned to RAM.`
        : heap
          ? `JavaScript heap only: ${Math.round(heap.used)} MB used / ${Math.round(heap.total)} MB allocated. This is NOT total tab RAM. PDF, GPU and browser-process memory are not exposed here. PlotFlow still releases rebuildable PDF buffers in the background.`
          : "This browser does not expose a reliable total page-memory metric. PlotFlow still releases rebuildable PDF buffers while inactive.";
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
      refreshPageMemory();
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, document.hidden ? 5000 : 5000);
    }

    function onVisibility() {
      if (document.hidden) {
        lastReleaseAt = Date.now();
        measuredPageMb = null;
      }
      render();
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, document.hidden ? 5000 : 400);
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
