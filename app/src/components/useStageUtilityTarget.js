import { useEffect, useState } from "react";

const TARGET_CLASS = "stage-utility-tools";

function findOrCreateTarget() {
  const header = document.querySelector(".stage-header");
  if (!header) return null;

  let target = header.querySelector(`.${TARGET_CLASS}`);
  if (!target) {
    target = document.createElement("div");
    target.className = TARGET_CLASS;
    target.setAttribute("aria-label", "Preview utilities");
    header.appendChild(target);
  }
  return target;
}

export default function useStageUtilityTarget() {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    function sync() {
      const next = findOrCreateTarget();
      setTarget((current) => current === next ? current : next);
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return target;
}
