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

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .toUpperCase();
}

function displayUnitType(unit) {
  const source = `${unit?.type || ""} ${unit?.sourceFeature || ""}`;
  const normalized = normalizeText(source);
  let base = "LIỀN KỀ";
  if (normalized.includes("SONG LAP")) base = "SONG LẬP";
  else if (normalized.includes("DON LAP")) base = "ĐƠN LẬP";

  // These are selling/property variants, so they belong with the lot/unit info.
  if (normalized.includes("SHOPHOUSE")) return `${base} - SHOPHOUSE`;
  if (normalized.includes("CAN GOC") || normalized.includes("GOC")) return `${base} - CĂN GÓC`;
  if (normalized.includes("XE KHE") || normalized.includes("XEKHE")) return `${base} - XẺ KHE`;
  return base;
}

export default function UnitInfoCard({ unit }) {
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

  const has36 = unit.price36 !== undefined && unit.price36 !== null && String(unit.price36).trim() !== "";

  return (
    <section className="unit-info-card">
      <div className="unit-code-box">{unit.unitCode}</div>

      <div className="unit-spec-tabs" aria-label="Unit specifications">
        <SpecColumn items={leftSpecs} />
        <SpecColumn items={rightSpecs} />
      </div>

      <div className="price-grid">
        <PriceBox label="GIÁ THANH TOÁN SỚM" value={unit.priceEarly} />
        <PriceBox label="GIÁ HTLS 70% - 18TH" value={unit.price18} />
        <PriceBox label="GIÁ HTLS 70% - 24TH" value={unit.price24} />
        <PriceBox label={`GIÁ HTLS 70% - ${has36 ? "36TH" : "30TH"}`} value={has36 ? unit.price36 : unit.price30} />
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
  return (
    <div className="price-box">
      <span className="price-label">{label}</span>
      <div className="price-value">
        <strong>{sourceText(value)}</strong>
        <span>tỷ</span>
      </div>
    </div>
  );
}
