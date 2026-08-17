import { useEffect, useRef } from "react";

// Keep startup blank/light, but once real unit data exists the bundled masterplan
// should become available automatically. This bridge intentionally waits for the
// unit list so opening PlotFlow alone never loads or indexes the PDF.
export default function AutoFloorplanSource() {
  const attemptedRef = useRef(false);

  useEffect(() => {
    function tryConnect() {
      if (attemptedRef.current) return;

      const hasUnits = Boolean(document.querySelector(".unit-selector .unit-select"));
      if (!hasUnits) return;

      // Respect an explicit linked/uploaded/bundled PDF that is already active.
      if (document.querySelector(".locator-file")) {
        attemptedRef.current = true;
        return;
      }

      const buttons = Array.from(document.querySelectorAll(".locator-card button"));
      const bundledButton = buttons.find((button) =>
        String(button.textContent || "").includes("Use Bundled Masterplan")
      );

      if (!bundledButton || bundledButton.disabled) return;
      attemptedRef.current = true;
      bundledButton.click();
    }

    tryConnect();
    const root = document.getElementById("root") || document.body;
    const observer = new MutationObserver(() => requestAnimationFrame(tryConnect));
    observer.observe(root, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
