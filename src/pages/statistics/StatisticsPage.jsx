import { useEffect, useState } from "react";

import { getCharacterStatistics, getVersions } from "../../services/apiClient";

const DEFAULT_MMR = "DiamondPlus";
const MMR_ORDER = ["Mythril", "Meteor", "Diamond", "Platinum", "Gold"];

const columns = [
  { key: "characterName_inkorean", label: "캐릭터", type: "string" },
  { key: "pickrate", label: "픽률", type: "percent" },
  { key: "avg_mmrGain", label: "평균 MMR", type: "number" },
  { key: "win_rate", label: "승률", type: "percent" },
  { key: "top3_rate", label: "Top3 비율", type: "percent" },
  { key: "avg_gameRank", label: "평균 순위", type: "number" },
  { key: "avg_damageToPlayer", label: "평균 딜량", type: "number" },
  { key: "avg_teamKill", label: "평균 킬 관여", type: "number" },
  { key: "pickCount", label: "게임 수", type: "integer" },
];

function formatValue(value, type) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";

  if (type === "percent") return `${(number * 100).toFixed(2)}%`;
  if (type === "integer") return Math.round(number).toLocaleString();
  return number.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function compareValues(a, b, type, direction) {
  const multiplier = direction === "asc" ? 1 : -1;

  if (type === "string") {
    return String(a ?? "").localeCompare(String(b ?? ""), "en") * multiplier;
  }

  const na = Number(a);
  const nb = Number(b);
  const safeA = Number.isFinite(na) ? na : Number.NEGATIVE_INFINITY;
  const safeB = Number.isFinite(nb) ? nb : Number.NEGATIVE_INFINITY;
  return (safeA - safeB) * multiplier;
}

function buildMmrOptions(statisticsByMmr) {
  const keys = Object.keys(statisticsByMmr || {});
  if (!keys.length) return [DEFAULT_MMR];

  return [...keys].sort((a, b) => {
    const baseA = a.replace(/Plus$/i, "");
    const baseB = b.replace(/Plus$/i, "");
    const rankA = MMR_ORDER.indexOf(baseA);
    const rankB = MMR_ORDER.indexOf(baseB);
    const safeRankA = rankA === -1 ? Number.MAX_SAFE_INTEGER : rankA;
    const safeRankB = rankB === -1 ? Number.MAX_SAFE_INTEGER : rankB;

    if (safeRankA !== safeRankB) {
      return safeRankA - safeRankB;
    }

    const plusA = /Plus$/i.test(a) ? 0 : 1;
    const plusB = /Plus$/i.test(b) ? 0 : 1;
    if (plusA !== plusB) {
      return plusA - plusB;
    }

    return a.localeCompare(b, "en");
  });
}

function formatMmrLabel(mmr) {
  if (!mmr) return "-";

  const baseLabels = {
    Mythril: "미스릴",
    Meteor: "메테오",
    Diamond: "다이아",
    Platinum: "플래티넘",
    Gold: "골드",
  };

  const hasPlus = /Plus$/i.test(mmr);
  const baseKey = mmr.replace(/Plus$/i, "");
  const baseLabel = baseLabels[baseKey] || baseKey;
  return hasPlus ? `${baseLabel}+` : baseLabel;
}

function getSortedRows(rows, sortKey, sortDirection) {
  const column = columns.find((item) => item.key === sortKey);
  const type = column?.type || "number";
  return [...rows].sort((a, b) =>
    compareValues(a?.[sortKey], b?.[sortKey], type, sortDirection),
  );
}

export function StatisticsPage() {
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [selectedMmr, setSelectedMmr] = useState(DEFAULT_MMR);
  const [statisticsByMmr, setStatisticsByMmr] = useState({});
  const [loadingVersions, setLoadingVersions] = useState(true);
  const [loadingStatistics, setLoadingStatistics] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sortKey, setSortKey] = useState("pickrate");
  const [sortDirection, setSortDirection] = useState("desc");

  useEffect(() => {
    let cancelled = false;

    async function loadVersions() {
      setLoadingVersions(true);
      setErrorMessage("");

      try {
        const response = await getVersions();
        const nextVersions = Array.isArray(response) ? response : [];
        if (cancelled) return;

        setVersions(nextVersions);
        setSelectedVersion(nextVersions[0] || "");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error.detail || error.message || "버전 목록을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) {
          setLoadingVersions(false);
        }
      }
    }

    loadVersions();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedVersion) return;

    let cancelled = false;

    async function loadStatistics() {
      setLoadingStatistics(true);
      setErrorMessage("");

      try {
        const response = await getCharacterStatistics(selectedVersion);
        if (cancelled) return;

        setStatisticsByMmr(response || {});
        const nextOptions = buildMmrOptions(response || {});
        setSelectedMmr((current) =>
          nextOptions.includes(current) ? current : nextOptions[0] || DEFAULT_MMR,
        );
      } catch (error) {
        if (cancelled) return;
        setStatisticsByMmr({});
        setErrorMessage(error.detail || error.message || "통계를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) {
          setLoadingStatistics(false);
        }
      }
    }

    loadStatistics();
    return () => {
      cancelled = true;
    };
  }, [selectedVersion]);

  const mmrOptions = buildMmrOptions(statisticsByMmr);
  const currentRows = Array.isArray(statisticsByMmr?.[selectedMmr])
    ? statisticsByMmr[selectedMmr]
    : [];
  const sortedRows = getSortedRows(currentRows, sortKey, sortDirection);
  function onSort(columnKey) {
    if (sortKey === columnKey) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }

    setSortKey(columnKey);
    const column = columns.find((item) => item.key === columnKey);
    setSortDirection(column?.type === "string" ? "asc" : "desc");
  }

  return (
    <div className="page-stack">
      <section className="toolbar-panel">
        <div className="field-grid">
          <label className="field">
            <span className="field__label">버전</span>
            <select
              value={selectedVersion}
              onChange={(event) => setSelectedVersion(event.target.value)}
              disabled={loadingVersions || !versions.length}
            >
              {versions.map((itemVersion) => (
                <option key={itemVersion} value={itemVersion}>
                  {itemVersion}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field__label">MMR 티어</span>
            <select
              value={selectedMmr}
              onChange={(event) => setSelectedMmr(event.target.value)}
              disabled={loadingStatistics || !mmrOptions.length}
            >
              {mmrOptions.map((mmr) => (
                <option key={mmr} value={mmr}>
                  {formatMmrLabel(mmr)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {errorMessage ? (
        <section className="notice-panel notice-panel--error">
          <strong>통계 요청에 실패했습니다.</strong>
          <p>{errorMessage}</p>
        </section>
      ) : null}

      {(loadingVersions || loadingStatistics) && !sortedRows.length ? (
        <section className="notice-panel">
          <strong>통계를 불러오는 중입니다.</strong>
          <p>버전과 티어별 데이터를 가져오고 있습니다.</p>
        </section>
      ) : null}

      <section className="table-panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="data-table__rank">#</th>
                {columns.map((column) => (
                  <th key={column.key}>
                    <button
                      type="button"
                      className={`table-sort${
                        sortKey === column.key ? " table-sort--active" : ""
                      }`}
                      onClick={() => onSort(column.key)}
                    >
                      {column.label}
                      <span className="table-sort__arrows" aria-hidden="true">
                        <span
                          className={`table-sort__arrow${
                            sortKey === column.key && sortDirection === "asc"
                              ? " table-sort__arrow--active"
                              : ""
                          }`}
                        >
                          ▲
                        </span>
                        <span
                          className={`table-sort__arrow${
                            sortKey === column.key && sortDirection === "desc"
                              ? " table-sort__arrow--active"
                              : ""
                          }`}
                        >
                          ▼
                        </span>
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length ? (
                sortedRows.map((row, index) => (
                  <tr key={`${row.characterName_inkorean || "character"}-${index}`}>
                    <td>{index + 1}</td>
                    {columns.map((column) => (
                      <td key={column.key}>
                        {column.type === "string"
                          ? row?.[column.key] || "-"
                          : formatValue(row?.[column.key], column.type)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length + 1} className="data-table__empty">
                    현재 선택한 조건의 통계가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
