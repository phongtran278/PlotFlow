import "./BrandWordmark.css";

export default function BrandWordmark({ onClick, className = "" }) {
  return (
    <button
      type="button"
      className={`pf-brand-wordmark ${className}`.trim()}
      onClick={onClick}
      aria-label="Back to PlotFlow home"
    >
      PlotFlow
    </button>
  );
}
