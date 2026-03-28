export function PageIntro({ eyebrow, title, description }) {
  return (
    <section className="page-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="page-title">{title}</h2>
      <p className="page-description">{description}</p>
    </section>
  );
}
