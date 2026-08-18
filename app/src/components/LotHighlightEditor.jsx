import "./LotHighlightEditorFix.css";
import LotHighlightEditorAuto from "./LotHighlightEditorAuto.jsx";
import { getMemoryProfile } from "../runtime/memoryProfile.js";

function lowMemoryBaseline(props) {
  const anchor = props.autoAnchor || { x: 0.5, y: 0.5 };
  return {
    shape: { type: "polygon", source: "locator", points: [] },
    style: {
      fill: "#d91e36",
      opacity: 0.32,
      blendMode: "multiply",
      stroke: "none",
      strokeWidth: 0,
    },
    pin: {
      visible: false,
      x: Number(anchor.x ?? 0.5),
      y: Number(anchor.y ?? 0.5),
      scale: 1,
      rotation: 0,
      anchor: "tip",
    },
    viewSignature: props.viewSignature || "",
    status: "locator",
    autoConfidence: 0,
  };
}

export default function LotHighlightEditor(props) {
  const profile = getMemoryProfile();
  const initialOverlay = props.initialOverlay
    || (profile.lowMemory ? lowMemoryBaseline(props) : null);

  return (
    <LotHighlightEditorAuto
      {...props}
      initialOverlay={initialOverlay}
    />
  );
}
