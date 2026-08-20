import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import "./QuickTextOverride.css";

const STORAGE_KEY = "plotflow-quick-text-overrides-v1";

const FIELD_DEFS = [
  { key: "unitCode", label: "Mã căn", group: "Identity" },
  { key: "architectureLabel", label: "Kiến trúc / phong cách", group: "Identity" },
  { key: "type", label: "Loại hình", group: "Identity" },
  { key: "houseModel", label: "Tên mẫu nhà", group: "Identity" },
  { key: "floors", label: "Số tầng", group: "Thông tin" },
  { key: "handover", label: "Bàn giao", group: "Thông tin" },
  { key: "landArea", label: "Diện tích đất", group: "Thông tin" },
  { key: "constructionArea", label: "Diện tích xây dựng", group: "Thông tin" },
  { key: "roadWidth", label: "Lộ giới / đường", group: "Thông tin" },
  { key: "priceEarly", label: "Giá sớm", group: "Giá" },
  { key: "price18", label: "Giá 18TH", group: "Giá" },
  { key: "price24", label: "Giá 24TH", group: "Giá" },
  { key: "price30", label: "Giá 30TH", group: "Giá" },
  { key: "price36", label: "Giá 36TH", group: "Giá" },
];

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
  for (const { key } of FIELD_DEFS) {
    if (Object.prototype.hasOwnProperty.call(override || {}, key)) next[key] = override[key];
  }
  return next;
}

function valueFor(field, override, resolvedUnit) {
  return Object.prototype.hasOwnProperty.call(override || {}, field.key)
    ? String(override[field.key] ?? "")
    : String(resolvedUnit?.[field.key] ?? "");
}

export default function QuickTextOverride({ unit, resolvedUnit, target, isEditing = false }) {
  const [override, setOverride] = useState(() => readQuickTextOverride(unit?.unitCode));
  const [drafts, setDrafts] = useState({});

  const groups = useMemo(() => {
    const map = new Map();
    for (const field of FIELD_DEFS) {
      if (!map.has(field.group)) map.set(field.group, []);
      map.get(field.group).push(field);
    }
    return [...map.entries()];
  }, []);

  useEffect(() => {
    const next = readQuickTextOverride(unit?.unitCode);
    setOverride(next);
    const nextDrafts = {};
    for (const field of FIELD_DEFS) nextDrafts[field.key] = valueFor(field, next, resolvedUnit);
    setDrafts(nextDrafts);
  }, [unit?.unitCode, resolvedUnit]);

  if (!target || isEditing || !unit) return null;

  function commitField(key) {
    const value = String(drafts[key] ?? "");
    const next = { ...override, [key]: value };
    setOverride(next);
    saveQuickTextOverride(unit.unitCode, { [key]: value });
  }

  function reset() {
    resetQuickTextOverride(unit.unitCode);
    setOverride({});
    const nextDrafts = {};
    for (const field of FIELD_DEFS) nextDrafts[field.key] = String(resolvedUnit?.[field.key] ?? "");
    setDrafts(nextDrafts);
  }

  const overrideCount = Object.keys(override || {}).length;

  return createPortal(
    <details className="quick-text-card">
      <summary>
        <span>EDIT TEXT</span>
        <strong>{overrideCount ? `${overrideCount} override${overrideCount > 1 ? "s" : ""}` : "Manual control"}</strong>
      </summary>

      <div className="quick-text-intro">
        Sửa trực tiếp text hiển thị của căn này khi dữ liệu tự động chưa đúng. Không thay đổi dữ liệu nguồn.
      </div>

      <div className="quick-text-scroll">
        {groups.map(([group, fields]) => (
          <section className="quick-text-group" key={group}>
            <div className="quick-text-group-title">{group}</div>
            <div className="quick-text-fields">
              {fields.map((field) => (
                <label key={field.key}>
                  <span>{field.label}</span>
                  <input
                    value={drafts[field.key] ?? ""}
                    onChange={(event) => setDrafts((current) => ({ ...current, [field.key]: event.target.value }))}
                    onBlur={() => commitField(field.key)}
                    onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
                  />
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="quick-text-actions">
        <small>Fallback manual · chỉ áp dụng cho căn hiện tại.</small>
        <button type="button" onClick={reset}>Reset to Data</button>
      </div>
    </details>,
    target
  );
}
