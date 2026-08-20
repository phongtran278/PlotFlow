import { useEffect, useRef, useState } from "react";
import "./SharedProjectStatus.css";

function Icon({ name, size = 16 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.85,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (name === "chevron") return <svg {...common}><path d="m8.5 10 3.5 3.5 3.5-3.5" /></svg>;
  if (name === "close") return <svg {...common}><path d="m8.5 8.5 7 7m0-7-7 7" /></svg>;
  if (name === "settings") return <svg {...common}><circle cx="12" cy="12" r="3.1"/><path d="M19.1 13.3c.1-.4.1-.9.1-1.3s0-.9-.1-1.3l2-1.6-2-3.4-2.5 1a8.6 8.6 0 0 0-2.2-1.3L14 2.8h-4l-.4 2.6a8.6 8.6 0 0 0-2.2 1.3l-2.5-1-2 3.4 2 1.6c-.1.4-.1.9-.1 1.3s0 .9.1 1.3l-2 1.6 2 3.4 2.5-1a8.6 8.6 0 0 0 2.2 1.3l.4 2.6h4l.4-2.6a8.6 8.6 0 0 0 2.2-1.3l2.5 1 2-3.4-2-1.6Z"/></svg>;
  if (name === "device") return <svg {...common}><rect x="5" y="3.5" width="14" height="17" rx="3"/><path d="M9.5 17.5h5"/></svg>;
  if (name === "cloud") return <svg {...common}><path d="M7.4 18.1h9.1a4.1 4.1 0 0 0 .8-8.1 5.5 5.5 0 0 0-10.4 1.2A3.5 3.5 0 0 0 7.4 18Z"/><path d="m9.5 14 2.5 2.5 2.8-3"/></svg>;
  if (name === "person") return <svg {...common}><circle cx="12" cy="8" r="3.1"/><path d="M6.8 19c.7-3.1 2.4-4.7 5.2-4.7s4.5 1.6 5.2 4.7"/></svg>;
  if (name === "team") return <svg {...common}><circle cx="9" cy="8" r="2.5"/><circle cx="16.3" cy="9.1" r="2"/><path d="M4.8 18c.6-2.8 2-4.1 4.2-4.1 2.4 0 3.9 1.4 4.5 4.1M14 14.5c1.9-.7 4.4.2 5.1 3.5"/></svg>;
  if (name === "arrow") return <svg {...common}><path d="M5 12h13m-4-4 4 4-4 4"/></svg>;
  if (name === "lock") return <svg {...common}><rect x="5.5" y="10" width="13" height="9.5" rx="2.5"/><path d="M8.5 10V7.8A3.5 3.5 0 0 1 12 4.3a3.5 3.5 0 0 1 3.5 3.5V10"/></svg>;
  if (name === "spark") return <svg {...common}><path d="M12 3.8c.5 3.2 2 4.7 5.2 5.2-3.2.5-4.7 2-5.2 5.2-.5-3.2-2-4.7-5.2-5.2 3.2-.5 4.7-2 5.2-5.2Z"/><path d="M18.2 15.2c.2 1.5.9 2.2 2.4 2.4-1.5.2-2.2.9-2.4 2.4-.2-1.5-.9-2.2-2.4-2.4 1.5-.2 2.2-.9 2.4-2.4Z"/></svg>;
  return null;
}

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
        title="Settings"
      >
        <Icon name="settings" size={15} />
        <span className="shared-project-pill-label">Settings</span>
      </button>

      {open && (
        <div className="shared-project-popover" role="dialog" aria-label="PlotFlow settings">
          <div className="shared-project-glow" />

          <div className="shared-project-head">
            <div>
              <span className="shared-project-eyebrow">PLOTFLOW</span>
              <strong>Settings</strong>
            </div>
            <button className="shared-project-icon-button" type="button" onClick={() => setOpen(false)} aria-label="Close">
              <Icon name="close" size={16} />
            </button>
          </div>

          <section className="shared-project-section">
            <div className="shared-project-section-label">PROJECT STORAGE</div>
            <button type="button" className="shared-project-row is-current">
              <span className="shared-project-symbol local"><Icon name="device" size={18} /></span>
              <span className="shared-project-copy">
                <strong>Local Device</strong>
                <small>Saved only in this browser</small>
              </span>
              <span className="shared-project-current-mark">Current</span>
            </button>

            <button type="button" className="shared-project-row shared" disabled>
              <span className="shared-project-symbol cloud"><Icon name="cloud" size={18} /></span>
              <span className="shared-project-copy">
                <span className="shared-project-label-line">
                  <strong>Shared Project</strong>
                  <span className="shared-project-beta">Preview</span>
                </span>
                <small>Sync finished work across the team</small>
              </span>
              <Icon name="chevron" size={15} />
            </button>
          </section>

          <div className="shared-project-feature">
            <div className="shared-project-feature-title">
              <span className="shared-project-symbol accent"><Icon name="spark" size={17} /></span>
              <div>
                <strong>One setup. Everyone works.</strong>
                <p>Prepare the project once, then let the whole team use the same approved result.</p>
              </div>
            </div>

            <div className="shared-project-flow" aria-label="Shared project workflow">
              <div><Icon name="person" size={16} /><span>Designer</span></div>
              <Icon name="arrow" size={14} />
              <div><Icon name="cloud" size={16} /><span>Cloud</span></div>
              <Icon name="arrow" size={14} />
              <div><Icon name="team" size={16} /><span>Team</span></div>
            </div>
          </div>

          <div className="shared-project-info-list">
            <div>
              <span><Icon name="team" size={15} /> Access</span>
              <strong>Editor · Viewer</strong>
            </div>
            <div>
              <span><Icon name="cloud" size={15} /> Sync</span>
              <strong>Across devices</strong>
            </div>
            <div>
              <span><Icon name="lock" size={15} /> Storage</span>
              <strong>Local for now</strong>
            </div>
          </div>

          <button type="button" className="shared-project-primary" disabled>
            Connect Shared Project
          </button>
          <p className="shared-project-footnote">Cloud sync is not connected yet. Current work remains stored on this device.</p>
        </div>
      )}
    </div>
  );
}
