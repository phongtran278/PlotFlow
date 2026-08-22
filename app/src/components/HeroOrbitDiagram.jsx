import "./HeroOrbitDiagram.css";
import "./HomeLandingPolish.css";

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

      <div className="pf-human-rings" aria-hidden="true">
        <i className="pf-human-ring pf-human-ring-outer" />
        <i className="pf-human-ring pf-human-ring-middle" />
        <i className="pf-human-ring pf-human-ring-inner" />
      </div>

      <div className="pf-human-core pf-liquid-glass">
        <span>HUMAN-CENTERED</span>
        <strong>Designer at the center.</strong>
        <p>Human judgment stays in control.</p>
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
