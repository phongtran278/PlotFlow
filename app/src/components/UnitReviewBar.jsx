import { useEffect, useMemo, useRef, useState } from "react";
import "./UnitReviewBar.css";

const STATUS_ORDER = ["all", "ready", "review", "not-found", "unindexed"];

function readUnitSnapshot() {
  return Array.from(document.querySelectorAll(".unit-selector .unit-select")).map((button) => {
    const code = button.querySelector(".unit-main strong")?.textContent?.trim() || "";
    const badge = button.querySelector(".floorplan-badge");
    const status = ["ready", "review", "not-found", "unindexed"].find((name) => badge?.classList.contains(name)) || "unindexed";
    const directSpans = Array.from(button.children).filter((node) => node.tagName === "SPAN");
    const price = directSpans.at(-1)?.textContent?.trim() || "—";
    return {
      code,
      price,
      status,
      badgeText: badge?.textContent?.trim() || "· Unindexed",
      selected: button.classList.contains("active"),
      disabled: button.disabled,
    };
  }).filter((item) => item.code);
}

function clickUnit(code) {
  const target = Array.from(document.querySelectorAll(".unit-selector .unit-select")).find(
    (button) => button.querySelector(".unit-main strong")?.textContent?.trim() === code
  );
  if (!target || target.disabled) return false;
  target.click();
  return true;
}

function statusLabel(status) {
  if (status === "all") return "All";
  if (status === "ready") return "Ready";
  if (status === "review") return "Review";
  if (status === "not-found") return "Not Found";
  return "Unindexed";
}

export default function UnitReviewBar() {
  const [items, setItems] = useState([]);
  const [allOpen, setAllOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const activeChipRef = useRef(null);

  useEffect(() => {
    let observer;
    let frame;

    const attach = () => {
      const selector = document.querySelector(".unit-selector");
      if (!selector) {
        frame = requestAnimationFrame(attach);
        return;
      }

      const sync = () => setItems(readUnitSnapshot());
      sync();
      observer = new MutationObserver(sync);
      observer.observe(selector, {
        attributes: true,
        attributeFilter: ["class", "disabled"],
        childList: true,
        characterData: true,
        subtree: true,
      });
    };

    attach();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, []);

  const selectedIndex = Math.max(0, items.findIndex((item) => item.selected));
  const selectedItem = items[selectedIndex] || null;

  useEffect(() => {
    activeChipRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [selectedItem?.code]);

  useEffect(() => {
    function keydown(event) {
      if (event.key === "Escape" && allOpen) {
        setAllOpen(false);
        return;
      }
      if (allOpen || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) return;
      if (document.querySelector(".layout-studio-mode, .finetune-mode, .lot-editor-shell, .asset-picker-panel")) return;
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (!items.length) return;

      const nextIndex = event.key === "ArrowRight"
        ? Math.min(items.length - 1, selectedIndex + 1)
        : Math.max(0, selectedIndex - 1);
      if (nextIndex === selectedIndex) return;
      event.preventDefault();
      clickUnit(items[nextIndex].code);
    }

    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [allOpen, items, selectedIndex]);

  const summary = useMemo(() => items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, { ready: 0, review: 0, "not-found": 0, unindexed: 0 }), [items]);

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const matchesFilter = filter === "all" || item.status === filter;
      const matchesQuery = !needle || item.code.toLowerCase().includes(needle);
      return matchesFilter && matchesQuery;
    });
  }, [filter, items, query]);

  function selectCode(code, closeAll = false) {
    if (clickUnit(code) && closeAll) setAllOpen(false);
  }

  function move(offset) {
    const nextIndex = Math.max(0, Math.min(items.length - 1, selectedIndex + offset));
    if (nextIndex !== selectedIndex) selectCode(items[nextIndex].code);
  }

  if (!items.length) return null;

  return (
    <>
      <section className="unit-review-shell" aria-label="Unit review navigation">
        <div className="unit-review-topline">
          <button type="button" className="unit-review-step" onClick={() => move(-1)} disabled={selectedIndex <= 0 || selectedItem?.disabled}>
            <span>←</span><strong>Prev</strong>
          </button>

          <div className="unit-review-current">
            <span>REVIEWING</span>
            <strong>{selectedItem?.code || "—"}</strong>
            <em>{selectedIndex + 1} / {items.length}</em>
          </div>

          <button type="button" className="unit-review-step next" onClick={() => move(1)} disabled={selectedIndex >= items.length - 1 || selectedItem?.disabled}>
            <strong>Next</strong><span>→</span>
          </button>

          <div className="unit-review-mini-summary" aria-label="Review status summary">
            <span className="ready">✓ {summary.ready}</span>
            <span className="review">△ {summary.review}</span>
            <span className="not-found">× {summary["not-found"]}</span>
          </div>

          <button type="button" className="unit-review-all" onClick={() => setAllOpen(true)}>
            <span>⌕</span><strong>All Units</strong><em>{items.length}</em>
          </button>
        </div>

        <div className="unit-review-filmstrip">
          {items.map((item) => (
            <button
              type="button"
              key={item.code}
              ref={item.selected ? activeChipRef : null}
              className={`unit-review-chip ${item.status} ${item.selected ? "active" : ""}`}
              onClick={() => selectCode(item.code)}
              disabled={item.disabled}
              title={`${item.code} · ${statusLabel(item.status)} · ${item.price}`}
            >
              <i aria-hidden="true" />
              <strong>{item.code}</strong>
              <span>{item.status === "ready" ? "✓" : item.status === "review" ? "△" : item.status === "not-found" ? "×" : "·"}</span>
            </button>
          ))}
        </div>

        <div className="unit-review-hint"><kbd>←</kbd><kbd>→</kbd><span>chuyển căn nhanh</span></div>
      </section>

      {allOpen && (
        <div className="unit-review-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAllOpen(false); }}>
          <section className="unit-review-modal" role="dialog" aria-modal="true" aria-label="All units">
            <header className="unit-review-modal-head">
              <div><span>UNIT REVIEW</span><h3>Tất cả căn</h3><p>Nhảy thẳng tới bất kỳ căn nào và nhìn trạng thái review trong một màn hình.</p></div>
              <button type="button" onClick={() => setAllOpen(false)} aria-label="Close">×</button>
            </header>

            <div className="unit-review-toolbar">
              <label><span>⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã căn..." /></label>
              <div className="unit-review-filters">
                {STATUS_ORDER.map((status) => {
                  const count = status === "all" ? items.length : summary[status] || 0;
                  return <button type="button" key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(status)}>{statusLabel(status)} <em>{count}</em></button>;
                })}
              </div>
            </div>

            <div className="unit-review-grid">
              {visibleItems.map((item) => (
                <button type="button" key={item.code} className={`unit-review-card ${item.status} ${item.selected ? "active" : ""}`} onClick={() => selectCode(item.code, true)} disabled={item.disabled}>
                  <div><i /><strong>{item.code}</strong></div>
                  <span>{item.price}</span>
                  <em>{item.badgeText}</em>
                </button>
              ))}
              {!visibleItems.length && <div className="unit-review-empty">Không có căn phù hợp bộ lọc.</div>}
            </div>

            <footer className="unit-review-modal-foot">
              <span><b>✓</b> Ready {summary.ready}</span>
              <span><b>△</b> Review {summary.review}</span>
              <span><b>×</b> Not Found {summary["not-found"]}</span>
              <span><b>·</b> Unindexed {summary.unindexed}</span>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
