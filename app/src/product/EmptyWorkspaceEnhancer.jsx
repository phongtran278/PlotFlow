import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./EmptyWorkspaceEnhancer.css";

function countUnits() {
  return document.querySelectorAll(".unit-select").length;
}

export default function EmptyWorkspaceEnhancer() {
  const [target, setTarget] = useState(null);
  const [empty, setEmpty] = useState(countUnits() === 0);

  useEffect(() => {
    const sync = () => {
      setTarget(document.querySelector(".component-canvas"));
      setEmpty(countUnits() === 0);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!target || !empty) return null;

  return createPortal(
    <div className="pf-empty-detail">
      <div className="pf-empty-index" aria-hidden="true">
        <span>DETAIL / 00</span>
        <div className="pf-empty-gridline"><i /><i /><i /></div>
        <strong>Waiting<br />for project data.</strong>
        <small>1080 × 1920 · composition surface</small>
      </div>
      <div className="pf-empty-copy">
        <span>DETAIL WORKSPACE</span>
        <h2>Start with <em>the source.</em></h2>
        <p>Connect project data or choose a unit from Overview. PlotFlow will bring the structure in; you decide what the final composition needs.</p>
        <div className="pf-empty-steps"><b>01</b><span>Connect data</span><b>02</b><span>Select a unit</span><b>03</b><span>Review the composition</span></div>
        <div className="pf-empty-note"><strong>Note</strong><span>No placeholder content is exported. This state disappears as soon as live unit data arrives.</span></div>
      </div>
    </div>,
    target
  );
}
