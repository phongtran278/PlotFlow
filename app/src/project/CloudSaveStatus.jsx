import { useEffect, useRef, useState } from "react";
import { getCloudConflictReview, resetStagingLocalConflict } from "./CloudProjectState.js";

const messages = {
  saved: { title: "Đã lưu lên staging", detail: "State API đã xác nhận ghi dữ liệu và phiên bản mới." },
  version_conflict: {
    title: "Có thay đổi từ phiên làm việc khác",
    detail: "Thay đổi trong cửa sổ này CHƯA được lưu. PlotFlow đã dừng tự động lưu để tránh ghi đè dữ liệu mới. Giữ nguyên cửa sổ và kiểm tra thay đổi trước khi tải lại.",
  },
  save_error: {
    title: "Không lưu được dữ liệu",
    detail: "Đã dừng tự động lưu. Giữ nguyên cửa sổ để bảo toàn chỉnh sửa và kiểm tra kết nối.",
  },
  missing_write_version: {
    title: "Không xác minh được phiên bản sau khi lưu",
    detail: "Đã dừng tự động lưu để tránh ghi đè. Kiểm tra kết nối trước khi tiếp tục.",
  },
  load_error: {
    title: "Không tải được dữ liệu từ máy chủ",
    detail: "Chế độ lưu cloud đang tạm dừng. Đừng xem thay đổi tại đây là đã đồng bộ.",
  },
  manual_migration_required: {
    title: "Dữ liệu cục bộ chưa được đồng bộ",
    detail: "Dữ liệu cục bộ khác bản trên máy chủ. PlotFlow giữ nguyên bản cục bộ và dừng lưu cloud. Hãy sao lưu chỉnh sửa trước khi đặt lại cache staging.",
  },
};

const loadDiagnostics = {
  transport_config: "Cấu hình kết nối staging chưa hợp lệ.",
  authentication_required: "Phiên đăng nhập State API chưa được xác thực (401).",
  access_denied: "Tài khoản hoặc nguồn truy cập chưa được cấp quyền (403).",
  endpoint_not_found: "Không tìm thấy endpoint State API (404).",
  storage_unavailable: "State API không đọc được dữ liệu lưu trữ (502).",
  service_unavailable: "State API hoặc cấu hình xác thực chưa sẵn sàng (503).",
  network_or_access: "Trình duyệt không kết nối được State API; cần kiểm tra mạng, CORS hoặc Cloudflare Access.",
  timeout: "State API phản hồi quá thời gian chờ.",
  invalid_snapshot: "Phản hồi dữ liệu không đúng định dạng dự án.",
  missing_read_version: "Phản hồi thiếu phiên bản ETag hợp lệ.",
  http_error: "State API trả về lỗi HTTP.",
  unknown: "Chưa xác định được nguyên nhân.",
};

export default function CloudSaveStatus() {
  const [state, setState] = useState(null);
  const [review, setReview] = useState(null);
  const [backupMessage, setBackupMessage] = useState("");
  const backedUpLocal = useRef(null);
  const status = state?.status;
  const diagnostic = status === "load_error" ? loadDiagnostics[state?.diagnostic] : null;
  useEffect(() => {
    const handler = (event) => {
      if (event.detail?.transport !== "state-api") return;
      setState(event.detail || null);
    };
    window.addEventListener("plotflow-cloud-state-status", handler);
    if (window.__plotflowCloudStateStatus?.transport === "state-api") {
      setState(window.__plotflowCloudStateStatus);
    }
    return () => window.removeEventListener("plotflow-cloud-state-status", handler);
  }, []);
  function downloadConflictBackup() {
    backedUpLocal.current = null;
    setReview(null);
    try {
      const snapshot = getCloudConflictReview();
      if (!snapshot) { setBackupMessage("Chưa có bản cloud đã xác minh để đối chiếu."); return; }
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "plotflow-staging-conflict-" + snapshot.capturedAt.replace(/[:.]/g, "-") + ".json";
      document.body.appendChild(a);
      try { a.click(); } finally { a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 30000); }
      // Hold the local snapshot only in memory to reject changes since backup.
      backedUpLocal.current = snapshot.local.storage;
      setReview(snapshot.comparison);
      setBackupMessage("Đã yêu cầu tải file sao lưu. Kiểm tra thư mục Downloads trước khi thao tác tiếp. File chứa dữ liệu dự án riêng tư; không gửi file lên chat.");
    } catch {
      setBackupMessage("Không tạo được bản sao lưu. Giữ nguyên dữ liệu và thử lại.");
    }
  }
  function resetLocal() {
    if (!backedUpLocal.current) return;
    if (!window.confirm("Bạn đã kiểm tra file JSON trong Downloads chưa? Thao tác này xóa dữ liệu thiết lập cục bộ của dự án Vinhomes Saigon Park trên Staging, giữ nguyên Azure và tải lại dữ liệu cloud. Chỉ tiếp tục nếu đã có bản sao lưu và đã đóng các tab PlotFlow Staging khác.")) return;
    try {
      const result = resetStagingLocalConflict(backedUpLocal.current);
      if (result === "reset") {
        backedUpLocal.current = null;
        window.location.reload();
      } else {
        backedUpLocal.current = null;
        setReview(null);
        setBackupMessage(result === "backup_stale" ? "Dữ liệu cục bộ đã thay đổi sau khi sao lưu. Hãy sao lưu lại." : "Chưa thể reset an toàn. Giữ file sao lưu, không xóa thủ công.");
      }
    } catch {
      backedUpLocal.current = null;
      setReview(null);
      setBackupMessage("Không thể kiểm tra dữ liệu cục bộ. Giữ nguyên file sao lưu.");
    }
  }
  const message = messages[status];
  if (!message) return null;
  return <div role={status === "saved" ? "status" : "alert"} aria-live={status === "saved" ? "polite" : "assertive"} style={{
    position: "fixed", bottom: 20, right: 20, zIndex: 2147483000,
    maxWidth: 430, padding: "16px 18px", background: "#ffffff",
    border: status === "saved" ? "2px solid #16803d" : "2px solid #ad3838", borderRadius: 12, color: "#272727",
    boxShadow: "0 12px 34px rgba(0,0,0,.20)", fontFamily: "system-ui, sans-serif",
  }}>
    <strong style={{ display: "block", marginBottom: 8, fontSize: 16 }}>{message.title}</strong>
    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{message.detail}</span>
    {diagnostic && <p style={{ margin: "8px 0 0", fontSize: 12, lineHeight: 1.5 }}>{diagnostic}</p>}
    {status === "manual_migration_required" && <>
      <button type="button" onClick={downloadConflictBackup} style={{ display: "block", marginTop: 12, padding: "9px 12px", border: "1px solid #666", borderRadius: 6, cursor: "pointer", background: "#fff", color: "#272727" }}>Sao lưu và đối chiếu</button>
      {backupMessage && <p role="status" style={{ fontSize: 12, lineHeight: 1.5 }}>{backupMessage}</p>}
      {review && <div style={{ fontSize: 12, lineHeight: 1.5 }}>
        <p>{review.filter(item => item.status === "same").length} giống nhau · {review.filter(item => item.status === "different").length} khác nhau · {review.filter(item => item.status === "local_only").length} chỉ cục bộ · {review.filter(item => item.status === "remote_only").length} chỉ cloud</p>
        <ul style={{ maxHeight: 120, overflowY: "auto", overflowWrap: "anywhere", paddingLeft: 18 }}>
          {review.filter(item => item.status !== "same").map(item => <li key={item.key}>{item.key}: {({ different: "Khác nhau", local_only: "Chỉ cục bộ", remote_only: "Chỉ cloud" })[item.status]}</li>)}
        </ul>
        <span>Cloud: bản đọc thành công lúc khởi động trang. Không có dữ liệu nào được ghi hoặc xóa.</span>
        <button type="button" onClick={resetLocal} style={{ display: "block", marginTop: 12, padding: "9px 12px", border: "1px solid #ad3838", borderRadius: 6, cursor: "pointer", background: "#fff", color: "#943030" }}>Reset local và tải lại từ cloud</button>
      </div>}
    </>}
  </div>;
}
