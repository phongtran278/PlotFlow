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

const OVERVIEW_GROUPS = ["Hoàn thiện", "Đang xây", "Bàn giao thô"];

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
  const [overviewGroup, setOverviewGroup] = useState(OVERVIEW_GROUPS[0]);
  const [units, setUnits] = useState([]);

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

  function openProject(nextProject) {
    setProject(nextProject);
    setScreen("project");
    setMode("overview");
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

          <div className="pf-overview-layout pf-overview-layout-wide">
            <section className="pf-masterplan-card">
              <div className="pf-masterplan-head pf-masterplan-head-callouts">
                <div><span>OVERVIEW</span><h1>{project.name}</h1></div>
                <div className="pf-overview-groups" role="group" aria-label="Trạng thái sản phẩm">
                  {OVERVIEW_GROUPS.map((group) => <button key={group} type="button" className={overviewGroup === group ? "active" : ""} onClick={() => setOverviewGroup(group)}>{group}</button>)}
                </div>
              </div>
              <div className={`pf-masterplan-stage ${project.masterplan ? "has-real-pdf has-callouts" : ""}`}>
                {project.masterplan ? (
                  <iframe className="pf-masterplan-pdf" title={`${project.name} masterplan`} src="/masterplan/masterplan.pdf#toolbar=0&navpanes=0&scrollbar=0&view=FitH" />
                ) : (
                  <div className={`pf-project-overview-placeholder tone-${project.tone}`}><strong>{project.name}</strong><span>{project.developer}</span></div>
                )}
                {project.masterplan && overviewGroup === "Hoàn thiện" && units.length === 0 && (
                  <div className="pf-overview-coming"><strong>Chưa có dữ liệu căn thật</strong><span>Connect Sheet hoặc Import Excel ở Detail. Overview sẽ chỉ hiển thị unit thật, không dùng dữ liệu demo.</span></div>
                )}
                {project.masterplan && overviewGroup !== "Hoàn thiện" && (
                  <div className="pf-overview-coming"><strong>{overviewGroup}</strong><span>Nhóm này sẽ lấy từ nguồn dữ liệu Overview riêng.</span></div>
                )}
              </div>
            </section>

            <aside className="pf-overview-side pf-overview-guide">
              <div className="pf-side-card"><span>LIVE DATA</span><strong>{units.length} unit thật</strong><p>Overview dùng cùng mã căn với Detail. Không còn fallback bằng mã demo.</p></div>
              <div className="pf-side-card"><span>WORKFLOW</span><strong>Double-click → Focus</strong><p>Định vị mã trên PDF, chỉnh anchor một lần rồi lưu lại để dùng tiếp.</p></div>
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
