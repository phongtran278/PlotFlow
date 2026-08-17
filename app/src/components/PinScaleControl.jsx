import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./PinScaleControl.css";

const UNIT_PIN_KEY = "plotflow-unit-pin-layouts-v1";
const DEFAULT_PIN = { x: 518, y: 1120, w: 62, h: 86 };
const MIN_SCALE = 40;
const MAX_SCALE = 300;

function normalizeCode(value) {
  return String(value || "").toUpperCase().replace(/\s+/g, "").trim();
}

function readAll() {
  try {
    const value = JSON.parse(localStorage.getItem(UNIT_PIN_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function scaleFromPin(pin) {
  return Math.round(((Number(pin?.w) || DEFAULT_PIN.w) / DEFAULT_PIN.w) * 100);
}

function pinAtScale(existing, scale) {
  const current = { ...DEFAULT_PIN, ...(existing || {}) };
  const safeScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.round(Number(scale) || 100)));
  const nextW = Math.round(DEFAULT_PIN.w * safeScale / 100);
  const nextH = Math.round(DEFAULT_PIN.h * safeScale / 100);
  const cx = current.x + current.w / 2;
  const cy = current.y + current.h / 2;
  return {
    ...current,
    x: Math.round(cx - nextW / 2),
    y: Math.round(cy - nextH / 2),
    w: nextW,
    h: nextH,
  };
}

function selectedUnitCode() {
  return normalizeCode(document.querySelector(".unit-selector .unit-select.active .unit-main strong")?.textContent || "");
}

function allUnitCodes() {
  return Array.from(document.querySelectorAll(".unit-selector .unit-select .unit-main strong"))
    .map((node) => normalizeCode(node.textContent))
    .filter(Boolean);
}

function ensureTarget() {
  const dock = document.querySelector(".design-assignment-dock");
  if (!dock) return null;
  let target = dock.querySelector(".pin-scale-control-host");
  if (!target) {
    target = document.createElement("div");
    target.className = "pin-scale-control-host";
    dock.appendChild(target);
  }
  return target;
}

export default function PinScaleControl() {
  const [target, setTarget] = useState(null);
  const [unitCode, setUnitCode] = useState("");
  const [unitCount, setUnitCount] = useState(0);
  const [scale, setScale] = useState(100);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    function sync() {
      const nextTarget = ensureTarget();
      setTarget((current) => current === nextTarget ? current : nextTarget);
      const code = selectedUnitCode();
      setUnitCode(code);
      setUnitCount(allUnitCodes().length);
      const pin = readAll()[code] || DEFAULT_PIN;
      setScale(scaleFromPin(pin));
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    window.addEventListener("plotflow-unit-pin-updated", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("plotflow-unit-pin-updated", sync);
    };
  }, []);

  function saveCurrent(nextScale) {
    const code = selectedUnitCode() || unitCode;
    if (!code) return;
    const safe = Math.max(MIN_SCALE, Math.min(MAX_SCALE, Math.round(Number(nextScale) || 100)));
    const all = readAll();
    const nextPin = pinAtScale(all[code] || DEFAULT_PIN, safe);
    all[code] = nextPin;
    localStorage.setItem(UNIT_PIN_KEY, JSON.stringify(all));
    setScale(safe);
    window.dispatchEvent(new CustomEvent("plotflow-unit-pin-updated", { detail: { unitCode: code, pin: nextPin } }));
  }

  function applyAll() {
    const codes = allUnitCodes();
    if (!codes.length) return;
    const all = readAll();
    codes.forEach((code) => {
      all[code] = pinAtScale(all[code] || DEFAULT_PIN, scale);
    });
    localStorage.setItem(UNIT_PIN_KEY, JSON.stringify(all));
    const current = selectedUnitCode() || unitCode;
    window.dispatchEvent(new CustomEvent("plotflow-unit-pin-updated", { detail: { unitCode: current, pin: all[current] } }));
    setApplied(true);
    window.setTimeout(() => setApplied(false), 1600);
  }

  function arrangePin() {
    window.dispatchEvent(new CustomEvent("plotflow-open-pin-arrange", { detail: { unitCode: selectedUnitCode() || unitCode } }));
  }

  if (!target) return null;

  return createPortal(
    <section className="pin-scale-control" aria-label="3D Pin controls">
      <div className="pin-scale-head">
        <div><span>3D PIN</span><strong>Mặc định ON</strong></div>
        <button type="button" onClick={arrangePin}>✥ Position</button>
      </div>

      <div className="pin-scale-row">
        <label>
          <span>Scale</span>
          <div><input type="number" min={MIN_SCALE} max={MAX_SCALE} value={scale} onChange={(event) => saveCurrent(event.target.value)} /><b>%</b></div>
        </label>
        <div className="pin-scale-presets">
          {[80, 90, 100, 110].map((value) => (
            <button type="button" key={value} className={scale === value ? "active" : ""} onClick={() => saveCurrent(value)}>{value}%</button>
          ))}
        </div>
      </div>

      <button type="button" className="pin-apply-all" onClick={applyAll}>
        {applied ? "✓ Đã áp dụng" : `Apply scale to all ${unitCount || ""} units`}
      </button>
      <p>Scale có thể đồng bộ hàng loạt; vị trí vẫn lưu riêng cho từng căn.</p>
    </section>,
    target
  );
}
