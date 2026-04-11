import { Link, useNavigate } from "react-router-dom";

import erLogo from "../../assets/er_logo.png";
import { games } from "../../data/games";

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="page-stack">
      <section className="game-grid">
        {games.map((game) => (
          <article
            key={game.id}
            className="game-card game-card--interactive"
            role="button"
            tabIndex={0}
            onClick={() => navigate(game.sections[0].path)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate(game.sections[0].path);
              }
            }}
          >
            <div className="game-card__head">
              <span className="game-card__badge" style={{ padding: 0 }}>
                {game.id === "eternal-return" ? (
                  <img src={erLogo} alt={game.shortName} style={{ height: "40px", objectFit: "contain" }} />
                ) : (
                  game.shortName
                )}
              </span>
              <p className="eyebrow">{game.description}</p>
            </div>
            <h3>{game.name}</h3>
            <div className="game-card__links">
              {game.sections.map((section) => (
                <Link
                  key={section.id}
                  className="text-link"
                  to={section.path}
                  onClick={(event) => event.stopPropagation()}
                >
                  {section.label}
                </Link>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
