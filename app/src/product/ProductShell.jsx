import { useEffect, useMemo, useState } from "react";
import "./ProductShell.css";

const PROJECTS = [
  { id: "vinhomes-saigon-park", code: "VSP", name: "Vinhomes Saigon Park", developer: "Vinhomes", location: "Hóc Môn, TP.HCM", status: "Active", tone: "sage", masterplan: true },
  { id: "vinhomes-green-paradise", code: "VGP", name: "Vinhomes Green Paradise", developer: "Vinhomes", location: "Cần Giờ, TP.HCM", status: "Active", tone: "sea" },
  { id: "vinhomes-grand-park", code: "VGP2", name: "Vinhomes Grand Park", developer: "Vinhomes", location: "TP. Thủ Đức, TP.HCM", status: "Active", tone: "sky" },
  { id: "the-global-city", code: "TGC", name: "The Global City", developer: "Masterise Homes", location: "TP. Thủ Đức, TP.HCM", status: "Active", tone: "sand" },
  { id: "lumiere-riverside", code: "LR", name: "Lumière Riverside", developer: "Masterise Homes", location: "TP. Thủ Đức, TP.HCM", status: "Active", tone: "mist" },
  { id: "eaton-park", code: "EP", name: "Eaton Park", developer: "Gamuda Land", location: "TP. Thủ Đức, TP.HCM", status: "Active", tone: "olive" },
  { id: "akari-city", code: "AC", name: "Akari City", developer: "Nam Long", location: "Bình Tân, TP.HCM", status: "Active", tone: "peach" },
  { id: "waterpoint", code: "WP", name: "Waterpoint", developer: "Nam Long", location: "Long An", status: "Active", tone: "lake" },
  { id: "celesta-rise", code: "CR", name: "Celesta Rise", developer: "Keppel Land", location: "Nhà Bè, TP.HCM", status: "Active", tone: "stone" },
  { id: "gladia-by-the-waters", code: "GW", name: "Gladia by the Waters", developer: "Khang Điền", location: "TP. Thủ Đức, TP.HCM", status: "Active", tone: "mint" },
  { id: "metropole-thu-thiem", code: "MTT", name: "The Metropole Thủ Thiêm", developer: "SonKim Land", location: "TP. Thủ Đức, TP.HCM", status: "Active", tone: "clay" },
  { id: "eco-retreat", code: "ER", name: "Eco Retreat", developer: "Ecopark", location: "Long An", status: "Planning", tone: "forest" },
];

const DEMO_PLOTS = [
  { code: "CH-01", x: 18, y: 24, price: "18.6 tỷ", type: "Townhouse" },
  { code: "CH-02", x: 37, y: 31, price: "19.2 tỷ", type: "Townhouse" },
  { code: "CH-03", x: 56, y: 22, price: "21.4 tỷ", type: "Corner" },
  { code: "CH-04", x: 68, y: 42, price: "22.1 tỷ", type: "Garden" },
  { code: "CH-05", x: 45, y: 60, price: "24.8 tỷ", type: "Premium" },
  { code: "CH-06", x: 76, y: 66, price: "20.5 tỷ", type: "Townhouse" },
];

function readAvailableUnits() {
  return Array.from(document.querySelectorAll(".unit-select .unit-main strong"))
    .map((node) => node.textContent?.trim())
    .filter(Boolean);
}

function ProjectCard({ project, onOpen }) {
  return (
    <button type="button" className="pf-project-card" onClick={() => onOpen(project)}>
      <div className={`pf-project-thumb tone-${project.tone}`}>
        <span>{project.code}</span>
        <small>{project.developer}</small>
      </div>
      <div className="pf-project-card-copy">
        <span>{project.status}</span>
        <strong>{project.name}</strong>
        <small>{project.location}</small>
      </div>
      <em>Open →</em>
    </button>
  );
}

export default function ProductShell({ children }) {
  const [screen, setScreen] = useState("home");
  const [project, setProject] = useState(PROJECTS[0]);
  const [mode, setMode] = useState("overview");
  const [developer, setDeveloper] = useState("All developers");
  const [units, setUnits] = useState([]);
  const [activeUnit, setActiveUnit] = useState("");

  useEffect(() => {
    const sync = () => setUnits(readAvailableUnits());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.classList.toggle("pf-product-home", screen === "home");
    document.body.classList.toggle("pf-product-overview", screen === "project" && mode === "overview");
    document.body.classList.toggle("pf-product-detail", screen === "project" && mode === "detail");
    return () => document.body.classList.remove("pf-product-home", "pf-product-overview", "pf-product-detail");
  }, [screen, mode]);

  const developers = useMemo(() => ["All developers", ...Array.from(new Set(PROJECTS.map((item) => item.developer)))], []);
  const filteredProjects = useMemo(() => developer === "All developers" ? PROJECTS : PROJECTS.filter((item) => item.developer === developer), [developer]);

  const plots = useMemo(() => {
    if (!units.length) return DEMO_PLOTS;
    return units.slice(0, 12).map((code, index) => ({
      code,
      x: 14 + ((index * 19) % 70),
      y: 16 + ((index * 27) % 66),
      price: "View detail",
      type: "Unit",
    }));
  }, [units]);

  function openProject(nextProject) {
    setProject(nextProject);
    setActiveUnit("");
    setScreen("project");
    setMode("overview");
  }

  function openUnit(code) {
    setActiveUnit(code);
    const match = Array.from(document.querySelectorAll(".unit-select")).find((button) =>
      button.querySelector(".unit-main strong")?.textContent?.trim() === code
    );
    match?.click();
    setMode("detail");
    setScreen("project");
  }

  const detailVisible = screen === "project" && mode === "detail";

  return (
    <div className="pf-product-root">
      <div className={`pf-product-workspace ${detailVisible ? "is-visible" : "is-hidden"}`}>{children}</div>

      {screen === "home" && (
        <main className="pf-home">
          <header className="pf-home-bar">
            <div className="pf-home-brand"><span>PF</span><div><strong>PhongFlow</strong><small>Real Estate Visual Studio</small></div></div>
            <div className="pf-home-status"><i /> Private workspace</div>
          </header>

          <section className="pf-home-hero">
            <div>
              <span>PROJECT HUB</span>
              <h1>All projects.<br />One flow.</h1>
              <p>Move from the masterplan to every sales visual without losing project context.</p>
            </div>
            <div className="pf-home-hero-note">
              <strong>{PROJECTS.length}</strong>
              <span>projects in workspace</span>
              <small>Overview ↔ Detail</small>
            </div>
          </section>

          <section className="pf-home-projects">
            <div className="pf-section-head">
              <div><span>WORKSPACES</span><h2>Your projects</h2></div>
              <small>{filteredProjects.length} shown</small>
            </div>
            <div className="pf-filter-row" role="group" aria-label="Filter projects by developer">
              {developers.map((name) => (
                <button key={name} type="button" className={developer === name ? "active" : ""} onClick={() => setDeveloper(name)}>{name}</button>
              ))}
            </div>
            <div className="pf-project-grid">{filteredProjects.map((item) => <ProjectCard key={item.id} project={item} onOpen={openProject} />)}</div>
          </section>
        </main>
      )}

      {screen === "project" && mode === "overview" && (
        <main className="pf-overview">
          <header className="pf-project-bar">
            <button type="button" className="pf-back" onClick={() => setScreen("home")}>← Projects</button>
            <div><span>{project.code}</span><strong>{project.name}</strong><small>{project.developer} · {project.location}</small></div>
            <nav><button className="active" type="button">Overview</button><button type="button" onClick={() => setMode("detail")}>Detail</button></nav>
          </header>

          <div className="pf-overview-layout">
            <section className="pf-masterplan-card">
              <div className="pf-masterplan-head">
                <div><span>OVERVIEW</span><h1>{project.name}</h1></div>
                <small>{project.masterplan ? "Live masterplan PDF" : "Project overview preview"}</small>
              </div>
              <div className={`pf-masterplan-stage ${project.masterplan ? "has-real-pdf" : ""}`}>
                {project.masterplan ? (
                  <iframe className="pf-masterplan-pdf" title={`${project.name} masterplan`} src="/masterplan/masterplan.pdf#toolbar=0&navpanes=0&scrollbar=0&view=FitH" />
                ) : (
                  <div className={`pf-project-overview-placeholder tone-${project.tone}`}><strong>{project.name}</strong><span>{project.developer}</span></div>
                )}
                {project.masterplan && plots.map((plot) => (
                  <button key={plot.code} type="button" className={`pf-plot-pin ${activeUnit === plot.code ? "active" : ""}`} style={{ left: `${plot.x}%`, top: `${plot.y}%` }} onClick={() => setActiveUnit(plot.code)}>
                    <span>{plot.code}</span>
                  </button>
                ))}
                {project.masterplan && activeUnit && (() => {
                  const current = plots.find((plot) => plot.code === activeUnit);
                  if (!current) return null;
                  return <div className="pf-plot-card"><span>SELECTED UNIT</span><strong>{current.code}</strong><p>{current.type} · {current.price}</p><button type="button" onClick={() => openUnit(current.code)}>Open Detail →</button></div>;
                })()}
              </div>
            </section>

            <aside className="pf-overview-side">
              <div className="pf-side-card"><span>PROJECT FLOW</span><strong>Overview ↔ Detail</strong><p>Pick a unit on the masterplan, inspect its sales info, then open the connected detail workspace.</p></div>
              <div className="pf-side-list"><span>UNITS</span>{plots.slice(0, 8).map((plot) => <button key={plot.code} type="button" onClick={() => setActiveUnit(plot.code)} className={activeUnit === plot.code ? "active" : ""}><strong>{plot.code}</strong><small>{plot.price}</small></button>)}</div>
            </aside>
          </div>
        </main>
      )}

      {detailVisible && (
        <div className="pf-detail-nav">
          <button type="button" onClick={() => setScreen("home")}>⌂</button>
          <div><span>{project.code}</span><strong>{project.name}</strong></div>
          <nav><button type="button" onClick={() => setMode("overview")}>Overview</button><button type="button" className="active">Detail</button></nav>
        </div>
      )}
    </div>
  );
}
