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
      <div className="pf-empty-poster">
        <div className="pf-empty-poster-top"><span>PF</span><i /></div>
        <div className="pf-empty-house"><i /><i /><i /></div>
        <div className="pf-empty-grid"><span/><span/><span/><span/></div>
      </div>
      <div className="pf-empty-copy">
        <span>DETAIL WORKSPACE</span>
        <h2>Your canvas is ready.</h2>
        <p>Connect a Google Sheet or choose a unit from Overview. The layout stays composed even before live data arrives.</p>
        <div className="pf-empty-steps"><b>01</b><span>Connect project data</span><b>02</b><span>Select a unit</span><b>03</b><span>Build the sales visual</span></div>
      </div>
    </div>,
    target
  );
}
