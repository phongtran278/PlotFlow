import "./OverviewWorkspace.css";

export default function OverviewWorkspace({
  project,
  overviewGroups,
  overviewGroup,
  onOverviewGroup,
  sellUnits,
  units,
  visibleSellUnits,
}) {
  const liveUnitCount = sellUnits.length || units.length;
  const groupUnitCount = sellUnits.length ? visibleSellUnits.length : liveUnitCount;
  const scopedInventoryLabel = groupUnitCount
    ? `${groupUnitCount} / ${groupUnitCount} units loaded for ${overviewGroup}`
    : "Waiting for inventory in this view";

  return (
    <main className="pf-overview">
      <header className="pf-overview-intro">
        <div className="pf-overview-intro-copy">
          <span>PROJECT OVERVIEW</span>
          <h1>{project.name}</h1>
          <p>{project.developer} · {project.location}</p>
        </div>
        <div className="pf-overview-summary" aria-label="Overview project summary">
          <div><span>STATUS</span><strong>{project.status}</strong></div>
          <div><span>LIVE INVENTORY</span><strong>{groupUnitCount}</strong><small>{overviewGroup} in current view</small></div>
          <div><span>VIEW</span><strong>{overviewGroup}</strong><small>{groupUnitCount} units in scope</small></div>
        </div>
      </header>

      {project.masterplan && <div className="pf-overview-control-rail" aria-label="Overview editor controls" />}

      <div className="pf-overview-layout pf-overview-layout-wide">
        <section className="pf-masterplan-card">
          <div className="pf-masterplan-head pf-masterplan-head-callouts">
            <div className="pf-masterplan-head-copy">
              <span>MASTERPLAN EXPLORER</span>
              <strong>Availability by handover standard</strong>
              <small>Select a handover group, focus a unit, then refine the callout layout.</small>
            </div>
            <div className="pf-overview-groups" role="group" aria-label="Tiêu chuẩn bàn giao">
              {overviewGroups.map((group) => (
                <button
                  key={group}
                  type="button"
                  className={overviewGroup === group ? "active" : ""}
                  onClick={() => onOverviewGroup(group)}
                >
                  {group}
                </button>
              ))}
            </div>
          </div>

          <div className={`pf-masterplan-stage ${project.masterplan ? "has-real-pdf has-callouts" : ""}`} data-overview-group={overviewGroup}>
            {project.masterplan ? (
              <iframe className="pf-masterplan-pdf" title={`${project.name} masterplan`} src="/masterplan/masterplan.pdf#toolbar=0&navpanes=0&scrollbar=0&view=FitH" />
            ) : (
              <div className={`pf-project-overview-placeholder tone-${project.tone}`}><strong>{project.name}</strong><span>{project.developer}</span></div>
            )}

            {project.masterplan && sellUnits.length > 0 && visibleSellUnits.length === 0 && (
              <div className="pf-overview-coming"><strong>{overviewGroup}</strong><span>Không có căn nào thuộc đúng tiêu chuẩn bàn giao này trong file sell đang kết nối.</span></div>
            )}
            {project.masterplan && sellUnits.length === 0 && units.length === 0 && (
              <div className="pf-overview-coming"><strong>Chưa có dữ liệu căn thật</strong><span>Connect Sheet ở Detail. Overview sẽ đọc nguyên dữ liệu sell và không dùng dữ liệu demo.</span></div>
            )}
          </div>
        </section>

        <aside className="pf-overview-side pf-overview-guide">
          <section className="pf-overview-context-card pf-overview-context-primary">
            <span>CURRENT VIEW</span>
            <strong>{overviewGroup}</strong>
            <p>{groupUnitCount} unit đang nằm trong đúng nhóm hiển thị hiện tại.</p>
            <div className="pf-overview-context-meter"><i style={{ width: groupUnitCount ? "100%" : "8%" }} /></div>
            <small>{scopedInventoryLabel}</small>
          </section>

          <section className="pf-overview-context-card pf-overview-context-note">
            <span>DATA SOURCE</span>
            <strong>{liveUnitCount ? "Connected" : "Not connected"}</strong>
            <p>Overview reads the same sell data used by Detail, so the visual layer stays tied to one source of truth.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
