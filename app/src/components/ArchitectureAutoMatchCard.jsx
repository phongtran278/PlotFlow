import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { architectureExportRows, resolveArchitectureMatch } from "../data/architectureAutoMatch.js";
import "./ArchitectureAutoMatchCard.css";

function percent(value) {
  return `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`;
}

function downloadPilotWorkbook() {
  const rows = architectureExportRows();
  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: [
      "unitCode",
      "architectureCode",
      "architectureLabel",
      "architectureSource",
      "architectureConfidence",
    ],
  });
  sheet["!cols"] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 42 },
    { wch: 20 },
    { wch: 24 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "ARCHITECTURE_AUTO_MATCH");
  XLSX.writeFile(workbook, "PlotFlow_Architecture_AutoMatch_14_units.xlsx");
}

export default function ArchitectureAutoMatchCard({ unit, target, isEditing = false }) {
  if (!target || isEditing || !unit) return null;
  const match = resolveArchitectureMatch(unit);
  const isManual = match.source === "MANUAL";
  const isAuto = match.source === "AUTO";

  return createPortal(
    <section className={`architecture-auto-card ${isManual ? "is-manual" : isAuto ? "is-auto" : "is-empty"}`}>
      <div className="architecture-auto-head">
        <div>
          <span>ARCHITECTURE MATCH</span>
          <strong>{match.architectureCode || "—"}</strong>
        </div>
        <em>{isManual ? "MANUAL" : isAuto ? `AUTO · ${percent(match.confidence)}` : "NO MATCH"}</em>
      </div>

      <div className="architecture-auto-label">{match.architectureLabel}</div>

      <div className="architecture-auto-note">
        {isManual
          ? "Sheet đang có architectureLabel nên giá trị thủ công được ưu tiên. Refresh data sẽ giữ override này."
          : isAuto
            ? "Sheet đang trống kiến trúc → PlotFlow tự match theo unitCode. Nếu sai, chỉ cần điền architectureLabel trong Sheet rồi Refresh Data."
            : "Mã căn này chưa nằm trong pilot mapping. Có thể bổ sung vào architecture map sau."}
      </div>

      <button type="button" className="architecture-export-button" onClick={downloadPilotWorkbook}>
        ↓ Export Auto-Match Excel · 14 căn
      </button>
    </section>,
    target
  );
}
