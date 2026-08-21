import { createRoot } from "react-dom/client";
import "./index.css";
import "./components/CommercialShell.css";
import App from "./App.jsx";
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
import OverviewControlRailRuntime from "./product/OverviewControlRailRuntime.jsx";
import "./product/OverviewCallouts.css";
import "./components/ToolbarConsistency.css";
import "./components/AuroraTheme.css";
import "./product/PremiumProductPolish.css";
import "./product/PremiumAuthPolish.css";
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

createRoot(document.getElementById("root")).render(
  <AuthGate>
    <ProductShell>
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
      <OverviewControlRailRuntime />
    </ProductShell>
  </AuthGate>
);
