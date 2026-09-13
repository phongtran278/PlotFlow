import "./Button.css";

export default function Button({
  variant = "secondary",
  size = "md",
  iconOnly = false,
  className = "",
  children,
  type = "button",
  ...props
}) {
  const classes = [
    "pf-button",
    `pf-button--${variant}`,
    `pf-button--${size}`,
    iconOnly ? "pf-button--icon" : "",
    className,
  ].filter(Boolean).join(" ");

  return <button type={type} className={classes} {...props}>{children}</button>;
}
