import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import UnitReviewBar from "./components/UnitReviewBar.jsx";
import PerformanceFeedback from "./components/PerformanceFeedback.jsx";
import WorkspaceController from "./components/WorkspaceController.jsx";
import PinScaleControl from "./components/PinScaleControl.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <>
      <App />
      <UnitReviewBar />
      <PerformanceFeedback />
      <WorkspaceController />
      <PinScaleControl />
    </>
  </StrictMode>
);
