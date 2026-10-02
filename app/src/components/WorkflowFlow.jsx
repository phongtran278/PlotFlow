import "./WorkflowFlow.css";

export default function WorkflowFlow({ items }) {
  return (
    <div className="pf-workflow-flow" aria-label="PlotFlow system diagram">
      {items.map((item, index) => (
        <div className={`pf-workflow-step pf-workflow-step--${item.key}`} key={item.key}>
          <span>{item.eyebrow}</span>
          <strong>{item.title}</strong>
          <b>{item.body}</b>
          <small>{item.meta}</small>
          {index < items.length - 1 && (
            <div className="pf-workflow-connector" aria-hidden="true">
              <i>→</i>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
