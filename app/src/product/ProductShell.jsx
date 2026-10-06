import { useEffect, useMemo, useRef, useState } from "react";
import "./ProductShell.css";
import "./OverviewCallouts.css";
import ProjectLanding from "./ProjectLanding.jsx";
import WorkspaceNav from "./WorkspaceNav.jsx";
import OverviewWorkspace from "./OverviewWorkspace.jsx";
import { PROJECTS } from "./projectCatalog.js";
import { ProjectProvider } from "../project/ProjectContext.jsx";

const DEFAULT_OVERVIEW_GROUPS = ["Hoàn thiện", "Giãn xây", "Xây thô"];
const SELL_STORAGE_KEY = "plotflow-overview-sell-units-v1";
const VALID_MODES = new Set(["landing", "overview", "detail"]);

function productPath(screen, project, mode) {
  if (screen !== "project" || !project?.id) return "/projects";
  const suffix = mode === "overview" ? "/overview" : mode === "detail" ? "/detail" : "";
  return `/projects/${encodeURIComponent(project.id)}${suffix}`;
}

function readProductRoute() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts[0] === "projects") {
    const projectId = decodeURIComponent(parts[1] || "");
    const project = PROJECTS.find((item) => item.id === projectId) || PROJECTS[0];
    const mode = VALID_MODES.has(parts[2]) ? parts[2] : "landing";
    const screen = projectId && PROJECTS.some((item) => item.id === projectId) ? "project" : "home";
    return { screen, project, mode, legacy: false };
  }

  // Compatibility for the short-lived query-param routes shipped before slugs.
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("project") || "";
  const project = PROJECTS.find((item) => item.id === projectId) || PROJECTS[0];
  const mode = VALID_MODES.has(params.get("mode")) ? params.get("mode") : "landing";
  const screen = projectId ? "project" : "home";
  return { screen, project, mode, legacy: Boolean(params.get("workspace") || projectId || params.get("mode")) };
}

function writeProductRoute(screen, project, mode, { replace = false } = {}) {
  const url = new URL(window.location.href);
  url.pathname = productPath(screen, project, mode);
  url.searchParams.delete("workspace");
  url.searchParams.delete("project");
  url.searchParams.delete("mode");
  const state = { plotflow: true, screen, projectId: project?.id || "", mode };
  window.history[replace ? "replaceState" : "pushState"](state, "", url);
}

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
  const initialRouteRef = useRef(null);
  if (!initialRouteRef.current) initialRouteRef.current = readProductRoute();
  const [screen, setScreen] = useState(initialRouteRef.current.screen);
  const [project, setProject] = useState(initialRouteRef.current.project);
  const [mode, setMode] = useState(initialRouteRef.current.mode);
  const [developer, setDeveloper] = useState("All");
  const [query, setQuery] = useState("");
  const [overviewGroup, setOverviewGroup] = useState(DEFAULT_OVERVIEW_GROUPS[0]);
  const [units, setUnits] = useState(readAvailableUnits);
  const [sellUnits, setSellUnits] = useState(readSellUnits);
  const workspaceRef = useRef(null);
  const overviewSyncReadyRef = useRef(false);

  useEffect(() => {
    if (exclusiveEditor) return undefined;
    if (initialRouteRef.current?.legacy) {
      writeProductRoute(screen, project, mode, { replace: true });
      initialRouteRef.current = { ...initialRouteRef.current, legacy: false };
    }
    function onPopState() {
      const next = readProductRoute();
      setProject(next.project);
      setScreen(next.screen);
      setMode(next.mode);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [exclusiveEditor]);

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

  const developers = useMemo(() => ["All", ...Array.from(new Set(PROJECTS.map((item) => item.developer)))], []);
  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return PROJECTS.filter((item) => (
      (developer === "All" || item.developer === developer)
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
    if (exclusiveEditor) return undefined;
    if (screen !== "project" || mode !== "overview") {
      overviewSyncReadyRef.current = false;
      return undefined;
    }

    let raf1 = 0;
    let raf2 = 0;
    const dispatchGroup = (source) => {
      window.dispatchEvent(new CustomEvent("pf-overview-group-changed", { detail: { group: overviewGroup, source } }));
    };

    if (!overviewSyncReadyRef.current) {
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          overviewSyncReadyRef.current = true;
          dispatchGroup("overview-entry-sync");
        });
      });
    } else {
      raf1 = window.requestAnimationFrame(() => dispatchGroup("handover-tab"));
    }

    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [screen, mode, overviewGroup, exclusiveEditor]);

  const detailVisible = screen === "project" && mode === "detail";

  useEffect(() => {
    if (exclusiveEditor) return undefined;
    const root = workspaceRef.current;
    if (!root) return undefined;
    if (detailVisible) {
      restoreImages(root);
      const sidebar = root.querySelector(".unit-sidebar");
      if (sidebar && sidebar.scrollTop > 0) sidebar.scrollTo({ top: 0, behavior: "auto" });
    } else {
      hibernateImages(root);
    }
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
    writeProductRoute("project", next, "landing");
    setProject(next);
    setScreen("project");
    setMode("landing");
  }

  function openProjects() {
    writeProductRoute("home", project, "landing");
    setScreen("home");
    setMode("landing");
  }

  function openMode(nextMode) {
    const safeMode = VALID_MODES.has(nextMode) ? nextMode : "landing";
    writeProductRoute("project", project, safeMode);
    setScreen("project");
    setMode(safeMode);
  }

  return (
    <ProjectProvider project={project}>
      <div className={`pf-product-root ${exclusiveEditor ? "is-exclusive-editor" : ""}`}>
      {!exclusiveEditor && (
        <WorkspaceNav
          screen={screen}
          mode={mode}
          project={project}
          onExitWorkspace={onExitWorkspace}
          onProjects={openProjects}
          onMode={openMode}
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

      {!exclusiveEditor && screen === "project" && mode === "landing" && <ProjectLanding project={project} onOverview={() => openMode("overview")} onDetail={() => openMode("detail")} />}
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
    </ProjectProvider>
  );
}
