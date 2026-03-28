export function PlaceholderPanel({ title, description, items }) {
  return (
    <section className="panel">
      <div className="panel__header">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="panel__body">
        <ul className="check-list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
