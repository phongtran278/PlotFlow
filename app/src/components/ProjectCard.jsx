import "./ProjectCard.css";

export default function ProjectCard({ project, index, onOpenProject, onOpenLibrary }) {
  const isActive = project.status === "active";

  return (
    <article className={`pf-project-card pf-project-card--${project.status}`}>
      <header className="pf-project-card__header">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <em>{project.signal}</em>
      </header>

      <div className={`pf-project-card__visual pf-project-card__visual--${project.tone}`}>
        <div className="pf-project-card__grid" aria-hidden="true" />
        <div className="pf-project-card__copy">
          <strong>{project.name}</strong>
          <small>{project.developer} · {project.location}</small>
        </div>
      </div>

      <footer className="pf-project-card__footer">
        <button type="button" onClick={isActive ? onOpenProject : onOpenLibrary}>
          {isActive ? "Open workspace" : "View in library"} <b>{isActive ? "↗" : "→"}</b>
        </button>
      </footer>
    </article>
  );
}
