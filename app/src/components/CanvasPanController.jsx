import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./CanvasPanController.css";

function isTypingTarget(target) {
  return Boolean(target?.closest?.("input, textarea, select, [contenteditable='true']"));
}

function findZoomControls() {
  return document.querySelector(".preview-zoom-controls");
}

function findCanvas() {
  return document.querySelector(".component-canvas");
}

export default function CanvasPanController() {
  const [enabled, setEnabled] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const [target, setTarget] = useState(null);
  const dragRef = useRef(null);

  const active = enabled || spaceHeld;

  useEffect(() => {
    function syncTarget() {
      const next = findZoomControls();
      setTarget((current) => (current === next ? current : next));
    }

    syncTarget();
    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.code !== "Space" || isTypingTarget(event.target)) return;
      const canvas = findCanvas();
      const stage = canvas?.closest(".component-stage");
      if (!canvas || stage?.classList.contains("layout-studio-mode") || stage?.classList.contains("finetune-mode")) return;
      event.preventDefault();
      setSpaceHeld(true);
    }

    function onKeyUp(event) {
      if (event.code !== "Space") return;
      setSpaceHeld(false);
      dragRef.current = null;
      setPanning(false);
    }

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = findCanvas();
    if (!canvas) return undefined;

    const stage = canvas.closest(".component-stage");
    const unavailable = stage?.classList.contains("layout-studio-mode") || stage?.classList.contains("finetune-mode");
    const canPan = active && !unavailable;

    canvas.classList.toggle("canvas-pan-enabled", canPan);
    canvas.classList.toggle("canvas-pan-active", canPan && panning);

    function onPointerDown(event) {
      if (!canPan || event.button !== 0) return;
      event.preventDefault();
      dragRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        scrollLeft: canvas.scrollLeft,
        scrollTop: canvas.scrollTop,
      };
      canvas.setPointerCapture?.(event.pointerId);
      setPanning(true);
    }

    function onPointerMove(event) {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      canvas.scrollLeft = drag.scrollLeft - (event.clientX - drag.x);
      canvas.scrollTop = drag.scrollTop - (event.clientY - drag.y);
    }

    function endPan(event) {
      const drag = dragRef.current;
      if (!drag || (event?.pointerId != null && drag.pointerId !== event.pointerId)) return;
      try { canvas.releasePointerCapture?.(drag.pointerId); } catch {}
      dragRef.current = null;
      setPanning(false);
    }

    canvas.addEventListener("pointerdown", onPointerDown, { passive: false });
    canvas.addEventListener("pointermove", onPointerMove, { passive: false });
    canvas.addEventListener("pointerup", endPan);
    canvas.addEventListener("pointercancel", endPan);
    canvas.addEventListener("lostpointercapture", endPan);

    return () => {
      canvas.classList.remove("canvas-pan-enabled", "canvas-pan-active");
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", endPan);
      canvas.removeEventListener("pointercancel", endPan);
      canvas.removeEventListener("lostpointercapture", endPan);
    };
  }, [active, panning, target]);

  const button = useMemo(() => (
    <button
      type="button"
      className={`canvas-hand-button ${enabled ? "active" : ""}`}
      onClick={() => setEnabled((value) => !value)}
      title="Hand tool · kéo canvas để pan · giữ Space để pan tạm thời"
      aria-pressed={enabled}
    >
      <span>✋</span>
      <strong>Hand</strong>
    </button>
  ), [enabled]);

  return target ? createPortal(button, target) : null;
}
