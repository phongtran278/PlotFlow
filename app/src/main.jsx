import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import UnitReviewBar from "./components/UnitReviewBar.jsx";
import PerformanceFeedback from "./components/PerformanceFeedback.jsx";
import WorkspaceController from "./components/WorkspaceController.jsx";
import PinScaleControl from "./components/PinScaleControl.jsx";

// Keep the first paint light, but prepare the Sheet parser once the browser is idle.
// App.jsx dynamically imports the same module, so the later Connect action reuses it.
function warmSheetParser() {
  import("xlsx").catch(() => {});
}

if (typeof requestIdleCallback === "function") {
  requestIdleCallback(warmSheetParser);
} else {
  window.setTimeout(warmSheetParser, 1200);
}

// Google Sheet requests must never leave the UI spinning forever.
// Limit the timeout patch to the Google spreadsheet export endpoint only.
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const url = typeof input === "string" ? input : input?.url || "";
  const isGoogleSheetExport = /docs\.google\.com\/spreadsheets\/d\//i.test(url);
  if (!isGoogleSheetExport || init.signal) return nativeFetch(input, init);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  return nativeFetch(input, { ...init, signal: controller.signal })
    .finally(() => window.clearTimeout(timeout));
};

createRoot(document.getElementById("root")).render(
  <>
    <App />
    <UnitReviewBar />
    <PerformanceFeedback />
    <WorkspaceController />
    <PinScaleControl />
  </>
);
