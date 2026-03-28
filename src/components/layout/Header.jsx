import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

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
      <div className="shell__inner topbar__inner">
        <div className="brand">
          <NavLink className="brand__mark" to="/" aria-label="게임 포털 홈">
            GP
          </NavLink>
          <div>
            <p className="eyebrow">게임 데이터 플랫폼</p>
            <h1 className="brand__title">Game Portal Analytics</h1>
          </div>
        </div>

        <div className="header__controls">
          <span
            className={`status-chip${
              healthStatus === "disconnected" ? " status-chip--error" : ""
            }`}
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

      {currentGame ? (
        <div className="shell__inner navigation">
          <nav className="navigation__group" aria-label={`${currentGame.name} 메뉴`}>
            <span className="navigation__label">{currentGame.name}</span>
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
        </div>
      ) : null}
    </header>
  );
}
