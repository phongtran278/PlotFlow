import "./GlobalNav.css";
import BrandWordmark from "./BrandWordmark.jsx";

function go(path) {
  if (window.location.pathname === path) return;
  window.location.assign(path);
}

export default function GlobalNav({ active = "", onProduct, onProjects, onPricing, onOpenWorkspace }) {
  const product = onProduct || (() => go("/"));
  const projects = onProjects || (() => go("/projects"));
  const pricing = onPricing || (() => go("/pricing"));
  const workspace = onOpenWorkspace || projects;

  return (
    <header className="pf-global-nav">
      <BrandWordmark className="pf-global-nav-brand" onClick={product} />
      <nav className="pf-global-nav-links" aria-label="PlotFlow navigation">
        <button type="button" className={active === "product" ? "active" : ""} onClick={product}>Product</button>
        <button type="button" className={active === "projects" ? "active" : ""} onClick={projects}>Projects</button>
        <button type="button" className={active === "pricing" ? "active" : ""} onClick={pricing}>Pricing <i aria-hidden="true">✦</i></button>
      </nav>
      <button type="button" className="pf-global-nav-cta" onClick={workspace}>Open workspace <span>↗</span></button>
    </header>
  );
}
