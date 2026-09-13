import "./WorkspaceNav.css";

export default function WorkspaceNav({ screen, mode, project, onExitWorkspace, onProjects, onMode }) {
  const inProject = screen === "project";

  return (
    <header className="pf-shell-nav">
      <div className="pf-shell-nav-left">
        <button type="button" className="pf-shell-nav-brand" onClick={onExitWorkspace} aria-label="Back to PlotFlow home">
          PlotFlow
        </button>
        {inProject && (
          <button type="button" className="pf-shell-nav-back" onClick={onProjects}>
            <span aria-hidden="true">←</span> Projects
          </button>
        )}
      </div>

      <nav className="pf-shell-nav-modes" aria-label={inProject ? "Project navigation" : "Workspace navigation"}>
        {!inProject && <button type="button" className="active" onClick={onProjects}>Projects</button>}
        {inProject && (
          <>
            <button type="button" className={mode === "landing" ? "active" : ""} onClick={() => onMode("landing")}>Project Home</button>
            <button type="button" className={mode === "overview" ? "active" : ""} onClick={() => onMode("overview")}>Overview</button>
            <button type="button" className={mode === "detail" ? "active" : ""} onClick={() => onMode("detail")}>Detail</button>
          </>
        )}
      </nav>

      <div className="pf-shell-nav-context" aria-hidden={!inProject}>
        {inProject ? project?.name : null}
      </div>
    </header>
  );
}
