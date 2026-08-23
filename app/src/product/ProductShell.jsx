import { useEffect, useMemo, useState } from "react";
import "./ProductShell.css";
import "./OverviewCallouts.css";
import ProjectLanding from "./ProjectLanding.jsx";

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

const DEFAULT_OVERVIEW_GROUPS = ["Hoàn thiện", "Giãn xây", "Bàn giao thô"];
const SELL_STORAGE_KEY = "plotflow-overview-sell-units-v1";

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

function WorkspaceNav({ screen, mode, onExitWorkspace, onProjects, onMode }) {
  const inProject = screen === "project";
  return (
    <header className="pf-workspace-nav">
      <button type="button" className="pf-workspace-brand" onClick={onExitWorkspace} aria-label="Back to PlotFlow home">PlotFlow</button>
      <nav aria-label="Workspace navigation">
        <button type="button" className={screen === "home" ? "active" : ""} onClick={onProjects}>Projects</button>
        {inProject && <button type="button" className={mode === "landing" ? "active" : ""} onClick={() => onMode("landing")}>Project</button>}
        {inProject && <button type="button" className={mode === "overview" ? "active" : ""} onClick={() => onMode("overview")}>Overview</button>}
        {inProject && <button type="button" className={mode === "detail" ? "active" : ""} onClick={() => onMode("detail")}>Detail</button>}
      </nav>
      <div className="pf-workspace-nav-spacer" aria-hidden="true" />
    </header>
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
    const fromSheet = Array.from(new Set(sellUnits.map((item) => String(item.handover || "").trim()).filter(Boolean)));
    return fromSheet.length ? fromSheet : DEFAULT_OVERVIEW_GROUPS;
  }, [sellUnits]);
  const visibleSellUnits = useMemo(() => sellUnits.filter((item) => String(item.handover || "").trim() === overviewGroup), [sellUnits, overviewGroup]);

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
              <small>Project → Overview → Detail</small>
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
        <main className="pf-overview">
          {project.masterplan && <div className="pf-overview-control-rail" aria-label="Overview editor controls" />}

          <div className="pf-overview-layout pf-overview-layout-wide">
            <section className="pf-masterplan-card">
              <div className="pf-masterplan-head pf-masterplan-head-callouts">
                <div><span>OVERVIEW</span><h1>{project.name}</h1></div>
                <div className="pf-overview-groups" role="group" aria-label="Tiêu chuẩn bàn giao">
                  {overviewGroups.map((group) => <button key={group} type="button" className={overviewGroup === group ? "active" : ""} onClick={() => setOverviewGroup(group)}>{group}</button>)}
                </div>
              </div>
              <div className={`pf-masterplan-stage ${project.masterplan ? "has-real-pdf has-callouts" : ""}`} data-overview-group={overviewGroup}>
                {project.masterplan ? (
                  <iframe className="pf-masterplan-pdf" title={`${project.name} masterplan`} src="/masterplan/masterplan.pdf#toolbar=0&navpanes=0&scrollbar=0&view=FitH" />
                ) : (
                  <div className={`pf-project-overview-placeholder tone-${project.tone}`}><strong>{project.name}</strong><span>{project.developer}</span></div>
                )}
                {project.masterplan && sellUnits.length > 0 && visibleSellUnits.length === 0 && (
                  <div className="pf-overview-coming"><strong>{overviewGroup}</strong><span>Không có căn nào thuộc đúng tiêu chuẩn bàn giao này trong file sell đang kết nối.</span></div>
                )}
                {project.masterplan && sellUnits.length === 0 && units.length === 0 && (
                  <div className="pf-overview-coming"><strong>Chưa có dữ liệu căn thật</strong><span>Connect Sheet ở Detail. Overview sẽ đọc nguyên dữ liệu sell và không dùng dữ liệu demo.</span></div>
                )}
              </div>
            </section>

            <aside className="pf-overview-side pf-overview-guide">
              <div className="pf-side-card"><span>LIVE DATA</span><strong>{sellUnits.length || units.length} unit thật</strong><p>Tab TCBG và card Overview lấy trực tiếp từ file sell đang kết nối.</p></div>
              <div className="pf-side-card"><span>WORKFLOW</span><strong>Focus → Arrange → Style</strong><p>Định vị lô, tự dàn card trái/phải rồi tinh chỉnh style và highlight.</p></div>
            </aside>
          </div>
        </main>
      )}
    </div>
  );
}
