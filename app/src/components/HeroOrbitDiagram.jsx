import "./HeroOrbitDiagram.css";

const FEATURES = [
  { id: "locator", title: "Floorplan Locator" },
  { id: "overview", title: "Data-linked Overview" },
  { id: "detail", title: "Detail Composer" },
  { id: "export", title: "Review & Export" },
  { id: "override", title: "Manual Override" },
];

export default function HeroOrbitDiagram() {
  return (
    <div className="pf-human-orbit" aria-label="PlotFlow keeps the designer at the center of the system">
      <div className="pf-human-orbit-glow" aria-hidden="true" />

      <svg className="pf-human-orbit-svg" viewBox="0 0 720 720" role="presentation" aria-hidden="true">
        <g className="pf-human-ring pf-human-ring-outer">
          <circle cx="360" cy="360" r="286" />
          <circle className="pf-human-ring-accent" cx="360" cy="360" r="286" />
        </g>
        <g className="pf-human-ring pf-human-ring-middle">
          <circle cx="360" cy="360" r="218" />
          <circle className="pf-human-ring-accent" cx="360" cy="360" r="218" />
        </g>
        <g className="pf-human-ring pf-human-ring-inner">
          <circle cx="360" cy="360" r="154" />
          <circle className="pf-human-ring-accent" cx="360" cy="360" r="154" />
        </g>
      </svg>

      <div className="pf-human-core pf-liquid-glass">
        <span>HUMAN-CENTERED</span>
        <strong>Designer at the center.</strong>
        <p>Automation carries the repetition. The designer keeps the judgment.</p>
      </div>

      <div className="pf-human-feature-field" aria-label="PlotFlow core capabilities">
        {FEATURES.map((feature) => (
          <div className={`pf-human-feature pf-human-feature-${feature.id}`} key={feature.id}>
            <i aria-hidden="true" />
            <strong>{feature.title}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
