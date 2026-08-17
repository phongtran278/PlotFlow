import { useEffect, useMemo, useRef, useState } from "react";
import "./PerformanceFeedback.css";

const NAV_START = 0;

function elapsedSeconds() {
  return Math.max(0, (performance.now() - NAV_START) / 1000);
}

function browserLabel() {
  const ua = navigator.userAgent || "";
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  return "Browser";
}

function platformLabel() {
  const value = navigator.userAgentData?.platform || navigator.platform || "Unknown";
  if (/Win/i.test(value)) return "Windows";
  if (/Mac/i.test(value)) return "macOS";
  if (/Linux/i.test(value)) return "Linux";
  return value;
}

function collectSnapshot() {
  const unitCount = document.querySelectorAll(".unit-select").length;
  const floorplanImage = document.querySelector('.poster-floorplan img[alt="Floorplan"]');
  const floorplanReady = Boolean(
    floorplanImage
      && floorplanImage.complete
      && floorplanImage.naturalWidth > 0
      && String(floorplanImage.src || "").startsWith("data:image/")
  );

  return { unitCount, floorplanReady };
}

export default function PerformanceFeedback() {
  const [unitCount, setUnitCount] = useState(0);
  const [floorplanSeconds, setFloorplanSeconds] = useState(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const floorplanRecordedRef = useRef(false);

  useEffect(() => {
    function inspect() {
      const snapshot = collectSnapshot();
      setUnitCount(snapshot.unitCount);

      if (snapshot.floorplanReady && !floorplanRecordedRef.current) {
        floorplanRecordedRef.current = true;
        setFloorplanSeconds(elapsedSeconds());
      }
    }

    inspect();
    const observer = new MutationObserver(inspect);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "class"],
    });

    const timer = window.setInterval(inspect, 400);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);

  const readyLabel = floorplanSeconds == null ? "Đang tải…" : `${floorplanSeconds.toFixed(1)}s`;
  const feedbackText = useMemo(() => {
    const load = floorplanSeconds == null ? "chưa sẵn sàng" : `${floorplanSeconds.toFixed(1)}s`;
    return [
      "PlotFlow performance feedback",
      `Thời gian sẵn sàng: ${load}`,
      `Số căn: ${unitCount || "—"}`,
      `Trình duyệt: ${browserLabel()}`,
      `Hệ điều hành: ${platformLabel()}`,
      `Thời điểm: ${new Date().toLocaleString("vi-VN")}`,
    ].join("\n");
  }, [floorplanSeconds, unitCount]);

  async function copyFeedback() {
    try {
      await navigator.clipboard.writeText(feedbackText);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = feedbackText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className={`performance-feedback ${expanded ? "expanded" : ""}`}>
      <button
        type="button"
        className="performance-feedback-summary"
        onClick={() => setExpanded((value) => !value)}
        title="Đo từ lúc trang bắt đầu mở đến khi mặt bằng PDF của căn đang xem đã hiện"
      >
        <span className={`performance-feedback-dot ${floorplanSeconds == null ? "loading" : "ready"}`} />
        <strong>Ready {readyLabel}</strong>
        <small>{unitCount ? `${unitCount} căn` : "đang đọc dữ liệu"}</small>
      </button>

      {expanded && (
        <div className="performance-feedback-panel">
          <div>
            <span>THỜI GIAN SẴN SÀNG</span>
            <strong>{readyLabel}</strong>
            <p>Tính tới lúc mặt bằng PDF của căn đang xem đã xuất hiện.</p>
          </div>
          <div className="performance-feedback-meta">
            <span>{unitCount || "—"} căn</span>
            <span>{browserLabel()}</span>
            <span>{platformLabel()}</span>
          </div>
          <button type="button" onClick={copyFeedback} disabled={floorplanSeconds == null}>
            {copied ? "✓ Đã copy" : "Copy feedback"}
          </button>
        </div>
      )}
    </div>
  );
}
