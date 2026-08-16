import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./QuickTextOverride.css";

const STORAGE_KEY = "plotflow-quick-text-overrides-v1";

function normalizeCode(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function readAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}

export function readQuickTextOverride(unitCode) {
  const code = normalizeCode(unitCode);
  return code ? (readAll()[code] || {}) : {};
}

function saveQuickTextOverride(unitCode, patch) {
  const code = normalizeCode(unitCode);
  if (!code) return;
  const all = readAll();
  all[code] = { ...(all[code] || {}), ...patch };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent("plotflow-quick-text-updated", { detail: { unitCode: code, override: all[code] } }));
}

function resetQuickTextOverride(unitCode) {
  const code = normalizeCode(unitCode);
  if (!code) return;
  const all = readAll();
  delete all[code];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  window.dispatchEvent(new CustomEvent("plotflow-quick-text-updated", { detail: { unitCode: code, override: {} } }));
}

export function applyQuickTextOverride(unit, override) {
  if (!unit) return unit;
  const next = { ...unit };
  if (Object.prototype.hasOwnProperty.call(override || {}, "architectureLabel")) next.architectureLabel = override.architectureLabel;
  if (Object.prototype.hasOwnProperty.call(override || {}, "type")) next.type = override.type;
  return next;
}

export default function QuickTextOverride({ unit, resolvedUnit, target, isEditing = false }) {
  const [override, setOverride] = useState(() => readQuickTextOverride(unit?.unitCode));
  const [architectureDraft, setArchitectureDraft] = useState("");
  const [typeDraft, setTypeDraft] = useState("");

  useEffect(() => {
    const next = readQuickTextOverride(unit?.unitCode);
    setOverride(next);
    setArchitectureDraft(Object.prototype.hasOwnProperty.call(next, "architectureLabel") ? next.architectureLabel : String(resolvedUnit?.architectureLabel || ""));
    setTypeDraft(Object.prototype.hasOwnProperty.call(next, "type") ? next.type : String(resolvedUnit?.type || ""));
  }, [unit?.unitCode, resolvedUnit?.architectureLabel, resolvedUnit?.type]);

  if (!target || isEditing || !unit) return null;

  function commitArchitecture() {
    const next = { ...override, architectureLabel: architectureDraft };
    setOverride(next);
    saveQuickTextOverride(unit.unitCode, { architectureLabel: architectureDraft });
  }

  function commitType() {
    const next = { ...override, type: typeDraft };
    setOverride(next);
    saveQuickTextOverride(unit.unitCode, { type: typeDraft });
  }

  function reset() {
    resetQuickTextOverride(unit.unitCode);
    setOverride({});
    setArchitectureDraft(String(resolvedUnit?.architectureLabel || ""));
    setTypeDraft(String(resolvedUnit?.type || ""));
  }

  return createPortal(
    <details className="quick-text-card">
      <summary>
        <span>QUICK TEXT</span>
        <strong>Sửa / xóa nhanh</strong>
      </summary>
      <div className="quick-text-fields">
        <label>
          <span>Kiến trúc</span>
          <input
            value={architectureDraft}
            onChange={(event) => setArchitectureDraft(event.target.value)}
            onBlur={commitArchitecture}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
          />
        </label>
        <label>
          <span>Loại hình</span>
          <input
            value={typeDraft}
            onChange={(event) => setTypeDraft(event.target.value)}
            onBlur={commitType}
            onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
          />
        </label>
      </div>
      <div className="quick-text-actions">
        <small>Chỉ override text hiển thị của căn này. Sheet/Excel không bị sửa.</small>
        <button type="button" onClick={reset}>Reset to Data</button>
      </div>
    </details>,
    target
  );
}
