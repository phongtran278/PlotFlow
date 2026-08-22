import { useMemo, useState } from "react";
import "./HomeLanding.css";
import HeroOrbitDiagram from "./HeroOrbitDiagram.jsx";

const FEEDBACK_EMAIL = "phongtran7076@gmail.com";

const PROJECTS = [
  { id: "vh-green-paradise", name: "Vinhomes Green Paradise", developer: "Vinhomes", location: "TP.HCM", status: "active", signal: "Active workspace", phase: "Đang triển khai", tone: "forest", featured: true },
  { id: "global-city", name: "The Global City", developer: "Masterise", location: "TP.HCM", status: "hot", signal: "Hot right now", phase: "Đang được quan tâm", tone: "stone", featured: true },
  { id: "eaton-park", name: "Eaton Park", developer: "Gamuda", location: "TP.HCM", status: "launching", signal: "Sắp mở bán", phase: "Chuẩn bị mở bán", tone: "sand", featured: true },
  { id: "vh-grand-park", name: "Vinhomes Grand Park", developer: "Vinhomes", location: "TP.HCM", status: "soon", signal: "Coming soon", phase: "Workspace kế tiếp", tone: "mist", featured: true },
  { id: "waterpoint", name: "Waterpoint", developer: "Nam Long", location: "Long An", status: "soon", signal: "Coming soon", phase: "Đang chuẩn hóa dữ liệu", tone: "graphite", featured: true },
  { id: "vh-op2", name: "Vinhomes Ocean Park 2", developer: "Vinhomes", location: "Hưng Yên", status: "soon", signal: "Coming soon", phase: "Reference queue", tone: "mist" },
  { id: "vh-op3", name: "Vinhomes Ocean Park 3", developer: "Vinhomes", location: "Hưng Yên", status: "soon", signal: "Coming soon", phase: "Reference queue", tone: "stone" },
  { id: "masteri-centre-point", name: "Masteri Centre Point", developer: "Masterise", location: "TP.HCM", status: "soon", signal: "Coming soon", phase: "Reference queue", tone: "graphite" },
  { id: "lumiere-riverside", name: "LUMIÈRE Riverside", developer: "Masterise", location: "TP.HCM", status: "soon", signal: "Coming soon", phase: "Reference queue", tone: "mist" },
  { id: "celadon-city", name: "Celadon City", developer: "Gamuda", location: "TP.HCM", status: "soon", signal: "Coming soon", phase: "Reference queue", tone: "forest" },
  { id: "elysian", name: "Elysian", developer: "Gamuda", location: "TP.HCM", status: "soon", signal: "Coming soon", phase: "Reference queue", tone: "sand" },
  { id: "mizuki-park", name: "Mizuki Park", developer: "Nam Long", location: "TP.HCM", status: "soon", signal: "Coming soon", phase: "Reference queue", tone: "stone" },
];

const FAQ = [
  ["PlotFlow được xây để giải quyết chính xác việc gì?", "Một việc rất cụ thể: biến dữ liệu bán hàng bất động sản thành artwork có thể review và xuất bản mà không bắt designer lặp lại cùng một chuỗi thao tác cho hàng chục hay hàng trăm căn. PlotFlow không cố trở thành phần mềm thiết kế cho mọi thứ. Nó tối ưu thật sâu đoạn đường từ data → masterplan → composition → output."],
  ["Tại sao không chỉ dùng template rồi copy từng căn?", "Vì copy-paste vẫn bắt con người làm phần máy móc: tìm đúng căn, thay đúng dữ liệu, kiểm tra đúng floorplan, dựng lại overview, giữ layout nhất quán rồi export. PlotFlow gom những bước đó thành một system. Designer dành thời gian cho hierarchy, hình ảnh và quyết định thị giác thay vì kiểm tra xem mình đã thay sót một con số hay chưa."],
  ["Automation có làm thiết kế bị giống máy không?", "Không, nếu automation dừng đúng chỗ. PlotFlow tự động hóa những gì có quy luật, rồi trả quyền điều khiển cho designer ở floorplan view, highlight, connector, layout, asset và final composition. Tốc độ đến từ việc bỏ thao tác lặp; chất lượng vẫn đến từ mắt nghề."],
  ["Điểm mạnh của Overview và Detail nằm ở đâu?", "Chúng không phải hai file rời. Overview giúp nhìn cả dự án, card bán hàng, connector và vùng cần nhấn; Detail đi sâu vào từng unit với floorplan và thông tin bán hàng. Cùng một nguồn data đi qua hai cấp độ truyền thông, nên việc cập nhật và review có logic hơn nhiều so với quản lý từng artwork thủ công."],
  ["PlotFlow có thay designer không?", "Không. PlotFlow được thiết kế để nâng leverage của designer: ít thời gian cho thao tác lặp, nhiều thời gian hơn cho lựa chọn có ý nghĩa. Nó giống một lớp vận hành phía sau design hơn là một nút generate thay thế người làm nghề."],
];

const FLOW = [
  { key: "data", eyebrow: "INPUT 01", title: "Sales data", body: "Google Sheet / Excel", meta: "Unit code · price · type · specs" },
  { key: "map", eyebrow: "INPUT 02", title: "Masterplan", body: "PDF + project assets", meta: "Floorplan · houses · amenities" },
  { key: "engine", eyebrow: "PLOTFLOW", title: "Project engine", body: "Locate · map · compose", meta: "One source of truth" },
  { key: "control", eyebrow: "DESIGNER", title: "Human control", body: "Review · override · refine", meta: "Craft stays visible" },
  { key: "output", eyebrow: "OUTPUT", title: "Sales-ready design", body: "Overview + Detail", meta: "PNG · PDF · batch export" },
];

export default function HomeLanding({ onOpenProject }) {
  const [filter, setFilter] = useState("All");
  const [feedback, setFeedback] = useState("");
  const [openFaq, setOpenFaq] = useState(0);
  const [projectLibraryOpen, setProjectLibraryOpen] = useState(false);
  const [sendStatus, setSendStatus] = useState("idle");
  const developers = ["All", "Vinhomes", "Masterise", "Gamuda", "Nam Long"];

  const featuredProjects = PROJECTS.filter((project) => project.featured).slice(0, 5);
  const filtered = useMemo(() => (filter === "All" ? PROJECTS : PROJECTS.filter((project) => project.developer === filter)), [filter]);

  async function sendFeedback() {
    const value = feedback.trim();
    if (!value || sendStatus === "sending") return;
    setSendStatus("sending");
    try {
      const response = await fetch(`https://formsubmit.co/ajax/${FEEDBACK_EMAIL}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ _subject: "PlotFlow · Product feedback", _template: "table", source: "PlotFlow Home", message: value }),
      });
      if (!response.ok) throw new Error("send failed");
      try {
        const history = JSON.parse(localStorage.getItem("plotflow-local-feedback-v1") || "[]");
        localStorage.setItem("plotflow-local-feedback-v1", JSON.stringify([{ text: value, createdAt: new Date().toISOString() }, ...(Array.isArray(history) ? history : [])].slice(0, 20)));
      } catch { /* best effort backup */ }
      setFeedback("");
      setSendStatus("sent");
      window.setTimeout(() => setSendStatus("idle"), 4200);
    } catch {
      setSendStatus("error");
    }
  }

  return (
    <div className="pf-home">
      <header className="pf-home-nav pf-liquid-glass">
        <a className="pf-home-brand" href="#top" aria-label="PlotFlow home">PlotFlow</a>
        <nav aria-label="Homepage sections"><a href="#product">Product</a><a href="#workflow">System</a><a href="#projects">Projects</a><a href="#faq">Why PlotFlow</a></nav>
        <button type="button" className="pf-home-open" onClick={onOpenProject}>Open workspace <span>↗</span></button>
      </header>

      <main id="top">
        <section className="pf-home-hero" id="product">
          <div className="pf-home-hero-copy">
            <div className="pf-home-eyebrow"><i /> Real-estate design operations</div>
            <h1 className="pf-home-hero-title" aria-label="Make the repetitive disappear. Keep the design.">
              <span className="pf-title-kicker">Make the</span>
              <span className="pf-title-main">repetitive</span>
              <em className="pf-title-accent">disappear.</em>
              <span className="pf-title-secondary">Keep the</span>
              <span className="pf-title-main pf-title-design">design.</span>
            </h1>
            <p>PlotFlow được xây cho một công việc rất cụ thể: đưa dữ liệu bán hàng bất động sản đi từ spreadsheet và masterplan tới artwork hoàn chỉnh — nhanh hơn, nhất quán hơn, nhưng vẫn để designer giữ quyền quyết định.</p>
            <div className="pf-home-hero-actions"><button type="button" onClick={onOpenProject}>Open PlotFlow <span>→</span></button><a href="#workflow">See how the system works</a></div>
            <div className="pf-home-proof"><span><b>01</b> One data source</span><span><b>02</b> Human-in-the-loop</span><span><b>03</b> Overview + Detail</span></div>
          </div>

          <div className="pf-home-hero-visual">
            <HeroOrbitDiagram />
          </div>
        </section>

        <section className="pf-home-statement"><span>THE PRINCIPLE</span><p>A designer should spend more time making <em>decisions that matter</em> — and less time repeating them.</p></section>

        <section className="pf-home-workflow" id="workflow">
          <div className="pf-home-section-head"><span>ONE JOB, DEEPLY OPTIMIZED</span><h2>A system for the messy space between <em>property data</em> and finished design.</h2><p>PlotFlow không gom thật nhiều feature để trông mạnh. Nó nối đúng những bước thường làm designer bất động sản mất thời gian nhất, rồi giữ chúng trong một luồng có thể nhìn thấy và kiểm soát.</p></div>
          <div className="pf-system-map pf-system-flow" aria-label="PlotFlow system diagram">{FLOW.map((item, index) => <div className={`pf-system-node ${item.key}`} key={item.key}><span>{item.eyebrow}</span><strong>{item.title}</strong><b>{item.body}</b><small>{item.meta}</small>{index < FLOW.length - 1 && <i className="pf-flow-arrow" aria-hidden="true">→</i>}</div>)}</div>
          <div className="pf-system-caption"><span>INPUT</span><i /><span>AUTOMATION</span><i /><span>DESIGN JUDGMENT</span><i /><span>OUTPUT</span></div>
          <div className="pf-home-benefits"><article><span>01</span><h3>Stop hunting through files.</h3><p>Locator đưa designer tới đúng khu vực cần làm thay vì dò từng trang PDF bằng mắt.</p></article><article><span>02</span><h3>Stop rebuilding the same composition.</h3><p>Dữ liệu unit đi vào một hệ thống layout có sẵn, thay vì copy-paste rồi sửa từng layer.</p></article><article><span>03</span><h3>Keep the decisions human.</h3><p>Highlight, connector, framing và hierarchy vẫn mở để designer tinh chỉnh khi mắt nghề thấy cần.</p></article><article><span>04</span><h3>Scale without flattening the craft.</h3><p>Một project có thể sinh nhiều output hơn mà không buộc tất cả artwork trông như template vô hồn.</p></article></div>
        </section>

        <section className="pf-home-projects" id="projects">
          <div className="pf-home-section-head compact pf-featured-project-heading"><div><span>FEATURED PROJECTS</span><h2>A few projects worth <em>watching now.</em></h2><p>Home chỉ ưu tiên những project đang active, đang được quan tâm hoặc sắp bước vào giai đoạn bán hàng. Toàn bộ library nằm trong một project space riêng để trang chủ luôn gọn.</p></div><button type="button" className="pf-view-library" onClick={() => setProjectLibraryOpen(true)}>View all projects <span>↗</span></button></div>
          <div className="pf-featured-project-grid">
            {featuredProjects.map((project, index) => (
              <article className={`pf-featured-project-card ${project.status}`} key={project.id}>
                <header><span>{String(index + 1).padStart(2, "0")}</span><em>{project.signal}</em></header>
                <div className={`pf-project-thumb tone-${project.tone}`}>
                  <div className="pf-project-thumb-grid" />
                  <div className="pf-project-thumb-content">
                    <strong className="pf-project-name">{project.name}</strong>
                    <small className="pf-project-meta">{project.developer} · {project.location}</small>
                  </div>
                </div>
                <footer>{project.status === "active" ? <button type="button" onClick={onOpenProject}>Open workspace <b>↗</b></button> : <button type="button" onClick={() => setProjectLibraryOpen(true)}>View in library <b>→</b></button>}</footer>
              </article>
            ))}
          </div>
        </section>

        <section className="pf-home-faq" id="faq"><div className="pf-home-section-head compact"><span>WHY PLOTFLOW</span><h2>Less software theatre.<br /><em>More useful leverage.</em></h2><p>Những câu dưới đây nói thẳng vào giá trị thật của sản phẩm: PlotFlow đang bỏ đi phần việc nào, giữ lại phần việc nào, và vì sao điều đó quan trọng với design bất động sản.</p></div><div className="pf-home-faq-list">{FAQ.map(([question, answer], index) => { const isOpen = openFaq === index; return <article className={isOpen ? "open" : ""} key={question}><button type="button" onClick={() => setOpenFaq(isOpen ? -1 : index)} aria-expanded={isOpen}><span>{String(index + 1).padStart(2, "0")}</span><strong>{question}</strong><i>＋</i></button><div className="pf-home-faq-answer" aria-hidden={!isOpen}><div className="pf-home-faq-answer-inner"><p>{answer}</p></div></div></article>; })}</div></section>

        <section className="pf-home-feedback"><div><span>BUILD THE NEXT VERSION</span><h2>Shape what PlotFlow <em>becomes next.</em></h2><p>Nếu có một thao tác vẫn làm bạn mất nhịp, một feature còn thiếu, hay một chi tiết khiến workflow chưa đủ mượt — gửi thẳng cho Phong. Người gửi chỉ nhập và bấm gửi, không cần mở Gmail hay đăng nhập email.</p></div><div className="pf-home-feedback-box pf-liquid-glass"><label>What would make your workflow better?</label><textarea value={feedback} onChange={(event) => { setFeedback(event.target.value); if (sendStatus === "error") setSendStatus("idle"); }} placeholder="Tell me what feels slow, repetitive, unclear — or what you wish PlotFlow could do next…" rows={5} /><footer><small>{sendStatus === "sent" ? "✓ Feedback sent directly to Phong" : sendStatus === "error" ? "Could not send. Please try again." : "Direct feedback · no email login required"}</small><button type="button" onClick={sendFeedback} disabled={!feedback.trim() || sendStatus === "sending"}>{sendStatus === "sending" ? "Sending…" : sendStatus === "sent" ? "Sent ✓" : "Send feedback"}</button></footer></div></section>
      </main>

      <footer className="pf-home-footer"><div className="pf-home-signature"><span>Personal note by Phong Trần</span><em>Đời lắm phong trần.</em></div><div className="pf-home-footer-brand">PlotFlow</div><div className="pf-home-footer-meta"><div><strong>Real-estate design operations.</strong><span>One focused workflow, deeply optimized.</span></div><div><span>Product principle</span><strong>Automate repetition. Keep judgment human.</strong></div><div className="right"><span>Product preview</span><strong>2026</strong></div></div></footer>

      {projectLibraryOpen && <div className="pf-project-library-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProjectLibraryOpen(false); }}><section className="pf-project-library pf-liquid-glass" role="dialog" aria-modal="true" aria-label="Project library"><header><div><span>PROJECT SPACE</span><h2>Browse the full library.</h2><p>Filter theo chủ đầu tư để tìm nhanh project cần xem. Home chỉ giữ featured projects; mọi thứ còn lại nằm ở đây.</p></div><button type="button" onClick={() => setProjectLibraryOpen(false)} aria-label="Close project library">×</button></header><div className="pf-project-library-filters" role="group" aria-label="Filter projects by developer">{developers.map((item) => <button type="button" key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}<span>{filtered.length} projects</span></div><div className="pf-project-library-list">{filtered.map((project, index) => <article key={project.id} className={project.status}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{project.name}</strong><small>{project.developer} · {project.location}</small></div><em>{project.signal}</em>{project.status === "active" ? <button type="button" onClick={onOpenProject}>Open <b>↗</b></button> : <button type="button" disabled>Coming soon</button>}</article>)}</div></section></div>}
    </div>
  );
}
