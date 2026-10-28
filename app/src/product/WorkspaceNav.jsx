import "./WorkspaceNav.css";
import BrandWordmark from "../components/BrandWordmark.jsx";
import GlobalNav from "../components/GlobalNav.jsx";

export default function WorkspaceNav({ screen, mode, project, onExitWorkspace, onProjects, onMode }) {
  const inProject = screen === "project";

  if (!inProject) {
    return (
      <GlobalNav
        active="projects"
        onProduct={onExitWorkspace}
        onProjects={onProjects}
        onOpenWorkspace={onProjects}
      />
    );
  }

  return (
    <header className="pf-shell-nav pf-shell-nav-project">
      <div className="pf-shell-nav-left">
        <BrandWordmark className="pf-shell-nav-brand" onClick={onExitWorkspace} />
        <button type="button" className="pf-shell-nav-back" onClick={onProjects}>
          <span aria-hidden="true">←</span> All Projects
        </button>
      </div>
      <nav className="pf-shell-nav-modes" aria-label="Project navigation">
        <button type="button" className={mode === "landing" ? "active" : ""} onClick={() => onMode("landing")}>Project Home</button>
        <button type="button" className={mode === "overview" ? "active" : ""} onClick={() => onMode("overview")}>Overview</button>
        <button type="button" className={mode === "detail" ? "active" : ""} onClick={() => onMode("detail")}>Detail</button>
      </nav>
      <div className="pf-shell-nav-context">{project?.name || "Project"}</div>
    </header>
  );
}
