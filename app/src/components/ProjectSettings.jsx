import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./ProjectSettings.css";

const PROJECT_FILE_VERSION = 1;
const PROJECT_STORAGE_KEYS = [
  "plotflow-design-assignments-r1",
  "plotflow-lot-overlays-r1-v9",
  "plotflow-floorplan-overrides-v6",
  "plotflow-quick-text-overrides-v1",
  "plotflow-manual-floorplans-v1",
  "plotflow-unit-pin-layouts-v1",
  "plotflow-campaign-badges-by-unit-v2",
  "plotflow-layout-round1-v9",
  "plotflow-grid-round1-v9",
];

function Icon({ name, size = 16 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };
  if (name === "settings") return <svg {...common}><circle cx="12" cy="12" r="3.1"/><path d="M19.2 13.5a7.8 7.8 0 0 0 0-3l2-1.5-2-3.4-2.5 1a8 8 0 0 0-2.6-1.5L13.8 2h-4l-.4 3.1a8 8 0 0 0-2.6 1.5l-2.5-1-2 3.4 2 1.5a7.8 7.8 0 0 0 0 3l-2 1.5 2 3.4 2.5-1a8 8 0 0 0 2.6 1.5l.4 3.1h4l.4-3.1a8 8 0 0 0 2.6-1.5l2.5 1 2-3.4-2.1-1.5Z"/></svg>;
  if (name === "download") return <svg {...common}><path d="M12 3v12m-4-4 4 4 4-4"/><path d="M5 19h14"/></svg>;
  if (name === "upload") return <svg {...common}><path d="M12 16V4m-4 4 4-4 4 4"/><path d="M5 20h14"/></svg>;
  if (name === "device") return <svg {...common}><rect x="5" y="3.5" width="14" height="17" rx="3"/><path d="M9.5 17.5h5"/></svg>;
  if (name === "cloud") return <svg {...common}><path d="M7.3 18h9.2a4 4 0 0 0 .8-7.9A5.6 5.6 0 0 0 6.8 11.4 3.4 3.4 0 0 0 7.3 18Z"/></svg>;
  if (name === "close") return <svg {...common}><path d="m8.5 8.5 7 7m0-7-7 7"/></svg>;
  if (name === "chevron") return <svg {...common}><path d="m9 7 5 5-5 5"/></svg>;
  return null;
}

function safeFileName(value) {
  return String(value || "PlotFlow Project")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80) || "PlotFlow Project";
}

function collectProjectData() {
  const storage = {};
  PROJECT_STORAGE_KEYS.forEach((key) => {
    const value = localStorage.getItem(key);
    if (value !== null) storage[key] = value;
  });
  return storage;
}

function downloadProject(projectName) {
  const payload = {
    format: "plotflow-project",
    schemaVersion: PROJECT_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    projectName: projectName || "PlotFlow Project",
    storage: collectProjectData(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${safeFileName(payload.projectName)}.plotflow`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function validateProjectFile(payload) {
  if (!payload || payload.format !== "plotflow-project") throw new Error("Đây không phải file PlotFlow Project.");
  if (Number(payload.schemaVersion) !== PROJECT_FILE_VERSION) throw new Error("Phiên bản project này chưa được hỗ trợ.");
  if (!payload.storage || typeof payload.storage !== "object" || Array.isArray(payload.storage)) throw new Error("File project không có dữ liệu hợp lệ.");
  return payload;
}

function restoreProject(payload) {
  const allowed = new Set(PROJECT_STORAGE_KEYS);
  PROJECT_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  Object.entries(payload.storage).forEach(([key, value]) => {
    if (!allowed.has(key) || typeof value !== "string") return;
    localStorage.setItem(key, value);
  });
}

export default function ProjectSettings() {
  const [target, setTarget] = useState(null);
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState(() => localStorage.getItem("plotflow-project-name-v1") || "PlotFlow Project");
  const [message, setMessage] = useState("");
  const inputRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const syncTarget = () => setTarget(document.querySelector(".unit-sidebar"));
    syncTarget();
    const observer = new MutationObserver(syncTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

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

  function commitName(value) {
    const next = value.trim() || "PlotFlow Project";
    setProjectName(next);
    localStorage.setItem("plotflow-project-name-v1", next);
  }

  async function importProject(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const payload = validateProjectFile(JSON.parse(await file.text()));
      restoreProject(payload);
      const nextName = String(payload.projectName || file.name.replace(/\.plotflow$/i, "") || "PlotFlow Project");
      localStorage.setItem("plotflow-project-name-v1", nextName);
      setProjectName(nextName);
      setMessage("Đã nhập project. Đang tải lại…");
      window.setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      setMessage(error.message || "Không thể nhập file project.");
    }
  }

  if (!target) return null;

  return createPortal(
    <div className="project-settings-anchor" ref={panelRef}>
      {open && (
        <div className="project-settings-panel" role="dialog" aria-label="PlotFlow settings">
          <div className="project-settings-head">
            <div><small>SETTINGS</small><strong>Project</strong></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close"><Icon name="close" size={15} /></button>
          </div>

          <label className="project-settings-name">
            <span>Project name</span>
            <input value={projectName} onChange={(event) => setProjectName(event.target.value)} onBlur={(event) => commitName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
          </label>

          <section className="project-settings-section">
            <div className="project-settings-section-title"><span>PROJECT DATA</span><small>Move or back up your work</small></div>
            <button type="button" className="project-settings-row" onClick={() => { downloadProject(projectName); setMessage("Đã xuất file project."); }}>
              <span className="project-settings-symbol"><Icon name="download" /></span>
              <span><strong>Export Project</strong><small>Save a .plotflow file</small></span>
              <Icon name="chevron" size={14} />
            </button>
            <button type="button" className="project-settings-row" onClick={() => inputRef.current?.click()}>
              <span className="project-settings-symbol"><Icon name="upload" /></span>
              <span><strong>Import Project</strong><small>Restore work from a file</small></span>
              <Icon name="chevron" size={14} />
            </button>
            <input ref={inputRef} type="file" accept=".plotflow,application/json" hidden onChange={importProject} />
          </section>

          <section className="project-settings-section">
            <div className="project-settings-section-title"><span>STORAGE</span><small>Where this project is saved</small></div>
            <div className="project-settings-row is-static">
              <span className="project-settings-symbol"><Icon name="device" /></span>
              <span><strong>Local Device</strong><small>Saved in this browser</small></span>
              <em>Current</em>
            </div>
            <div className="project-settings-row is-static is-muted">
              <span className="project-settings-symbol"><Icon name="cloud" /></span>
              <span><strong>Shared Project</strong><small>Cloud team sync</small></span>
              <em>Later</em>
            </div>
          </section>

          {message && <div className="project-settings-message">{message}</div>}
        </div>
      )}

      <button type="button" className={`project-settings-trigger ${open ? "is-open" : ""}`} onClick={() => { setOpen((value) => !value); setMessage(""); }}>
        <Icon name="settings" size={17} />
        <span>Settings</span>
      </button>
    </div>,
    target
  );
}
