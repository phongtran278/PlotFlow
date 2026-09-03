import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/plotflow-tokens.css";
import "./components/CommercialShell.css";
import "./components/WorkspaceReturn.css";
import "./product/overviewV2Migration.js";
import "./product/DetailHomeLanguage.css";
import "./product/DetailExperience.css";
import "./styles/buttonToneRefinement.css";
import "./styles/locatorWorkflowCleanup.css";
import App from "./App.jsx";
import HomeLanding from "./components/HomeLanding.jsx";
import UnitReviewBar from "./components/UnitReviewBar.jsx";
import PerformanceFeedback from "./components/PerformanceFeedback.jsx";
import WorkspaceController from "./components/WorkspaceController.jsx";
import WorkspaceScrollSurfaceFix from "./components/WorkspaceScrollSurfaceFix.jsx";
import ProjectSettings from "./components/ProjectSettings.jsx";
import PinScaleControl from "./components/PinScaleControl.jsx";
import AutoFloorplanSource from "./components/AutoFloorplanSource.jsx";
import MemoryGovernor from "./components/MemoryGovernor.jsx";
import LotTileRuntime from "./components/LotTileRuntime.jsx";
import AuthGate from "./auth/AuthGate.jsx";
import ProductShell from "./product/ProductShell.jsx";
import EmptyWorkspaceEnhancer from "./product/EmptyWorkspaceEnhancer.jsx";
import DetailModeRecovery from "./product/DetailModeRecovery.jsx";
import OverviewZoomRuntime from "./product/OverviewZoomRuntime.jsx";
import OverviewRasterRuntime from "./product/OverviewRasterRuntime.jsx";
import OverviewWindowsFixedBitmapRuntime from "./product/OverviewWindowsFixedBitmapRuntime.jsx";
import OverviewExportRuntime from "./product/OverviewExportRuntime.jsx";
import OverviewHeaderExportRuntime from "./product/OverviewHeaderExportRuntime.jsx";
import OverviewAnchorRuntime from "./product/OverviewAnchorRuntime.jsx";
import OverviewLiveUnitsRuntime from "./product/OverviewLiveUnitsRuntime.jsx";
import OverviewDetailLocatorBridge from "./product/OverviewDetailLocatorBridge.jsx";
import OverviewControlRailRuntime from "./product/OverviewControlRailRuntime.jsx";
import OverviewPrecisionArrangeRuntime from "./product/OverviewPrecisionArrangeRuntime.jsx";
import OverviewV2Runtime from "./product/OverviewV2Runtime.jsx";
import OverviewArrangeModesRuntime from "./product/OverviewArrangeModesRuntime.jsx";
import OverviewLayoutPresetRuntime from "./product/OverviewLayoutPresetRuntime.jsx";
import OverviewSellDataRuntime from "./product/OverviewSellDataRuntime.jsx";
import OverviewPenRuntime from "./product/OverviewPenRuntime.jsx";
import OverviewSimplifiedRuntime from "./product/OverviewSimplifiedRuntime.jsx";
import OverviewGuideRuntime from "./product/OverviewGuideRuntime.jsx";
import OverviewInteractionRuntime from "./product/OverviewInteractionRuntime.jsx";
import OverviewLayerRevealRuntime from "./product/OverviewLayerRevealRuntime.jsx";
import OverviewUnitBadgeRuntime from "./product/OverviewUnitBadgeRuntime.jsx";
import WindowsOverviewViewportRuntime from "./product/WindowsOverviewViewportRuntime.jsx";
import "./product/OverviewControlRailTwoRows.css";
import "./product/OverviewFinalPolish.css";
import { installMemoryProfile } from "./runtime/memoryProfile.js";
import { installPreviewInteractions } from "./previewInteractions.js";

window.__PLOTFLOW_BUILD__ = __PLOTFLOW_BUILD_COMMIT__;
document.documentElement.dataset.plotflowBuild = __PLOTFLOW_BUILD_COMMIT__;
console.info(`[PlotFlow] build ${__PLOTFLOW_BUILD_COMMIT__}`);

installMemoryProfile();

function isWindowsPlatform() {
  if (typeof navigator === "undefined") return false;
  const value = String(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "").toLowerCase();
  return value.includes("win");
}

function useExclusiveFloorplanEditing() {
  const [editing, setEditing] = useState(() => document.body.classList.contains("plotflow-floorplan-editing"));

  useEffect(() => {
    const sync = () => setEditing(document.body.classList.contains("plotflow-floorplan-editing"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return editing;
}

function useLotHighlightEditing() {
  const [editing, setEditing] = useState(() => document.body.classList.contains("plotflow-lot-highlight-editing"));

  useEffect(() => {
    const sync = () => setEditing(document.body.classList.contains("plotflow-lot-highlight-editing"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return editing;
}

function useOverviewActive() {
  const [active, setActive] = useState(() => document.body.classList.contains("pf-product-overview"));

  useEffect(() => {
    function onProductViewChange(event) {
      setActive(event?.detail?.screen === "project" && event?.detail?.mode === "overview");
    }

    window.addEventListener("plotflow-product-view-changed", onProductViewChange);
    return () => window.removeEventListener("plotflow-product-view-changed", onProductViewChange);
  }, []);

  return active;
}

function PreviewInteractionsRuntime({ disabled }) {
  useEffect(() => {
    window.__plotflowPreviewInteractionsCleanup?.();
    window.__plotflowPreviewInteractionsCleanup = null;
    if (disabled) return undefined;

    const cleanup = installPreviewInteractions();
    window.__plotflowPreviewInteractionsCleanup = cleanup;
    return () => {
      cleanup?.();
      if (window.__plotflowPreviewInteractionsCleanup === cleanup) {
        window.__plotflowPreviewInteractionsCleanup = null;
      }
    };
  }, [disabled]);

  return null;
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.__plotflowPreviewInteractionsCleanup?.();
    window.__plotflowPreviewInteractionsCleanup = null;
  });
}

function OverviewMasterplanEngine() {
  const [sourceKey, setSourceKey] = useState("");

  useEffect(() => {
    function sync() {
      const stage = document.querySelector('.pf-masterplan-stage[data-overview-render-mode="raster"]');
      const next = stage?.dataset?.overviewRasterSource || "";
      setSourceKey((current) => current === next ? current : next);
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-overview-render-mode", "data-overview-group", "data-overview-raster-source"],
    });
    return () => observer.disconnect();
  }, []);

  if (!sourceKey) return null;
  return isWindowsPlatform()
    ? <OverviewWindowsFixedBitmapRuntime key={`windows-fixed:${sourceKey}`} />
    : <OverviewRasterRuntime key={sourceKey} />;
}

function OverviewRuntimes() {
  return (
    <>
      <OverviewZoomRuntime />
      <WindowsOverviewViewportRuntime />
      <OverviewMasterplanEngine />
      <OverviewExportRuntime />
      <OverviewHeaderExportRuntime />
      <OverviewAnchorRuntime />
      <OverviewLiveUnitsRuntime />
      <OverviewDetailLocatorBridge />
      <OverviewControlRailRuntime />
      <OverviewPrecisionArrangeRuntime />
      <OverviewV2Runtime />
      <OverviewArrangeModesRuntime />
      <OverviewLayoutPresetRuntime />
      <OverviewPenRuntime />
      <OverviewSimplifiedRuntime />
      <OverviewGuideRuntime />
      <OverviewInteractionRuntime />
      <OverviewLayerRevealRuntime />
      <OverviewUnitBadgeRuntime />
    </>
  );
}

function WorkspaceAuxiliaryRuntimes() {
  const overviewActive = useOverviewActive();
  const lotHighlightEditing = useLotHighlightEditing();

  if (lotHighlightEditing) {
    return <MemoryGovernor />;
  }

  return (
    <>
      <OverviewSellDataRuntime />
      <AutoFloorplanSource />
      <MemoryGovernor />
      <LotTileRuntime />
      <UnitReviewBar />
      <PerformanceFeedback />
      <WorkspaceController />
      <WorkspaceScrollSurfaceFix />
      <ProjectSettings />
      <PinScaleControl />
      <EmptyWorkspaceEnhancer />
      <DetailModeRecovery />
      {overviewActive && <OverviewRuntimes />}
    </>
  );
}

function PlotFlowExperience() {
  const [view, setView] = useState("home");
  const floorplanEditing = useExclusiveFloorplanEditing();
  const lotHighlightEditing = useLotHighlightEditing();

  if (view === "home") {
    return <HomeLanding onOpenProject={() => setView("workspace")} />;
  }

  return (
    <ProductShell onExitWorkspace={() => setView("home")} exclusiveEditor={floorplanEditing}>
      <PreviewInteractionsRuntime disabled={floorplanEditing || lotHighlightEditing} />
      <App />
      {!floorplanEditing && <WorkspaceAuxiliaryRuntimes />}
    </ProductShell>
  );
}

createRoot(document.getElementById("root")).render(
  <AuthGate>
    <PlotFlowExperience />
  </AuthGate>
);
