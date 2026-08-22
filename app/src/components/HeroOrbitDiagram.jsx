import "./HeroOrbitDiagram.css";

const FEATURES = [
  { id: "locator", title: "Find the right lot in seconds" },
  { id: "overview", title: "One data source → Overview + Detail" },
  { id: "detail", title: "Manual override stays open" },
  { id: "export", title: "Review faster. Export cleaner." },
  { id: "override", title: "Automation handles repetition" },
];

export default function HeroOrbitDiagram() {
  return (
    <div className="pf-human-orbit" aria-label="PlotFlow keeps the designer in control while automation handles repetitive production work">
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
    </div>
  );
}
