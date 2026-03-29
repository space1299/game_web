import { useEffect, useState } from "react";

import { getUserReportStatus, requestUserReport } from "../../services/apiClient";

const POLLING_INTERVAL_MS = 3000;
const FINAL_REPORT_RETRY_DELAY_MS = 1000;
const FINAL_REPORT_RETRY_COUNT = 5;

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

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function UserReportPage() {
  const [nicknameInput, setNicknameInput] = useState("");
  const [submittedNickname, setSubmittedNickname] = useState("");
  const [jobId, setJobId] = useState("");
  const [phase, setPhase] = useState("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  async function fetchFinalReport(nickname, options = {}) {
    const retries = options.retries ?? FINAL_REPORT_RETRY_COUNT;
    const delayMs = options.delayMs ?? FINAL_REPORT_RETRY_DELAY_MS;

    for (let attempt = 0; attempt < retries; attempt += 1) {
      const response = await requestUserReport(nickname);
      const nextReport = extractReportPayload(response);
      if (nextReport) {
        return nextReport;
      }

      if (attempt < retries - 1) {
        await wait(delayMs);
      }
    }

    return null;
  }

  useEffect(() => {
    if (!jobId || !submittedNickname || (phase !== "queued" && phase !== "running")) {
      return undefined;
    }

    let cancelled = false;
    const timerId = window.setTimeout(async () => {
      try {
        const job = await getUserReportStatus(jobId);
        if (cancelled) return;

        const nextStatus = job?.status || "queued";

        const jobReport = extractReportPayload(job);
        if (jobReport) {
          setReport(jobReport);
          setPhase("done");
          setErrorMessage("");
          setStatusMessage("리포트가 준비되었습니다.");
          return;
        }

        if (nextStatus === "done") {
          setStatusMessage("리포트를 확인하는 중입니다.");
          const nextReport = await fetchFinalReport(submittedNickname);
          if (cancelled) return;

          if (nextReport) {
            setReport(nextReport);
            setPhase("done");
            setErrorMessage("");
            setStatusMessage("리포트가 준비되었습니다.");
          } else {
            setPhase("error");
            setErrorMessage("완료 상태를 확인했지만 최종 리포트를 불러오지 못했습니다.");
          }
        } else {
          setPhase(nextStatus);
          setStatusMessage(job?.message || "");
        }

        if (nextStatus === "error") {
          setErrorMessage(job?.error?.message || "리포트 생성에 실패했습니다.");
        }
      } catch (error) {
        if (cancelled) return;
        setPhase("error");
        setErrorMessage(error.detail || error.message || "리포트 상태를 확인하지 못했습니다.");
      }
    }, POLLING_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [jobId, phase, submittedNickname]);

  async function onSubmit(event) {
    event.preventDefault();

    const nickname = nicknameInput.trim();
    if (!nickname) {
      setErrorMessage("닉네임을 입력해 주세요.");
      setPhase("error");
      return;
    }

    setSubmittedNickname(nickname);
    setJobId("");
    setReport(null);
    setErrorMessage("");
    setStatusMessage("");
    setPhase("loading");
    setActiveTab("overview");

    try {
      const nextReport = await fetchFinalReport(nickname, { retries: 1 });
      if (nextReport) {
        setReport(nextReport);
        setPhase("done");
        setStatusMessage("리포트를 불러왔습니다.");
        return;
      }

      const response = await requestUserReport(nickname);
      if (response?.jobId) {
        setJobId(response.jobId);
        setPhase(response.status || "queued");
        setStatusMessage("리포트 생성을 요청했습니다. 완료될 때까지 확인 중입니다.");
        return;
      }

      setPhase("error");
      setErrorMessage("유저 리포트 API 응답 형식이 예상과 다릅니다.");
    } catch (error) {
      setPhase("error");
      setErrorMessage(error.detail || error.message || "유저 리포트를 요청하지 못했습니다.");
    }
  }

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

      {errorMessage ? (
        <section className="notice-panel notice-panel--error">
          <strong>유저 리포트 요청에 실패했습니다.</strong>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {(phase === "loading" || phase === "queued" || phase === "running") && !report ? (
        <section className="notice-panel">
          <strong>리포트를 생성하고 있습니다.</strong>
          <p>{statusMessage || "백엔드 작업이 끝날 때까지 잠시만 기다려 주세요."}</p>
        </section>
      ) : null}

      {reportErrorMessage ? (
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
