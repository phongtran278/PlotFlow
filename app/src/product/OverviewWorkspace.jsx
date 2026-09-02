import "./OverviewWorkspace.css";

const OVERVIEW_RENDER_MODE = "raster";

function uniqueUnitCount(list = []) {
  const keys = list.map((item, index) => String(item?.code || item?.id || index)).filter(Boolean);
  return new Set(keys).size;
}

export default function OverviewWorkspace({
  project,
  overviewGroups,
  overviewGroup,
  onOverviewGroup,
  sellUnits,
  units,
  visibleSellUnits,
}) {
  const liveUnitCount = sellUnits.length ? uniqueUnitCount(sellUnits) : uniqueUnitCount(units);
  const groupUnitCount = sellUnits.length ? uniqueUnitCount(visibleSellUnits) : liveUnitCount;

  return (
    <main className="pf-overview">
      <header className="pf-overview-intro">
        <div className="pf-overview-intro-copy">
          <h1>{project.name}</h1>
        </div>

        <div className="pf-overview-header-tools">
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
          <div className="pf-overview-view-status" aria-label="Current overview inventory">
            <strong>{groupUnitCount}</strong>
            <span>căn</span>
          </div>
        </div>
      </header>

      <div className="pf-overview-editor-shell">
        {project.masterplan && (
          <aside className="pf-overview-control-rail" aria-label="Overview editor controls">
            <div className="pf-overview-control-row pf-overview-control-row-primary" data-overview-control-row="primary">
              <div className="pf-overview-primary-tools" data-overview-primary-tools />
            </div>
            <div className="pf-overview-control-row pf-overview-control-row-canvas" data-overview-control-row="canvas">
              <div className="pf-overview-canvas-tools" data-overview-canvas-tools />
            </div>
            <div className="pf-overview-side" aria-label="Overview layers" />
          </aside>
        )}

        <div className="pf-overview-layout pf-overview-layout-wide">
          <section className="pf-masterplan-card pf-masterplan-card-compact">
            <div
              className={`pf-masterplan-stage ${project.masterplan ? "has-real-pdf has-callouts" : ""}`}
              data-overview-group={overviewGroup}
              data-overview-render-mode={OVERVIEW_RENDER_MODE}
              data-overview-raster-source="prepared-masterplan-page-1"
            >
              {!project.masterplan && (
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
        </div>
      </div>
    </main>
  );
}
