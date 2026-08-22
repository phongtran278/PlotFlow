import { useMemo, useState } from "react";
import "./HomeLanding.css";

const PROJECTS = [
  {
    id: "vhspark",
    name: "Vinhomes Green Paradise · Saigon Park",
    developer: "Vinhomes",
    location: "TP.HCM",
    status: "active",
    note: "Round 1 workspace",
  },
  {
    id: "masterise",
    name: "Masterise Homes Project",
    developer: "Masterise",
    location: "Vietnam",
    status: "soon",
    note: "Coming soon",
  },
  {
    id: "gamuda",
    name: "Gamuda Land Project",
    developer: "Gamuda",
    location: "Vietnam",
    status: "soon",
    note: "Coming soon",
  },
  {
    id: "future",
    name: "Next residential collection",
    developer: "Other",
    location: "Vietnam",
    status: "soon",
    note: "Coming soon",
  },
];

const FAQ = [
  ["PlotFlow dùng để làm gì?", "Biến dữ liệu bán hàng + masterplan thành artwork bất động sản có thể review, tinh chỉnh và export theo từng căn."],
  ["Tôi có cần chuẩn bị file gì?", "Một Google Sheet hoặc Excel cho dữ liệu căn. Masterplan PDF chỉ cần khi bạn muốn dùng Floorplan Locator / Overview."],
  ["Có thể chỉnh tay sau khi tự động hóa không?", "Có. Các bước quan trọng vẫn giữ quyền can thiệp bằng tay: floorplan view, lot highlight, card layout, anchor và các layer thiết kế."],
  ["Dữ liệu project khác có dùng được không?", "Có thể mở rộng theo cùng cấu trúc. Các project ngoài workspace hiện tại đang được để Coming Soon để giao diện tập trung và dễ kiểm thử."],
];

export default function HomeLanding({ onOpenProject }) {
  const [filter, setFilter] = useState("All");
  const [feedback, setFeedback] = useState("");
  const [savedFeedback, setSavedFeedback] = useState(false);
  const developers = ["All", "Vinhomes", "Masterise", "Gamuda"];

  const filtered = useMemo(() => (
    filter === "All" ? PROJECTS : PROJECTS.filter((project) => project.developer === filter)
  ), [filter]);

  function saveFeedback() {
    const value = feedback.trim();
    if (!value) return;
    try {
      const history = JSON.parse(localStorage.getItem("plotflow-local-feedback-v1") || "[]");
      const next = [{ text: value, createdAt: new Date().toISOString() }, ...(Array.isArray(history) ? history : [])].slice(0, 20);
      localStorage.setItem("plotflow-local-feedback-v1", JSON.stringify(next));
    } catch { /* local feedback is best-effort */ }
    setFeedback("");
    setSavedFeedback(true);
    window.setTimeout(() => setSavedFeedback(false), 2600);
  }

  return (
    <div className="pf-home">
      <header className="pf-home-nav">
        <button type="button" className="pf-home-brand" aria-label="PlotFlow home">
          <span>PlotFlow</span><i>PF</i>
        </button>
        <nav aria-label="Homepage sections">
          <a href="#product">Product</a>
          <a href="#projects">Projects</a>
          <a href="#faq">FAQ</a>
        </nav>
        <button type="button" className="pf-home-open" onClick={onOpenProject}>Open workspace <span>↗</span></button>
      </header>

      <main>
        <section className="pf-home-hero" id="product">
          <div className="pf-home-hero-copy">
            <div className="pf-home-eyebrow"><i /> Real-estate design operating system</div>
            <h1>From property data<br />to sales-ready design.</h1>
            <p>PlotFlow kết nối dữ liệu, masterplan và hệ thống thiết kế trong một workflow gọn — đủ tự động để nhanh, đủ thủ công để designer vẫn kiểm soát chất lượng.</p>
            <div className="pf-home-hero-actions">
              <button type="button" className="primary" onClick={onOpenProject}>Enter Saigon Park workspace <span>→</span></button>
              <a href="#workflow">How it works</a>
            </div>
            <div className="pf-home-proof" aria-label="Product capabilities">
              <span><b>01</b> Connect data</span>
              <span><b>02</b> Locate & compose</span>
              <span><b>03</b> Review & export</span>
            </div>
          </div>

          <div className="pf-home-hero-visual" aria-label="PlotFlow workflow preview">
            <div className="pf-home-window">
              <header><span><i /><i /><i /></span><strong>PlotFlow / Saigon Park</strong><em>Live workspace</em></header>
              <div className="pf-home-window-body">
                <aside>
                  <small>PROJECT DATA</small>
                  <strong>Saigon Park</strong>
                  <span>Google Sheet</span>
                  <span>Masterplan PDF</span>
                  <span>Design assets</span>
                </aside>
                <section>
                  <div className="pf-home-canvas-card large"><small>DETAIL</small><b>SA5-12</b><span>Floorplan + sales information</span></div>
                  <div className="pf-home-canvas-card"><small>OVERVIEW</small><b>12 units</b><span>Cards, connectors, highlights</span></div>
                  <div className="pf-home-canvas-card"><small>EXPORT</small><b>1× — 5×</b><span>Review-ready output</span></div>
                </section>
              </div>
            </div>
            <div className="pf-home-float one"><span>✓</span><div><b>Floorplan found</b><small>Text-anchor locator</small></div></div>
            <div className="pf-home-float two"><span>↗</span><div><b>Designer controlled</b><small>Manual override stays available</small></div></div>
          </div>
        </section>

        <section className="pf-home-workflow" id="workflow">
          <div className="pf-home-section-head">
            <span>WORKFLOW</span>
            <h2>One clear path from source to output.</h2>
            <p>Không biến app thành một bộ tool khổng lồ. PlotFlow giữ từng bước đủ rõ để designer biết AI / automation đang làm gì và can thiệp ở đâu.</p>
          </div>
          <div className="pf-home-steps">
            <article><b>01</b><div><h3>Connect</h3><p>Nạp Google Sheet hoặc Excel. Chỉ kết nối PDF khi cần locator để startup vẫn nhẹ.</p></div></article>
            <article><b>02</b><div><h3>Compose</h3><p>Ghép floorplan, house, amenity, logo và Overview theo hệ thống thiết kế đã định nghĩa.</p></div></article>
            <article><b>03</b><div><h3>Review</h3><p>Fine-tune vị trí, highlight, connector, hierarchy rồi export ở độ phân giải phù hợp.</p></div></article>
          </div>
        </section>

        <section className="pf-home-projects" id="projects">
          <div className="pf-home-section-head compact">
            <span>PROJECTS</span>
            <h2>Project workspace.</h2>
            <p>Một workspace đang active. Các project tiếp theo được giữ tối giản để tập trung kiểm thử chất lượng trước khi mở rộng.</p>
          </div>

          <div className="pf-home-project-toolbar">
            <div className="pf-home-filters" role="group" aria-label="Filter projects by developer">
              {developers.map((item) => <button type="button" key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
            </div>
            <span>{filtered.length} project{filtered.length === 1 ? "" : "s"}</span>
          </div>

          <div className="pf-home-project-table" role="table" aria-label="PlotFlow projects">
            <div className="pf-home-project-row heading" role="row">
              <span>Project</span><span>Developer</span><span>Location</span><span>Status</span><span />
            </div>
            {filtered.map((project) => (
              <div className={`pf-home-project-row ${project.status}`} role="row" key={project.id}>
                <div><i>{project.status === "active" ? "01" : "—"}</i><strong>{project.name}</strong><small>{project.note}</small></div>
                <span>{project.developer}</span>
                <span>{project.location}</span>
                <span className="status"><i />{project.status === "active" ? "Active" : "Coming soon"}</span>
                {project.status === "active" ? <button type="button" onClick={onOpenProject}>Open <b>↗</b></button> : <em>Locked</em>}
              </div>
            ))}
          </div>
        </section>

        <section className="pf-home-faq" id="faq">
          <div className="pf-home-section-head compact">
            <span>FAQ</span>
            <h2>Before you start.</h2>
          </div>
          <div className="pf-home-faq-list">
            {FAQ.map(([question, answer], index) => (
              <details key={question} open={index === 0}>
                <summary><span>{String(index + 1).padStart(2, "0")}</span><strong>{question}</strong><i>＋</i></summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="pf-home-feedback">
          <div><span>PRODUCT FEEDBACK</span><h2>Thiếu một bước trong workflow?</h2><p>Ghi lại góp ý hoặc feature request để review trong vòng test. Hiện nội dung được lưu cục bộ trên thiết bị này.</p></div>
          <div className="pf-home-feedback-box">
            <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Ví dụ: cần thêm preset layout cho Overview…" rows={4} />
            <footer><small>{savedFeedback ? "✓ Đã lưu feedback trên thiết bị" : "Local feedback · không gửi ra ngoài"}</small><button type="button" onClick={saveFeedback} disabled={!feedback.trim()}>Save feedback</button></footer>
          </div>
        </section>
      </main>

      <footer className="pf-home-footer">
        <div><strong>PlotFlow</strong><span>Real-estate design workflow</span></div>
        <p>Data → Design → Review → Export</p>
        <small>Product preview · 2026</small>
      </footer>
    </div>
  );
}
