import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./PerformanceFeedback.css";
import useStageUtilityTarget from "./useStageUtilityTarget";

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
  const connection = document.querySelector(".connection-status");

  return {
    unitCount: unitCodes.length,
    unitSignature: unitCodes.join("|"),
    connectionLoading: Boolean(connection?.classList.contains("loading")),
    connectionConnected: Boolean(
      connection?.classList.contains("connected") || connection?.classList.contains("excel")
    ),
    connectionError: Boolean(connection?.classList.contains("error")),
  };
}

export default function PerformanceFeedback() {
  const [unitCount, setUnitCount] = useState(0);
  const [seconds, setSeconds] = useState(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [runType, setRunType] = useState("sheet");
  const [measuring, setMeasuring] = useState(false);
  const [resultState, setResultState] = useState("idle");
  const utilityTarget = useStageUtilityTarget();

  const startRef = useRef(0);
  const baselineSignatureRef = useRef("");
  const previousLoadingRef = useRef(false);
  const measuringRef = useRef(false);
  const rafRef = useRef(null);

  useEffect(() => {
    function beginRun(snapshot) {
      startRef.current = performance.now();
      baselineSignatureRef.current = snapshot.unitSignature;
      measuringRef.current = true;
      setRunType("sheet");
      setSeconds(null);
      setResultState("running");
      setMeasuring(true);
      setCopied(false);
    }

    function finishRun(state) {
      if (!measuringRef.current) return;
      measuringRef.current = false;
      setSeconds(Math.max(0, (performance.now() - startRef.current) / 1000));
      setResultState(state);
      setMeasuring(false);
    }

    function inspectNow() {
      rafRef.current = null;
      const snapshot = collectSnapshot();
      setUnitCount((current) => current === snapshot.unitCount ? current : snapshot.unitCount);

      if (snapshot.connectionLoading && !previousLoadingRef.current) {
        beginRun(snapshot);
      }

      if (measuringRef.current && !snapshot.connectionLoading) {
        if (snapshot.connectionError) {
          finishRun("error");
        } else if (snapshot.connectionConnected) {
          const dataChanged = snapshot.unitSignature !== baselineSignatureRef.current;
          if (dataChanged || snapshot.unitCount > 0) finishRun("success");
        }
      }

      previousLoadingRef.current = snapshot.connectionLoading;
    }

    function scheduleInspect() {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(inspectNow);
    }

    const initial = collectSnapshot();
    setUnitCount(initial.unitCount);
    previousLoadingRef.current = initial.connectionLoading;

    const observer = new MutationObserver(scheduleInspect);
    const root = document.querySelector(".unit-sidebar") || document.body;
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  const readyLabel = measuring
    ? "Đang đo…"
    : seconds == null
      ? "Sẵn sàng"
      : `${seconds.toFixed(1)}s`;
  const runLabel = runType === "sheet" ? "Sheet" : "App";

  const feedbackText = useMemo(() => {
    const load = seconds == null ? "chưa đo" : `${seconds.toFixed(1)}s`;
    return [
      "PlotFlow performance feedback",
      "Phép đo: Connect / Refresh Sheet",
      `Kết quả: ${resultState === "error" ? "Lỗi" : resultState === "success" ? "Thành công" : "Chưa chạy"}`,
      `Thời gian: ${load}`,
      `Số căn: ${unitCount || "—"}`,
      `Trình duyệt: ${browserLabel()}`,
      `Hệ điều hành: ${platformLabel()}`,
      `Thời điểm: ${new Date().toLocaleString("vi-VN")}`,
    ].join("\n");
  }, [seconds, unitCount, resultState]);

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

  if (!utilityTarget) return null;

  return createPortal(
    <div className={`stage-utility-item performance-feedback ${expanded ? "expanded" : ""}`}>
      <button
        type="button"
        className="performance-feedback-summary"
        onClick={() => setExpanded((value) => !value)}
        title="Mỗi lần Connect/Refresh Sheet sẽ tự bắt đầu một lượt đo mới"
      >
        <span className={`performance-feedback-dot ${measuring ? "loading" : resultState === "error" ? "error" : "ready"}`} />
        <strong>{runLabel} {readyLabel}</strong>
        <small>{unitCount ? `${unitCount} căn` : "chưa có dữ liệu"}</small>
      </button>

      {expanded && (
        <div className="performance-feedback-panel">
          <div>
            <span>CONNECT / REFRESH SHEET</span>
            <strong>{readyLabel}</strong>
            <p>Timer chỉ chạy khi kết nối dữ liệu và luôn dừng khi Sheet thành công hoặc báo lỗi.</p>
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
    </div>,
    utilityTarget
  );
}
