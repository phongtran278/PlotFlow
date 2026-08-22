import "./HeroOrbitDiagram.css";

const NODES = [
  { id: "locator", index: "01", title: "Floorplan Locator", body: "Find the correct unit inside large masterplans." },
  { id: "overview", index: "02", title: "Data-linked Overview", body: "Keep cards, connectors and highlights in sync." },
  { id: "detail", index: "03", title: "Detail Composer", body: "Build unit-level artwork from one data source." },
  { id: "export", index: "04", title: "Review & Export", body: "Move from visual review to polished output." },
  { id: "override", index: "05", title: "Manual Override", body: "Keep hierarchy, spacing and exceptions human." },
];

export default function HeroOrbitDiagram() {
  return (
    <div className="pf-orbit-diagram" aria-label="Designer-centered PlotFlow feature system">
      <svg className="pf-orbit-svg" viewBox="0 0 760 660" role="presentation" aria-hidden="true">
        <defs>
          <linearGradient id="pfOrbitLine" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0f7a64" stopOpacity="0.12" />
            <stop offset="45%" stopColor="#0f7a64" stopOpacity="0.48" />
            <stop offset="100%" stopColor="#0f7a64" stopOpacity="0.12" />
          </linearGradient>
          <filter id="pfOrbitGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <path id="pfOrbitOuter" d="M 380 58 A 272 272 0 1 1 379.9 58" />
          <path id="pfOrbitInner" d="M 380 150 A 180 180 0 1 1 379.9 150" />
        </defs>
        <circle className="pf-orbit-circle pf-orbit-circle-outer" cx="380" cy="330" r="272" />
        <circle className="pf-orbit-circle pf-orbit-circle-inner" cx="380" cy="330" r="180" />
        <circle className="pf-orbit-circle pf-orbit-circle-core" cx="380" cy="330" r="112" />
        <path className="pf-orbit-flow-path" d="M 380 58 A 272 272 0 1 1 379.9 58" />
        <circle className="pf-orbit-runner pf-orbit-runner-a" r="5" filter="url(#pfOrbitGlow)">
          <animateMotion dur="8s" repeatCount="indefinite" rotate="auto"><mpath href="#pfOrbitOuter" /></animateMotion>
        </circle>
        <circle className="pf-orbit-runner pf-orbit-runner-b" r="4" filter="url(#pfOrbitGlow)">
          <animateMotion dur="6.2s" begin="-2.4s" repeatCount="indefinite" rotate="auto"><mpath href="#pfOrbitInner" /></animateMotion>
        </circle>
      </svg>

      <div className="pf-orbit-core pf-liquid-glass">
        <span>CORE PRINCIPLE</span>
        <strong>Designer in control</strong>
        <p>Automation handles repetition. Visual judgment stays human.</p>
      </div>

      {NODES.map((node) => (
        <article className={`pf-orbit-feature pf-orbit-feature-${node.id} pf-liquid-glass`} key={node.id}>
          <small>{node.index}</small>
          <strong>{node.title}</strong>
          <span>{node.body}</span>
        </article>
      ))}
    </div>
  );
}
