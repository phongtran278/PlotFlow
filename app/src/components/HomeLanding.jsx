import { useMemo, useState } from "react";
import "./HomeLanding.css";

const PROJECTS = [
  { id: "vhspark", name: "Vinhomes Green Paradise · Saigon Park", developer: "Vinhomes", location: "TP.HCM", status: "active", note: "Round 1 workspace" },
  { id: "masterise", name: "Masterise Homes Project", developer: "Masterise", location: "Vietnam", status: "soon", note: "Coming soon" },
  { id: "gamuda", name: "Gamuda Land Project", developer: "Gamuda", location: "Vietnam", status: "soon", note: "Coming soon" },
  { id: "future", name: "Next residential collection", developer: "Other", location: "Vietnam", status: "soon", note: "Coming soon" },
];

const FAQ = [
  [
    "PlotFlow khác gì so với một template thiết kế thông thường?",
    "Template chỉ giúp bạn bắt đầu nhanh. PlotFlow đi xa hơn: dữ liệu bán hàng, masterplan, locator, artwork và export nằm trong cùng một workflow. Designer không phải lặp lại những thao tác máy móc, nhưng vẫn giữ quyền quyết định ở những chỗ ảnh hưởng trực tiếp đến chất lượng hình ảnh.",
  ],
  [
    "Tại sao PlotFlow vẫn cho chỉnh tay nếu đã có automation?",
    "Vì sản phẩm bán hàng không nên trông như được sinh ra bởi một chiếc máy. Automation xử lý phần lặp lại; designer vẫn có thể chỉnh floorplan view, highlight, card layout, connector, hierarchy và asset. Mục tiêu là tăng tốc mà không đánh đổi craft.",
  ],
  [
    "Một project mới có phải làm lại mọi thứ từ đầu không?",
    "Không. PlotFlow được xây theo cấu trúc project: dữ liệu, masterplan và asset thay đổi, nhưng logic vận hành có thể tái sử dụng. Khi hệ thống trưởng thành hơn, một project mới sẽ giống việc cấu hình một workspace mới hơn là dựng lại cả quy trình.",
  ],
  [
    "PlotFlow phù hợp nhất với ai?",
    "Những team bất động sản cần sản xuất số lượng artwork lớn nhưng vẫn muốn giữ chuẩn thiết kế. Sales có dữ liệu rõ hơn, designer bớt thao tác lặp, còn người review nhìn được trạng thái và can thiệp đúng chỗ.",
  ],
  [
    "Chất lượng file có bị hy sinh để đổi lấy tốc độ không?",
    "Không theo hướng đó. PlotFlow ưu tiên preview nhẹ để làm việc nhanh, nhưng vẫn giữ workflow export độ phân giải cao và vector PDF khi nguồn cho phép. Tốc độ dùng để giảm thời gian thao tác, không phải giảm chất lượng đầu ra.",
  ],
];

export default function HomeLanding({ onOpenProject }) {
  const [filter, setFilter] = useState("All");
  const [feedback, setFeedback] = useState("");
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
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
        <a className="pf-home-brand" href="#top" aria-label="PlotFlow home">PlotFlow</a>
        <nav aria-label="Homepage sections">
          <a href="#product">Product</a>
          <a href="#workflow">Workflow</a>
          <a href="#projects">Projects</a>
          <a href="#faq">FAQ</a>
        </nav>
        <button type="button" className="pf-home-open" onClick={onOpenProject}>Open workspace <span>↗</span></button>
      </header>

      <main id="top">
        <section className="pf-home-hero" id="product">
          <div className="pf-home-hero-copy">
            <div className="pf-home-eyebrow"><i /> Design operations for real estate</div>
            <h1>Make the repetitive <em>disappear.</em><br />Keep the design.</h1>
            <p>PlotFlow biến dữ liệu bán hàng và masterplan thành một workflow thiết kế có thể kiểm soát. Automation xử lý phần lặp lại; designer giữ lại những quyết định tạo nên chất lượng.</p>
            <div className="pf-home-hero-actions">
              <button type="button" onClick={onOpenProject}>Explore Saigon Park <span>→</span></button>
              <a href="#workflow">See the workflow</a>
            </div>
            <div className="pf-home-proof">
              <span><b>01</b> Data connected</span>
              <span><b>02</b> Designer controlled</span>
              <span><b>03</b> Export ready</span>
            </div>
          </div>

          <div className="pf-home-hero-visual" aria-label="PlotFlow product preview">
            <div className="pf-home-product-frame">
              <div className="pf-home-frame-top"><span>Saigon Park / Overview</span><b>Live workspace</b></div>
              <div className="pf-home-product-canvas">
                <div className="pf-home-plan">
                  <i className="road r1" /><i className="road r2" /><i className="road r3" />
                  {Array.from({ length: 16 }).map((_, index) => <i className={`lot l${index + 1}`} key={index} />)}
                  <i className="highlight h1" /><i className="highlight h2" />
                </div>
                <svg className="pf-home-connectors" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <line x1="16" y1="29" x2="42" y2="35" />
                  <line x1="16" y1="62" x2="39" y2="59" />
                  <line x1="84" y1="38" x2="61" y2="43" />
                  <line x1="84" y1="69" x2="64" y2="64" />
                </svg>
                <div className="pf-home-sales-card c1"><small>SA5-12</small><strong>24.8 tỷ</strong><span>216m² · Song lập</span></div>
                <div className="pf-home-sales-card c2"><small>SA5-18</small><strong>21.6 tỷ</strong><span>180m² · Liền kề</span></div>
                <div className="pf-home-sales-card c3"><small>SA6-03</small><strong>27.1 tỷ</strong><span>240m² · Song lập</span></div>
                <div className="pf-home-sales-card c4"><small>SA6-08</small><strong>19.9 tỷ</strong><span>160m² · Liền kề</span></div>
                <div className="pf-home-detail-preview">
                  <small>DETAIL</small><b>SA5-12</b><span>Floorplan located · ready to compose</span>
                </div>
              </div>
            </div>
            <div className="pf-home-product-note one"><i>⌖</i><div><b>Floorplan Locator</b><span>Find the right unit without hunting pages.</span></div></div>
            <div className="pf-home-product-note two"><i>✦</i><div><b>Manual control stays</b><span>Move, highlight, refine and export.</span></div></div>
          </div>
        </section>

        <section className="pf-home-statement">
          <span>PlotFlow is built around one idea:</span>
          <p>“A designer should spend more time making decisions — and less time repeating them.”</p>
        </section>

        <section className="pf-home-workflow" id="workflow">
          <div className="pf-home-section-head">
            <span>THE WORKFLOW</span>
            <h2>From raw project data to something people actually want to look at.</h2>
            <p>Mỗi bước đều đủ tự động để nhanh hơn, nhưng vẫn đủ mở để designer nhìn thấy, hiểu và chỉnh lại khi cần.</p>
          </div>
          <div className="pf-home-steps">
            <article><b>01</b><div><h3>Connect the source</h3><p>Google Sheet hoặc Excel trở thành nguồn dữ liệu chung. Masterplan PDF chỉ được tải khi cần, để trải nghiệm khởi động vẫn nhẹ.</p></div></article>
            <article><b>02</b><div><h3>Let PlotFlow do the repetitive work</h3><p>Locate floorplan, đưa dữ liệu vào đúng vị trí, dựng Overview và chuẩn bị những layer cần thiết cho một artwork có thể review.</p></div></article>
            <article><b>03</b><div><h3>Make it yours</h3><p>Fine-tune view, highlight, connector, card layout và asset. Đây là nơi automation dừng lại và mắt nghề của designer tiếp tục.</p></div></article>
            <article><b>04</b><div><h3>Export without shrinking the craft</h3><p>Xuất từng căn hoặc batch ở nhiều mức độ phân giải, phù hợp từ review nhanh đến zoom sâu và gửi file chất lượng cao.</p></div></article>
          </div>
        </section>

        <section className="pf-home-projects" id="projects">
          <div className="pf-home-section-head compact">
            <span>PROJECT LIBRARY</span>
            <h2>One system. Many projects.</h2>
            <p>Saigon Park đang là workspace được phát triển sâu nhất. Những project kế tiếp sẽ dùng lại cùng nền tảng thay vì bắt đầu lại từ con số không.</p>
          </div>
          <div className="pf-home-project-toolbar">
            <div className="pf-home-filters" role="group" aria-label="Filter projects by developer">
              {developers.map((item) => <button type="button" key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
            </div>
            <span>{filtered.length} project{filtered.length === 1 ? "" : "s"}</span>
          </div>
          <div className="pf-home-project-table" role="table" aria-label="PlotFlow projects">
            <div className="pf-home-project-row heading" role="row"><span>Project</span><span>Developer</span><span>Location</span><span>Status</span><span /></div>
            {filtered.map((project) => (
              <div className={`pf-home-project-row ${project.status}`} role="row" key={project.id}>
                <div><i>{project.status === "active" ? "01" : "—"}</i><strong>{project.name}</strong><small>{project.note}</small></div>
                <span>{project.developer}</span><span>{project.location}</span>
                <span className="status"><i />{project.status === "active" ? "Active" : "Coming soon"}</span>
                {project.status === "active" ? <button type="button" onClick={onOpenProject}>Open <b>↗</b></button> : <em>Locked</em>}
              </div>
            ))}
          </div>
        </section>

        <section className="pf-home-faq" id="faq">
          <div className="pf-home-section-head compact">
            <span>WHY PLOTFLOW</span>
            <h2>Built for the part between data and design.</h2>
            <p>Những câu hỏi quan trọng nhất không phải “có bao nhiêu tool”, mà là sản phẩm này giúp team làm tốt hơn ở đâu.</p>
          </div>
          <div className="pf-home-faq-list">
            {FAQ.map(([question, answer], index) => {
              const isOpen = openFaq === index;
              return (
                <article className={isOpen ? "open" : ""} key={question}>
                  <button type="button" onClick={() => setOpenFaq(isOpen ? -1 : index)} aria-expanded={isOpen}>
                    <span>{String(index + 1).padStart(2, "0")}</span><strong>{question}</strong><i>＋</i>
                  </button>
                  <div className="pf-home-faq-answer"><div><p>{answer}</p></div></div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="pf-home-feedback">
          <div><span>BUILD WITH US</span><h2>Thấy một bước có thể tốt hơn?</h2><p>PlotFlow đang được xây từ chính những tình huống xảy ra trong workflow thật. Một góp ý nhỏ hôm nay có thể trở thành một phần của hệ thống ngày mai.</p></div>
          <div className="pf-home-feedback-box">
            <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Một workflow, một thao tác, hoặc một chi tiết bạn muốn PlotFlow làm tốt hơn…" rows={4} />
            <footer><small>{savedFeedback ? "✓ Đã lưu feedback trên thiết bị" : "Local feedback · chỉ lưu trên thiết bị này"}</small><button type="button" onClick={saveFeedback} disabled={!feedback.trim()}>Save feedback</button></footer>
          </div>
        </section>
      </main>

      <footer className="pf-home-footer">
        <div className="pf-home-footer-brand">PlotFlow</div>
        <div className="pf-home-footer-meta">
          <div><strong>Design operations for real estate.</strong><span>Data → Compose → Review → Export</span></div>
          <div><span>Current workspace</span><strong>Vinhomes Green Paradise · Saigon Park</strong></div>
          <div className="right"><span>Product preview</span><strong>2026</strong></div>
        </div>
      </footer>
    </div>
  );
}
