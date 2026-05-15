"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { fetchSelectionEvents } from "@/app/lib/selections";
import type { SelectionEvent } from "@/app/types/selection";

import {
  buildCalendarCells,
  addMonths,
  startOfMonth,
  toMonthKey,
} from "@/app/match/utils/date";

import {
  MatchCalendarBase,
  type CalendarItem,
} from "@/app/match/components/MatchCalendarBase";

type ViewMode = "none" | "list" | "calendar";

function formatDate(date?: string | null) {
  if (!date) return "未定";

  return new Date(date).toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
  });
}

function statusColor(status?: string) {
  switch (status) {
    case "募集中":
      return {
        bg: "#ecfdf3",
        text: "#166534",
        border: "#bbf7d0",
      };

    case "申込終了":
    case "開催終了":
      return {
        bg: "#f3f4f6",
        text: "#374151",
        border: "#d1d5db",
      };

    default:
      return {
        bg: "#eff6ff",
        text: "#1d4ed8",
        border: "#bfdbfe",
      };
  }
}

function orgLabel(type?: string | null) {
  switch (type) {
    case "j_club":
      return "J下部";

    case "strong_team":
      return "強豪";

    case "school":
      return "スクール";

    case "club_team":
      return "クラブ";

    default:
      return "その他";
  }
}

export function SelectionSection() {
  const [viewMode, setViewMode] = useState<ViewMode>("none");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SelectionEvent[]>([]);

  const [calendarMonth, setCalendarMonth] = useState(() =>
    startOfMonth(new Date())
  );
  const [selectedDate, setSelectedDate] = useState("");

  const sectionRef = useRef<HTMLDivElement | null>(null);

  const isOpen = viewMode !== "none";

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);

    const rows = await fetchSelectionEvents();

    setItems(rows);

    setLoading(false);
  }

  function openMode(nextMode: ViewMode) {
    setViewMode((current) => {
      if (current === nextMode) return "none";
      return nextMode;
    });

    if (nextMode !== "none") {
      setTimeout(() => {
        sectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
    }
  }

  const featuredItems = useMemo(() => {
    return items.filter((v) => v.is_featured);
  }, [items]);

  const normalItems = useMemo(() => {
    return items.filter((v) => !v.is_featured);
  }, [items]);

  const calendarCells = useMemo(() => {
    return buildCalendarCells(calendarMonth);
  }, [calendarMonth]);

  const calendarMonthKey = useMemo(() => {
    return toMonthKey(calendarMonth);
  }, [calendarMonth]);

  const selectionItemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    const countMap = new Map<string, number>();

    for (const item of items) {
      if (!item.event_date) continue;
      countMap.set(item.event_date, (countMap.get(item.event_date) ?? 0) + 1);
    }

    for (const [ymd, count] of countMap.entries()) {
      map.set(ymd, [
        {
          label: "選",
          count,
          tone: "open",
        },
      ]);
    }

    return map;
  }, [items]);

  const selectedDateItems = useMemo(() => {
    if (!selectedDate) return [];

    return items.filter((item) => item.event_date === selectedDate);
  }, [items, selectedDate]);

  return (
    <section ref={sectionRef}>
      <Link href="/selection" style={sectionLink}>
        <section style={summaryBoxClickable} className="ui-card">
          <div style={summaryCardTop}>
            <div style={summaryDateText} className="ui-title">
              セレクション情報
            </div>

            <span style={sectionCtaSmall}>セレ一覧</span>
          </div>

          <div style={summaryInnerCompactBox} className="ui-card-soft">
            <div>
              <div style={summaryCountLineCompact} className="ui-title">
                掲載件数：{items.length}件
              </div>

              <div style={summarySubTight} className="ui-meta">
                J下部組織・強豪チーム・スクール等
              </div>
            </div>
          </div>
        </section>
      </Link>

      {viewMode === "calendar" ? (
        <section style={calendarCard} className="ui-card">
          <div style={calendarTitle}>セレクション開催日</div>

          <div style={calendarHint} className="ui-meta">
            日付を押すと、その日のセレクションを表示します。
          </div>

          {loading ? (
            <div style={emptyBox} className="ui-meta">
              読み込み中…
            </div>
          ) : (
            <>
              <MatchCalendarBase
                monthKey={calendarMonthKey}
                cells={calendarCells}
                selectedYmd={selectedDate}
                itemsByDate={selectionItemsByDate}
                onSelectDate={(ymd) => {
                  setSelectedDate((current) => (current === ymd ? "" : ymd));
                }}
                onPrevMonth={() =>
                  setCalendarMonth((prev) => addMonths(prev, -1))
                }
                onNextMonth={() =>
                  setCalendarMonth((prev) => addMonths(prev, 1))
                }
              />

              {selectedDate ? (
                <div style={selectedDateList}>
                  <div style={selectedDateTitle}>
                    {formatDate(selectedDate)} のセレクション
                  </div>

                  {selectedDateItems.length === 0 ? (
                    <div style={emptyMini} className="ui-meta">
                      この日のセレクション情報はありません。
                    </div>
                  ) : (
                    <div style={miniList}>
                      {selectedDateItems.map((item) => (
                        <SelectionMiniCard key={item.id} item={item} />
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {viewMode === "list" ? (
        <section style={listWrap}>
          {loading ? (
            <div style={emptyBox} className="ui-card">
              読み込み中…
            </div>
          ) : items.length === 0 ? (
            <div style={emptyBox} className="ui-card">
              セレクション情報はまだありません
            </div>
          ) : (
            <>
              {featuredItems.length > 0 ? (
                <div style={featuredTitle}>注目セレクション</div>
              ) : null}

              {featuredItems.map((item) => (
                <SelectionCard key={item.id} item={item} featured />
              ))}

              {normalItems.length > 0 ? (
                <div style={featuredTitle}>すべての情報</div>
              ) : null}

              {normalItems.map((item) => (
                <SelectionCard key={item.id} item={item} />
              ))}
            </>
          )}
        </section>
      ) : null}
    </section>
  );
}

function SelectionCard(props: {
  item: SelectionEvent;
  featured?: boolean;
}) {
  const { item, featured } = props;
  const color = statusColor(item.display_status);

  return (
    <Link key={item.id} href={`/selection/${item.id}`} style={linkStyle}>
      <article style={featured ? featuredCard : card} className="ui-card">
        <div style={topRow}>
          <div style={orgBadge}>{orgLabel(item.organization_type)}</div>

          <div
            style={{
              ...statusBadge,
              background: color.bg,
              color: color.text,
              borderColor: color.border,
            }}
          >
            {item.display_status}
          </div>
        </div>

        <div style={titleText}>{item.title}</div>

        <div style={orgText}>{item.organization_name}</div>

        <div style={infoRow}>
          <span>📅 {formatDate(item.event_date)}</span>
          <span>📍 {item.prefecture || "未定"}</span>
        </div>

        {item.target_categories?.length > 0 ? (
          <div style={tagWrap}>
            {item.target_categories.map((cat) => (
              <span key={cat} style={tag}>
                {cat}
              </span>
            ))}
          </div>
        ) : null}
      </article>
    </Link>
  );
}

function SelectionMiniCard(props: {
  item: SelectionEvent;
}) {
  const { item } = props;
  const color = statusColor(item.display_status);

  return (
    <Link href={`/selection/${item.id}`} style={linkStyle}>
      <article style={miniCard}>
        <div style={topRow}>
          <div style={orgBadge}>{orgLabel(item.organization_type)}</div>

          <div
            style={{
              ...statusBadge,
              background: color.bg,
              color: color.text,
              borderColor: color.border,
            }}
          >
            {item.display_status}
          </div>
        </div>

        <div style={miniTitle}>{item.title}</div>

        <div style={miniMeta}>
          {item.organization_name || "団体名未設定"} /{" "}
          {item.prefecture || "地域未定"}
        </div>
      </article>
    </Link>
  );
}

const summaryBox: React.CSSProperties = {
  marginTop: 2,
  padding: "12px 14px",
};

const summaryCardTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const summaryDateText: React.CSSProperties = {
  fontSize: 20,
  lineHeight: 1.25,
};

const summaryInnerCompactBox: React.CSSProperties = {
  marginTop: 8,
  padding: 12,
  display: "grid",
  gap: 10,
};

const summaryCountLineCompact: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.5,
};

const summarySubTight: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.55,
};

const summaryActionRowCompact: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const calendarCard: React.CSSProperties = {
  marginTop: 10,
  padding: "12px 14px",
};

const calendarTitle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.25,
};

const calendarHint: React.CSSProperties = {
  marginTop: 4,
  marginBottom: 10,
  fontSize: 13,
};

const selectedDateList: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gap: 8,
};

const selectedDateTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#16391f",
};

const miniList: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const miniCard: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: "1px solid #e5ece7",
  background: "#fff",
};

const miniTitle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 15,
  fontWeight: 900,
  lineHeight: 1.45,
};

const miniMeta: React.CSSProperties = {
  marginTop: 4,
  color: "#4b5563",
  fontSize: 12,
  lineHeight: 1.5,
};

const emptyMini: React.CSSProperties = {
  padding: 12,
  textAlign: "center",
};

const listWrap: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gap: 10,
};

const linkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "inherit",
};

const featuredTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#166534",
  marginTop: 2,
  marginBottom: -2,
};

const card: React.CSSProperties = {
  padding: 14,
};

const featuredCard: React.CSSProperties = {
  padding: 14,
  border: "2px solid #bbf7d0",
  background: "linear-gradient(to bottom, #ffffff, #f0fdf4)",
};

const topRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const orgBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "0 10px",
  borderRadius: 999,
  background: "#eef6f0",
  color: "#14532d",
  border: "1px solid #dce9df",
  fontSize: 12,
  fontWeight: 900,
};

const statusBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "0 10px",
  borderRadius: 999,
  border: "1px solid",
  fontSize: 12,
  fontWeight: 900,
};

const titleText: React.CSSProperties = {
  marginTop: 10,
  fontSize: 17,
  fontWeight: 900,
  lineHeight: 1.45,
};

const orgText: React.CSSProperties = {
  marginTop: 6,
  color: "#4b5563",
  fontSize: 13,
};

const infoRow: React.CSSProperties = {
  marginTop: 10,
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  color: "#374151",
  fontSize: 13,
  fontWeight: 700,
};

const tagWrap: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const tag: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "0 10px",
  borderRadius: 999,
  background: "#f3f4f6",
  color: "#374151",
  fontSize: 12,
  fontWeight: 700,
};

const emptyBox: React.CSSProperties = {
  padding: 20,
  textAlign: "center",
};

const sectionLink: React.CSSProperties = {
  display: "block",
  color: "inherit",
  textDecoration: "none",
};

const summaryBoxClickable: React.CSSProperties = {
  ...summaryBox,
  cursor: "pointer",
};

const sectionCta: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 40,
  padding: "0 16px",
  borderRadius: 999,
  background: "#0f7a35",
  color: "#fff",
  fontSize: 14,
  fontWeight: 900,
};

const sectionCtaSmall: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 36,
  padding: "0 14px",
  borderRadius: 999,
  background: "#0f7a35",
  color: "#fff",
  fontSize: 13,
  fontWeight: 900,
  whiteSpace: "nowrap",
};