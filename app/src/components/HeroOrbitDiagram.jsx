import { useEffect, useRef, useState } from "react";
import "./HeroOrbitDiagram.css";

const FEATURES = [
  { id: "locator", title: "Find the right lot in seconds" },
  { id: "overview", title: "One data source → Overview + Detail" },
  { id: "detail", title: "Manual override stays open" },
  { id: "export", title: "Review faster. Export cleaner." },
  { id: "override", title: "Automation handles repetition" },
];

function roundRect(rect) {
  if (!rect) return null;
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    right: Math.round(rect.right),
    bottom: Math.round(rect.bottom),
  };
}

function getClippingAncestors(node) {
  const items = [];
  let current = node?.parentElement;
  while (current && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    const overflowX = style.overflowX;
    const overflowY = style.overflowY;
    if (![overflowX, overflowY].every((value) => value === "visible" || value === "clip")) {
      items.push(`${current.tagName.toLowerCase()}${current.id ? `#${current.id}` : ""}${current.className && typeof current.className === "string" ? `.${current.className.trim().replace(/\s+/g, ".")}` : ""} [${overflowX}/${overflowY}]`);
    }
    current = current.parentElement;
  }
  return items;
}

export default function HeroOrbitDiagram() {
  const orbitRef = useRef(null);
  const [debug, setDebug] = useState(null);

  useEffect(() => {
    let frame = 0;

    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const orbit = orbitRef.current;
        if (!orbit) return;
        const visual = orbit.closest(".pf-home-hero-visual");
        const hero = orbit.closest(".pf-home-hero");
        const main = orbit.closest("main");
        const orbitRect = orbit.getBoundingClientRect();
        const outerRing = orbit.querySelector(".pf-human-ring-outer")?.getBoundingClientRect();

        setDebug({
          viewport: {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            visualWidth: Math.round(window.visualViewport?.width || 0),
            visualScale: window.visualViewport?.scale || 1,
            dpr: window.devicePixelRatio,
          },
          hero: roundRect(hero?.getBoundingClientRect()),
          visual: roundRect(visual?.getBoundingClientRect()),
          orbit: roundRect(orbitRect),
          outerRing: roundRect(outerRing),
          overflow: {
            main: main ? `${getComputedStyle(main).overflowX}/${getComputedStyle(main).overflowY}` : "n/a",
            hero: hero ? `${getComputedStyle(hero).overflowX}/${getComputedStyle(hero).overflowY}` : "n/a",
            visual: visual ? `${getComputedStyle(visual).overflowX}/${getComputedStyle(visual).overflowY}` : "n/a",
            orbit: `${getComputedStyle(orbit).overflowX}/${getComputedStyle(orbit).overflowY}`,
          },
          clippingAncestors: getClippingAncestors(orbit),
          rightGap: Math.round(window.innerWidth - orbitRect.right),
          outerRightGap: outerRing ? Math.round(window.innerWidth - outerRing.right) : null,
        });
      });
    };

    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    if (orbitRef.current) observer.observe(orbitRef.current);
    const visual = orbitRef.current?.closest(".pf-home-hero-visual");
    if (visual) observer.observe(visual);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div ref={orbitRef} className="pf-human-orbit" aria-label="PlotFlow keeps the designer in control while automation handles repetitive production work">
      <div className="pf-human-rings" aria-hidden="true">
        <i className="pf-human-ring pf-human-ring-outer"><span className="pf-orbit-tracer" /></i>
        <i className="pf-human-ring pf-human-ring-middle"><span className="pf-orbit-tracer" /></i>
        <i className="pf-human-ring pf-human-ring-inner"><span className="pf-orbit-tracer" /></i>
      </div>

      <div className="pf-human-core pf-liquid-glass">
        <strong>Designer decides.</strong>
        <p>PlotFlow handles the repetition.</p>
      </div>

      <div className="pf-human-feature-field" aria-label="PlotFlow core product value">
        {FEATURES.map((feature) => (
          <div className={`pf-human-feature pf-human-feature-${feature.id}`} key={feature.id}>
            <i aria-hidden="true" />
            <strong>{feature.title}</strong>
          </div>
        ))}
      </div>

      {debug && (
        <aside className="pf-orbit-debug" aria-label="Hero orbit debug measurements">
          <strong>Orbit debug</strong>
          <span>viewport {debug.viewport.innerWidth}×{debug.viewport.innerHeight} · vv {debug.viewport.visualWidth} · scale {debug.viewport.visualScale} · DPR {debug.viewport.dpr}</span>
          <span>hero {debug.hero?.width}w · x {debug.hero?.x} → {debug.hero?.right}</span>
          <span>visual {debug.visual?.width}w · x {debug.visual?.x} → {debug.visual?.right}</span>
          <span>orbit {debug.orbit?.width}w · x {debug.orbit?.x} → {debug.orbit?.right} · gapR {debug.rightGap}</span>
          <span>outer {debug.outerRing?.width}w · x {debug.outerRing?.x} → {debug.outerRing?.right} · gapR {debug.outerRightGap}</span>
          <span>overflow main {debug.overflow.main}</span>
          <span>overflow hero {debug.overflow.hero}</span>
          <span>overflow visual {debug.overflow.visual}</span>
          <span>overflow orbit {debug.overflow.orbit}</span>
          <span>clippers {debug.clippingAncestors.length ? debug.clippingAncestors.join(" → ") : "none"}</span>
        </aside>
      )}
    </div>
  );
}
