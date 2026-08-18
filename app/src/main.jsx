import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import UnitReviewBar from "./components/UnitReviewBar.jsx";
import PerformanceFeedback from "./components/PerformanceFeedback.jsx";
import WorkspaceController from "./components/WorkspaceController.jsx";
import PinScaleControl from "./components/PinScaleControl.jsx";
import AutoFloorplanSource from "./components/AutoFloorplanSource.jsx";

createRoot(document.getElementById("root")).render(
  <>
    <App />
    <AutoFloorplanSource />
    <UnitReviewBar />
    <PerformanceFeedback />
    <WorkspaceController />
    <PinScaleControl />
  </>
);
