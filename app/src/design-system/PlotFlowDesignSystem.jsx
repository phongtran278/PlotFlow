import { useState } from "react";
import { PFButton, PFSelect, PFToolbarGroup, PFInspectorSection, PFControlRow } from "./PlotFlowControls.jsx";
import "./PlotFlowDesignSystem.css";

const groups = ["Hoàn thiện", "Giãn xây", "Xây thô"];

export default function PlotFlowDesignSystem() {
  const [group, setGroup] = useState(groups[0]);
  return (
    <main className="pf-ds-page">
      <header className="pf-ds-page-head">
        <div><span>PLOTFLOW DESIGN SYSTEM</span><h1>One visual language.<br />Across every PlotFlow surface.</h1></div>
        <p>Home and Detail remain the visual source of truth. macOS interaction discipline informs controls, hierarchy, spacing and states.</p>
      </header>

      <section className="pf-ds-section">
        <div className="pf-ds-section-head"><span>FOUNDATIONS</span><h2>Tokens</h2></div>
        <div className="pf-ds-token-grid">
          <article><strong>Spacing</strong><div className="pf-ds-space-demo"><i/><i/><i/><i/></div><small>4 · 8 · 12 · 16 · 24 · 32</small></article>
          <article><strong>Radius</strong><div className="pf-ds-radius-demo"><i/><i/><i/></div><small>Control · Button · Card</small></article>
          <article><strong>Surface</strong><div className="pf-ds-surface-demo"><i/><i/><i/></div><small>Canvas · Soft · Raised</small></article>
        </div>
      </section>

      <section className="pf-ds-section">
        <div className="pf-ds-section-head"><span>COMPONENTS</span><h2>Controls</h2></div>
        <div className="pf-ds-showcase-grid">
          <article className="pf-ds-showcase-card">
            <strong>Buttons</strong><p>One action, one semantic role, complete interaction states.</p>
            <div className="pf-ds-samples"><PFButton variant="primary">Save</PFButton><PFButton>Cancel</PFButton><PFButton variant="quiet">More</PFButton><PFButton disabled>Disabled</PFButton></div>
          </article>
          <article className="pf-ds-showcase-card">
            <strong>Selection</strong><p>Mutually exclusive choices use a select/pop-up instead of multiple CTA buttons.</p>
            <PFSelect label="Handover type" value={group} onChange={(e) => setGroup(e.target.value)}>{groups.map((item) => <option key={item}>{item}</option>)}</PFSelect>
          </article>
          <article className="pf-ds-showcase-card">
            <strong>Toolbar</strong><p>Common actions stay together and visually quiet.</p>
            <PFToolbarGroup label="Canvas tools"><PFButton variant="selected" icon="↖" iconOnly aria-label="Select" title="Select"/><PFButton icon="✋" iconOnly aria-label="Pan" title="Pan"/><PFButton icon="−" iconOnly aria-label="Zoom out" title="Zoom out"/><PFButton icon="+" iconOnly aria-label="Zoom in" title="Zoom in"/></PFToolbarGroup>
          </article>
        </div>
      </section>

      <section className="pf-ds-section">
        <div className="pf-ds-section-head"><span>PATTERNS</span><h2>Object inspector</h2></div>
        <div className="pf-ds-pattern-grid">
          <aside className="pf-ds-inspector-demo">
            <PFInspectorSection title="Card" meta="2 selected">
              <PFControlRow label="Scale"><input type="range" min="20" max="100" defaultValue="100" /></PFControlRow>
              <PFControlRow label="Align"><PFToolbarGroup label="Align cards"><PFButton icon="⇤" iconOnly aria-label="Align left"/><PFButton icon="↔" iconOnly aria-label="Center"/><PFButton icon="⇥" iconOnly aria-label="Align right"/></PFToolbarGroup></PFControlRow>
              <PFControlRow label="Gap"><input className="pf-ds-number" type="number" defaultValue="12" /></PFControlRow>
            </PFInspectorSection>
            <PFInspectorSection title="Card appearance"><PFControlRow label="Corner radius"><input className="pf-ds-number" type="number" defaultValue="12" /></PFControlRow></PFInspectorSection>
          </aside>
          <article className="pf-ds-pattern-note"><strong>Object rule</strong><p>Choose an object → show only the actions owned by that object. Shared tools stay outside the inspector. The same action must never appear twice.</p></article>
        </div>
      </section>
    </main>
  );
}
