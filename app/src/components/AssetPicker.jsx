import { useEffect, useMemo, useState } from "react";

function AssetThumbnail({ item, selected, eager = false }) {
  const src = item.thumbnailSrc || item.src;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
  }, [src]);

  const revealWhenDecoded = async (event) => {
    const image = event.currentTarget;
    try {
      if (typeof image.decode === "function") {
        await image.decode();
      }
    } catch {
      // The image has already loaded; decoding can reject in a few browsers.
    }

    requestAnimationFrame(() => setReady(true));
  };

  return (
    <div
      className="asset-picker-thumb"
      style={{
        contain: "layout paint",
        isolation: "isolate",
      }}
    >
      <img
        src={src}
        alt={item.name}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={eager ? "high" : "auto"}
        onLoad={revealWhenDecoded}
        style={{
          opacity: ready ? 1 : 0,
          transition: "opacity 140ms ease-out",
          transform: "translateZ(0)",
          willChange: ready ? "auto" : "opacity",
        }}
      />
      {selected && <i>✓</i>}
    </div>
  );
}

export default function AssetPicker({
  open,
  title,
  subtitle,
  catalog = [],
  value,
  onSelect,
  onClose,
  allowNone = false,
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("ALL");

  const groups = useMemo(
    () => ["ALL", ...Array.from(new Set(catalog.map((item) => item.group).filter(Boolean)))],
    [catalog]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((item) => {
      const groupOk = group === "ALL" || item.group === group;
      const queryOk = !q || `${item.name} ${item.id} ${item.fileName || ""}`.toLowerCase().includes(q);
      return groupOk && queryOk;
    });
  }, [catalog, group, query]);

  if (!open) return null;

  return (
    <div className="asset-picker-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <aside className="asset-picker-panel" onMouseDown={(event) => event.stopPropagation()}>
        <div className="asset-picker-header">
          <div>
            <span>ASSET LIBRARY</span>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="asset-picker-close" onClick={onClose}>×</button>
        </div>

        <div className="asset-picker-search">
          <span>⌕</span>
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name / ID..."
          />
        </div>

        <div className="asset-picker-groups">
          {groups.map((item) => (
            <button
              type="button"
              key={item}
              className={group === item ? "active" : ""}
              onClick={() => setGroup(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="asset-picker-grid">
          {allowNone && (
            <button
              type="button"
              className={`asset-picker-card none-card ${!value ? "selected" : ""}`}
              onClick={() => onSelect?.(null)}
            >
              <div className="asset-picker-none">None</div>
              <strong>Không dùng</strong>
              <small>Hide asset</small>
            </button>
          )}

          {filtered.map((item, index) => (
            <button
              type="button"
              key={item.id}
              className={`asset-picker-card ${value === item.id ? "selected" : ""}`}
              onClick={() => onSelect?.(item.id)}
            >
              <AssetThumbnail
                item={item}
                selected={value === item.id}
                eager={index < 6}
              />
              <strong>{item.name}</strong>
              <small>{item.id}</small>
            </button>
          ))}
        </div>

        <div className="asset-picker-footer">
          <span>{filtered.length} assets</span>
          <button type="button" onClick={onClose}>Done</button>
        </div>
      </aside>
    </div>
  );
}
