import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { houseCatalog } from "../data/assetCatalog.js";
import { architectureExportRows, resolveArchitectureHouseAsset, resolveArchitectureMatch } from "../data/architectureAutoMatch.js";
import "./ArchitectureAutoMatchCard.css";

function percent(value) {
  return `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`;
}

function downloadPilotWorkbook() {
  const rows = architectureExportRows(houseCatalog);
  const sheet = XLSX.utils.json_to_sheet(rows, {
    header: [
      "unitCode",
      "architectureCode",
      "architectureLabel",
      "expectedAssetKey",
      "houseModel",
      "houseAssetStatus",
      "architectureSource",
      "architectureConfidence",
    ],
  });
  sheet["!cols"] = [
    { wch: 14 },
    { wch: 18 },
    { wch: 42 },
    { wch: 28 },
    { wch: 30 },
    { wch: 20 },
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
  const house = resolveArchitectureHouseAsset(unit, houseCatalog);
  const isManual = match.source === "MANUAL";
  const isAuto = match.source === "AUTO";
  const hasHouse = house.assetStatus === "FOUND";

  return createPortal(
    <section className={`architecture-auto-card ${isManual ? "is-manual" : isAuto ? "is-auto" : "is-empty"}`}>
      <div className="architecture-auto-head">
        <div>
          <span>ARCHITECTURE</span>
          <strong>{match.architectureCode || "NO MATCH"}</strong>
        </div>
        <em>{isManual ? "MANUAL" : isAuto ? `AUTO ${percent(match.confidence)}` : "—"}</em>
      </div>

      <div className="architecture-auto-label">{match.architectureLabel || "Chưa xác định kiến trúc"}</div>

      {match.source !== "NONE" && (
        <div className={`architecture-house-status ${hasHouse ? "found" : "missing"}`}>
          <span>{hasHouse ? "✓ HOUSE ASSET" : "⚠ MISSING ASSET"}</span>
          <strong>{hasHouse ? house.asset.id : (house.suggestedHouseModel || house.expectedAssetKey || match.architectureCode)}</strong>
        </div>
      )}

      <div className="architecture-auto-note">
        {hasHouse
          ? `Đã map đúng ${house.asset.id}.`
          : match.source !== "NONE"
            ? `Thiếu đúng asset ${house.suggestedHouseModel || house.expectedAssetKey}. Bổ sung file theo key này, PlotFlow sẽ tự nhận.`
            : "Chưa có mapping cho mã căn này."}
      </div>

      <button type="button" className="architecture-export-button" onClick={downloadPilotWorkbook}>
        ↓ Export data đã auto fill
      </button>
    </section>,
    target
  );
}
