import "./FaqAccordion.css";

export default function FaqAccordion({ items, openIndex, onToggle }) {
  return (
    <div className="pf-faq-accordion">
      {items.map(([question, answer], index) => {
        const isOpen = openIndex === index;
        return (
          <article className={isOpen ? "is-open" : ""} key={question}>
            <button type="button" onClick={() => onToggle(isOpen ? -1 : index)} aria-expanded={isOpen}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{question}</strong>
              <i>＋</i>
            </button>
            <div className="pf-faq-accordion__answer" aria-hidden={!isOpen}>
              <div>
                <p>{answer}</p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
