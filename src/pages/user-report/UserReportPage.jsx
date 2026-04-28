import { useEffect, useRef, useState } from "react";

import {
  getUserReportStatus,
  refreshUserReport,
  requestUserReport,
  subscribeUserReportStream,
} from "../../services/apiClient";

const POLLING_INTERVAL_MS = 3000;

const reportTabs = [
  { id: "overview", label: "리포트 개요" },
  { id: "character-trend", label: "주력 캐릭터 분석" },
  { id: "compare", label: "티어 평균 비교" },
];

function formatRate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${(number * 100).toFixed(1)}%` : "-";
}

function formatWinsRate(wins, totalGames) {
  const winCount = Number(wins);
  const games = Number(totalGames);
  if (!Number.isFinite(winCount) || !Number.isFinite(games) || games <= 0) return "-";
  return `${((winCount / games) * 100).toFixed(1)}%`;
}

function formatNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return number.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatRankPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `${(number * 100).toFixed(2)}%`;
}

function formatDateTime(value) {
  if (!value) return "-";

  const normalized =
    typeof value === "object" && value !== null && "$date" in value ? value.$date : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(normalized);

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDelta(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  const formatted = number.toLocaleString(undefined, { maximumFractionDigits: digits });
  if (number > 0) return `+${formatted}`;
  return formatted;
}

function getDeltaTone(value, reverse = false) {
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return "neutral";
  if (reverse) {
    return number < 0 ? "positive" : "negative";
  }
  return number > 0 ? "positive" : "negative";
}

function getCompareItems(report) {
  const items = report?.characterCompare?.items;
  return Array.isArray(items) ? items : [];
}

function isReportPayload(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value.meta || value.seasonSummary || value.characterSlices || value.characterCompare),
  );
}

function extractReportPayload(response) {
  if (isReportPayload(response)) return response;
  if (isReportPayload(response?.report)) return response.report;
  return null;
}

function computeCooldownRemaining(cooldownEndsAt) {
  if (!cooldownEndsAt) return null;
  return Math.max(0, Math.ceil((new Date(cooldownEndsAt) - Date.now()) / 1000));
}

export function UserReportPage() {
  const [nicknameInput, setNicknameInput] = useState("");
  const [submittedNickname, setSubmittedNickname] = useState("");
  // phase: "idle" | "loading" | "queued" | "running" | "done" | "error"
  const [phase, setPhase] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Refresh state: tracks an active or blocked background refresh (coexists with done phase)
  const [refreshJobId, setRefreshJobId] = useState(null);
  // refreshJobStatus: null | "queued" | "running" | "error" | "cooldown"
  const [refreshJobStatus, setRefreshJobStatus] = useState(null);
  const [refreshError, setRefreshError] = useState("");
  const [cooldownEndsAt, setCooldownEndsAt] = useState(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(null);

  // sseKey: null | { nickname, gen } — changing this value starts a new SSE subscription
  const [sseKey, setSseKey] = useState(null);
  // pollingEnabled: fallback when SSE fails and there is no report yet
  const [pollingEnabled, setPollingEnabled] = useState(false);

  // phaseRef lets SSE/polling callbacks read current phase without stale closure
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // --- SSE subscription effect ---
  useEffect(() => {
    if (!sseKey) return;
    const { nickname } = sseKey;

    const cancel = subscribeUserReportStream(nickname, {
      onEvent: async (event) => {
        if (event.type !== "status") return;
        const { jobStatus, error: jobError } = event;

        if (jobStatus === "done") {
          try {
            const response = await requestUserReport(nickname);
            const newReport = extractReportPayload(response);
            if (newReport) setReport(newReport);
            setRefreshJobId(null);
            setRefreshJobStatus(null);
            setRefreshError("");
            setPhase("done");
          } catch (err) {
            const errMsg = err.detail || err.message || "리포트를 불러오지 못했습니다.";
            if (phaseRef.current === "done") {
              setRefreshJobStatus("error");
              setRefreshError(errMsg);
            } else {
              setPhase("error");
              setErrorMessage(errMsg);
            }
          }
        } else if (jobStatus === "error") {
          const errMsg = jobError || "리포트 생성에 실패했습니다.";
          if (phaseRef.current === "done") {
            setRefreshJobStatus("error");
            setRefreshError(errMsg);
          } else {
            setPhase("error");
            setErrorMessage(errMsg);
          }
        } else {
          // queued or running: update status
          setRefreshJobStatus(jobStatus);
          if (phaseRef.current !== "done") {
            setPhase(jobStatus);
          }
        }
      },
      onError: () => {
        // SSE failed — fall back to polling only when waiting for first report
        if (phaseRef.current !== "done") {
          setPollingEnabled(true);
        }
      },
    });

    return cancel;
  }, [sseKey]);

  // --- Polling fallback effect (active only when SSE fails before first report) ---
  useEffect(() => {
    if (!pollingEnabled || !refreshJobId || !submittedNickname) return;
    if (phase !== "queued" && phase !== "running") return;

    let cancelled = false;
    const timerId = window.setTimeout(async () => {
      try {
        const job = await getUserReportStatus(refreshJobId);
        if (cancelled) return;

        const nextStatus = job?.status || "queued";

        if (nextStatus === "done") {
          const response = await requestUserReport(submittedNickname);
          if (cancelled) return;
          const finalReport = extractReportPayload(response);
          if (finalReport) {
            setReport(finalReport);
            setPhase("done");
            setRefreshJobId(null);
            setRefreshJobStatus(null);
            setPollingEnabled(false);
          } else {
            setPhase("error");
            setErrorMessage("완료 상태를 확인했지만 최종 리포트를 불러오지 못했습니다.");
            setPollingEnabled(false);
          }
        } else if (nextStatus === "error") {
          setPhase("error");
          setErrorMessage(job?.error?.message || "리포트 생성에 실패했습니다.");
          setPollingEnabled(false);
        } else {
          setPhase(nextStatus);
          setRefreshJobStatus(nextStatus);
        }
      } catch (error) {
        if (cancelled) return;
        setPhase("error");
        setErrorMessage(error.detail || error.message || "리포트 상태를 확인하지 못했습니다.");
        setPollingEnabled(false);
      }
    }, POLLING_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [pollingEnabled, refreshJobId, phase, submittedNickname]);

  // --- Cooldown countdown effect ---
  useEffect(() => {
    if (!cooldownEndsAt) {
      setCooldownRemaining(null);
      return;
    }

    const update = () => {
      const r = computeCooldownRemaining(cooldownEndsAt);
      setCooldownRemaining(r);
      return r;
    };

    if (update() <= 0) return;

    const interval = window.setInterval(() => {
      if (update() <= 0) window.clearInterval(interval);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [cooldownEndsAt]);

  // --- Submit handler ---
  async function onSubmit(event) {
    event.preventDefault();

    const nickname = nicknameInput.trim();
    if (!nickname) {
      setErrorMessage("닉네임을 입력해 주세요.");
      setPhase("error");
      return;
    }

    setSubmittedNickname(nickname);
    setReport(null);
    setErrorMessage("");
    setPhase("loading");
    setActiveTab("overview");
    setRefreshJobId(null);
    setRefreshJobStatus(null);
    setRefreshError("");
    setCooldownEndsAt(null);
    setSseKey(null);
    setPollingEnabled(false);

    try {
      const response = await requestUserReport(nickname);
      const reportPayload = extractReportPayload(response);
      const jobId = response?.jobId;
      const jobStatus = response?.jobStatus;

      if (reportPayload) {
        setReport(reportPayload);
        setPhase("done");
      }

      if (jobId) {
        setRefreshJobId(jobId);
        if (jobStatus === "queued" || jobStatus === "running") {
          setRefreshJobStatus(jobStatus);
          setSseKey({ nickname, gen: Date.now() });
          if (!reportPayload) {
            setPhase(jobStatus);
          }
        } else if (jobStatus === "error") {
          setRefreshJobStatus("error");
          setRefreshError(response.jobError || "");
          if (!reportPayload) {
            setPhase("error");
            setErrorMessage(response.jobError || "리포트 생성에 실패했습니다.");
          }
        }
      } else if (!reportPayload) {
        setPhase("error");
        setErrorMessage("유저 리포트 API 응답 형식이 예상과 다릅니다.");
      }
    } catch (error) {
      setPhase("error");
      setErrorMessage(error.detail || error.message || "유저 리포트를 요청하지 못했습니다.");
    }
  }

  // --- Manual refresh handler ---
  async function onRefresh() {
    if (!submittedNickname || phase !== "done") return;
    if (refreshJobStatus === "queued" || refreshJobStatus === "running") return;

    setRefreshError("");
    setCooldownEndsAt(null);

    try {
      const response = await refreshUserReport(submittedNickname);

      if (response.refreshStatus === "cooldown") {
        setRefreshJobId(response.jobId);
        setRefreshJobStatus("cooldown");
        setCooldownEndsAt(response.cooldownEndsAt);
      } else {
        // "accepted" or "in_progress"
        setRefreshJobId(response.jobId);
        setRefreshJobStatus(response.jobStatus || "queued");
        setSseKey({ nickname: submittedNickname, gen: Date.now() });
      }
    } catch (error) {
      setRefreshError(error.detail || error.message || "새로고침 요청에 실패했습니다.");
    }
  }

  // --- Derived values ---
  const isRefreshActive = refreshJobStatus === "queued" || refreshJobStatus === "running";
  const canRefresh =
    phase === "done" && !isRefreshActive && refreshJobStatus !== "cooldown";

  const meta = report?.meta || {};
  const seasonSummary = report?.seasonSummary || {};
  const reportErrorMessage = report?.error?.message || "";
  const apiCharacterStats = Array.isArray(seasonSummary?.apiCharacterStats)
    ? seasonSummary.apiCharacterStats
    : [];
  const compareItems = getCompareItems(report);
  const characterTrendItems = Array.isArray(report?.characterSlices?.items)
    ? [...report.characterSlices.items].sort(
      (a, b) => Number(b?.pickCount || 0) - Number(a?.pickCount || 0),
    )
    : [];
  const topCharacters = apiCharacterStats.slice(0, 3);
  const versionLabel =
    meta.versionSeason != null && meta.versionMajor != null && meta.versionMinor != null
      ? `${meta.versionSeason}.${meta.versionMajor}.${meta.versionMinor}`
      : "-";

  return (
    <div className="page-stack">
      <section className="toolbar-panel">
        <form className="search-form" onSubmit={onSubmit}>
          <label className="field field--grow">
            <span className="field__label">닉네임</span>
            <input
              type="text"
              value={nicknameInput}
              onChange={(event) => setNicknameInput(event.target.value)}
              placeholder="플레이어 닉네임 입력"
            />
          </label>
          <button type="submit" className="button-primary">
            조회
          </button>
        </form>
      </section>

      {errorMessage && !report ? (
        <section className="notice-panel notice-panel--error">
          <strong>유저 리포트 요청에 실패했습니다.</strong>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {(phase === "loading" || phase === "queued" || phase === "running") && !report ? (
        <section className="notice-panel">
          <strong className="animated-dots">리포트를 생성하고 있습니다</strong>
          <p>데이터 분석은 최대 10초 정도 소요될 수 있습니다, 잠시만 기다려 주세요.</p>
        </section>
      ) : null}

      {report && reportErrorMessage ? (
        <section className="notice-panel notice-panel--error">
          <strong>리포트 데이터에 오류가 포함되어 있습니다.</strong>
          <p>{reportErrorMessage}</p>
        </section>
      ) : null}

      {report && !reportErrorMessage ? (
        <>
          <section className="tab-bar" aria-label="리포트 섹션">
            {reportTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`tab-button${activeTab === tab.id ? " tab-button--active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
            <div className="tab-bar__actions">
              {canRefresh ? (
                <button type="button" className="tab-button" onClick={onRefresh}>
                  새로고침
                </button>
              ) : null}
              {isRefreshActive ? (
                <span className="tab-bar__hint">갱신 중...</span>
              ) : null}
              {refreshJobStatus === "cooldown" && cooldownRemaining != null ? (
                <span className="tab-bar__hint">
                  {cooldownRemaining > 0
                    ? `${cooldownRemaining}초 후 새로고침 가능`
                    : "새로고침 가능"}
                </span>
              ) : null}
              {refreshError ? (
                <span className="tab-bar__hint tab-bar__hint--error">{refreshError}</span>
              ) : null}
            </div>
          </section>

          {activeTab === "overview" ? (
            <section className="panel">
              <div className="panel__header">
                <h3>리포트 개요</h3>
                <p>닉네임 기준 핵심 시즌 정보입니다.</p>
              </div>
              <div className="panel__body">
                <div className="overview-metrics">
                  <article className="summary-card">
                    <span className="summary-card__label">닉네임</span>
                    <strong className="summary-card__value summary-card__value--small">
                      {meta.nickname || submittedNickname || "-"}
                    </strong>
                  </article>
                  <article className="summary-card">
                    <span className="summary-card__label">MMR</span>
                    <strong className="summary-card__value">{formatNumber(seasonSummary.mmr)}</strong>
                  </article>
                  <article className="summary-card">
                    <span className="summary-card__label">랭크</span>
                    <strong className="summary-card__value">{formatNumber(seasonSummary.rank)}</strong>
                    <p className="summary-card__text">상위 {formatRankPercent(seasonSummary.rankPercent)}</p>
                  </article>
                </div>

                <dl className="key-value-list">
                  <div>
                    <dt>버전</dt>
                    <dd>{versionLabel}</dd>
                  </div>
                  <div>
                    <dt>게임 수</dt>
                    <dd>{formatNumber(seasonSummary.totalGames)}</dd>
                  </div>
                  <div>
                    <dt>승리 수</dt>
                    <dd>{formatNumber(seasonSummary.totalWins)}</dd>
                  </div>
                  <div>
                    <dt>승률</dt>
                    <dd>{formatRate(seasonSummary.top1)}</dd>
                  </div>
                  <div>
                    <dt>Top3</dt>
                    <dd>{formatRate(seasonSummary.top3)}</dd>
                  </div>
                  <div>
                    <dt>생성 시각</dt>
                    <dd>{formatDateTime(report.generatedAt || meta.createdAt)}</dd>
                  </div>
                </dl>

                {topCharacters.length ? (
                  <div className="compact-list">
                    {topCharacters.map((item) => (
                      <article
                        key={`${item.characterCode}-${item.characterNameKo || "character"}`}
                        className="compact-list__item"
                      >
                        <strong>{item.characterNameKo || item.characterCode}</strong>
                        <span>{formatNumber(item.totalGames)}게임</span>
                        <span>승률 {formatWinsRate(item.wins, item.totalGames)}</span>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="empty-copy">상위 캐릭터 데이터가 없습니다.</p>
                )}
              </div>
            </section>
          ) : null}

          {activeTab === "character-trend" ? (
            <section className="panel">
              <div className="panel__header">
                <h3>최근 캐릭터 경향</h3>
                <p>최근 게임을 기반으로 어떤 캐릭터 조합을 주로 사용했고 어떤 성과를 냈는지 정리합니다.</p>
              </div>
              <div className="panel__body">
                {characterTrendItems.length ? (
                  <div className="report-card-list">
                    {characterTrendItems.map((item, index) => (
                      <article
                        key={`${item.characterWeaponNameKo || item.characterNum}-${index}`}
                        className="report-card"
                      >
                        <div className="report-card__head">
                          <div>
                            <strong>{item.characterWeaponNameKo || item.characterNameKo || "-"}</strong>
                            <p>{formatNumber(item.pickCount)}게임 플레이</p>
                          </div>
                          <span className="report-card__badge">
                            평균 MMR {formatNumber(item.avgMmrGain, 1)}
                          </span>
                        </div>
                        <div className="report-card__stats">
                          <span>승률 {formatRate(item.winRate)}</span>
                          <span>Top3 {formatRate(item.top3Rate)}</span>
                          <span>평균 순위 {formatNumber(item.avgGameRank, 2)}</span>
                          <span>평균 딜량 {formatNumber(item.avgDamageToPlayer)}</span>
                          <span>평균 킬 관여 {formatNumber(item.avgTeamKill, 1)}</span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="empty-copy">최근 캐릭터 경향 데이터가 없습니다.</p>
                )}
              </div>
            </section>
          ) : null}

          {activeTab === "compare" ? (
            <section className="panel">
              <div className="panel__header">
                <h3>티어 평균 비교</h3>
                <p>주요 캐릭터의 성과 차이를 바로 읽을 수 있게 정리합니다.</p>
              </div>
              <div className="panel__body">
                {compareItems.length ? (
                  <div className="report-card-list">
                    {compareItems.slice(0, 6).map((item, index) => (
                      <article
                        key={`${item?.key?.characterWeaponNameKo || item?.key?.characterNum}-${index}`}
                        className="report-card"
                      >
                        <div className="report-card__head">
                          <div>
                            <strong>{item?.key?.characterWeaponNameKo || "-"}</strong>
                            <p>
                              유저 승률 {formatRate(item?.user?.winRate)} / 티어 승률{" "}
                              {formatRate(item?.tierAvg?.winRate)}
                            </p>
                          </div>
                        </div>
                        <div className="delta-grid">
                          <span
                            className={`delta-chip delta-chip--${getDeltaTone(
                              item?.diff?.mmrGainAvgDelta,
                            )}`}
                          >
                            MMR {formatDelta(item?.diff?.mmrGainAvgDelta)}
                          </span>
                          <span
                            className={`delta-chip delta-chip--${getDeltaTone(
                              item?.diff?.avgRankDelta,
                              true,
                            )}`}
                          >
                            순위 {formatDelta(item?.diff?.avgRankDelta)}
                          </span>
                          <span
                            className={`delta-chip delta-chip--${getDeltaTone(
                              item?.diff?.winRateDelta,
                            )}`}
                          >
                            승률 {formatDelta((item?.diff?.winRateDelta || 0) * 100)}%p
                          </span>
                          <span
                            className={`delta-chip delta-chip--${getDeltaTone(
                              item?.diff?.avgDamageDelta,
                            )}`}
                          >
                            딜량 {formatDelta(item?.diff?.avgDamageDelta)}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="empty-copy">비교 데이터가 없습니다.</p>
                )}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
