import { useEffect, useMemo, useState } from "react";
import "./ProductShell.css";
import "./OverviewCallouts.css";
import ProjectLanding from "./ProjectLanding.jsx";
import WorkspaceNav from "./WorkspaceNav.jsx";
import OverviewWorkspace from "./OverviewWorkspace.jsx";
import { PROJECTS } from "./projectCatalog.js";

const DEFAULT_OVERVIEW_GROUPS = ["Hoàn thiện", "Giãn xây", "Xây thô"];
const SELL_STORAGE_KEY = "plotflow-overview-sell-units-v1";

function canonicalOverviewGroup(value = "") {
  const raw = String(value).trim();
  const normalized = raw.toLowerCase();
  if (normalized.includes("hoàn thiện") || normalized.includes("hoan thien")) return "Hoàn thiện";
  if (normalized.includes("giãn xây") || normalized.includes("gian xay")) return "Giãn xây";
  if (
    normalized.includes("xây thô") ||
    normalized.includes("xay tho") ||
    normalized.includes("bàn giao thô") ||
    normalized.includes("ban giao tho")
  ) return "Xây thô";
  return raw;
}

function readAvailableUnits() {
  return Array.from(document.querySelectorAll(".unit-select .unit-main strong"))
    .map((node) => node.textContent?.trim())
    .filter(Boolean);
}

function readSellUnits() {
  try {
    const value = JSON.parse(localStorage.getItem(SELL_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function HubProjectCard({ project, index, onOpen }) {
  return (
    <button type="button" className="pf-hub-project-card" onClick={() => onOpen(project)}>
      <div className={`pf-hub-project-media tone-${project.tone}`} aria-label={`${project.name} project thumbnail placeholder`}>
        <div className="pf-hub-project-grid" aria-hidden="true" />
      </div>
      <div className="pf-hub-project-body">
        <div className="pf-hub-project-meta">
          <span>{String(index + 1).padStart(2, "0")}</span>
          <em>{project.status}</em>
        </div>
        <strong>{project.name}</strong>
        <div className="pf-hub-project-foot">
          <small>{project.developer} · {project.location}</small>
          <b>Open →</b>
        </div>
      </div>
    </button>
  );
}

export default function ProductShell({ children, onExitWorkspace }) {
  const [screen, setScreen] = useState("home");
  const [project, setProject] = useState(PROJECTS[0]);
  const [mode, setMode] = useState("landing");
  const [developer, setDeveloper] = useState("All developers");
  const [query, setQuery] = useState("");
  const [overviewGroup, setOverviewGroup] = useState(DEFAULT_OVERVIEW_GROUPS[0]);
  const [units, setUnits] = useState(readAvailableUnits);
  const [sellUnits, setSellUnits] = useState(readSellUnits);

  useEffect(() => {
    const onSellUnits = (event) => {
      setSellUnits(Array.isArray(event.detail?.units) ? event.detail.units : readSellUnits());
      setUnits(readAvailableUnits());
    };
    window.addEventListener("plotflow-overview-sell-units", onSellUnits);
    return () => window.removeEventListener("plotflow-overview-sell-units", onSellUnits);
  }, []);

  useEffect(() => {
    const detail = { screen, mode };
    document.body.classList.toggle("pf-product-home", screen === "home");
    document.body.classList.toggle("pf-product-project", screen === "project" && mode === "landing");
    document.body.classList.toggle("pf-product-overview", screen === "project" && mode === "overview");
    document.body.classList.toggle("pf-product-detail", screen === "project" && mode === "detail");
    window.dispatchEvent(new CustomEvent("plotflow-product-view-changed", { detail }));
    return () => document.body.classList.remove("pf-product-home", "pf-product-project", "pf-product-overview", "pf-product-detail");
  }, [screen, mode]);

  const developers = useMemo(() => ["All developers", ...Array.from(new Set(PROJECTS.map((item) => item.developer)))], []);
  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return PROJECTS.filter((item) => {
      const matchesDeveloper = developer === "All developers" || item.developer === developer;
      if (!matchesDeveloper) return false;
      if (!normalizedQuery) return true;
      return [item.code, item.name, item.developer, item.location, item.status].some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [developer, query]);
  const overviewGroups = useMemo(() => {
    const fromSheet = Array.from(new Set(
      sellUnits
        .map((item) => canonicalOverviewGroup(item.handover))
        .filter(Boolean)
    ));
    return fromSheet.length ? DEFAULT_OVERVIEW_GROUPS.filter((group) => fromSheet.includes(group)).concat(fromSheet.filter((group) => !DEFAULT_OVERVIEW_GROUPS.includes(group))) : DEFAULT_OVERVIEW_GROUPS;
  }, [sellUnits]);
  const visibleSellUnits = useMemo(
    () => sellUnits.filter((item) => canonicalOverviewGroup(item.handover) === overviewGroup),
    [sellUnits, overviewGroup]
  );

  useEffect(() => {
    if (!overviewGroups.includes(overviewGroup)) setOverviewGroup(overviewGroups[0] || "");
  }, [overviewGroups, overviewGroup]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("pf-overview-group-changed", { detail: { group: overviewGroup } }));
  }, [overviewGroup]);

  function openProject(nextProject) {
    setProject(nextProject);
    setScreen("project");
    setMode("landing");
  }

  const detailVisible = screen === "project" && mode === "detail";

  return (
    <div className="pf-product-root">
      <WorkspaceNav
        screen={screen}
        mode={mode}
        project={project}
        onExitWorkspace={onExitWorkspace}
        onProjects={() => setScreen("home")}
        onMode={setMode}
      />

      <div hidden={!detailVisible} className={`pf-product-workspace ${detailVisible ? "is-visible" : "is-hidden"}`}>{children}</div>

      {screen === "home" && (
        <main className="pf-project-hub">
          <section className="pf-hub-intro">
            <div>
              <span>PROJECT WORKSPACE</span>
              <h1>All projects.<br /><em>One visual system.</em></h1>
              <p>Move from project data and masterplan to Overview and Detail without losing context — while keeping every workspace inside the same design language.</p>
            </div>
            <div className="pf-hub-stat">
              <strong>{PROJECTS.length}</strong>
              <span>projects in workspace</span>
              <small>Project Home → Overview → Detail</small>
            </div>
          </section>

          <section className="pf-hub-library">
            <div className="pf-hub-section-head">
              <div><span>PROJECT LIBRARY</span><h2>Your projects</h2></div>
              <small>{filteredProjects.length} shown</small>
            </div>

            <div className="pf-hub-tools">
              <label className="pf-hub-search">
                <span aria-hidden="true">⌕</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects" aria-label="Search projects" />
              </label>
              <div className="pf-hub-filters" role="group" aria-label="Filter projects by developer">
                {developers.map((name) => (
                  <button key={name} type="button" className={developer === name ? "active" : ""} onClick={() => setDeveloper(name)}>{name}</button>
                ))}
              </div>
            </div>

            <div className="pf-hub-project-grid">
              {filteredProjects.map((item, index) => <HubProjectCard key={item.id} project={item} index={index} onOpen={openProject} />)}
            </div>
          </section>
        </main>
      )}

      {screen === "project" && mode === "landing" && (
        <ProjectLanding project={project} onOverview={() => setMode("overview")} onDetail={() => setMode("detail")} />
      )}

      {screen === "project" && mode === "overview" && (
        <OverviewWorkspace
          project={project}
          overviewGroups={overviewGroups}
          overviewGroup={overviewGroup}
          onOverviewGroup={setOverviewGroup}
          sellUnits={sellUnits}
          units={units}
          visibleSellUnits={visibleSellUnits}
        />
      )}
    </div>
  );
}
