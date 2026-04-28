import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import erLogo from "../../assets/er_logo.png";
import gpLogo from "../../assets/gp_logo.png";
import { findGame, games } from "../../data/games";
import { getHealth } from "../../services/apiClient";

function getCurrentGame(pathname) {
  const gameId = pathname.split("/")[1];
  return findGame(gameId);
}

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentGame = getCurrentGame(location.pathname);
  const [healthStatus, setHealthStatus] = useState("checking");

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        await getHealth();
        if (!cancelled) setHealthStatus("connected");
      } catch (_) {
        if (!cancelled) setHealthStatus("disconnected");
      }
    }

    loadHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  if (location.pathname === "/") {
    return null;
  }

  function onChangeGame(event) {
    const nextGame = findGame(event.target.value);
    if (!nextGame?.sections?.length) return;
    navigate(nextGame.sections[0].path);
  }

  function getHealthLabel() {
    if (healthStatus === "connected") return "API 연결됨";
    if (healthStatus === "disconnected") return "API 연결 실패";
    return "API 확인 중";
  }

  return (
    <header className="topbar">
      <div className="shell__inner topbar__inner" style={{ position: "relative" }}>

        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          {currentGame && (
            <nav className="navigation__group" aria-label={`${currentGame.name} 메뉴`} style={{ margin: 0 }}>
              <span className="navigation__label" style={{ display: "inline-flex", justifyContent: "center", alignItems: "center", width: "52px", height: "52px", background: "#000", borderRadius: "14px", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)", border: "1px solid rgba(148, 163, 184, 0.15)" }}>
                {currentGame.id === "eternal-return" ? (
                  <img src={erLogo} alt={currentGame.name} style={{ height: "36px", width: "auto", objectFit: "contain", filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.5))" }} />
                ) : (
                  currentGame.name
                )}
              </span>
              <div className="navigation__items">
                {currentGame.sections.map((section) => (
                  <NavLink
                    key={section.id}
                    className={({ isActive }) =>
                      `nav-pill nav-pill--small${isActive ? " nav-pill--active" : ""}`
                    }
                    to={section.path}
                  >
                    {section.label}
                  </NavLink>
                ))}
              </div>
            </nav>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div className="brand">
            <NavLink className="brand__mark" to="/" aria-label="게임 포털 홈" style={{ padding: 0, overflow: 'hidden' }}>
              <img src={gpLogo} alt="GP Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </NavLink>
            <div>
              <p className="eyebrow">게임 데이터 플랫폼</p>
              <h1 className="brand__title" style={{ background: "linear-gradient(135deg, #60a5fa 0%, #a855f7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Game Portal Analytics</h1>
            </div>
          </div>
        </div>

        <div className="header__controls" style={{ flex: 1, justifyContent: "flex-end" }}>
          <span
            className={`status-chip${healthStatus === "disconnected" ? " status-chip--error" : ""}`}
          >
            {getHealthLabel()}
          </span>
          <label className="header-select" aria-label="게임 선택">
            <select
              value={currentGame?.id || games[0]?.id || ""}
              onChange={onChangeGame}
              aria-label="게임 선택"
            >
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}
