import { useEffect, useRef, useState } from "react";

const LAYOUT_KEY = "plotflow-layout-round1-v9";
const DEFAULT_PIN = { x: 518, y: 1120, w: 62, h: 86 };
const ARTBOARD_W = 1080;
const ARTBOARD_H = 1920;

function readPinLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "null");
    return { ...DEFAULT_PIN, ...(saved?.pin3d || {}) };
  } catch {
    return DEFAULT_PIN;
  }
}

function persistPin(pin) {
  try {
    const saved = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "null") || {};
    const next = { ...saved, pin3d: pin };
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("plotflow-layout-quick-updated", { detail: { pin3d: pin } }));
  } catch {
    // Keep the live interaction working even when storage is unavailable.
  }
}

export default function QuickPinOverlay({ artboard, src, active }) {
  const [pin, setPin] = useState(readPinLayout);
  const gestureRef = useRef(null);

  useEffect(() => {
    if (!active) setPin(readPinLayout());
  }, [active]);

  useEffect(() => {
    if (!artboard) return;
    const legacy = artboard.querySelector(".poster-pin-3d");
    if (!legacy) return;
    const previousOpacity = legacy.style.opacity;
    const previousPointerEvents = legacy.style.pointerEvents;
    if (active) {
      legacy.style.opacity = "0";
      legacy.style.pointerEvents = "none";
    } else {
      legacy.style.opacity = previousOpacity;
      legacy.style.pointerEvents = previousPointerEvents;
    }
    return () => {
      legacy.style.opacity = previousOpacity;
      legacy.style.pointerEvents = previousPointerEvents;
    };
  }, [artboard, active]);

  useEffect(() => {
    if (!active) return;

    function onMove(event) {
      const gesture = gestureRef.current;
      if (!gesture || !artboard) return;
      const rect = artboard.getBoundingClientRect();
      const artScale = rect.width / ARTBOARD_W || 1;
      const dx = (event.clientX - gesture.clientX) / artScale;
      const dy = (event.clientY - gesture.clientY) / artScale;

      if (gesture.type === "drag") {
        setPin({
          ...gesture.pin,
          x: Math.round(Math.max(-gesture.pin.w / 2, Math.min(ARTBOARD_W - gesture.pin.w / 2, gesture.pin.x + dx))),
          y: Math.round(Math.max(-gesture.pin.h / 2, Math.min(ARTBOARD_H - gesture.pin.h / 2, gesture.pin.y + dy))),
        });
      } else {
        const ratio = gesture.pin.h / gesture.pin.w;
        const nextW = Math.round(Math.max(36, Math.min(320, gesture.pin.w + dx)));
        const nextH = Math.round(nextW * ratio);
        setPin({ ...gesture.pin, w: nextW, h: nextH });
      }
    }

    function onUp() {
      if (!gestureRef.current) return;
      gestureRef.current = null;
      setPin((current) => {
        persistPin(current);
        return current;
      });
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [active, artboard]);

  if (!active || !src) return null;

  function begin(type, event) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    gestureRef.current = {
      type,
      clientX: event.clientX,
      clientY: event.clientY,
      pin: { ...pin },
    };
  }

  return (
    <div
      onMouseDown={(event) => begin("drag", event)}
      style={{
        position: "absolute",
        left: `${pin.x}px`,
        top: `${pin.y}px`,
        width: `${pin.w}px`,
        height: `${pin.h}px`,
        zIndex: 40,
        cursor: "grab",
        outline: "3px solid rgba(255,255,255,.96)",
        boxShadow: "0 0 0 2px rgba(20,95,255,.9), 0 10px 28px rgba(0,0,0,.24)",
        borderRadius: 8,
        userSelect: "none",
      }}
      title="Kéo để đặt 3D Pin"
    >
      <img src={src} alt="3D pin" draggable="false" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }} />
      <div style={{
        position: "absolute",
        left: "50%",
        top: -34,
        transform: "translateX(-50%)",
        whiteSpace: "nowrap",
        background: "#141821",
        color: "white",
        padding: "6px 9px",
        borderRadius: 7,
        fontSize: 12,
        fontWeight: 700,
        pointerEvents: "none",
      }}>Drag pin · zoom preview để đặt chính xác</div>
      <button
        type="button"
        aria-label="Resize 3D pin"
        title="Kéo để phóng to / thu nhỏ"
        onMouseDown={(event) => begin("resize", event)}
        style={{
          position: "absolute",
          right: -10,
          bottom: -10,
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: "3px solid white",
          background: "#145fff",
          cursor: "nwse-resize",
          padding: 0,
        }}
      />
    </div>
  );
}
