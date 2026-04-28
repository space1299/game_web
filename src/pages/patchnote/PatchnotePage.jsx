import { useEffect, useState } from "react";

import {
  getPatchnoteDetail,
  getPatchnoteSummary,
  getPatchnotes,
} from "../../services/apiClient";
import {
  PatchnoteSummarySection,
  toAnchorId,
} from "./PatchnoteSummarySection";

function formatDetectedAt(iso) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatPatchnoteTitleDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getPatchnoteListTitle(item) {
  if (item.titleKo) return item.titleKo;
  const titleDate = formatPatchnoteTitleDate(item.detectedAt);
  if (titleDate) return `${titleDate} 패치노트`;
  return "패치노트";
}

function ChangeTypeBadge({ type }) {
  const map = {
    added: { label: "추가", cls: "patchnote-badge--added" },
    removed: { label: "삭제", cls: "patchnote-badge--removed" },
    modified: { label: "변경", cls: "patchnote-badge--modified" },
  };
  const resolved = map[type] ?? { label: type, cls: "" };
  return (
    <span className={`patchnote-badge ${resolved.cls}`}>{resolved.label}</span>
  );
}

function ChangeRow({ change }) {
  return (
    <div className="patchnote-entry">
      <div className="patchnote-entry__head">
        <ChangeTypeBadge type={change.changeType} />
        <span className="patchnote-entry__name">
          {change.fieldLabel || change.fieldKey || "-"}
        </span>
      </div>
      <table className="patchnote-fields">
        <thead>
          <tr>
            <th>이전</th>
            <th>이후</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="patchnote-fields__before">
              {change.displayBefore ?? "-"}
            </td>
            <td className="patchnote-fields__after">
              {change.displayAfter ?? "-"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SectionBlock({ section }) {
  const label = section.entityLabel || section.entityKey || "-";
  const changes = Array.isArray(section.changes) ? section.changes : [];

  return (
    <div id={toAnchorId(section.entityKey)} className="patchnote-group">
      <div className="patchnote-group__head">
        <strong className="patchnote-group__label">{label}</strong>
        <span className="patchnote-group__count">{changes.length}건</span>
      </div>
      <div className="patchnote-group__entries">
        {changes.map((change, idx) => (
          <ChangeRow
            key={`${change.sourceKey ?? "change"}-${change.fieldKey ?? idx}`}
            change={change}
          />
        ))}
      </div>
    </div>
  );
}

function PatchnoteDetail({ patchId }) {
  const [detail, setDetail] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [pendingScrollKey, setPendingScrollKey] = useState(null);

  useEffect(() => {
    if (!patchId) return;
    let cancelled = false;

    async function loadDetail() {
      setLoading(true);
      setSummaryLoading(true);
      setError("");
      setDetail(null);
      setSummary(null);
      setActiveTab(0);
      setPendingScrollKey(null);

      try {
        const data = await getPatchnoteDetail(patchId);
        if (cancelled) return;
        setDetail(data);
      } catch (err) {
        if (cancelled) return;
        setError(err.detail || err.message || "패치노트 상세 정보를 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadSummary() {
      try {
        const data = await getPatchnoteSummary(patchId);
        if (cancelled) return;
        setSummary(data);
      } catch (_) {
        if (cancelled) return;
        setSummary(null);
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    }

    loadDetail();
    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [patchId]);

  useEffect(() => {
    if (!pendingScrollKey) return undefined;

    const frame = requestAnimationFrame(() => {
      const section = document.getElementById(toAnchorId(pendingScrollKey));
      if (!section) return;
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingScrollKey(null);
    });

    return () => cancelAnimationFrame(frame);
  }, [activeTab, detail, pendingScrollKey]);

  if (!patchId) {
    return (
      <div className="patchnote-detail patchnote-detail--empty">
        <p className="empty-copy">왼쪽 목록에서 패치노트를 선택하세요.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="patchnote-detail">
        <div className="notice-panel">
          <strong>상세 정보를 불러오는 중입니다.</strong>
          <p>{patchId}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="patchnote-detail">
        <div className="notice-panel notice-panel--error">
          <strong>상세 정보 요청에 실패했습니다.</strong>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const tabs = Array.isArray(detail.tabs) ? detail.tabs : [];
  const currentTab = tabs[activeTab];
  const sections = Array.isArray(currentTab?.sections) ? currentTab.sections : [];
  const parseStatus = detail.parseStatus || "ok";
  const hasErrorKeys =
    Array.isArray(detail.errorKeys) && detail.errorKeys.length > 0;

  function handleSummaryEntitySelect(entityKey) {
    if (!entityKey) return;

    const targetTabIndex = tabs.findIndex((tab) =>
      Array.isArray(tab.sections)
        ? tab.sections.some((section) => section.entityKey === entityKey)
        : false,
    );

    if (targetTabIndex >= 0 && targetTabIndex !== activeTab) {
      setActiveTab(targetTabIndex);
    }
    setPendingScrollKey(entityKey);
  }

  return (
    <div className="patchnote-detail">
      <div className="patchnote-detail__header">
        <h2 className="patchnote-detail__title">
          {detail.titleKo || detail.patchId}
        </h2>
        <div className="patchnote-detail__meta">
          {detail.titleKo && detail.patchId ? (
            <span className="patchnote-detail__patch-id">{detail.patchId}</span>
          ) : null}
          <span className="patchnote-detail__date">
            {formatDetectedAt(detail.detectedAt)}
          </span>
          {parseStatus === "error" ? (
            <span className="status-chip status-chip--error">
              파싱 오류{hasErrorKeys ? `: ${detail.errorKeys.join(", ")}` : ""}
            </span>
          ) : null}
          {parseStatus === "partial" ? (
            <span className="status-chip status-chip--warning">
              부분 파싱{hasErrorKeys ? `: ${detail.errorKeys.join(", ")}` : ""}
            </span>
          ) : null}
        </div>
      </div>

      <PatchnoteSummarySection
        loading={summaryLoading}
        onEntitySelect={handleSummaryEntitySelect}
        summary={summary}
      />

      {tabs.length > 0 ? (
        <>
          <div className="tab-bar patchnote-detail__tabs">
            {tabs.map((tab, idx) => (
              <button
                key={tab.tabKey ?? idx}
                type="button"
                className={`tab-button${activeTab === idx ? " tab-button--active" : ""}`}
                onClick={() => setActiveTab(idx)}
              >
                {tab.tabLabel || tab.tabKey || "-"}
              </button>
            ))}
          </div>

          <div className="patchnote-detail__body">
            {sections.length > 0 ? (
              sections.map((section, idx) => (
                <SectionBlock
                  key={section.entityKey ?? idx}
                  section={section}
                />
              ))
            ) : (
              <p className="empty-copy">이 탭에는 변경 내용이 없습니다.</p>
            )}
          </div>
        </>
      ) : (
        <p className="empty-copy">탭 데이터가 없습니다.</p>
      )}
    </div>
  );
}

export function PatchnotePage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPatchId, setSelectedPatchId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadList() {
      setLoading(true);
      setError("");

      try {
        const data = await getPatchnotes();
        if (cancelled) return;
        const items = Array.isArray(data) ? data : [];
        setList(items);
        if (items.length > 0) setSelectedPatchId(items[0].patchId);
      } catch (err) {
        if (cancelled) return;
        setError(err.detail || err.message || "패치노트 목록을 불러오지 못했습니다.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadList();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page-stack">
      {error ? (
        <section className="notice-panel notice-panel--error">
          <strong>패치노트 목록 요청에 실패했습니다.</strong>
          <p>{error}</p>
        </section>
      ) : null}

      {loading && !list.length ? (
        <section className="notice-panel">
          <strong>패치노트 목록을 불러오는 중입니다.</strong>
        </section>
      ) : null}

      {!loading || list.length > 0 ? (
        <div className="patchnote-layout">
          <nav className="patchnote-list panel">
            {list.length === 0 && !loading ? (
              <p className="empty-copy patchnote-list__empty">
                패치노트 데이터가 없습니다.
              </p>
            ) : null}
            {list.map((item) => {
              const isActive = item.patchId === selectedPatchId;
              const labels = Array.isArray(item.changedLabelsKo)
                ? item.changedLabelsKo
                : item.changedKeys;
              const hasLabels = Array.isArray(labels) && labels.length > 0;
              const parseStatus = item.parseStatus || "ok";
              return (
                <button
                  key={item.patchId}
                  type="button"
                  className={`patchnote-list__item${isActive ? " patchnote-list__item--active" : ""}`}
                  onClick={() => setSelectedPatchId(item.patchId)}
                >
                  <span className="patchnote-list__title">
                    {getPatchnoteListTitle(item)}
                  </span>
                  <span className="patchnote-list__date">
                    {formatDetectedAt(item.detectedAt)}
                  </span>
                  {hasLabels ? (
                    <span className="patchnote-list__keys">
                      {labels.join(" · ")}
                    </span>
                  ) : null}
                  {parseStatus !== "ok" ? (
                    <span className="patchnote-list__error-flag">
                      {parseStatus === "partial" ? "부분 파싱" : "파싱 오류 있음"}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <PatchnoteDetail patchId={selectedPatchId} />
        </div>
      ) : null}
    </div>
  );
}
