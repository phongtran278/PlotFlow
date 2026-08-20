import { useEffect, useRef, useState } from "react";
import "./SharedProjectStatus.css";

export default function SharedProjectStatus() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!panelRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="shared-project-status" ref={panelRef}>
      <button
        type="button"
        className={`shared-project-pill ${open ? "is-open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        title="Project save & sync"
      >
        <span className="shared-project-dot" />
        <span>Local</span>
        <span className="shared-project-chevron">⌄</span>
      </button>

      {open && (
        <div className="shared-project-popover" role="dialog" aria-label="Project save and sync">
          <div className="shared-project-head">
            <div>
              <strong>Project data</strong>
              <span>Save & sync</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close">×</button>
          </div>

          <div className="shared-project-current">
            <div className="shared-project-current-icon">◉</div>
            <div>
              <strong>Local device</strong>
              <p>Edits are saved only in this browser.</p>
            </div>
            <span className="shared-project-badge">Current</span>
          </div>

          <div className="shared-project-divider" />

          <div className="shared-project-recommended">
            <div className="shared-project-title-row">
              <div>
                <strong>Shared project</strong>
                <span className="shared-project-recommended-tag">Recommended</span>
              </div>
              <span className="shared-project-cloud">☁</span>
            </div>
            <p>One person prepares the project. Everyone else opens the same link and uses the saved result.</p>

            <div className="shared-project-flow">
              <span>Designer edits</span>
              <b>→</b>
              <span>Cloud saves</span>
              <b>→</b>
              <span>Team uses</span>
            </div>

            <div className="shared-project-meta">
              <div><span>Access</span><strong>Editor · Viewer</strong></div>
              <div><span>Sync</span><strong>Across devices</strong></div>
            </div>

            <button type="button" className="shared-project-preview-button" disabled>
              Connect shared project · Preview UI
            </button>
          </div>

          <small className="shared-project-note">Cloud sync is not connected yet. This panel previews the intended workflow.</small>
        </div>
      )}
    </div>
  );
}
