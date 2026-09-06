import "./PlotFlowControls.css";

export function PFButton({ children, variant = "secondary", icon, iconOnly = false, className = "", ...props }) {
  const classes = ["pf-ds-button", `is-${variant}`, iconOnly ? "is-icon-only" : "", className].filter(Boolean).join(" ");
  return (
    <button type="button" className={classes} {...props}>
      {icon ? <span className="pf-ds-button-icon" aria-hidden="true">{icon}</span> : null}
      {!iconOnly ? <span>{children}</span> : null}
    </button>
  );
}

export function PFSelect({ label, value, onChange, children, className = "", ...props }) {
  return (
    <label className={["pf-ds-select", className].filter(Boolean).join(" ")}>
      {label ? <span className="pf-ds-field-label">{label}</span> : null}
      <span className="pf-ds-select-control">
        <select value={value} onChange={onChange} {...props}>{children}</select>
        <span aria-hidden="true">⌄</span>
      </span>
    </label>
  );
}

export function PFToolbarGroup({ children, label, className = "" }) {
  return (
    <div className={["pf-ds-toolbar-group", className].filter(Boolean).join(" ")} aria-label={label}>
      {children}
    </div>
  );
}

export function PFInspectorSection({ title, meta, children, className = "" }) {
  return (
    <section className={["pf-ds-inspector-section", className].filter(Boolean).join(" ")}>
      <header>
        <strong>{title}</strong>
        {meta ? <small>{meta}</small> : null}
      </header>
      <div className="pf-ds-inspector-body">{children}</div>
    </section>
  );
}

export function PFControlRow({ label, children }) {
  return (
    <div className="pf-ds-control-row">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
}
