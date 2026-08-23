import "./ProjectLanding.css";

const FACTS = [
  ["Developer", (project) => project.developer],
  ["Location", (project) => project.location],
  ["Status", (project) => project.status],
  ["Project code", (project) => project.code],
];

function SectionLabel({ children }) {
  return <span className="pf-project-landing-label">{children}</span>;
}

export default function ProjectLanding({ project, onOverview, onDetail }) {
  const landing = project.landing;

  return (
    <main className="pf-project-landing" data-tone={project.tone}>
      <section className="pf-project-landing-hero">
        <div className="pf-project-landing-hero-copy">
          <SectionLabel>PROJECT INTRODUCTION</SectionLabel>
          <h1>{project.name}</h1>
          <p className="pf-project-landing-positioning">{landing.positioning}</p>
          <div className="pf-project-landing-actions">
            <button type="button" className="primary" onClick={onOverview}>Explore project <span>→</span></button>
            <button type="button" className="quiet" onClick={onDetail}>Open design workspace</button>
          </div>
        </div>
        <div className="pf-project-landing-hero-media" aria-label="Project hero visual placeholder">
          <span>HERO VISUAL / PROJECT FILM</span>
          <b>{project.code}</b>
        </div>
      </section>

      <section className="pf-project-landing-facts" aria-label="Project facts">
        {FACTS.map(([label, getValue]) => (
          <article key={label}><span>{label}</span><strong>{getValue(project)}</strong></article>
        ))}
      </section>

      <section className="pf-project-landing-story pf-project-landing-section">
        <div className="pf-project-landing-section-head">
          <SectionLabel>WHY THIS PROJECT</SectionLabel>
          <h2>A reason to care,<br /><em>before the details.</em></h2>
        </div>
        <div className="pf-project-landing-value-grid">
          {landing.valuePillars.map((item) => (
            <article key={item.index}><span>{item.index}</span><h3>{item.title}</h3><p>{item.copy}</p></article>
          ))}
        </div>
      </section>

      <section className="pf-project-landing-split pf-project-landing-section">
        <div className="pf-project-landing-map-placeholder">
          <span>LOCATION / CONNECTIVITY MAP</span>
          <strong>{project.location}</strong>
          <small>Map, nearby destinations and travel times will live here.</small>
        </div>
        <div className="pf-project-landing-split-copy">
          <SectionLabel>LOCATION & CONNECTIVITY</SectionLabel>
          <h2>Turn geography into a buyer benefit.</h2>
          <p>{landing.location.description}</p>
          <div className="pf-project-landing-mini-facts">
            {landing.location.destinations.map((item, index) => <span key={`${item}-${index}`}><b>0{index + 1}</b> {item}</span>)}
          </div>
        </div>
      </section>

      <section className="pf-project-landing-masterplan pf-project-landing-section">
        <div className="pf-project-landing-section-head compact">
          <SectionLabel>MASTERPLAN</SectionLabel>
          <h2>See the project as a system.</h2>
          <p>The landing page introduces the story. PlotFlow Overview takes the buyer or sales team deeper into the actual masterplan and availability context.</p>
        </div>
        <button type="button" className="pf-project-landing-masterplan-stage" onClick={onOverview}>
          <span>MASTERPLAN / OVERVIEW PREVIEW</span><strong>Explore Overview</strong><b>↗</b>
        </button>
      </section>

      <section className="pf-project-landing-products pf-project-landing-section">
        <div className="pf-project-landing-section-head">
          <SectionLabel>PRODUCT COLLECTION</SectionLabel>
          <h2>Make the offer easy to understand.</h2>
        </div>
        <div className="pf-project-landing-product-grid">
          {landing.products.map((item, index) => (
            <article key={`${item.name}-${index}`}>
              <div className="pf-project-landing-product-media"><span>PRODUCT VISUAL</span></div>
              <span>0{index + 1}</span><h3>{item.name}</h3><p>{item.meta}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="pf-project-landing-lifestyle pf-project-landing-section">
        <div className="pf-project-landing-section-head compact">
          <SectionLabel>LIFESTYLE & AMENITIES</SectionLabel>
          <h2>Sell the experience, not a checklist.</h2>
        </div>
        <div className="pf-project-landing-lifestyle-grid">
          {landing.lifestyle.map((item, index) => (
            <article key={`${item.title}-${index}`}><span>0{index + 1}</span><h3>{item.title}</h3><p>{item.copy}</p></article>
          ))}
        </div>
      </section>

      <section className="pf-project-landing-trust pf-project-landing-section">
        <div>
          <SectionLabel>DEVELOPER & TRUST</SectionLabel>
          <h2>{project.developer}</h2>
          <p>{landing.trust.copy}</p>
        </div>
        <div className="pf-project-landing-trust-proof">
          {landing.trust.proof.map((item, index) => (
            <div key={`${item}-${index}`}><span>{["TRACK RECORD", "LEGAL / DELIVERY", "MARKET TRUST"][index] || `PROOF 0${index + 1}`}</span><strong>{item}</strong></div>
          ))}
        </div>
      </section>

      <section className="pf-project-landing-resources pf-project-landing-section">
        <div className="pf-project-landing-section-head compact">
          <SectionLabel>SALES RESOURCES</SectionLabel>
          <h2>Everything a serious buyer asks for.</h2>
          <p>Public resources can open directly. High-intent resources such as price lists or policy documents can later become lead-gated conversion points.</p>
        </div>
        <div className="pf-project-landing-resource-list">
          {landing.resources.map((item, index) => (
            <button type="button" key={`${item.name}-${index}`}><span>0{index + 1}</span><strong>{item.name}</strong><small>{item.status}</small><b>→</b></button>
          ))}
        </div>
      </section>

      <section className="pf-project-landing-conversion pf-project-landing-section">
        <div className="pf-project-landing-conversion-copy">
          <SectionLabel>CONVERSION</SectionLabel>
          <h2>Ready for the<br /><em>next conversation?</em></h2>
          <p>This is the primary lead-capture moment. Keep the form short, explain what the visitor receives, and make the next step feel concrete.</p>
        </div>
        <form className="pf-project-landing-form" onSubmit={(event) => event.preventDefault()}>
          <label><span>Name</span><input placeholder="Your name" /></label>
          <label><span>Phone</span><input placeholder="Phone number" /></label>
          <label><span>Email · optional</span><input placeholder="Email address" /></label>
          <label><span>Interest</span><select defaultValue=""><option value="" disabled>Select an interest</option><option>Price list</option><option>Floorplan</option><option>Sales consultation</option><option>Project information</option></select></label>
          <button type="submit">Request project pack <span>→</span></button>
          <small>Wireframe only — no lead submission is connected yet.</small>
        </form>
      </section>

      <section className="pf-project-landing-faq pf-project-landing-section">
        <div className="pf-project-landing-section-head compact">
          <SectionLabel>FAQ / OBJECTION HANDLING</SectionLabel>
          <h2>Answer the questions that block action.</h2>
        </div>
        <div className="pf-project-landing-faq-list">
          {landing.faq.map((item, index) => <article key={`${item}-${index}`}><span>0{index + 1}</span><strong>{item}</strong><b>+</b></article>)}
        </div>
      </section>

      <section className="pf-project-landing-final">
        <span>{project.name}</span>
        <h2>Understand the project.<br /><em>Then explore the real work.</em></h2>
        <div>
          <button type="button" onClick={onOverview}>Explore Overview <span>→</span></button>
          <button type="button" className="quiet" onClick={onDetail}>Open Detail workspace</button>
        </div>
      </section>
    </main>
  );
}
