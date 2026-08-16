const POLICY_IMAGE_BY_HANDOVER = {
  THO: "/assets/policy/policy-tho.png",
  GIAN_XAY: "/assets/policy/policy-gian-xay.png",
  HOAN_THIEN: "/assets/policy/policy-hoan-thien.png",
};

function normalizeHandover(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[Đđ]/g, "D")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function resolvePolicyImage(handover) {
  const key = normalizeHandover(handover);
  if (key.includes("HOAN_THIEN")) return POLICY_IMAGE_BY_HANDOVER.HOAN_THIEN;
  if (key.includes("GIAN_XAY") || key.includes("GIANXAY")) return POLICY_IMAGE_BY_HANDOVER.GIAN_XAY;
  if (key === "THO" || key.includes("BAN_GIAO_THO") || key.includes("TCBG_THO")) return POLICY_IMAGE_BY_HANDOVER.THO;
  return null;
}

export default function PolicyImageOverlay({ handover }) {
  const src = resolvePolicyImage(handover);
  if (!src) return null;

  return (
    <div
      className="plotflow-policy-frame"
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "24px",
        bottom: "24px",
        width: "1032px",
        overflow: "hidden",
        zIndex: 18,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <img
        className="plotflow-policy-image"
        src={src}
        alt=""
        draggable="false"
        style={{
          display: "block",
          width: "112%",
          height: "auto",
          maxWidth: "none",
          marginLeft: "-6%",
        }}
      />
    </div>
  );
}
