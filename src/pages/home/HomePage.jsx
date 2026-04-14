import { Link, useNavigate } from "react-router-dom";

import erLogo from "../../assets/er_logo.png";
import { games } from "../../data/games";

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="page-stack">
      <section className="page-intro" style={{ padding: "60px 0 40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <h1 className="page-title" style={{ fontFamily: '"Terminator Real NFI", sans-serif', fontSize: "clamp(2.2rem, 5vw, 3.2rem)", marginBottom: "20px", background: "linear-gradient(135deg, #60a5fa 0%, #a855f7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "0.02em", maxWidth: "100%", wordBreak: "keep-all", fontWeight: 900 }}>
          <span style={{ fontWeight: 900 }}>G</span>ame <span style={{ fontWeight: 900 }}>P</span>ortal<br /><span style={{ fontWeight: 900 }}>A</span>nalytics
        </h1>
        <p className="page-description" style={{ fontSize: "1.15rem", maxWidth: "700px", color: "#94a3b8", lineHeight: "1.6", wordBreak: "keep-all" }}>
          게임을 선택하고 심도 있는 통계, 유저 리포트, 최신 패치노트를 빠르게 확인하세요.<br />데이터 기반으로 게임을 더 깊이 이해할 수 있습니다.
        </p>
      </section>

      <section className="game-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "24px", paddingBottom: "60px" }}>
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
            style={{ display: "flex", flexDirection: "column", padding: "32px", background: "linear-gradient(145deg, rgba(51, 65, 85, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)", border: "1px solid rgba(147, 197, 253, 0.2)", borderRadius: "20px", boxShadow: "0 12px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)", backdropFilter: "blur(10px)" }}
          >
            <div className="game-card__head" style={{ marginBottom: "20px" }}>
              <span className="game-card__badge" style={{ padding: "0", background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", border: "1px solid rgba(255, 255, 255, 0.1)", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)" }}>
                {game.id === "eternal-return" ? (
                  <img src={erLogo} alt={game.shortName} style={{ height: "46px", objectFit: "contain", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))" }} />
                ) : (
                  game.shortName
                )}
              </span>
              <p className="eyebrow" style={{ color: "#60a5fa", fontWeight: "600", letterSpacing: "0.1em" }}>{game.description}</p>
            </div>
            <h3 style={{ fontSize: "1.75rem", margin: "0 0 24px", color: "#f8fafc" }}>{game.name}</h3>
            <div className="game-card__links" style={{ gap: "12px", marginTop: "auto" }}>
              {game.sections.map((section) => (
                <Link
                  key={section.id}
                  className="nav-pill nav-pill--small"
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
