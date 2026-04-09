import { useEffect, useState } from "react";

import { getPatchnoteDetail, getPatchnotes } from "../../services/apiClient";

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

function FieldChanges({ fields }) {
  if (!Array.isArray(fields) || !fields.length) return null;
  return (
    <table className="patchnote-fields">
      <thead>
        <tr>
          <th>항목</th>
          <th>이전</th>
          <th>이후</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((field, idx) => (
          <tr key={`${field.fieldKey ?? idx}`}>
            <td>{field.fieldLabel || field.fieldKey || "-"}</td>
            <td className="patchnote-fields__before">{field.before ?? "-"}</td>
            <td className="patchnote-fields__after">{field.after ?? "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EntryRow({ entry, changeType }) {
  return (
    <div className="patchnote-entry">
      <div className="patchnote-entry__head">
        <ChangeTypeBadge type={changeType} />
        <span className="patchnote-entry__name">
          {entry.displayName || entry.pk || "-"}
        </span>
        {entry.mergedKeys && entry.mergedKeys.length > 0 ? (
          <span className="patchnote-entry__meta">
            ({entry.mergedKeys.join(", ")})
          </span>
        ) : null}
      </div>
      <FieldChanges fields={entry.fields} />
    </div>
  );
}

function GroupBlock({ group }) {
  const label = group.keyLabel || group.key || "-";
  const added = Array.isArray(group.added) ? group.added : [];
  const removed = Array.isArray(group.removed) ? group.removed : [];
  const modified = Array.isArray(group.modified) ? group.modified : [];
  const total = added.length + removed.length + modified.length;

  return (
    <div className="patchnote-group">
      <div className="patchnote-group__head">
        <strong className="patchnote-group__label">{label}</strong>
        {group.key && group.key !== label ? (
          <span className="patchnote-group__key">{group.key}</span>
        ) : null}
        <span className="patchnote-group__count">{total}건</span>
      </div>
      <div className="patchnote-group__entries">
        {added.map((entry, idx) => (
          <EntryRow key={`added-${idx}`} entry={entry} changeType="added" />
        ))}
        {removed.map((entry, idx) => (
          <EntryRow key={`removed-${idx}`} entry={entry} changeType="removed" />
        ))}
        {modified.map((entry, idx) => (
          <EntryRow key={`modified-${idx}`} entry={entry} changeType="modified" />
        ))}
      </div>
    </div>
  );
}

function PatchnoteDetail({ patchId }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (!patchId) return;
    let cancelled = false;

    async function loadDetail() {
      setLoading(true);
      setError("");
      setDetail(null);
      setActiveTab(0);

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

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [patchId]);

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
  const groups = Array.isArray(currentTab?.groups) ? currentTab.groups : [];

  return (
    <div className="patchnote-detail">
      <div className="patchnote-detail__header">
        <h2 className="patchnote-detail__title">{detail.patchId}</h2>
        <div className="patchnote-detail__meta">
          <span className="patchnote-detail__date">
            {formatDetectedAt(detail.detectedAt)}
          </span>
          {Array.isArray(detail.errorKeys) && detail.errorKeys.length > 0 ? (
            <span className="status-chip status-chip--error">
              파싱 오류: {detail.errorKeys.join(", ")}
            </span>
          ) : null}
        </div>
      </div>

      {tabs.length > 0 ? (
        <>
          <div className="tab-bar patchnote-detail__tabs">
            {tabs.map((tab, idx) => (
              <button
                key={tab.tab ?? idx}
                type="button"
                className={`tab-button${activeTab === idx ? " tab-button--active" : ""}`}
                onClick={() => setActiveTab(idx)}
              >
                {tab.tab}
              </button>
            ))}
          </div>

          <div className="patchnote-detail__body">
            {groups.length > 0 ? (
              groups.map((group, idx) => (
                <GroupBlock key={group.key ?? idx} group={group} />
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
              const hasError =
                Array.isArray(item.errorKeys) && item.errorKeys.length > 0;
              return (
                <button
                  key={item.patchId}
                  type="button"
                  className={`patchnote-list__item${isActive ? " patchnote-list__item--active" : ""}`}
                  onClick={() => setSelectedPatchId(item.patchId)}
                >
                  <span className="patchnote-list__patch-id">{item.patchId}</span>
                  <span className="patchnote-list__date">
                    {formatDetectedAt(item.detectedAt)}
                  </span>
                  {Array.isArray(item.changedKeys) && item.changedKeys.length > 0 ? (
                    <span className="patchnote-list__keys">
                      {item.changedKeys.join(" · ")}
                    </span>
                  ) : null}
                  {hasError ? (
                    <span className="patchnote-list__error-flag">파싱 오류 있음</span>
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
