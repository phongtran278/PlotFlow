import "./PricingPage.css";

const PLANS = [
  {
    name: "Free",
    eyebrow: "START HERE",
    price: "0₫",
    cadence: "for personal exploration",
    description: "Khám phá workflow cốt lõi của PlotFlow với một project và các công cụ thiết kế cơ bản.",
    cta: "Current workspace",
    tone: "free",
    features: [
      ["1 project", "available"],
      ["Overview + Detail", "available"],
      ["Manual design controls", "available"],
      ["Standard export", "available"],
      ["Local browser cache", "available"],
    ],
  },
  {
    name: "Pro",
    eyebrow: "FOR ACTIVE PROJECTS",
    price: "Coming soon",
    cadence: "premium roadmap preview",
    description: "Dành cho designer hoặc team sales cần một project sống: dữ liệu thay đổi nhưng setup thiết kế không phải làm lại.",
    cta: "Preview Pro",
    tone: "pro",
    featured: true,
    features: [
      ["Cloud project sync", "available"],
      ["Shareable project links", "available"],
      ["Unlimited unit memory", "available"],
      ["Google Sheet auto reconnect", "available"],
      ["HD / batch export", "available"],
      ["Version history", "soon"],
      ["Automatic sales-data refresh", "soon"],
    ],
  },
  {
    name: "Team",
    eyebrow: "FOR SALES TEAMS",
    price: "Coming soon",
    cadence: "collaboration roadmap",
    description: "Khi PlotFlow trở thành workspace dùng chung cho marketing, design và sales thay vì một công cụ cá nhân.",
    cta: "Preview Team",
    tone: "team",
    features: [
      ["Everything in Pro", "available"],
      ["Shared cloud workspace", "available"],
      ["Roles & permissions", "soon"],
      ["Multi-user activity", "soon"],
      ["White-label branding", "soon"],
      ["Multiple client projects", "soon"],
      ["Project analytics", "soon"],
      ["Priority support", "soon"],
    ],
  },
];

const PREMIUM_ROADMAP = [
  { title: "Cloud Project Sync", copy: "Setup một lần, mở lại ở trình duyệt khác vẫn tiếp tục từ cùng project state.", status: "Available" },
  { title: "Shareable Project Link", copy: "Gửi URL project, Overview hoặc Detail để người khác vào đúng context đang làm.", status: "Available" },
  { title: "Persistent Unit Memory", copy: "Pin, highlight, house, floorplan và layout được giữ theo unit thay vì làm lại khi giá thay đổi.", status: "Available" },
  { title: "Version History", copy: "Quay lại snapshot cũ khi một thay đổi cloud không như mong muốn.", status: "Coming soon" },
  { title: "Role & Permission", copy: "Tách quyền xem, chỉnh sửa và quản trị project khi bắt đầu có nhiều người dùng.", status: "Coming soon" },
  { title: "White-label Workspace", copy: "Logo, domain và visual identity riêng cho từng agency hoặc client.", status: "Coming soon" },
];

export default function PricingPage({ onBack, onOpenWorkspace }) {
  return (
    <div className="pf-pricing">
      <header className="pf-pricing-nav">
        <button type="button" className="pf-pricing-brand" onClick={onBack}>PlotFlow</button>
        <div className="pf-pricing-nav-meta"><span>Premium roadmap</span><em>Preview · not billing yet</em></div>
        <button type="button" className="pf-pricing-open" onClick={onOpenWorkspace}>Open workspace ↗</button>
      </header>

      <main>
        <section className="pf-pricing-hero">
          <span>BUILDING TOWARD A PRODUCT</span>
          <h1>Free today.<br/><em>Premium by design.</em></h1>
          <p>Trang này là roadmap sống của PlotFlow. Feature đã hoàn thiện sẽ chuyển sang <b>Available</b>; phần tiếp theo vẫn hiện ở đây để sản phẩm luôn có một đích đến rõ ràng.</p>
          <div className="pf-pricing-proof"><b>NO PAYMENT YET</b><span>Đây là preview sản phẩm, không phải bảng giá đang bán chính thức.</span></div>
        </section>

        <section className="pf-pricing-plans" aria-label="PlotFlow plan preview">
          {PLANS.map((plan) => (
            <article key={plan.name} className={`pf-plan-card ${plan.featured ? "is-featured" : ""}`}>
              <div className="pf-plan-head">
                <span>{plan.eyebrow}</span>
                <h2>{plan.name}</h2>
                <strong>{plan.price}</strong>
                <small>{plan.cadence}</small>
                <p>{plan.description}</p>
              </div>
              <div className="pf-plan-features">
                {plan.features.map(([label, state]) => (
                  <div key={label} className="pf-plan-feature">
                    <i aria-hidden="true">{state === "available" ? "✓" : "○"}</i>
                    <span>{label}</span>
                    <em className={state}>{state === "available" ? "Available" : "Soon"}</em>
                  </div>
                ))}
              </div>
              <button type="button" onClick={onOpenWorkspace}>{plan.cta}</button>
            </article>
          ))}
        </section>

        <section className="pf-premium-roadmap">
          <div className="pf-premium-roadmap-head">
            <span>PREMIUM FEATURE BOARD</span>
            <h2>Turn “coming soon” into <em>available.</em></h2>
            <p>Mỗi feature bên dưới là một cột mốc sản phẩm. Không cần làm tất cả cùng lúc; chỉ cần nhìn thấy thứ tiếp theo đáng để xây.</p>
          </div>
          <div className="pf-premium-roadmap-grid">
            {PREMIUM_ROADMAP.map((item, index) => (
              <article key={item.title}>
                <div><span>{String(index + 1).padStart(2, "0")}</span><em className={item.status === "Available" ? "available" : ""}>{item.status}</em></div>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="pf-pricing-cta">
          <span>THE TARGET</span>
          <h2>One setup.<br/>Every future sales update.</h2>
          <p>Đó là premium promise cốt lõi của PlotFlow: design memory tồn tại lâu hơn một file giá.</p>
          <button type="button" onClick={onOpenWorkspace}>Continue building PlotFlow →</button>
        </section>
      </main>
    </div>
  );
}
