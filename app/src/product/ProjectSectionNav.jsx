import { useEffect, useState } from "react";
import "./ProjectSectionNav.css";

export default function ProjectSectionNav({ items }) {
  const visibleItems = items.filter((item) => item.visible !== false);
  const [activeId, setActiveId] = useState(visibleItems[0]?.id || "");

  useEffect(() => {
    if (!visibleItems.length) return undefined;

    const nodes = visibleItems
      .map((item) => document.getElementById(item.id))
      .filter(Boolean);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target?.id) setActiveId(visible.target.id);
      },
      { rootMargin: "-124px 0px -58% 0px", threshold: [0.05, 0.2, 0.45] },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [visibleItems.map((item) => item.id).join("|")]);

  function goTo(id) {
    const target = document.getElementById(id);
    if (!target) return;
    setActiveId(id);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav className="pf-project-section-nav" aria-label="Project page sections">
      <div className="pf-project-section-nav-inner">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={activeId === item.id ? "active" : ""}
            aria-current={activeId === item.id ? "location" : undefined}
            onClick={() => goTo(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
