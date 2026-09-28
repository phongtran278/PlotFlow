import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "./PriceDesignControl.css";
import {
  DEFAULT_PRICE_STYLE,
  applyPriceStyleToAll,
  readPriceStyle,
  resetAllPriceStyles,
  resetPriceStyleForUnit,
  savePriceStyleForUnit,
} from "./priceDesignSettings.js";

const NUMBER_FIELDS = [
  ["labelSize", "Label size", 7, 18, 0.5],
  ["valueSize", "Price size", 24, 64, 1],
  ["suffixSize", "Suffix size", 8, 28, 1],
  ["radius", "Corner radius", 0, 24, 1],
  ["gap", "Value gap", 0, 18, 1],
];

function sanitize(style) {
  return {
    ...DEFAULT_PRICE_STYLE,
    ...style,
    labelSize: Number(style.labelSize) || DEFAULT_PRICE_STYLE.labelSize,
    valueSize: Number(style.valueSize) || DEFAULT_PRICE_STYLE.valueSize,
    suffixSize: Number(style.suffixSize) || DEFAULT_PRICE_STYLE.suffixSize,
    labelWeight: Number(style.labelWeight) || DEFAULT_PRICE_STYLE.labelWeight,
    valueWeight: Number(style.valueWeight) || DEFAULT_PRICE_STYLE.valueWeight,
    suffixWeight: Number(style.suffixWeight) || DEFAULT_PRICE_STYLE.suffixWeight,
    radius: Number(style.radius) || 0,
    gap: Number(style.gap) || 0,
  };
}

export default function PriceDesignControl({ unit, target, isEditing = false }) {
  const [style, setStyle] = useState(() => readPriceStyle(unit?.unitCode));
  const [status, setStatus] = useState("");

  useEffect(() => {
    setStyle(readPriceStyle(unit?.unitCode));
    setStatus("");
  }, [unit?.unitCode]);

  useEffect(() => {
    const sync = () => setStyle(readPriceStyle(unit?.unitCode));
    window.addEventListener("plotflow-price-style-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("plotflow-price-style-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, [unit?.unitCode]);

  if (!target || isEditing || !unit?.unitCode) return null;

  function patch(key, value) {
    const next = sanitize({ ...style, [key]: value });
    setStyle(next);
    savePriceStyleForUnit(unit.unitCode, next);
    setStatus("Saved for this unit");
  }

  function applyAll() {
    const next = sanitize(style);
    applyPriceStyleToAll(next);
    setStyle(next);
    setStatus("Applied to all units");
  }

  function resetUnit() {
    resetPriceStyleForUnit(unit.unitCode);
    const next = readPriceStyle(unit.unitCode);
    setStyle(next);
    setStatus("Unit reset");
  }

  function resetAll() {
    resetAllPriceStyles();
    setStyle(DEFAULT_PRICE_STYLE);
    setStatus("All price styles reset");
  }

  return createPortal(
    <details className="price-design-card">
      <summary>
        <span>PRICE DESIGN</span>
        <strong>Visual controls · {unit.unitCode}</strong>
      </summary>

      <div className="price-design-intro">
        Data vẫn tự động. Phần nhìn do designer quyết định và có thể áp dụng cho toàn bộ project.
      </div>

      <div className="price-design-section">
        <span>COLORS</span>
        <div className="price-design-colors">
          {[
            ["background", "Card"],
            ["labelColor", "Label"],
            ["valueColor", "Price"],
            ["suffixColor", "Suffix"],
          ].map(([key, label]) => (
            <label key={key}><span>{label}</span><input type="color" value={style[key]} onChange={(event) => patch(key, event.target.value)} /></label>
          ))}
        </div>
      </div>

      <div className="price-design-section">
        <span>TYPE & SHAPE</span>
        <div className="price-design-fields">
          {NUMBER_FIELDS.map(([key, label, min, max, step]) => (
            <label key={key}>
              <span>{label}</span>
              <input type="number" min={min} max={max} step={step} value={style[key]} onChange={(event) => patch(key, event.target.value)} />
            </label>
          ))}
          <label><span>Label weight</span><select value={style.labelWeight} onChange={(event) => patch("labelWeight", event.target.value)}><option value="600">600</option><option value="700">700</option><option value="800">800</option><option value="850">850</option><option value="900">900</option></select></label>
          <label><span>Price weight</span><select value={style.valueWeight} onChange={(event) => patch("valueWeight", event.target.value)}><option value="600">600</option><option value="700">700</option><option value="800">800</option><option value="850">850</option><option value="900">900</option></select></label>
          <label><span>Suffix weight</span><select value={style.suffixWeight} onChange={(event) => patch("suffixWeight", event.target.value)}><option value="600">600</option><option value="700">700</option><option value="800">800</option><option value="850">850</option><option value="900">900</option></select></label>
          <label><span>Alignment</span><select value={style.align} onChange={(event) => patch("align", event.target.value)}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
        </div>
      </div>

      <div className="price-design-actions">
        <button type="button" className="primary" onClick={applyAll}>Apply to all</button>
        <button type="button" onClick={resetUnit}>Reset unit</button>
        <button type="button" onClick={resetAll}>Reset all</button>
      </div>
      <small className="price-design-status">{status || "Changes save automatically for the current unit."}</small>
    </details>,
    target
  );
}
