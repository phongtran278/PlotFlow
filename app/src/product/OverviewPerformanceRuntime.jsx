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
      const pressure = hasPageMeasurement ? pressureFor(measuredPageMb) : { level: "Unknown", tone: "partial" };
      const main = hasPageMeasurement ? `Estimated page ${Math.round(measuredPageMb)} MB` : "Total RAM unavailable";
      const state = hidden
        ? "Releasing PDF cache"
        : recentlyReleased
          ? "Background cache released"
          : hasPageMeasurement
            ? `${pressure.level} page load`
            : heap
              ? `JS heap ${Math.round(heap.used)} MB`
              : "Browser metric unavailable";
      const detail = hidden
        ? "PlotFlow suspends rebuildable PDF buffers while inactive."
        : recentlyReleased
          ? "PlotFlow released rebuildable PDF buffers; Chromium decides when OS RAM visibly drops."
          : hasPageMeasurement
            ? "Browser-provided page estimate; Task Manager may still include GPU/browser-process memory."
            : "Browsers do not expose reliable total tab/process RAM here. Check Task Manager/Activity Monitor for the real process total.";

      meter.dataset.pressure = hidden ? "suspended" : recentlyReleased ? "released" : pressure.tone;
      meter.innerHTML = `<span class="pf-performance-dot"></span><div><strong>${main}</strong><b>${state}</b></div><small>${detail}</small>`;
      meter.title = hasPageMeasurement
        ? `Estimated page memory: ${Math.round(measuredPageMb)} MB. This is the browser's page-level estimate, not a guarantee of the operating-system process total.`
        : heap
          ? `Total tab/process RAM is not exposed by this browser. JavaScript heap is ${Math.round(heap.used)} MB used / ${Math.round(heap.total)} MB allocated. PDF, GPU and browser-process memory can make Task Manager much higher.`
          : "Total tab/process RAM is not exposed by this browser. Use Task Manager or Activity Monitor for the real process total.";
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
      timer = window.setTimeout(tick, 5000);
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
