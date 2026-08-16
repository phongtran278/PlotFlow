function show(value, suffix = "") {
  if (value === undefined || value === null || String(value).trim() === "") return "—";
  return `${String(value).trim()}${suffix}`;
}

function formatPrice(value) {
  if (value === undefined || value === null || String(value).trim() === "") return "—";
  const raw = String(value).trim();
  let normalized = raw;
  if (raw.includes(",") && raw.includes(".")) normalized = raw.replace(/,/g, "");
  else if (raw.includes(",") && !raw.includes(".")) normalized = raw.replace(",", ".");
  let number = Number(normalized);
  if (!Number.isFinite(number)) return "—";
  if (Math.abs(number) >= 1000000) number /= 1000000000;
  const truncated = Math.trunc((number + Number.EPSILON) * 1000) / 1000;
  return truncated.toFixed(3);
}

export default function UnitInfoCard({ unit }) {
  const leftSpecs = [
    { label: "KIẾN TRÚC", value: show(unit.architectureLabel || unit.type) },
    { label: "SỐ TẦNG", value: show(unit.floors) },
    { label: "TCBG", value: show(unit.handover) },
  ];

  const rightSpecs = [
    { label: "DT ĐẤT", value: show(unit.landArea, "M²") },
    { label: "DTXD", value: show(unit.constructionArea, "M²") },
    { label: "LỘ GIỚI", value: show(unit.roadWidth, "M") },
  ];

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
        <PriceBox
          label={`GIÁ HTLS 70% - ${unit.price36 !== undefined && unit.price36 !== "" ? "36TH" : "30TH"}`}
          value={unit.price36 !== undefined && unit.price36 !== "" ? unit.price36 : unit.price30}
        />
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
        <strong>{formatPrice(value)}</strong>
        <span>tỷ</span>
      </div>
    </div>
  );
}
