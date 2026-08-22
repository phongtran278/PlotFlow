import "./HeroOrbitDiagram.css";

const FEATURES = [
  { id: "locator", title: "Floorplan Locator", body: "Find the right unit fast." },
  { id: "overview", title: "Data-linked Overview", body: "Keep the big picture in sync." },
  { id: "detail", title: "Detail Composer", body: "Build unit artwork from one source." },
  { id: "export", title: "Review & Export", body: "Move cleanly from review to output." },
  { id: "override", title: "Manual Override", body: "Keep visual judgment human." },
];

export default function HeroOrbitDiagram() {
  return (
    <div className="pf-human-orbit" aria-label="PlotFlow is designed around the designer">
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
        <span>HUMAN-CENTERED SYSTEM</span>
        <strong>Designer at the center.</strong>
        <p>PlotFlow takes responsibility for repetition so the designer can stay responsible for the decision.</p>
      </div>

      <div className="pf-human-feature-field">
        {FEATURES.map((feature) => (
          <article className={`pf-human-feature pf-human-feature-${feature.id}`} key={feature.id}>
            <i aria-hidden="true" />
            <div><strong>{feature.title}</strong><span>{feature.body}</span></div>
          </article>
        ))}
      </div>
    </div>
  );
}
