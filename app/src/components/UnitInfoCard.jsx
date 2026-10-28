import { useEffect, useState } from "react";
import { readPriceStyle } from "./priceDesignSettings.js";

function sourceText(value) {
  if (value === undefined || value === null) return "—";
  const text = String(value).replace(/\u200B/g, "").trim();
  if (!text) return "—";
  return text.replace(/,/g, ".");
}

function show(value, suffix = "") {
  const text = sourceText(value);
  return text === "—" ? text : `${text}${suffix}`;
}

export function formatPriceBillions(value) {
  if (value === undefined || value === null) return "—";
  const raw = String(value).replace(/\u200B/g, "").trim();
  if (!raw) return "—";

  const compact = raw
    .replace(/\s+/g, "")
    .replace(/(?:VND|VNĐ|Đ|₫|TỶ|TY)/gi, "");

  const groupedVnd = /^\d{1,3}(?:[.,]\d{3}){2,}$/.test(compact);
  const plainVnd = /^\d+$/.test(compact) && compact.length >= 7;

  if (groupedVnd || plainVnd) {
    const digits = compact.replace(/[^\d]/g, "");
    try {
      const amount = BigInt(digits);
      const billions = amount / 1000000000n;
      const thousandths = (amount % 1000000000n) / 1000000n;
      return `${billions}.${String(thousandths).padStart(3, "0")}`;
    } catch {
      return "—";
    }
  }

  const decimal = compact.replace(",", ".");
  const match = decimal.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) return "—";

  const integer = match[1].replace(/^0+(?=\d)/, "") || "0";
  const fraction = String(match[2] || "").padEnd(3, "0").slice(0, 3);
  return `${integer}.${fraction}`;
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase();
}

export function canonicalUnitType(value) {
  const raw = sourceText(value);
  if (raw === "—") return raw;
  const normalized = normalizeText(raw).replace(/[^A-Z0-9]/g, "");
  if (["K", "LK", "LIENKE"].includes(normalized)) return "LIỀN KỀ";
  if (["SL", "SONGLAP"].includes(normalized)) return "SONG LẬP";
  if (["DL", "DONLAP"].includes(normalized)) return "ĐƠN LẬP";
  return raw.toLocaleUpperCase("vi-VN");
}

export function composeArchitectureLabel(typeValue, labelValue) {
  const type = canonicalUnitType(typeValue);
  const raw = sourceText(labelValue);
  if (raw === "—") return type;
  const canonicalType = type === "—" ? "" : type;
  const typeNorm = normalizeText(canonicalType).replace(/[^A-Z0-9]/g, "");
  const aliases = new Set([typeNorm]);
  if (canonicalType === "LIỀN KỀ") ["K","LK","LIENKE"].forEach((x) => aliases.add(x));
  if (canonicalType === "SONG LẬP") ["SL","SONGLAP"].forEach((x) => aliases.add(x));
  if (canonicalType === "ĐƠN LẬP") ["DL","DONLAP"].forEach((x) => aliases.add(x));

  const parts = raw.split(/\s*[-–—]\s*/).map((part) => part.trim()).filter(Boolean);
  const cleaned = parts.filter((part, index) => {
    const key = normalizeText(part).replace(/[^A-Z0-9]/g, "");
    if (!aliases.has(key)) return true;
    return index > 0 && !parts.slice(0, index).some((prev) => aliases.has(normalizeText(prev).replace(/[^A-Z0-9]/g, "")));
  });
  const unique = [];
  cleaned.forEach((part) => {
    const key = normalizeText(part).replace(/[^A-Z0-9]/g, "");
    if (!unique.some((item) => normalizeText(item).replace(/[^A-Z0-9]/g, "") === key)) unique.push(part);
  });
  return [canonicalType, ...unique].filter(Boolean).join(" — ");
}

function displayUnitType(unit) {
  const source = `${unit?.type || ""} ${unit?.sourceFeature || ""}`.trim();
  if (!source) return "—";
  const normalized = normalizeText(source);
  let base = canonicalUnitType(unit?.type);

  if (normalized.includes("SHOPHOUSE")) return `${base} - SHOPHOUSE`;
  if (normalized.includes("CAN GOC") || normalized.includes("GOC")) return `${base} - CĂN GÓC`;
  if (normalized.includes("XE KHE") || normalized.includes("XEKHE")) return `${base} - XẺ KHE`;
  return base;
}

export default function UnitInfoCard({ unit = {} }) {
  const [priceStyle, setPriceStyle] = useState(() => readPriceStyle(unit?.unitCode));

  useEffect(() => {
    const sync = () => setPriceStyle(readPriceStyle(unit?.unitCode));
    sync();
    window.addEventListener("plotflow-price-style-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("plotflow-price-style-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, [unit?.unitCode]);
  const leftSpecs = [
    { label: "LOẠI HÌNH", value: displayUnitType(unit) },
    { label: "SỐ TẦNG", value: show(unit.floors) },
    { label: "TCBG", value: show(unit.handover) },
  ];

  const rightSpecs = [
    { label: "DT ĐẤT", value: show(unit.landArea, "M²") },
    { label: "DTXD", value: show(unit.constructionArea, "M²") },
    { label: "LỘ GIỚI", value: show(unit.roadWidth, "M") },
  ];

  return (
    <section className="unit-info-card" style={{
      "--pf-price-bg": priceStyle.background,
      "--pf-price-label-color": priceStyle.labelColor,
      "--pf-price-value-color": priceStyle.valueColor,
      "--pf-price-suffix-color": priceStyle.suffixColor,
      "--pf-price-label-size": `${priceStyle.labelSize}px`,
      "--pf-price-value-size": `${priceStyle.valueSize}px`,
      "--pf-price-suffix-size": `${priceStyle.suffixSize}px`,
      "--pf-price-label-weight": priceStyle.labelWeight,
      "--pf-price-value-weight": priceStyle.valueWeight,
      "--pf-price-suffix-weight": priceStyle.suffixWeight,
      "--pf-price-radius": `${priceStyle.radius}px`,
      "--pf-price-gap": `${priceStyle.gap}px`,
      "--pf-price-align": priceStyle.align,
      "--pf-price-label-style": priceStyle.labelItalic ? "italic" : "normal",
      "--pf-price-value-style": priceStyle.valueItalic ? "italic" : "normal",
      "--pf-price-suffix-style": priceStyle.suffixItalic ? "italic" : "normal",
      "--pf-price-label-tracking": `${priceStyle.labelLetterSpacing}px`,
      "--pf-price-value-tracking": `${priceStyle.valueLetterSpacing}px`,
      "--pf-price-suffix-tracking": `${priceStyle.suffixLetterSpacing}px`,
      "--pf-price-label-line": priceStyle.labelLineHeight,
      "--pf-price-value-line": priceStyle.valueLineHeight,
      "--pf-price-suffix-line": priceStyle.suffixLineHeight,
      "--pf-price-padding-x": `${priceStyle.paddingX}px`,
      "--pf-price-padding-y": `${priceStyle.paddingY}px`,
      "--pf-price-row-gap": `${priceStyle.rowGap}px`,
      "--pf-price-min-height": `${priceStyle.minHeight}px`,
    }}>
      <div className="unit-code-box"><span className="unit-code-label">MÃ LÔ</span><strong>{sourceText(unit.unitCode)}</strong></div>

      <div className="unit-spec-tabs" aria-label="Unit specifications">
        <SpecColumn items={leftSpecs} />
        <SpecColumn items={rightSpecs} />
      </div>

      <div className="price-grid">
        <PriceBox label="GIÁ TT CHUẨN" value={unit.priceStandard} />
        <PriceBox label="GIÁ TT SỚM" value={unit.priceEarly} />
        <PriceBox label="GIÁ TT VAY 18T" value={unit.price18} />
        <PriceBox label="GIÁ TT VAY 24T" value={unit.price24} />
      </div>

      <div className="unit-note">
        *Lưu ý: Giá đã bao gồm VAT & KPBT - đã trừ chiết khấu
      </div>
    </section>
  );
}

function SpecColumn({ items }) {
  return (
    <div className="spec-tab-column">
      {items.map((item) => (
        <div className="spec-tab-row" key={item.label}>
          <span className="spec-tab-label">{item.label}</span>
          <strong className="spec-tab-value">{item.value}</strong>
        </div>
      ))}
    </div>
  );
}

function PriceBox({ label, value }) {
  const text = formatPriceBillions(value);
  return (
    <div className="price-box">
      <span className="price-label">{label}</span>
      <div className="price-value">
        <strong>{text}</strong>
        {text !== "—" && <span>tỷ</span>}
      </div>
    </div>
  );
}
