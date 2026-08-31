import { useEffect } from "react";

function isWindows() {
  if (typeof navigator === "undefined") return false;
  const value = String(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "").toLowerCase();
  return value.includes("win");
}

function mb(bytes) {
  if (!Number.isFinite(bytes)) return "n/a";
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function targetLabel(node) {
  if (!(node instanceof Element)) return node?.nodeName || "node";
  const id = node.id ? `#${node.id}` : "";
  const classes = Array.from(node.classList || []).slice(0, 2).map((name) => `.${name}`).join("");
  return `${node.tagName.toLowerCase()}${id}${classes}`;
}

export default function WindowsOomDiagnosticRuntime() {
  useEffect(() => {
    if (!isWindows()) return undefined;

    let cameraEvents = 0;
    let mutationRecords = 0;
    let mutationBatches = 0;
    let lastDrawCount = safeNumber(window.__plotflowOverviewRuntime?.drawCount);
    let lastSharpFetchCount = safeNumber(window.__plotflowOverviewRuntime?.sharpFetchCount);
    let mutationHotspots = new Map();

    const panel = document.createElement("div");
    panel.dataset.plotflowWindowsOomDiagnostic = "1";
    Object.assign(panel.style, {
      position: "fixed",
      top: "10px",
      right: "10px",
      zIndex: "2147483647",
      width: "360px",
      padding: "10px 12px",
      borderRadius: "10px",
      background: "rgba(15, 18, 24, 0.92)",
      color: "#f7f8fb",
      boxShadow: "0 8px 28px rgba(0,0,0,.28)",
      font: "12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      whiteSpace: "pre",
      pointerEvents: "none",
      userSelect: "none",
    });
    panel.textContent = "Windows OOM diagnostic\nstarting…";
    document.body.appendChild(panel);

    function onCamera() {
      cameraEvents += 1;
    }

    window.addEventListener("pf-overview-camera", onCamera);

    const observer = new MutationObserver((records) => {
      mutationBatches += 1;
      for (const record of records) {
        if (record.target === panel || panel.contains(record.target)) continue;
        mutationRecords += 1;
        const attr = record.type === "attributes" ? `@${record.attributeName || "attr"}` : record.type;
        const key = `${targetLabel(record.target)} ${attr}`;
        mutationHotspots.set(key, (mutationHotspots.get(key) || 0) + 1);
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: false,
    });

    function sample() {
      const runtime = window.__plotflowOverviewRuntime || {};
      const drawCount = safeNumber(runtime.drawCount);
      const sharpFetchCount = safeNumber(runtime.sharpFetchCount);
      const drawPerSecond = Math.max(0, drawCount - lastDrawCount);
      const sharpFetchPerSecond = Math.max(0, sharpFetchCount - lastSharpFetchCount);
      lastDrawCount = drawCount;
      lastSharpFetchCount = sharpFetchCount;

      const heap = performance?.memory;
      const domNodes = document.getElementsByTagName("*").length;
      const canvases = document.querySelectorAll("canvas").length;
      const images = document.querySelectorAll("img").length;
      const cards = document.querySelectorAll(".pf-live-sales-callout,.pf-sales-callout").length;
      const lines = document.querySelectorAll(".pf-live-callout-lines line,.pf-callout-lines line").length;
      const camera = window.__plotflowOverviewCamera || window.__plotflowOverviewRuntime?.camera || null;
      const scale = safeNumber(camera?.scale, NaN);
      const topHotspots = Array.from(mutationHotspots.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const hotspotLines = topHotspots.length
        ? topHotspots.map(([key, count], index) => `hot ${index + 1} ${String(count).padStart(6)}  ${key}`)
        : ["hotspots          none"];

      panel.textContent = [
        "WINDOWS OOM DIAGNOSTIC",
        `camera events/s   ${cameraEvents}`,
        `canvas redraw/s   ${drawPerSecond}`,
        `mut batches/s     ${mutationBatches}`,
        `mut records/s     ${mutationRecords}`,
        ...hotspotLines,
        `DOM nodes         ${domNodes}`,
        `canvas / img      ${canvases} / ${images}`,
        `cards / lines     ${cards} / ${lines}`,
        `JS heap used      ${heap ? mb(heap.usedJSHeapSize) : "n/a"}`,
        `JS heap total     ${heap ? mb(heap.totalJSHeapSize) : "n/a"}`,
        `base bitmaps      ${safeNumber(runtime.activeBitmaps)}`,
        `base fetch total  ${safeNumber(runtime.fetchCount)}`,
        `sharp fetch/s     ${sharpFetchPerSecond}`,
        `sharp fetch total ${safeNumber(runtime.sharpFetchCount)}`,
        `sharp pending     ${safeNumber(runtime.sharpPending)}`,
        `scale             ${Number.isFinite(scale) ? scale.toFixed(2) : "n/a"}`,
        `mode              ${runtime.mode || "n/a"}`,
      ].join("\n");

      window.__plotflowWindowsOomDiagnostic = {
        cameraEventsPerSecond: cameraEvents,
        canvasRedrawsPerSecond: drawPerSecond,
        mutationBatchesPerSecond: mutationBatches,
        mutationRecordsPerSecond: mutationRecords,
        mutationHotspots: topHotspots,
        domNodes,
        canvases,
        images,
        cards,
        lines,
        usedJSHeapSize: heap?.usedJSHeapSize ?? null,
        totalJSHeapSize: heap?.totalJSHeapSize ?? null,
        activeBitmaps: safeNumber(runtime.activeBitmaps),
        fetchCount: safeNumber(runtime.fetchCount),
        sharpFetchCount: safeNumber(runtime.sharpFetchCount),
        sharpPending: safeNumber(runtime.sharpPending),
        timestamp: Date.now(),
      };

      cameraEvents = 0;
      mutationRecords = 0;
      mutationBatches = 0;
      mutationHotspots = new Map();
    }

    sample();
    const timer = window.setInterval(sample, 1000);

    return () => {
      window.clearInterval(timer);
      observer.disconnect();
      window.removeEventListener("pf-overview-camera", onCamera);
      panel.remove();
      delete window.__plotflowWindowsOomDiagnostic;
    };
  }, []);

  return null;
}
