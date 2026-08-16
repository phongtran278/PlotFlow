export default function UnitInfoCard({ unit }) {
  return (
    <section className="unit-info-card">
      <div className="unit-code-box">
        {unit.unitCode}
      </div>

      <div className="unit-specs">
        <Spec label="LOẠI HÌNH" value={unit.type} />
        <Spec label="DT ĐẤT" value={`${unit.landArea}M²`} />

        <Spec label="SỐ TẦNG" value={unit.floors} />
        <Spec
          label="DTXD"
          value={`${unit.constructionArea}M²`}
        />

        <Spec label="TCBG" value={unit.handover} />
        <Spec
          label="LỘ GIỚI"
          value={`${unit.roadWidth}M`}
        />
      </div>

      <div className="price-grid">
        <PriceBox
          label="GIÁ THANH TOÁN SỚM"
          value={unit.priceEarly}
        />

        <PriceBox
          label="GIÁ HTLS 70% - 18TH"
          value={unit.price18}
        />

        <PriceBox
          label="GIÁ HTLS 70% - 24TH"
          value={unit.price24}
        />

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

function Spec({ label, value }) {
  return (
    <div className="spec-row">
      <span>{label}:</span>
      <strong>{value}</strong>
    </div>
  );
}

function PriceBox({ label, value }) {
  const number = Number(value);

  return (
    <div className="price-box">
      <span className="price-label">
        {label}
      </span>

      <div className="price-value">
        <strong>
          {Number.isFinite(number)
            ? number.toFixed(3)
            : "—"}
        </strong>

        <span>tỷ</span>
      </div>
    </div>
  );
}
