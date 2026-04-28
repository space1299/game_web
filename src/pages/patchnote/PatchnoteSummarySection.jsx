const SUMMARY_CATEGORIES = [
  { key: "character", label: "캐릭터" },
  { key: "cobalt", label: "코발트" },
  { key: "item", label: "아이템" },
];

const SUMMARY_VERDICTS = [
  { key: "buff", label: "상향", className: "patchnote-summary__group--buff" },
  { key: "nerf", label: "하향", className: "patchnote-summary__group--nerf" },
  { key: "adjust", label: "조정", className: "patchnote-summary__group--adjust" },
  { key: "new", label: "신규", className: "patchnote-summary__group--new" },
  { key: "removed", label: "제거", className: "patchnote-summary__group--removed" },
];

export function toAnchorId(entityKey) {
  return `section-${String(entityKey || "unknown").replace(/[^a-zA-Z0-9가-힣-]/g, "_")}`;
}

function getEntityLabel(item) {
  return item?.entityLabel || item?.entityKey || "-";
}

function sortByEntityLabel(items) {
  return [...items].sort((a, b) =>
    getEntityLabel(a).localeCompare(getEntityLabel(b), "ko"),
  );
}

function getVisibleCategories(summary) {
  return SUMMARY_CATEGORIES.map((category) => {
    const categorySummary = summary?.[category.key];
    const groups = SUMMARY_VERDICTS.map((verdict) => ({
      ...verdict,
      items: Array.isArray(categorySummary?.[verdict.key])
        ? sortByEntityLabel(categorySummary[verdict.key])
        : [],
    })).filter((group) => group.items.length > 0);

    return { ...category, groups };
  }).filter((category) => category.groups.length > 0);
}

export function PatchnoteSummarySection({ loading, onEntitySelect, summary }) {
  if (loading) {
    return (
      <section className="patchnote-summary" aria-label="패치 요약">
        <div className="patchnote-summary__loading">
          <span />
          <span />
          <span />
        </div>
      </section>
    );
  }

  const visibleCategories = getVisibleCategories(summary);

  if (!visibleCategories.length) return null;

  return (
    <section className="patchnote-summary" aria-label="패치 요약">
      {visibleCategories.map((category) => (
        <article key={category.key} className="patchnote-summary__category">
          <h3 className="patchnote-summary__category-title">{category.label}</h3>
          <div className="patchnote-summary__rows">
            {category.groups.map((group) => (
              <div
                key={`${category.key}-${group.key}`}
                className={`patchnote-summary__group ${group.className}`}
              >
                <span className="patchnote-summary__label">{group.label}</span>
                <div className="patchnote-summary__items">
                  {group.items.map((item, idx) => (
                    <button
                      key={`${item.entityKey ?? group.key}-${idx}`}
                      type="button"
                      className="patchnote-summary__item"
                      onClick={() => onEntitySelect?.(item.entityKey)}
                    >
                      {getEntityLabel(item)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}
