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
        <span>DETAIL / READY</span>
        <div className="pf-empty-gridline"><i /><i /><i /></div>
        <strong>Your composition<br />starts here.</strong>
      </div>
      <div className="pf-empty-copy">
        <span>DETAIL WORKSPACE</span>
        <h2>Connect data.<br /><em>Shape the story.</em></h2>
        <p>Bring in a Google Sheet or Excel file, choose a unit, then refine the artwork with PlotFlow’s layout, floorplan and highlight tools.</p>
        <div className="pf-empty-steps"><b>01</b><span>Connect project data</span><b>02</b><span>Select a unit</span><b>03</b><span>Refine & export</span></div>
        <div className="pf-empty-note"><strong>Ready</strong><span>This preview disappears automatically as soon as live unit data is connected.</span></div>
      </div>
    </div>,
    target
  );
}
