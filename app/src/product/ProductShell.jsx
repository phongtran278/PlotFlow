import { useEffect, useMemo, useRef, useState } from "react";
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
  if (normalized.includes("xây thô") || normalized.includes("xay tho") || normalized.includes("bàn giao thô") || normalized.includes("ban giao tho")) return "Xây thô";
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

function hibernateImages(root, preserveEditor = false) {
  if (!root) return;
  root.querySelectorAll("img").forEach((img) => {
    if (preserveEditor && img.closest(".lot-editor-shell")) return;
    const src = img.getAttribute("src");
    if (!src || img.dataset.pfMemoryHibernated === "1") return;
    img.dataset.pfMemoryHibernated = "1";
    img.dataset.pfMemorySrc = src;
    const srcset = img.getAttribute("srcset");
    if (srcset) img.dataset.pfMemorySrcset = srcset;
    img.removeAttribute("srcset");
    img.removeAttribute("src");
  });
  root.classList.add("is-memory-hibernated");
}

function restoreImages(root) {
  if (!root) return;
  root.querySelectorAll('img[data-pf-memory-hibernated="1"]').forEach((img) => {
    const src = img.dataset.pfMemorySrc;
    const srcset = img.dataset.pfMemorySrcset;
    if (src) img.setAttribute("src", src);
    if (srcset) img.setAttribute("srcset", srcset);
    delete img.dataset.pfMemoryHibernated;
    delete img.dataset.pfMemorySrc;
    delete img.dataset.pfMemorySrcset;
  });
  root.classList.remove("is-memory-hibernated");
}

function HubProjectCard({ project, index, onOpen }) {
  return (
    <button type="button" className="pf-hub-project-card" onClick={() => onOpen(project)}>
      <div className={`pf-hub-project-media tone-${project.tone}`}><div className="pf-hub-project-grid" aria-hidden="true" /></div>
      <div className="pf-hub-project-body">
        <div className="pf-hub-project-meta"><span>{String(index + 1).padStart(2, "0")}</span><em>{project.status}</em></div>
        <strong>{project.name}</strong>
        <div className="pf-hub-project-foot"><small>{project.developer} · {project.location}</small><b>Open →</b></div>
      </div>
    </button>
  );
}

export default function ProductShell({ children, onExitWorkspace, exclusiveEditor = false }) {
  const [screen, setScreen] = useState("home");
  const [project, setProject] = useState(PROJECTS[0]);
  const [mode, setMode] = useState("landing");
  const [developer, setDeveloper] = useState("All developers");
  const [query, setQuery] = useState("");
  const [overviewGroup, setOverviewGroup] = useState(DEFAULT_OVERVIEW_GROUPS[0]);
  const [units, setUnits] = useState(readAvailableUnits);
  const [sellUnits, setSellUnits] = useState(readSellUnits);
  const workspaceRef = useRef(null);

  useEffect(() => {
    const fn = (event) => {
      if (exclusiveEditor) return;
      setSellUnits(Array.isArray(event.detail?.units) ? event.detail.units : readSellUnits());
      setUnits(readAvailableUnits());
    };
    window.addEventListener("plotflow-overview-sell-units", fn);
    return () => window.removeEventListener("plotflow-overview-sell-units", fn);
  }, [exclusiveEditor]);

  useEffect(() => {
    if (exclusiveEditor) return undefined;
    const detail = { screen, mode };
    document.body.classList.toggle("pf-product-home", screen === "home");
    document.body.classList.toggle("pf-product-project", screen === "project" && mode === "landing");
    document.body.classList.toggle("pf-product-overview", screen === "project" && mode === "overview");
    document.body.classList.toggle("pf-product-detail", screen === "project" && mode === "detail");
    window.dispatchEvent(new CustomEvent("plotflow-product-view-changed", { detail }));
    return () => document.body.classList.remove("pf-product-home", "pf-product-project", "pf-product-overview", "pf-product-detail");
  }, [screen, mode, exclusiveEditor]);

  const developers = useMemo(() => ["All developers", ...Array.from(new Set(PROJECTS.map((item) => item.developer)))], []);
  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return PROJECTS.filter((item) => (
      (developer === "All developers" || item.developer === developer)
      && (!normalized || [item.code, item.name, item.developer, item.location, item.status].some((value) => String(value).toLowerCase().includes(normalized)))
    ));
  }, [developer, query]);

  const overviewGroups = useMemo(() => {
    const fromSheet = Array.from(new Set(sellUnits.map((item) => canonicalOverviewGroup(item.handover)).filter(Boolean)));
    return fromSheet.length
      ? DEFAULT_OVERVIEW_GROUPS.filter((group) => fromSheet.includes(group)).concat(fromSheet.filter((group) => !DEFAULT_OVERVIEW_GROUPS.includes(group)))
      : DEFAULT_OVERVIEW_GROUPS;
  }, [sellUnits]);

  const visibleSellUnits = useMemo(
    () => sellUnits.filter((item) => canonicalOverviewGroup(item.handover) === overviewGroup),
    [sellUnits, overviewGroup],
  );

  useEffect(() => {
    if (exclusiveEditor) return;
    if (!overviewGroups.includes(overviewGroup)) setOverviewGroup(overviewGroups[0] || "");
  }, [overviewGroups, overviewGroup, exclusiveEditor]);

  useEffect(() => {
    if (exclusiveEditor) return;
    window.dispatchEvent(new CustomEvent("pf-overview-group-changed", { detail: { group: overviewGroup } }));
  }, [overviewGroup, exclusiveEditor]);

  const detailVisible = screen === "project" && mode === "detail";

  useEffect(() => {
    if (exclusiveEditor) return undefined;
    const root = workspaceRef.current;
    if (!root) return undefined;
    if (detailVisible) restoreImages(root);
    else hibernateImages(root);
    return undefined;
  }, [detailVisible, exclusiveEditor]);

  useEffect(() => {
    if (exclusiveEditor) return undefined;
    function onLotHighlightChange(event) {
      const root = workspaceRef.current;
      if (!root) return;
      if (event?.detail?.active) hibernateImages(root, true);
      else if (detailVisible) restoreImages(root);
    }
    window.addEventListener("plotflow-lot-highlight-changed", onLotHighlightChange);
    return () => window.removeEventListener("plotflow-lot-highlight-changed", onLotHighlightChange);
  }, [detailVisible, exclusiveEditor]);

  function openProject(next) {
    setProject(next);
    setScreen("project");
    setMode("landing");
  }

  return (
    <div className={`pf-product-root ${exclusiveEditor ? "is-exclusive-editor" : ""}`}>
      {!exclusiveEditor && (
        <WorkspaceNav
          screen={screen}
          mode={mode}
          project={project}
          onExitWorkspace={onExitWorkspace}
          onProjects={() => setScreen("home")}
          onMode={setMode}
        />
      )}

      <div
        ref={workspaceRef}
        hidden={!detailVisible && !exclusiveEditor}
        className={`pf-product-workspace ${(detailVisible || exclusiveEditor) ? "is-visible" : "is-hidden"}`}
      >
        {children}
      </div>

      {!exclusiveEditor && screen === "home" && (
        <main className="pf-project-hub">
          <section className="pf-hub-intro">
            <div>
              <span>PROJECT WORKSPACE</span>
              <h1>All projects.<br /><em>One visual system.</em></h1>
              <p>Move from project data and masterplan to Overview and Detail without losing context — while keeping every workspace inside the same design language.</p>
            </div>
            <div className="pf-hub-stat"><strong>{PROJECTS.length}</strong><span>projects in workspace</span><small>Project Home → Overview → Detail</small></div>
          </section>
          <section className="pf-hub-library">
            <div className="pf-hub-section-head"><div><span>PROJECT LIBRARY</span><h2>Your projects</h2></div><small>{filteredProjects.length} shown</small></div>
            <div className="pf-hub-tools">
              <label className="pf-hub-search"><span aria-hidden="true">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects" /></label>
              <div className="pf-hub-filters">{developers.map((name) => <button key={name} type="button" className={developer === name ? "active" : ""} onClick={() => setDeveloper(name)}>{name}</button>)}</div>
            </div>
            <div className="pf-hub-project-grid">{filteredProjects.map((item, index) => <HubProjectCard key={item.id} project={item} index={index} onOpen={openProject} />)}</div>
          </section>
        </main>
      )}

      {!exclusiveEditor && screen === "project" && mode === "landing" && <ProjectLanding project={project} onOverview={() => setMode("overview")} onDetail={() => setMode("detail")} />}
      {!exclusiveEditor && screen === "project" && mode === "overview" && (
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
