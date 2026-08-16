import "./SalesPolicyBar.css";

const POLICY_BY_HANDOVER = {
  THO: {
    loanMonths: 30,
    loanOptions: [
      { months: 18, discount: "8%" },
      { months: 24, discount: "4%" },
    ],
    earlyPayment: "18%",
    vinclub: "0.5%",
    giftValue: "20",
    giftUnit: "TRIỆU",
  },
  GIAN_XAY: {
    loanMonths: 30,
    loanOptions: [
      { months: 18, discount: "8%" },
      { months: 24, discount: "4%" },
    ],
    earlyPayment: "18%",
    vinclub: "0.5%",
    giftValue: "20",
    giftUnit: "TRIỆU",
  },
  HOAN_THIEN: {
    loanMonths: 36,
    loanOptions: [
      { months: 24, discount: "12%" },
      { months: 18, discount: "8%" },
    ],
    earlyPayment: "22.5%",
    vinclub: "0.5%",
    giftValue: "20",
    giftUnit: "TRIỆU",
  },
};

function normalizeHandover(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/Đ/g, "D")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function resolveSalesPolicy(handover) {
  const key = normalizeHandover(handover);
  if (key.includes("HOAN_THIEN")) return { key: "HOAN_THIEN", ...POLICY_BY_HANDOVER.HOAN_THIEN };
  if (key.includes("GIAN_XAY") || key.includes("GIANXAY")) return { key: "GIAN_XAY", ...POLICY_BY_HANDOVER.GIAN_XAY };
  if (key === "THO" || key.includes("BAN_GIAO_THO") || key.includes("TCBG_THO")) return { key: "THO", ...POLICY_BY_HANDOVER.THO };
  return null;
}

function LoanOption({ item }) {
  return (
    <div className="sales-policy-loan-option">
      <span>{item.months} THÁNG</span>
      <div className="sales-policy-discount">
        <small>CHIẾT<br />KHẤU</small>
        <strong>{item.discount.replace("%", "")}</strong>
        <b>%</b>
      </div>
    </div>
  );
}

function BigMetric({ title, value, prefix = "CHIẾT KHẤU", unit = "%" }) {
  const numeric = String(value).replace("%", "");
  return (
    <div className="sales-policy-card sales-policy-metric-card">
      <div className="sales-policy-cap">{title}</div>
      <div className="sales-policy-big-metric">
        <small>{prefix}</small>
        <strong>{numeric}</strong>
        <b>{unit}</b>
      </div>
    </div>
  );
}

export default function SalesPolicyBar({ handover }) {
  const policy = resolveSalesPolicy(handover);
  if (!policy) return null;

  return (
    <section className={`sales-policy-bar policy-${policy.key.toLowerCase()}`} aria-label={`Chính sách bán hàng ${handover || ""}`}>
      <div className="sales-policy-card sales-policy-loan-card">
        <div className="sales-policy-cap">HỖ TRỢ VAY 70% LÊN TỚI {policy.loanMonths} THÁNG</div>
        <div className="sales-policy-loan-grid">
          {policy.loanOptions.map((item) => <LoanOption key={`${item.months}-${item.discount}`} item={item} />)}
        </div>
      </div>

      <BigMetric title="THANH TOÁN SỚM" value={policy.earlyPayment} />
      <BigMetric title="ƯU ĐÃI VINCLUB" value={policy.vinclub} prefix="LÊN TỚI" />

      <div className="sales-policy-card sales-policy-gift-card">
        <div className="sales-policy-cap sales-policy-cap-gift">
          <span>GÓI QUÀ TẶNG AQUAFIELD</span>
          <small>(500 SUẤT)</small>
        </div>
        <div className="sales-policy-gift-value">
          <strong>{policy.giftValue}</strong>
          <b>{policy.giftUnit}</b>
        </div>
      </div>
    </section>
  );
}
