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

const OVERVIEW_CALLOUTS = [
  { code: "AS-15", x: 39, y: 18, side: "left", row: 0, handover: "Hoàn thiện", land: "96 m²", floor: "280 m²", price1: "18.6 tỷ", price2: "16.9 tỷ" },
  { code: "AS-18", x: 44, y: 31, side: "left", row: 1, handover: "Hoàn thiện", land: "100 m²", floor: "292 m²", price1: "19.2 tỷ", price2: "17.5 tỷ" },
  { code: "AS-21", x: 47, y: 45, side: "left", row: 2, handover: "Hoàn thiện", land: "120 m²", floor: "338 m²", price1: "21.4 tỷ", price2: "19.8 tỷ" },
  { code: "AS-24", x: 42, y: 60, side: "left", row: 3, handover: "Hoàn thiện", land: "105 m²", floor: "301 m²", price1: "20.8 tỷ", price2: "18.9 tỷ" },
  { code: "AS-27", x: 46, y: 75, side: "left", row: 4, handover: "Hoàn thiện", land: "128 m²", floor: "356 m²", price1: "23.1 tỷ", price2: "21.2 tỷ" },
  { code: "AS-31", x: 58, y: 20, side: "right", row: 0, handover: "Hoàn thiện", land: "110 m²", floor: "318 m²", price1: "22.1 tỷ", price2: "20.3 tỷ" },
  { code: "AS-34", x: 61, y: 34, side: "right", row: 1, handover: "Hoàn thiện", land: "126 m²", floor: "348 m²", price1: "24.8 tỷ", price2: "22.7 tỷ" },
  { code: "AS-37", x: 55, y: 48, side: "right", row: 2, handover: "Hoàn thiện", land: "98 m²", floor: "286 m²", price1: "20.5 tỷ", price2: "18.7 tỷ" },
  { code: "AS-40", x: 62, y: 63, side: "right", row: 3, handover: "Hoàn thiện", land: "115 m²", floor: "326 m²", price1: "22.9 tỷ", price2: "20.9 tỷ" },
  { code: "AS-43", x: 57, y: 78, side: "right", row: 4, handover: "Hoàn thiện", land: "132 m²", floor: "365 m²", price1: "25.6 tỷ", price2: "23.5 tỷ" },
];

const DEMO_PLOTS = OVERVIEW_CALLOUTS.map((item) => ({ code: item.code, x: item.x, y: item.y, price: item.price1, type: item.handover }));

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

function OverviewCallouts({ items, activeUnit, onSelect, onOpenDetail }) {
  const rowY = [16, 33, 50, 67, 84];
  return (
    <div className="pf-callout-layer" aria-label="Sales overview callouts">
      <svg className="pf-callout-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {items.map((item) => {
          const startX = item.side === "left" ? 22 : 78;
          const startY = rowY[item.row];
          return <line key={item.code} x1={startX} y1={startY} x2={item.x} y2={item.y} className={activeUnit === item.code ? "active" : ""} />;
        })}
      </svg>

      {items.map((item) => (
        <button
          key={item.code}
          type="button"
          className={`pf-map-anchor ${activeUnit === item.code ? "active" : ""}`}
          style={{ left: `${item.x}%`, top: `${item.y}%` }}
          onClick={() => onSelect(item.code)}
          title={`Mã lô ${item.code}`}
        >
          {item.code}
        </button>
      ))}

      {items.map((item) => (
        <article
          key={`${item.code}-card`}
          className={`pf-sales-callout side-${item.side} ${activeUnit === item.code ? "active" : ""}`}
          style={{ "--callout-row": item.row }}
          onMouseEnter={() => onSelect(item.code)}
        >
          <button type="button" className="pf-sales-callout-hit" onClick={() => onSelect(item.code)} aria-label={`Chọn ${item.code}`} />
          <header><strong>{item.code}</strong><span>{item.handover}</span></header>
          <div className="pf-sales-specs"><span>Đất <b>{item.land}</b></span><span>Sàn <b>{item.floor}</b></span></div>
          <div className="pf-sales-prices"><span><small>Giá chuẩn</small><b>{item.price1}</b></span><span><small>Ưu đãi</small><b>{item.price2}</b></span></div>
          {activeUnit === item.code && <button type="button" className="pf-sales-open" onClick={() => onOpenDetail(item.code)}>Chi tiết →</button>}
        </article>
      ))}
    </div>
  );
}

export default function ProductShell({ children }) {
  const [screen, setScreen] = useState("home");
  const [project, setProject] = useState(PROJECTS[0]);
  const [mode, setMode] = useState("overview");
  const [developer, setDeveloper] = useState("All developers");
  const [overviewGroup, setOverviewGroup] = useState(OVERVIEW_GROUPS[0]);
  const [units, setUnits] = useState([]);
  const [activeUnit, setActiveUnit] = useState(OVERVIEW_CALLOUTS[0].code);

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
    setActiveUnit(OVERVIEW_CALLOUTS[0].code);
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
                {project.masterplan && overviewGroup === "Hoàn thiện" && (
                  <OverviewCallouts items={OVERVIEW_CALLOUTS} activeUnit={activeUnit} onSelect={setActiveUnit} onOpenDetail={openUnit} />
                )}
                {project.masterplan && overviewGroup !== "Hoàn thiện" && (
                  <div className="pf-overview-coming"><strong>{overviewGroup}</strong><span>Giữ cùng layout 5 trái · 5 phải. Data sẽ lấy từ file Overview riêng.</span></div>
                )}
              </div>
            </section>

            <aside className="pf-overview-side pf-overview-guide">
              <div className="pf-side-card"><span>LAYOUT LOGIC</span><strong>5 trái · 5 phải</strong><p>Mỗi mã lô là một điểm neo. Card giữ hàng thẳng; line được phép xiên để chỉ đúng tâm lô mà không chồng chéo.</p></div>
              <div className="pf-side-card"><span>PERFORMANCE</span><strong>10 card · 10 line</strong><p>SVG tĩnh + HTML nhẹ. Không canvas loop, không animation liên tục, không tính collision mỗi frame.</p></div>
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
