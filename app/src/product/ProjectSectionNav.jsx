import { useEffect, useMemo, useState } from "react";
import "./ProjectSectionNav.css";

export default function ProjectSectionNav({ items }) {
  const visibleItems = useMemo(() => items.filter((item) => item.visible !== false), [items]);
  const [activeId, setActiveId] = useState(visibleItems[0]?.id || "");
  const [showTop, setShowTop] = useState(false);

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
      { rootMargin: "-132px 0px -58% 0px", threshold: [0.05, 0.2, 0.45] },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [visibleItems]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 520);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function goTo(id) {
    const target = document.getElementById(id);
    if (!target) return;
    setActiveId(id);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goToTop() {
    setActiveId(visibleItems[0]?.id || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <nav className="pf-project-section-nav" aria-label="Project page sections">
        <div className="pf-project-section-nav-inner">
          <div className="pf-project-section-nav-links">
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
          <button
            type="button"
            className={`pf-project-section-nav-top ${showTop ? "is-visible" : ""}`}
            onClick={goToTop}
            tabIndex={showTop ? 0 : -1}
            aria-hidden={!showTop}
            aria-label="Back to top"
          >
            Top <span>↑</span>
          </button>
        </div>
      </nav>
      <div className="pf-project-section-nav-spacer" aria-hidden="true" />
    </>
  );
}
