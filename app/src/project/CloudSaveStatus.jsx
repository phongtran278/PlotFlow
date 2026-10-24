import { useEffect, useState } from "react";

const messages = {
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
    detail: "PlotFlow sẽ không tự ghi dữ liệu từ máy này lên dự án staging trống.",
  },
};

export default function CloudSaveStatus() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    const handler = (event) => {
      if (event.detail?.transport !== "state-api") return;
      setStatus(event.detail?.status || null);
    };
    window.addEventListener("plotflow-cloud-state-status", handler);
    if (window.__plotflowCloudStateStatus?.transport === "state-api") {
      setStatus(window.__plotflowCloudStateStatus.status);
    }
    return () => window.removeEventListener("plotflow-cloud-state-status", handler);
  }, []);
  const message = messages[status];
  if (!message) return null;
  return <div role="alert" aria-live="assertive" style={{
    position: "fixed", bottom: 20, right: 20, zIndex: 2147483000,
    maxWidth: 430, padding: "16px 18px", background: "#ffffff",
    border: "2px solid #ad3838", borderRadius: 12, color: "#272727",
    boxShadow: "0 12px 34px rgba(0,0,0,.20)", fontFamily: "system-ui, sans-serif",
  }}>
    <strong style={{ display: "block", marginBottom: 8, fontSize: 16 }}>{message.title}</strong>
    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{message.detail}</span>
  </div>;
}
