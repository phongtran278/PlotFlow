import { useEffect, useState } from "react";

function pickScroller() {
  const candidates = [...document.querySelectorAll(".studio-canvas-scroll")]
    .filter((node) => node.querySelector(".studio-poster-viewport"));
  return candidates.sort((a, b) => {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    return br.width * br.height - ar.width * ar.height;
  })[0] || null;
}

function snapshot(scroller, lastWheel) {
  if (!scroller) return {
    found: false,
    count: document.querySelectorAll(".studio-canvas-scroll").length,
    lastWheel,
  };
  const viewport = scroller.querySelector(".studio-poster-viewport");
  const rect = scroller.getBoundingClientRect();
  const style = getComputedStyle(scroller);
  return {
    found: true,
    count: document.querySelectorAll(".studio-canvas-scroll").length,
    client: `${scroller.clientWidth} × ${scroller.clientHeight}`,
    scroll: `${scroller.scrollWidth} × ${scroller.scrollHeight}`,
    pos: `${Math.round(scroller.scrollLeft)} , ${Math.round(scroller.scrollTop)}`,
    max: `${Math.max(0, scroller.scrollWidth - scroller.clientWidth)} , ${Math.max(0, scroller.scrollHeight - scroller.clientHeight)}`,
    rect: `${Math.round(rect.width)} × ${Math.round(rect.height)}`,
    overflow: `${style.overflowX} / ${style.overflowY}`,
    display: style.display,
    zoom: viewport?.dataset?.workspaceZoom || "—",
    cssZoom: viewport ? getComputedStyle(viewport).getPropertyValue("--studio-zoom").trim() || "—" : "—",
    spacer: scroller.querySelector(":scope > .workspace-scroll-spacer") ? "YES" : "NO",
    panSurface: scroller.dataset.workspacePanSurface || "—",
    lastWheel,
  };
}

export default function WorkspaceDebugHUD() {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState(() => snapshot(null, "—"));

  useEffect(() => {
    let frame = 0;
    let lastWheel = "—";
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setData(snapshot(pickScroller(), lastWheel)));
    };
    const onWheel = (event) => {
      const scroller = pickScroller();
      if (!scroller || !scroller.contains(event.target)) return;
      lastWheel = `dx ${Math.round(event.deltaX)} / dy ${Math.round(event.deltaY)} / ctrl ${event.ctrlKey ? 1 : 0} / shift ${event.shiftKey ? 1 : 0}`;
      update();
    };
    const onScroll = () => update();
    const timer = window.setInterval(update, 500);
    document.addEventListener("wheel", onWheel, true);
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
      document.removeEventListener("wheel", onWheel, true);
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div style={{ position: "fixed", left: 10, bottom: 10, zIndex: 99999, fontFamily: "monospace", fontSize: 11, lineHeight: 1.35, color: "#fff", background: "rgba(20,24,32,.92)", borderRadius: 10, padding: open ? 10 : 6, boxShadow: "0 8px 28px rgba(0,0,0,.25)", maxWidth: 360 }}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ border: 0, borderRadius: 6, padding: "4px 7px", cursor: "pointer", marginBottom: open ? 7 : 0 }}>WORKSPACE DEBUG</button>
      {open && (
        <div>
          <div>found: {String(data.found)} · scrollers: {data.count}</div>
          <div>client: {data.client || "—"}</div>
          <div>scroll: {data.scroll || "—"}</div>
          <div>pos: {data.pos || "—"}</div>
          <div>max: {data.max || "—"}</div>
          <div>rect: {data.rect || "—"}</div>
          <div>overflow: {data.overflow || "—"}</div>
          <div>display: {data.display || "—"}</div>
          <div>zoom: {data.zoom} · css: {data.cssZoom}</div>
          <div>spacer: {data.spacer} · pan: {data.panSurface}</div>
          <div>wheel: {data.lastWheel}</div>
        </div>
      )}
    </div>
  );
}
