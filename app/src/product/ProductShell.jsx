import { useEffect, useMemo, useState } from "react";
import "./ProductShell.css";

const PROJECTS = [
  { id: "project-a", code: "A", name: "Project A", subtitle: "Sales visual workspace", status: "Active" },
  { id: "project-b", code: "B", name: "Project B", subtitle: "Next development", status: "Draft" },
  { id: "project-c", code: "C", name: "Project C", subtitle: "Future workspace", status: "Draft" },
];

const DEMO_PLOTS = [
  { code: "A-01", x: 18, y: 24, price: "18.6 tỷ", type: "Townhouse" },
  { code: "A-02", x: 40, y: 18, price: "19.2 tỷ", type: "Townhouse" },
  { code: "A-03", x: 63, y: 29, price: "21.4 tỷ", type: "Corner" },
  { code: "A-04", x: 30, y: 58, price: "22.1 tỷ", type: "Garden" },
  { code: "A-05", x: 68, y: 62, price: "24.8 tỷ", type: "Premium" },
];

function readAvailableUnits() {
  return Array.from(document.querySelectorAll(".unit-select .unit-main strong"))
    .map((node) => node.textContent?.trim())
    .filter(Boolean);
}

function ProjectCard({ project, onOpen }) {
  return (
    <button type="button" className="pf-project-card" onClick={() => onOpen(project)}>
      <div className="pf-project-thumb"><span>{project.code}</span><i /><b /></div>
      <div className="pf-project-card-copy"><span>{project.status}</span><strong>{project.name}</strong><small>{project.subtitle}</small></div>
      <em>Open →</em>
    </button>
  );
}

export default function ProductShell({ children }) {
  const [screen, setScreen] = useState(() => localStorage.getItem("phongflow-screen-v1") || "home");
  const [project, setProject] = useState(PROJECTS[0]);
  const [mode, setMode] = useState(() => localStorage.getItem("phongflow-project-mode-v1") || "overview");
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
    localStorage.setItem("phongflow-screen-v1", screen);
    localStorage.setItem("phongflow-project-mode-v1", mode);
    document.body.classList.toggle("pf-product-home", screen === "home");
    document.body.classList.toggle("pf-product-overview", screen === "project" && mode === "overview");
    document.body.classList.toggle("pf-product-detail", screen === "project" && mode === "detail");
    return () => {
      document.body.classList.remove("pf-product-home", "pf-product-overview", "pf-product-detail");
    };
  }, [screen, mode]);

  const plots = useMemo(() => {
    if (!units.length) return DEMO_PLOTS;
    return units.slice(0, 12).map((code, index) => ({
      code,
      x: 13 + ((index * 23) % 73),
      y: 15 + ((index * 31) % 68),
      price: "View detail",
      type: "Unit",
    }));
  }, [units]);

  function openProject(nextProject) {
    setProject(nextProject);
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
            <div><span>PROJECT HUB</span><h1>From masterplan<br/>to every unit.</h1><p>Overview and detail stay connected inside one real-estate sales workspace.</p></div>
            <div className="pf-home-orbit"><span>Overview</span><strong>↔</strong><span>Detail</span></div>
          </section>
          <section className="pf-home-projects">
            <div className="pf-section-head"><div><span>WORKSPACES</span><h2>Your projects</h2></div><small>{PROJECTS.length} projects</small></div>
            <div className="pf-project-grid">{PROJECTS.map((item) => <ProjectCard key={item.id} project={item} onOpen={openProject} />)}</div>
          </section>
        </main>
      )}

      {screen === "project" && mode === "overview" && (
        <main className="pf-overview">
          <header className="pf-project-bar">
            <button type="button" className="pf-back" onClick={() => setScreen("home")}>← Projects</button>
            <div><span>{project.code}</span><strong>{project.name}</strong><small>Masterplan + unit detail</small></div>
            <nav><button className="active" type="button">Overview</button><button type="button" onClick={() => setMode("detail")}>Detail</button></nav>
          </header>
          <div className="pf-overview-layout">
            <section className="pf-masterplan-card">
              <div className="pf-masterplan-head"><div><span>OVERVIEW</span><h1>Masterplan</h1></div><small>{units.length ? `${units.length} live units` : "Demo map · connect Sheet for live units"}</small></div>
              <div className="pf-masterplan-stage">
                <div className="pf-masterplan-road road-a"/><div className="pf-masterplan-road road-b"/><div className="pf-masterplan-water"/>
                {plots.map((plot) => (
                  <button key={plot.code} type="button" className={`pf-plot-pin ${activeUnit === plot.code ? "active" : ""}`} style={{ left: `${plot.x}%`, top: `${plot.y}%` }} onClick={() => setActiveUnit(plot.code)}>
                    <span>{plot.code}</span>
                  </button>
                ))}
                {activeUnit && (() => {
                  const current = plots.find((plot) => plot.code === activeUnit);
                  if (!current) return null;
                  return <div className="pf-plot-card"><span>SELECTED UNIT</span><strong>{current.code}</strong><p>{current.type} · {current.price}</p><button type="button" onClick={() => openUnit(current.code)}>Open Detail →</button></div>;
                })()}
              </div>
            </section>
            <aside className="pf-overview-side">
              <div className="pf-side-card"><span>PROJECT FLOW</span><strong>Overview ↔ Detail</strong><p>Select one plot on the masterplan, then jump into its full sales visual without losing context.</p></div>
              <div className="pf-side-list"><span>UNITS</span>{plots.slice(0,6).map((plot) => <button key={plot.code} type="button" onClick={() => setActiveUnit(plot.code)} className={activeUnit === plot.code ? "active" : ""}><strong>{plot.code}</strong><small>{plot.price}</small></button>)}</div>
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
