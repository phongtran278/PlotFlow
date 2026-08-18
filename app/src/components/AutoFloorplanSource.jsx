import { useEffect, useRef } from "react";

// Keep startup blank/light, but once real unit data exists the bundled masterplan
// should become available automatically. This bridge disconnects itself as soon as
// it has either found an active PDF source or triggered the bundled masterplan.
export default function AutoFloorplanSource() {
  const attemptedRef = useRef(false);

  useEffect(() => {
    const root = document.getElementById("root") || document.body;
    let observer;
    let raf = null;

    function stop() {
      observer?.disconnect();
      if (raf != null) cancelAnimationFrame(raf);
      raf = null;
    }

    function tryConnect() {
      raf = null;
      if (attemptedRef.current) {
        stop();
        return;
      }

      const hasUnits = Boolean(document.querySelector(".unit-selector .unit-select"));
      if (!hasUnits) return;

      if (document.querySelector(".locator-file")) {
        attemptedRef.current = true;
        stop();
        return;
      }

      const buttons = Array.from(document.querySelectorAll(".locator-card button"));
      const bundledButton = buttons.find((button) =>
        String(button.textContent || "").includes("Use Bundled Masterplan")
      );

      if (!bundledButton || bundledButton.disabled) return;
      attemptedRef.current = true;
      bundledButton.click();
      stop();
    }

    function scheduleTryConnect() {
      if (attemptedRef.current || raf != null) return;
      raf = requestAnimationFrame(tryConnect);
    }

    tryConnect();
    if (!attemptedRef.current) {
      observer = new MutationObserver(scheduleTryConnect);
      observer.observe(root, { childList: true, subtree: true });
    }

    return stop;
  }, []);

  return null;
}
