import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/plotflow-tokens.css";
import "./components/CommercialShell.css";
import "./components/WorkspaceReturn.css";
import "./product/overviewV2Migration.js";
import "./product/DetailHomeLanguage.css";
import "./product/DetailExperience.css";
import "./styles/buttonToneRefinement.css";
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
import OverviewZoomRuntime from "./product/OverviewZoomRuntime.jsx";
import OverviewPdfRuntime from "./product/OverviewPdfRuntime.jsx";
import OverviewExportRuntime from "./product/OverviewExportRuntime.jsx";
import OverviewAnchorRuntime from "./product/OverviewAnchorRuntime.jsx";
import OverviewLiveUnitsRuntime from "./product/OverviewLiveUnitsRuntime.jsx";
import OverviewDetailLocatorBridge from "./product/OverviewDetailLocatorBridge.jsx";
import OverviewControlRailRuntime from "./product/OverviewControlRailRuntime.jsx";
import OverviewV2Runtime from "./product/OverviewV2Runtime.jsx";
import OverviewSellDataRuntime from "./product/OverviewSellDataRuntime.jsx";
import OverviewPenRuntime from "./product/OverviewPenRuntime.jsx";
import OverviewSimplifiedRuntime from "./product/OverviewSimplifiedRuntime.jsx";
import OverviewLayoutPresetRuntime from "./product/OverviewLayoutPresetRuntime.jsx";
import OverviewPrecisionArrangeRuntime from "./product/OverviewPrecisionArrangeRuntime.jsx";
import OverviewGuideRuntime from "./product/OverviewGuideRuntime.jsx";
import OverviewLayoutGuardRuntime from "./product/OverviewLayoutGuardRuntime.jsx";
import OverviewArrangeModesRuntime from "./product/OverviewArrangeModesRuntime.jsx";
import OverviewInteractionRuntime from "./product/OverviewInteractionRuntime.jsx";
import OverviewUnitBadgeRuntime from "./product/OverviewUnitBadgeRuntime.jsx";
import { installMemoryProfile } from "./runtime/memoryProfile.js";
import { installPreviewInteractions } from "./previewInteractions.js";

window.__PLOTFLOW_BUILD__ = __PLOTFLOW_BUILD_COMMIT__;
document.documentElement.dataset.plotflowBuild = __PLOTFLOW_BUILD_COMMIT__;
console.info(`[PlotFlow] build ${__PLOTFLOW_BUILD_COMMIT__}`);

installMemoryProfile();

window.__plotflowPreviewInteractionsCleanup?.();
window.__plotflowPreviewInteractionsCleanup = installPreviewInteractions();
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.__plotflowPreviewInteractionsCleanup?.();
    window.__plotflowPreviewInteractionsCleanup = null;
  });
}

function PlotFlowExperience() {
  const [view, setView] = useState("home");

  if (view === "home") {
    return <HomeLanding onOpenProject={() => setView("workspace")} />;
  }

  return (
    <ProductShell onExitWorkspace={() => setView("home")}>
      <OverviewSellDataRuntime />
      <App />
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
      <OverviewZoomRuntime />
      <OverviewPdfRuntime />
      <OverviewExportRuntime />
      <OverviewAnchorRuntime />
      <OverviewLiveUnitsRuntime />
      <OverviewDetailLocatorBridge />
      <OverviewControlRailRuntime />
      <OverviewV2Runtime />
      <OverviewPenRuntime />
      <OverviewSimplifiedRuntime />
      <OverviewLayoutPresetRuntime />
      <OverviewPrecisionArrangeRuntime />
      <OverviewGuideRuntime />
      <OverviewLayoutGuardRuntime />
      <OverviewArrangeModesRuntime />
      <OverviewInteractionRuntime />
      <OverviewUnitBadgeRuntime />
    </ProductShell>
  );
}

createRoot(document.getElementById("root")).render(
  <AuthGate>
    <PlotFlowExperience />
  </AuthGate>
);