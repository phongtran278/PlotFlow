import "./ProjectCard.css";
import Button from "./Button.jsx";

export default function ProjectCard({ project, index, onOpenLibrary }) {
  return (
    <article className={`pf-project-card pf-project-card--${project.status}`}>
      <div className={`pf-project-card__visual pf-project-card__visual--${project.tone}`} aria-label={`${project.name} project thumbnail placeholder`}>
        <div className="pf-project-card__grid" aria-hidden="true" />
      </div>

      <div className="pf-project-card__content">
        <div className="pf-project-card__meta">
          <span className="pf-project-card__index">{String(index + 1).padStart(2, "0")}</span>
          <span className={`pf-project-card__status pf-project-card__status--${project.status}`}>{project.signal}</span>
        </div>

        <div className="pf-project-card__copy">
          <strong>{project.name}</strong>
        </div>

        <div className="pf-project-card__utility">
          <small>{project.developer} · {project.location}</small>
          <Button variant="secondary" className="pf-project-card__action" onClick={onOpenLibrary}>
            <span>Open in library</span>
            <b aria-hidden="true">→</b>
          </Button>
        </div>
      </div>
    </article>
  );
}
