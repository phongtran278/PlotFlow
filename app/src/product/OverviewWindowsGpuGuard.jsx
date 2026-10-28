import { useEffect } from "react";

const TARGET_SELECTOR = ".pf-callout-layer,.pf-overview-coming,.pf-overview-markup-layer";

function isWindowsPlatform() {
  if (typeof navigator === "undefined") return false;
  const platform = String(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "").toLowerCase();
  return platform.includes("win");
}

function flattenTarget(node, detail) {
  if (!node) return;
  const scale = Number(detail?.scale);
  const tx = Number(detail?.tx);
  const ty = Number(detail?.ty);
  if (!Number.isFinite(scale) || !Number.isFinite(tx) || !Number.isFinite(ty)) return;

  node.style.setProperty("transform-origin", "0 0", "important");
  node.style.setProperty("transform", `translate(${tx}px, ${ty}px) scale(${scale})`, "important");
  node.style.setProperty("will-change", "auto", "important");
  node.style.setProperty("transform-style", "flat", "important");
  node.style.setProperty("backface-visibility", "visible", "important");
  node.style.setProperty("filter", "none", "important");
}

export default function OverviewWindowsGpuGuard() {
  useEffect(() => {
    if (!isWindowsPlatform()) return undefined;

    let lastCamera = { scale: 1, tx: 0, ty: 0 };
    let observer = null;

    const apply = () => {
      document.querySelectorAll(TARGET_SELECTOR).forEach((node) => flattenTarget(node, lastCamera));
    };

    const onCamera = (event) => {
      const detail = event?.detail || {};
      if (!Number.isFinite(Number(detail.scale))) return;
      lastCamera = {
        scale: Number(detail.scale),
        tx: Number(detail.tx) || 0,
        ty: Number(detail.ty) || 0,
      };
      apply();
    };

    document.documentElement.dataset.plotflowWindowsGpuGuard = "1";
    window.addEventListener("pf-overview-camera", onCamera);

    observer = new MutationObserver(() => apply());
    observer.observe(document.body, { childList: true, subtree: true });
    apply();

    window.__plotflowWindowsGpuGuard = {
      active: true,
      mode: "flatten-overview-overlays",
      transform3d: false,
      willChange: false,
    };

    return () => {
      window.removeEventListener("pf-overview-camera", onCamera);
      observer?.disconnect();
      delete document.documentElement.dataset.plotflowWindowsGpuGuard;
      delete window.__plotflowWindowsGpuGuard;
    };
  }, []);

  return null;
}
