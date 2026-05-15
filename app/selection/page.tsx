// /app/selection/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

import { CATEGORY_OPTIONS, categoryLabel } from "@/app/lib/categories";

type OrgFilter =
  | "all"
  | "j_club"
  | "strong_team"
  | "school"
  | "club_team"
  | "other";

type StatusFilter =
  | "all"
  | "募集中"
  | "申込終了"
  | "開催終了"
  | "日程未定";

const SOURCE_PREFECTURE_MAP: Record<string, string> = {
  鹿島アントラーズ: "茨城県",
  水戸ホーリーホック: "茨城県",
  浦和レッズ: "埼玉県",
  RB大宮アルディージャ: "埼玉県",
  ジェフユナイテッド市原・千葉: "千葉県",
  柏レイソル: "千葉県",
  FC東京: "東京都",
  東京ヴェルディ: "東京都",
  FC町田ゼルビア: "東京都",
  川崎フロンターレ: "神奈川県",
  横浜F・マリノス: "神奈川県",
  横浜FC: "神奈川県",
  湘南ベルマーレ: "神奈川県",
  栃木SC: "栃木県",
  ザスパ群馬: "群馬県",
  ヴァンフォーレ甲府: "山梨県",
};

function formatDate(date?: string | null) {
  if (!date) return "未定";
  return new Date(date).toLocaleDateString("ja-JP");
}

function inferredPrefecture(item: SelectionEvent) {
  if (item.prefecture) return item.prefecture;

  const name = item.organization_name || "";

  const matched = Object.keys(SOURCE_PREFECTURE_MAP).find((key) =>
    name.includes(key)
  );

  return matched ? SOURCE_PREFECTURE_MAP[matched] : null;
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

function statusStyle(status?: string): React.CSSProperties {
  if (status === "募集中") {
    return {
      background: "#ecfdf3",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (status === "申込終了" || status === "開催終了") {
    return {
      background: "#f3f4f6",
      color: "#374151",
      border: "1px solid #d1d5db",
    };
  }

  return {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
  };
}

function sortNewestFirst(rows: SelectionEvent[]) {
  return [...rows].sort((a, b) => {
    const aa = new Date(a.fetched_at || a.created_at || 0).getTime();
    const bb = new Date(b.fetched_at || b.created_at || 0).getTime();
    return bb - aa;
  });
}

export default function SelectionListPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SelectionEvent[]>([]);

  const [keyword, setKeyword] = useState("");
  const [prefecture, setPrefecture] = useState("all");
  const [city, setCity] = useState("all");
  const [orgType, setOrgType] = useState<OrgFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [category, setCategory] = useState("all");

  const [showCalendar, setShowCalendar] = useState(true);
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      const rows = await fetchSelectionEvents();
      if (!active) return;

      setItems(sortNewestFirst(rows));
      setLoading(false);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const calendarCells = useMemo(() => buildCalendarCells(monthDate), [monthDate]);
  const monthKey = useMemo(() => toMonthKey(monthDate), [monthDate]);

  const prefectures = useMemo(() => {
    return Array.from(
      new Set(items.map((v) => inferredPrefecture(v)).filter(Boolean).map(String))
    ).sort((a, b) => a.localeCompare(b, "ja"));
  }, [items]);

  const cities = useMemo(() => {
    return Array.from(
      new Set(
        items
          .filter((v) => {
            const itemPrefecture = inferredPrefecture(v);
            return prefecture === "all" || itemPrefecture === prefecture;
          })
          .map((v) => v.city)
          .filter(Boolean)
          .map(String)
      )
    ).sort((a, b) => a.localeCompare(b, "ja"));
  }, [items, prefecture]);

  const filteredItems = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    const rows = items.filter((item) => {
      const itemPrefecture = inferredPrefecture(item);

      if (selectedDate && item.event_date !== selectedDate) return false;
      if (prefecture !== "all" && itemPrefecture !== prefecture) return false;
      if (city !== "all" && item.city !== city) return false;
      if (orgType !== "all" && item.organization_type !== orgType) return false;
      if (status !== "all" && item.display_status !== status) return false;

      if (category !== "all" && !item.target_categories?.includes(category)) {
        return false;
      }

      if (q) {
        const hay = [
          item.title,
          item.organization_name,
          item.organization_type,
          itemPrefecture,
          item.city,
          item.area,
          item.venue_name,
          item.venue_address,
          ...(item.target_categories ?? []),
        ]
          .join(" ")
          .toLowerCase();

        if (!hay.includes(q)) return false;
      }

      return true;
    });

    return sortNewestFirst(rows);
  }, [items, keyword, prefecture, city, orgType, status, category, selectedDate]);

  const selectionItemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    const countMap = new Map<string, number>();

    for (const item of items) {
      if (!item.event_date) continue;
      countMap.set(item.event_date, (countMap.get(item.event_date) ?? 0) + 1);
    }

    for (const [ymd, count] of countMap.entries()) {
      map.set(ymd, [{ label: "選", count, tone: "open" }]);
    }

    return map;
  }, [items]);

  const selectedDateText = useMemo(() => {
    if (!selectedDate) return "すべての日程";
    return `${formatDate(selectedDate)} 開催分`;
  }, [selectedDate]);

  const clearFilters = () => {
    setKeyword("");
    setPrefecture("all");
    setCity("all");
    setOrgType("all");
    setStatus("all");
    setCategory("all");
    setSelectedDate("");
  };

  return (
    <main style={wrap}>
      <div style={topBar}>
        <Link href="/" className="sh-btn">
          ← ホーム
        </Link>

        <div style={pageTitle}>セレクション情報</div>
      </div>

      <section className="ui-card" style={searchBox}>
        <div style={searchHeader}>
          <div className="ui-title" style={searchTitle}>
            条件検索
          </div>

          <button
            type="button"
            className="sh-btn"
            onClick={() => setShowCalendar((v) => !v)}
          >
            {showCalendar ? "カレンダーを閉じる" : "カレンダー表示"}
          </button>
        </div>

        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="チーム名・地域・カテゴリなど"
          style={input}
        />

        <div style={filterGrid}>
          <select
            value={prefecture}
            onChange={(e) => {
              setPrefecture(e.target.value);
              setCity("all");
            }}
            style={select}
          >
            <option value="all">都道府県すべて</option>
            {prefectures.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={select}
          >
            <option value="all">市区町村すべて</option>

            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={orgType}
            onChange={(e) => setOrgType(e.target.value as OrgFilter)}
            style={select}
          >
            <option value="all">種別すべて</option>
            <option value="j_club">J下部</option>
            <option value="strong_team">強豪</option>
            <option value="school">スクール</option>
            <option value="club_team">クラブ</option>
            <option value="other">その他</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            style={select}
          >
            <option value="all">状態すべて</option>
            <option value="募集中">募集中</option>
            <option value="申込終了">申込終了</option>
            <option value="開催終了">開催終了</option>
            <option value="日程未定">日程未定</option>
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={select}
          >
            <option value="all">対象カテゴリすべて</option>

            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div style={filterFooter}>
          <div className="ui-meta">
            {selectedDateText} / 表示件数：{filteredItems.length}件
          </div>

          <button type="button" className="sh-btn" onClick={clearFilters}>
            条件クリア
          </button>
        </div>
      </section>

      {showCalendar ? (
        <section className="ui-card" style={calendarBox}>
          <div style={calendarTitle}>開催日カレンダー</div>

          <div style={calendarHint} className="ui-meta">
            日付を押すと、その日に開催されるセレクションだけを表示します。
          </div>

          <MatchCalendarBase
            monthKey={monthKey}
            cells={calendarCells}
            selectedYmd={selectedDate}
            itemsByDate={selectionItemsByDate}
            onSelectDate={(ymd) => {
              setSelectedDate((current) => (current === ymd ? "" : ymd));
            }}
            onPrevMonth={() => setMonthDate((prev) => addMonths(prev, -1))}
            onNextMonth={() => setMonthDate((prev) => addMonths(prev, 1))}
          />
        </section>
      ) : null}

      {loading ? (
        <div className="ui-card" style={emptyBox}>
          読み込み中…
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="ui-card" style={emptyBox}>
          条件に合うセレクション情報がありません
        </div>
      ) : (
        <section style={listWrap}>
          {filteredItems.map((item) => {
            const itemPrefecture = inferredPrefecture(item);

            return (
              <Link
                key={item.id}
                href={`/selection/${item.id}`}
                style={linkStyle}
              >
                <article className="ui-card" style={card}>
                  <div style={cardTop}>
                    <span style={orgBadge}>
                      {orgLabel(item.organization_type)}
                    </span>

                    <span
                      style={{
                        ...statusBadge,
                        ...statusStyle(item.display_status),
                      }}
                    >
                      {item.display_status}
                    </span>
                  </div>

                  <h2 style={cardTitle}>{item.title}</h2>

                  <div className="ui-meta" style={orgName}>
                    {item.organization_name || "団体名未設定"}
                  </div>

                  {item.target_categories?.length > 0 ? (
                    <div style={tagWrap}>
                      {item.target_categories.map((cat) => (
                        <span key={categoryLabel(cat) || cat} style={tag}>
                          {categoryLabel(cat) || cat}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div style={infoGrid}>
                    <div>
                      <div style={label}>開催日</div>
                      <div style={value}>{formatDate(item.event_date)}</div>
                    </div>

                    <div>
                      <div style={label}>地域</div>
                      <div style={value}>
                        {[itemPrefecture, item.city].filter(Boolean).join(" ") ||
                          "未定"}
                      </div>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}

const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 900,
  margin: "0 auto",
  display: "grid",
  gap: 12,
};

const topBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const pageTitle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#16391f",
};

const searchBox: React.CSSProperties = {
  padding: 14,
};

const searchHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 10,
};

const searchTitle: React.CSSProperties = {
  fontSize: 18,
};

const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  fontSize: 16,
  outline: "none",
  background: "#fff",
};

const filterGrid: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 8,
};

const select: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 10px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#fff",
  fontSize: 14,
};

const filterFooter: React.CSSProperties = {
  marginTop: 10,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const calendarBox: React.CSSProperties = {
  padding: 14,
};

const calendarTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
};

const calendarHint: React.CSSProperties = {
  marginTop: 4,
  marginBottom: 10,
};

const listWrap: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const linkStyle: React.CSSProperties = {
  textDecoration: "none",
  color: "inherit",
};

const card: React.CSSProperties = {
  padding: 14,
};

const cardTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "center",
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
  fontSize: 12,
  fontWeight: 900,
};

const cardTitle: React.CSSProperties = {
  margin: "10px 0 0",
  fontSize: 18,
  lineHeight: 1.45,
  color: "#111827",
};

const orgName: React.CSSProperties = {
  marginTop: 6,
};

const infoGrid: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const label: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  marginBottom: 3,
};

const value: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#1f2937",
};

const tagWrap: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
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
  padding: 22,
  textAlign: "center",
};