import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import UnitReviewBar from "./components/UnitReviewBar.jsx";
import PerformanceFeedback from "./components/PerformanceFeedback.jsx";
import WorkspaceController from "./components/WorkspaceController.jsx";
import WorkspaceScrollSurfaceFix from "./components/WorkspaceScrollSurfaceFix.jsx";
import SharedProjectStatus from "./components/SharedProjectStatus.jsx";
import PinScaleControl from "./components/PinScaleControl.jsx";
import AutoFloorplanSource from "./components/AutoFloorplanSource.jsx";
import MemoryGovernor from "./components/MemoryGovernor.jsx";
import LotTileRuntime from "./components/LotTileRuntime.jsx";
import { installMemoryProfile } from "./runtime/memoryProfile.js";
import { installPreviewInteractions } from "./previewInteractions.js";

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
  <>
    <App />
    <AutoFloorplanSource />
    <MemoryGovernor />
    <LotTileRuntime />
    <UnitReviewBar />
    <PerformanceFeedback />
    <WorkspaceController />
    <WorkspaceScrollSurfaceFix />
    <SharedProjectStatus />
    <PinScaleControl />
  </>
);
