import { useEffect, useMemo, useRef, useState } from "react";
import "./PerformanceFeedback.css";

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
  const unitButtons = Array.from(document.querySelectorAll(".unit-select"));
  const unitCodes = unitButtons
    .map((button) => button.querySelector(".unit-main strong")?.textContent?.trim() || "")
    .filter(Boolean);
  const floorplanImage = document.querySelector('.poster-floorplan img[alt="Floorplan"]');
  const floorplanReady = Boolean(
    floorplanImage
      && floorplanImage.complete
      && floorplanImage.naturalWidth > 0
      && String(floorplanImage.src || "").startsWith("data:image/")
  );
  const connection = document.querySelector(".connection-status");
  const connectionLoading = Boolean(connection?.classList.contains("loading"));
  const connectionConnected = Boolean(
    connection?.classList.contains("connected") || connection?.classList.contains("excel")
  );

  return {
    unitCount: unitCodes.length,
    unitSignature: unitCodes.join("|"),
    floorplanReady,
    connectionLoading,
    connectionConnected,
  };
}

export default function PerformanceFeedback() {
  const [unitCount, setUnitCount] = useState(0);
  const [seconds, setSeconds] = useState(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [runType, setRunType] = useState("app");
  const [measuring, setMeasuring] = useState(true);
  const startRef = useRef(0);
  const previousLoadingRef = useRef(false);
  const baselineSignatureRef = useRef("");
  const sawUnitChangeRef = useRef(false);
  const sawFloorplanMissingRef = useRef(false);

  useEffect(() => {
    function beginRun(type, snapshot) {
      startRef.current = performance.now();
      baselineSignatureRef.current = snapshot.unitSignature;
      sawUnitChangeRef.current = false;
      sawFloorplanMissingRef.current = !snapshot.floorplanReady;
      setRunType(type);
      setSeconds(null);
      setMeasuring(true);
      setCopied(false);
    }

    function finishRun() {
      setSeconds(Math.max(0, (performance.now() - startRef.current) / 1000));
      setMeasuring(false);
    }

    function inspect() {
      const snapshot = collectSnapshot();
      setUnitCount(snapshot.unitCount);

      if (snapshot.connectionLoading && !previousLoadingRef.current) {
        beginRun("sheet", snapshot);
      }
      previousLoadingRef.current = snapshot.connectionLoading;

      if (snapshot.unitSignature !== baselineSignatureRef.current) {
        sawUnitChangeRef.current = true;
      }
      if (!snapshot.floorplanReady) {
        sawFloorplanMissingRef.current = true;
      }

      if (!snapshot.floorplanReady) return;

      if (runType === "app") {
        if (measuring) finishRun();
        return;
      }

      if (!measuring || snapshot.connectionLoading || !snapshot.connectionConnected) return;

      const elapsedMs = performance.now() - startRef.current;
      const newContentObserved = sawUnitChangeRef.current || sawFloorplanMissingRef.current;

      // A new Sheet normally replaces the selected unit/floorplan before the new
      // PDF crop appears. On Refresh, an already usable cached floorplan can stay
      // visible; in that case it counts as ready once the refreshed Sheet data is
      // connected again, with a small guard against the same loading frame.
      if (newContentObserved || elapsedMs >= 500) finishRun();
    }

    const initial = collectSnapshot();
    startRef.current = 0;
    baselineSignatureRef.current = initial.unitSignature;
    previousLoadingRef.current = initial.connectionLoading;
    inspect();

    const observer = new MutationObserver(inspect);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "class"],
    });

    const timer = window.setInterval(inspect, 250);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [measuring, runType]);

  const readyLabel = measuring || seconds == null ? "Đang đo…" : `${seconds.toFixed(1)}s`;
  const runLabel = runType === "sheet" ? "Sheet Ready" : "App Ready";
  const feedbackText = useMemo(() => {
    const load = seconds == null ? "chưa sẵn sàng" : `${seconds.toFixed(1)}s`;
    return [
      "PlotFlow performance feedback",
      `Phép đo: ${runType === "sheet" ? "Connect / Refresh Sheet" : "Mở app"}`,
      `Thời gian sẵn sàng: ${load}`,
      `Số căn: ${unitCount || "—"}`,
      `Trình duyệt: ${browserLabel()}`,
      `Hệ điều hành: ${platformLabel()}`,
      `Thời điểm: ${new Date().toLocaleString("vi-VN")}`,
    ].join("\n");
  }, [seconds, unitCount, runType]);

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
        title="Mỗi lần Connect/Refresh Sheet sẽ tự bắt đầu một lượt đo mới"
      >
        <span className={`performance-feedback-dot ${measuring ? "loading" : "ready"}`} />
        <strong>{runLabel} {readyLabel}</strong>
        <small>{unitCount ? `${unitCount} căn` : "đang đọc dữ liệu"}</small>
      </button>

      {expanded && (
        <div className="performance-feedback-panel">
          <div>
            <span>{runType === "sheet" ? "CONNECT / REFRESH SHEET" : "MỞ APP"}</span>
            <strong>{readyLabel}</strong>
            <p>
              {runType === "sheet"
                ? "Tự reset mỗi lần Connect/Refresh và dừng khi dữ liệu mới đã kết nối, mặt bằng căn đang xem đã dùng được."
                : "Tính từ lúc mở trang tới khi mặt bằng PDF đầu tiên đã dùng được."}
            </p>
          </div>
          <div className="performance-feedback-meta">
            <span>{unitCount || "—"} căn</span>
            <span>{browserLabel()}</span>
            <span>{platformLabel()}</span>
          </div>
          <button type="button" onClick={copyFeedback} disabled={measuring || seconds == null}>
            {copied ? "✓ Đã copy" : "Copy feedback"}
          </button>
        </div>
      )}
    </div>
  );
}
