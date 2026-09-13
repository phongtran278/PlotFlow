import "./OverviewWorkspace.css";
import "./OverviewHandoverTabs.css";

const OVERVIEW_RENDER_MODE = "raster";

function uniqueUnitCount(list = []) {
  const keys = list.map((item, index) => String(item?.code || item?.id || index)).filter(Boolean);
  return new Set(keys).size;
}

function normalizedGroup(value = "") {
  return String(value).trim().toLowerCase().replace(/\s+/g, " ");
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
  const overviewConfigured = Boolean(project?.profile?.overview?.configured && project.masterplan);
  const liveUnitCount = sellUnits.length ? uniqueUnitCount(sellUnits) : uniqueUnitCount(units);
  const groupUnitCount = sellUnits.length ? uniqueUnitCount(visibleSellUnits) : liveUnitCount;
  const countForGroup = (group) => {
    if (!sellUnits.length) return group === overviewGroup ? groupUnitCount : 0;
    const key = normalizedGroup(group);
    return uniqueUnitCount(sellUnits.filter((item) => normalizedGroup(item?.handover) === key));
  };

  return (
    <main className="pf-overview">
      <header className="pf-overview-intro">
        <div className="pf-overview-intro-copy">
          <h1>{project.name}</h1>
        </div>

        {overviewConfigured && (
          <div className="pf-overview-header-tools">
            <nav className="pf-overview-handover-tabs" aria-label="Tiêu chuẩn bàn giao">
              {overviewGroups.map((group) => {
                const active = group === overviewGroup;
                return (
                  <button
                    key={group}
                    type="button"
                    className={active ? "is-active" : ""}
                    aria-pressed={active}
                    onClick={() => onOverviewGroup(group)}
                  >
                    <span>{group}</span>
                    <small>{countForGroup(group)} căn</small>
                  </button>
                );
              })}
            </nav>
            <div className="pf-overview-header-actions" aria-label="Overview view controls" />
          </div>
        )}
      </header>

      <div className={`pf-overview-editor-shell ${overviewConfigured ? "" : "is-wireframe"}`}>
        {overviewConfigured && (
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
              className={`pf-masterplan-stage ${overviewConfigured ? "has-real-pdf has-callouts" : "is-project-wireframe"}`}
              data-overview-group={overviewConfigured ? overviewGroup : ""}
              data-overview-render-mode={overviewConfigured ? OVERVIEW_RENDER_MODE : "wireframe"}
              data-overview-raster-source={overviewConfigured ? "prepared-masterplan-page-1" : ""}
            >
              {!overviewConfigured && (
                <div className="pf-overview-wireframe" aria-label="Overview chưa được cấu hình cho dự án này">
                  <div className="pf-overview-wireframe-plan" aria-hidden="true">
                    <span className="pf-overview-wireframe-x" />
                    <b>MASTERPLAN / SITE PLAN</b>
                  </div>
                  <div className="pf-overview-wireframe-caption">
                    <strong>Overview structure</strong>
                    <span>Project-specific masterplan, groups, units and interactions will be configured here.</span>
                  </div>
                </div>
              )}

              {overviewConfigured && sellUnits.length > 0 && visibleSellUnits.length === 0 && (
                <div className="pf-overview-coming"><strong>{overviewGroup}</strong><span>Không có căn nào thuộc đúng tiêu chuẩn bàn giao này trong file sell đang kết nối.</span></div>
              )}
              {overviewConfigured && sellUnits.length === 0 && units.length === 0 && (
                <div className="pf-overview-coming"><strong>Chưa có dữ liệu căn thật</strong><span>Connect Sheet ở Detail. Overview sẽ đọc nguyên dữ liệu sell và không dùng dữ liệu demo.</span></div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
