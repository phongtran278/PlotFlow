import "./PlotFlowControls.css";

export function PFButton({ children, variant = "secondary", icon, iconOnly = false, className = "", ...props }) {
  const classes = ["pf-ds-button", `is-${variant}`, iconOnly ? "is-icon-only" : "", className].filter(Boolean).join(" ");
  return <button type="button" className={classes} {...props}>{icon ? <span className="pf-ds-button-icon" aria-hidden="true">{icon}</span> : null}{!iconOnly ? <span>{children}</span> : null}</button>;
}

export function PFSelect({ label, value, onChange, children, className = "", ...props }) {
  return <label className={["pf-ds-select", className].filter(Boolean).join(" ")}>{label ? <span className="pf-ds-field-label">{label}</span> : null}<span className="pf-ds-select-control"><select value={value} onChange={onChange} {...props}>{children}</select><span aria-hidden="true">⌄</span></span></label>;
}

export function PFTextField({ label, hint, className = "", ...props }) {
  return <label className={["pf-ds-field", className].filter(Boolean).join(" ")}>{label ? <span className="pf-ds-field-label">{label}</span> : null}<input className="pf-ds-text-field" {...props}/>{hint ? <small>{hint}</small> : null}</label>;
}

export function PFCheckbox({ label, className = "", ...props }) {
  return <label className={["pf-ds-check", className].filter(Boolean).join(" ")}><input type="checkbox" {...props}/><span aria-hidden="true"/><b>{label}</b></label>;
}

export function PFSwitch({ label, className = "", ...props }) {
  return <label className={["pf-ds-switch", className].filter(Boolean).join(" ")}><input type="checkbox" {...props}/><span aria-hidden="true"/><b>{label}</b></label>;
}

export function PFSegmentedControl({ label, value, options, onChange, className = "" }) {
  return <div className={["pf-ds-segmented-wrap", className].filter(Boolean).join(" ")}>{label ? <span className="pf-ds-field-label">{label}</span> : null}<div className="pf-ds-segmented" role="radiogroup" aria-label={label}>{options.map((option) => { const item = typeof option === "string" ? { value: option, label: option } : option; return <button key={item.value} type="button" role="radio" aria-checked={value === item.value} className={value === item.value ? "is-selected" : ""} onClick={() => onChange?.(item.value)}>{item.label}</button>; })}</div></div>;
}

export function PFToolbarGroup({ children, label, className = "" }) {
  return <div className={["pf-ds-toolbar-group", className].filter(Boolean).join(" ")} aria-label={label}>{children}</div>;
}

export function PFToolbar({ leading, center, trailing, className = "" }) {
  return <div className={["pf-ds-toolbar", className].filter(Boolean).join(" ")}><div>{leading}</div><div>{center}</div><div>{trailing}</div></div>;
}

export function PFInspectorSection({ title, meta, children, className = "" }) {
  return <section className={["pf-ds-inspector-section", className].filter(Boolean).join(" ")}><header><strong>{title}</strong>{meta ? <small>{meta}</small> : null}</header><div className="pf-ds-inspector-body">{children}</div></section>;
}

export function PFControlRow({ label, children }) {
  return <div className="pf-ds-control-row"><span>{label}</span><div>{children}</div></div>;
}

export function PFPanel({ title, subtitle, children, footer, className = "" }) {
  return <section className={["pf-ds-panel", className].filter(Boolean).join(" ")}><header><div><strong>{title}</strong>{subtitle ? <small>{subtitle}</small> : null}</div></header><div className="pf-ds-panel-body">{children}</div>{footer ? <footer>{footer}</footer> : null}</section>;
}

export function PFPopover({ title, children, className = "" }) {
  return <div className={["pf-ds-popover", className].filter(Boolean).join(" ")} role="dialog" aria-label={title}>{title ? <strong>{title}</strong> : null}{children}</div>;
}
