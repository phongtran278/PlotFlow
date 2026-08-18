import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import UnitReviewBar from "./components/UnitReviewBar.jsx";
import PerformanceFeedback from "./components/PerformanceFeedback.jsx";
import WorkspaceController from "./components/WorkspaceController.jsx";
import PinScaleControl from "./components/PinScaleControl.jsx";
import { installPreviewInteractions } from "./previewInteractions.js";

installPreviewInteractions();

createRoot(document.getElementById("root")).render(
  <>
    <App />
    <UnitReviewBar />
    <PerformanceFeedback />
    <WorkspaceController />
    <PinScaleControl />
  </>
);
