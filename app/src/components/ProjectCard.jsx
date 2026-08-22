import "./ProjectCard.css";

export default function ProjectCard({ project, index, onOpenLibrary }) {
  return (
    <article className={`pf-project-card pf-project-card--${project.status}`}>
      <header className="pf-project-card__header">
        <span className="pf-project-card__index">{String(index + 1).padStart(2, "0")}</span>
        <span className={`pf-project-card__status pf-project-card__status--${project.status}`}>{project.signal}</span>
      </header>

      <div className={`pf-project-card__visual pf-project-card__visual--${project.tone}`}>
        <div className="pf-project-card__grid" aria-hidden="true" />
        <div className="pf-project-card__copy">
          <strong>{project.name}</strong>
          <small>{project.developer} · {project.location}</small>
        </div>
      </div>

      <footer className="pf-project-card__footer">
        <button className="pf-project-card__action" type="button" onClick={onOpenLibrary}>
          <span>Open in library</span>
          <b aria-hidden="true">→</b>
        </button>
      </footer>
    </article>
  );
}
