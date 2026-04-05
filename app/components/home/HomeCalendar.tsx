"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { categoryLabel } from "@/app/lib/categories";
import Link from "next/link";

type Slot = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  area: string | null;
  area_text?: string | null;
  category: string | null;
  is_closed?: boolean | null;
  strength_rank?: string | null;
  has_ground?: boolean | null;
  note?: string | null;
};

type DayCalendarSummary = {
  label: "決" | "募" | "他";
  count: number;
  tone: "decided" | "open" | "other";
};

function ymdToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, diff: number) {
  return new Date(date.getFullYear(), date.getMonth() + diff, 1);
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildCalendarCells(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - firstWeekday);

  return Array.from({ length: 42 }).map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");

    return {
      ymd: `${y}-${m}-${day}`,
      dayNum: d.getDate(),
      inMonth: d.getMonth() === month,
    };
  });
}

function hhmm(v?: string | null) {
  if (!v) return "";
  return String(v).slice(0, 5);
}

function isPastDate(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  const target = new Date(y, (m || 1) - 1, d || 1);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return target < today;
}

function getWeekdayKey(dateStr?: string | null) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  if (day === 0) return "sun";
  if (day === 6) return "sat";
  return "weekday";
}

function matchCategory(slot: Slot, category: string) {
  if (!category) return true;
  return (slot.category ?? "") === category;
}

function matchArea(slot: Slot, areaKeyword: string) {
  if (!areaKeyword.trim()) return true;
  const q = areaKeyword.trim().toLowerCase();
  const haystack = [slot.area ?? "", slot.area_text ?? ""].join(" ").toLowerCase();
  return haystack.includes(q);
}

function matchStrength(slot: Slot, selectedStrengths: string[]) {
  if (selectedStrengths.length === 0) return true;
  const value = String(slot.strength_rank ?? "");
  if (!value) return true;
  return selectedStrengths.includes(value);
}

function matchWeekday(slot: Slot, weekdayFilter: string) {
  if (!weekdayFilter) return true;

  const key = getWeekdayKey(slot.date);

  if (weekdayFilter === "holiday") {
    return key === "sat" || key === "sun";
  }

  return key === weekdayFilter;
}

function matchTimeZone(slot: Slot, timeZoneFilter: string) {
  if (!timeZoneFilter) return true;

  const start = String(slot.start_time ?? "");

  if (timeZoneFilter === "morning") return start >= "06:00" && start < "12:00";
  if (timeZoneFilter === "afternoon") return start >= "12:00" && start < "17:00";
  if (timeZoneFilter === "evening") return start >= "17:00" && start <= "21:00";

  return true;
}

function matchGround(slot: Slot, groundFilter: string) {
  if (!groundFilter) return true;

  const hasGround = !!slot.has_ground;

  if (groundFilter === "yes") return hasGround;
  if (groundFilter === "no") return !hasGround;

  return true;
}

function matchKeyword(slot: Slot, keyword: string) {
  if (!keyword.trim()) return true;

  const q = keyword.trim().toLowerCase();
  const text = [
    slot.area ?? "",
    slot.area_text ?? "",
    slot.category ?? "",
    slot.note ?? "",
    slot.strength_rank ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return text.includes(q);
}

function getSummaryLabel(summary: DayCalendarSummary) {
  if (summary.tone === "decided") return "決定済";
  if (summary.tone === "open") return "募集中";
  return "他決定";
}

export default function HomeCalendar() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);

  const [monthDate, setMonthDate] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<string>(ymdToday());

  const [areaKeyword, setAreaKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [strengthFilter, setStrengthFilter] = useState<string[]>([]);
  const [weekdayFilter, setWeekdayFilter] = useState("");
  const [timeZoneFilter, setTimeZoneFilter] = useState("");
  const [groundFilter, setGroundFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [openOnly, setOpenOnly] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("sakamatch:home-calendar-filters:v1");
      if (!raw) return;

      const saved = JSON.parse(raw);

      setAreaKeyword(saved.areaKeyword ?? "");
      setCategoryFilter(saved.categoryFilter ?? "");
      setStrengthFilter(Array.isArray(saved.strengthFilter) ? saved.strengthFilter : []);
      setWeekdayFilter(saved.weekdayFilter ?? "");
      setTimeZoneFilter(saved.timeZoneFilter ?? "");
      setGroundFilter(saved.groundFilter ?? "");
      setKeyword(saved.keyword ?? "");
      setOpenOnly(typeof saved.openOnly === "boolean" ? saved.openOnly : true);
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    void load();

    const channel = supabase
      .channel("home-calendar-slots-unified")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_slots",
        },
        () => {
          void load();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  async function load() {
    setLoading(true);

    const { data, error } = await supabase
      .from("match_slots")
      .select(
        "id,date,start_time,end_time,area,area_text,category,is_closed,strength_rank,has_ground,note"
      )
      .gte("date", ymdToday())
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(500);

    if (error) {
      console.error("HomeCalendar load error:", error);
      setSlots([]);
      setLoading(false);
      return;
    }

    setSlots((data ?? []) as Slot[]);
    setLoading(false);
  }

  function handleSaveFilters() {
    try {
      window.localStorage.setItem(
        "sakamatch:home-calendar-filters:v1",
        JSON.stringify({
          areaKeyword,
          categoryFilter,
          strengthFilter,
          weekdayFilter,
          timeZoneFilter,
          groundFilter,
          keyword,
          openOnly,
        })
      );
      alert("条件を保存しました");
    } catch {
      alert("条件の保存に失敗しました");
    }
  }

  function handleClearFilters() {
    setAreaKeyword("");
    setCategoryFilter("");
    setStrengthFilter([]);
    setWeekdayFilter("");
    setTimeZoneFilter("");
    setGroundFilter("");
    setKeyword("");
    setOpenOnly(true);
  }

  function handleApplyFilters() {
    setTimeout(() => {
      listRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  function toggleStrength(rank: string) {
    setStrengthFilter((prev) => {
      if (prev.includes(rank)) {
        return prev.filter((v) => v !== rank);
      }
      return [...prev, rank];
    });
  }

  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (openOnly && slot.is_closed) return false;

      return (
        matchCategory(slot, categoryFilter) &&
        matchArea(slot, areaKeyword) &&
        matchStrength(slot, strengthFilter) &&
        matchWeekday(slot, weekdayFilter) &&
        matchTimeZone(slot, timeZoneFilter) &&
        matchGround(slot, groundFilter) &&
        matchKeyword(slot, keyword)
      );
    });
  }, [
    slots,
    categoryFilter,
    areaKeyword,
    strengthFilter,
    weekdayFilter,
    timeZoneFilter,
    groundFilter,
    keyword,
    openOnly,
  ]);

  const grouped = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of filteredSlots) {
      if (!m.has(s.date)) m.set(s.date, []);
      m.get(s.date)!.push(s);
    }
    return m;
  }, [filteredSlots]);

  const monthCells = useMemo(() => buildCalendarCells(monthDate), [monthDate]);
  const monthKey = useMemo(() => toMonthKey(monthDate), [monthDate]);

  const dayStatusSummaryByDate = useMemo(() => {
    const map = new Map<string, DayCalendarSummary>();

    for (const [date, daySlots] of grouped.entries()) {
      const openCount = daySlots.filter((s) => !s.is_closed).length;
      const decidedCount = daySlots.filter((s) => !!s.is_closed).length;

      if (openCount > 0) {
        map.set(date, {
          label: "募",
          count: openCount,
          tone: "open",
        });
      } else if (decidedCount > 0) {
        map.set(date, {
          label: "決",
          count: decidedCount,
          tone: "decided",
        });
      }
    }

    return map;
  }, [grouped]);

  useEffect(() => {
    const currentCount = grouped.get(selectedDate)?.length ?? 0;
    if (currentCount > 0) return;

    const firstAvailable = Array.from(grouped.keys()).sort()[0];
    if (firstAvailable) {
      setSelectedDate(firstAvailable);
    }
  }, [grouped, selectedDate]);

  useEffect(() => {
    const target = new Date(`${selectedDate}T00:00:00`);
    if (
      target.getFullYear() !== monthDate.getFullYear() ||
      target.getMonth() !== monthDate.getMonth()
    ) {
      setMonthDate(startOfMonth(target));
    }
  }, [selectedDate, monthDate]);

  const selectedDateSlots = useMemo(() => {
    return grouped.get(selectedDate) ?? [];
  }, [grouped, selectedDate]);

  const totalFilteredCount = filteredSlots.length;

  const filterSummaryText = useMemo(() => {
    const parts: string[] = [];

    if (keyword.trim()) parts.push(`キーワード: ${keyword.trim()}`);
    if (areaKeyword.trim()) parts.push(`エリア: ${areaKeyword.trim()}`);
    if (categoryFilter) {
      parts.push(`カテゴリ: ${categoryLabel(categoryFilter) || categoryFilter}`);
    }
    if (strengthFilter.length > 0) parts.push(`強さ: ${strengthFilter.join(" / ")}`);
    if (weekdayFilter) parts.push("曜日条件あり");
    if (timeZoneFilter) parts.push("時間帯条件あり");
    if (groundFilter) parts.push("グラウンド条件あり");
    if (openOnly) parts.push("募集中のみ");

    return parts.join(" / ");
  }, [
    keyword,
    areaKeyword,
    categoryFilter,
    strengthFilter,
    weekdayFilter,
    timeZoneFilter,
    groundFilter,
    openOnly,
  ]);

  return (
    <section style={wrap}>
      <div ref={filterRef} style={heroCard}>
        <div style={filterCard}>
          <div style={filterTop}>
            <div style={filterTitleWrap}>
              <div style={filterEyebrow}>HOME MATCH SEARCH</div>
              <div style={filterTitle}>ホームでそのまま探す</div>
              <div style={filterDesc}>
                カレンダーと絞り込みをこのページに集約しました。
              </div>
            </div>

            <div style={summaryBox}>
              <div style={summaryLabel}>該当件数</div>
              <div style={summaryValue}>{loading ? "…" : totalFilteredCount}</div>
            </div>
          </div>

          <div style={filterBox}>
            <label style={field}>
              <span style={fieldLabel}>エリア</span>
              <input
                value={areaKeyword}
                onChange={(e) => setAreaKeyword(e.target.value)}
                placeholder="例：世田谷 / 横浜 / 三宿"
                className="sh-input"
              />
            </label>

            <label style={field}>
              <span style={fieldLabel}>カテゴリ</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="sh-select"
              >
                <option value="">すべて</option>
                <option value="u6">U-6</option>
                <option value="u7">U-7</option>
                <option value="u8">U-8</option>
                <option value="u9">U-9</option>
                <option value="u10">U-10</option>
                <option value="u11">U-11</option>
                <option value="u12">U-12</option>
                <option value="junior-high">中学</option>
                <option value="high-school">高校</option>
                <option value="adult">一般</option>
                <option value="ladies">女子</option>
                <option value="senior">シニア</option>
                <option value="futsal">フットサル</option>
              </select>
            </label>

            <label style={checkboxField}>
              <input
                type="checkbox"
                checked={openOnly}
                onChange={(e) => setOpenOnly(e.target.checked)}
              />
              <span>募集中のみ</span>
            </label>
          </div>

          <div style={strengthWrap}>
            <div style={fieldLabel}>強さ</div>
            <div style={chipRow}>
              {["SS", "S", "A", "B", "C"].map((rank) => {
                const active = strengthFilter.includes(rank);
                return (
                  <button
                    key={rank}
                    type="button"
                    onClick={() => toggleStrength(rank)}
                    style={{
                      ...chip,
                      ...(active ? chipActive : {}),
                    }}
                  >
                    {rank}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={advancedToggleRow}>
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              style={ghostButton}
            >
              {showAdvanced ? "詳細条件を閉じる" : "もっと条件を指定"}
            </button>
          </div>

          {showAdvanced ? (
            <div style={advancedBox}>
              <div style={advancedGrid}>
                <label style={field}>
                  <span style={fieldLabel}>曜日</span>
                  <select
                    value={weekdayFilter}
                    onChange={(e) => setWeekdayFilter(e.target.value)}
                    className="sh-select"
                  >
                    <option value="">すべて</option>
                    <option value="sat">土曜</option>
                    <option value="sun">日曜</option>
                    <option value="holiday">土日</option>
                    <option value="weekday">平日</option>
                  </select>
                </label>

                <label style={field}>
                  <span style={fieldLabel}>時間帯</span>
                  <select
                    value={timeZoneFilter}
                    onChange={(e) => setTimeZoneFilter(e.target.value)}
                    className="sh-select"
                  >
                    <option value="">すべて</option>
                    <option value="morning">午前</option>
                    <option value="afternoon">午後</option>
                    <option value="evening">夕方</option>
                  </select>
                </label>

                <label style={field}>
                  <span style={fieldLabel}>グラウンド</span>
                  <select
                    value={groundFilter}
                    onChange={(e) => setGroundFilter(e.target.value)}
                    className="sh-select"
                  >
                    <option value="">すべて</option>
                    <option value="yes">あり</option>
                    <option value="no">なし</option>
                  </select>
                </label>

                <label style={field}>
                  <span style={fieldLabel}>キーワード</span>
                  <input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="例：強度高め / 午前 / 世田谷"
                    className="sh-input"
                  />
                </label>
              </div>
            </div>
          ) : null}

          <div style={actionRow}>
            <button type="button" style={primaryButton} onClick={handleApplyFilters}>
              この条件で表示
            </button>

            <button type="button" style={ghostButton} onClick={handleSaveFilters}>
              条件を保存
            </button>

            <button type="button" style={ghostButton} onClick={handleClearFilters}>
              クリア
            </button>
          </div>
        </div>

        <section style={{ ...calendarCard, marginTop: 0 }}>
          <div style={topHead}>
            <div style={topHeadLeft}>
              <div style={topEyebrow}>MATCH CALENDAR</div>
              <div style={topTitle}>カレンダーから試合を探す</div>
            </div>

            <div style={topHeadActions}>
              <button
                type="button"
                className="sh-btn"
                onClick={() => {
                  filterRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }}
                disabled={loading}
              >
                条件変更
              </button>

              <button
                type="button"
                className="sh-btn"
                onClick={handleClearFilters}
                disabled={loading}
              >
                リセット
              </button>
            </div>
          </div>

          <div style={filterSummaryBox}>
            <div style={filterSummaryLabel}>表示条件</div>
            <div style={filterSummaryTextStyle}>
              {filterSummaryText.trim() || "すべての条件で表示中"}
            </div>

            <button
              type="button"
              onClick={() => setOpenOnly((prev) => !prev)}
              style={{
                ...openOnlyChip,
                ...(openOnly ? openOnlyChipActive : null),
              }}
              aria-pressed={openOnly}
            >
              {openOnly ? "募集中のみ表示中" : "募集中のみ表示"}
            </button>
          </div>

          <div style={headerRow}>
            <button
              className="sh-btn"
              type="button"
              onClick={() => setMonthDate(addMonths(monthDate, -1))}
            >
              ← 前月
            </button>

            <div style={monthTitle}>{monthKey}</div>

            <button
              className="sh-btn"
              type="button"
              onClick={() => setMonthDate(addMonths(monthDate, 1))}
            >
              次月 →
            </button>
          </div>

          <div style={weekHeaderGrid}>
            {["月", "火", "水", "木", "金", "土", "日"].map((w, i) => (
              <div
                key={w}
                style={{
                  ...weekLabel,
                  color: i === 5 ? "#2563eb" : i === 6 ? "#dc2626" : "#666666",
                }}
              >
                {w}
              </div>
            ))}
          </div>

          <div style={calendarGrid}>
            {monthCells.map((c, index) => {
              const daySummary = dayStatusSummaryByDate.get(c.ymd);
              const isSelected = c.ymd === selectedDate;
              const isPast = isPastDate(c.ymd);
              const weekday = index % 7;

              const dayColor =
                weekday === 5 ? "#2563eb" : weekday === 6 ? "#dc2626" : "#374151";

              return (
                <button
                  key={c.ymd}
                  type="button"
                  onClick={() => {
                    setSelectedDate(c.ymd);
                    setTimeout(() => {
                      listRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }, 80);
                  }}
                  style={{
                    ...calCell,
                    ...(isSelected ? calCellSelected : null),
                    ...(isPast ? calCellPast : null),
                    opacity: c.inMonth ? 1 : 0.42,
                  }}
                >
                  <div
                    style={{
                      ...dayNumText,
                      color: c.inMonth ? (isPast ? "#9ca3af" : dayColor) : "#c5cbd3",
                    }}
                  >
                    {c.dayNum}
                  </div>

                  <div
                    style={{
                      ...statusText,
                      color: isPast
                        ? "#94a3b8"
                        : daySummary
                        ? daySummary.tone === "decided"
                          ? "#166534"
                          : daySummary.tone === "open"
                          ? "#1d4ed8"
                          : "#4b5563"
                        : "#9ca3af",
                    }}
                  >
                    {daySummary ? getSummaryLabel(daySummary) : "-"}
                  </div>

                  <div
                    style={{
                      ...summaryCountText,
                      color: isPast ? "#94a3b8" : daySummary ? "#065f46" : "#9ca3af",
                    }}
                  >
                    {daySummary ? `${daySummary.count}件` : "-"}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={bottomRow}>
            <Link href="/match/new" className="sh-btn sh-btn--primary">
              募集する
            </Link>
          </div>
        </section>

        <div ref={listRef} style={listWrap}>
          <div style={listHead}>
            <div style={listTitle}>{selectedDate.replaceAll("-", "/")} の募集</div>
            <div style={listSub}>{loading ? "読み込み中…" : `${selectedDateSlots.length}件`}</div>
          </div>

          <div style={list}>
            {loading ? (
              <div style={empty}>読み込み中…</div>
            ) : selectedDateSlots.length === 0 ? (
              <div style={empty}>
                この条件では募集がありません。
                <br />
                条件をゆるめて再度ご確認ください。
              </div>
            ) : (
              selectedDateSlots.map((s) => (
                <div key={s.id} style={card}>
                  <div style={cardTop}>
                    <div style={time}>
                      {hhmm(s.start_time)}–{hhmm(s.end_time)}
                    </div>
                    <div style={badge}>{s.is_closed ? "締切" : "募集中"}</div>
                  </div>

                  <div style={meta}>📍 {s.area_text ?? s.area ?? "エリア未設定"}</div>

                  <div style={meta}>
                    🏷 {categoryLabel(s.category) || s.category || "カテゴリ未設定"}
                  </div>

                  <div style={meta}>💪 {s.strength_rank || "強さ未設定"}</div>

                  <div style={meta}>
                    🏟 {s.has_ground ? "グラウンドあり" : "グラウンド未設定"}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const wrap: React.CSSProperties = {
  marginTop: 16,
};

const heroCard: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const filterCard: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 18,
  background: "#fafcfb",
  padding: 14,
  display: "grid",
  gap: 14,
};

const filterTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const filterTitleWrap: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const filterEyebrow: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#1f5d30",
};

const filterTitle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#16391f",
};

const filterDesc: React.CSSProperties = {
  fontSize: 13,
  color: "#5b6470",
  lineHeight: 1.7,
};

const summaryBox: React.CSSProperties = {
  minWidth: 84,
  border: "1px solid #e5ece7",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#f8fcf9",
};

const summaryLabel: React.CSSProperties = {
  fontSize: 11,
  color: "#6b7280",
  fontWeight: 700,
};

const summaryValue: React.CSSProperties = {
  marginTop: 4,
  fontSize: 20,
  fontWeight: 900,
  color: "#145c2a",
  lineHeight: 1,
};

const filterBox: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 1fr auto",
  gap: 10,
  alignItems: "end",
};

const field: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const fieldLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#4b5563",
};

const checkboxField: React.CSSProperties = {
  minHeight: 44,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "0 12px",
  border: "1px solid #dbe5de",
  borderRadius: 12,
  background: "#fff",
  fontSize: 14,
  fontWeight: 800,
  color: "#294234",
};

const strengthWrap: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const chipRow: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const chip: React.CSSProperties = {
  border: "1px solid #d8e5dc",
  borderRadius: 999,
  background: "#fff",
  color: "#294234",
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const chipActive: React.CSSProperties = {
  border: "2px solid #145c2a",
  background: "#f3fbf5",
  color: "#145c2a",
};

const advancedToggleRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-start",
};

const advancedBox: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 16,
  background: "#fff",
  padding: 12,
};

const advancedGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const primaryButton: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 12,
  border: "none",
  background: "#145c2a",
  color: "#fff",
  padding: "0 16px",
  fontWeight: 900,
  fontSize: 14,
  cursor: "pointer",
};

const ghostButton: React.CSSProperties = {
  minHeight: 44,
  borderRadius: 12,
  border: "1px solid #d7e3da",
  background: "#fff",
  color: "#25342b",
  padding: "0 16px",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};

const calendarCard: React.CSSProperties = {
  padding: 14,
  border: "1px solid #eee",
  borderRadius: 14,
  background: "#fff",
};

const topHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
  flexWrap: "wrap",
};

const topHeadLeft: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const topEyebrow: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.08em",
  color: "#5b6d61",
};

const topTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.3,
};

const topHeadActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const filterSummaryBox: React.CSSProperties = {
  marginTop: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #dfeee3",
  background: "linear-gradient(135deg,#f5fbf6 0%,#eef8f0 100%)",
  display: "grid",
  gap: 6,
};

const filterSummaryLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  color: "#5b6d61",
  letterSpacing: "0.05em",
};

const filterSummaryTextStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#23412c",
  lineHeight: 1.6,
};

const openOnlyChip: React.CSSProperties = {
  marginTop: 2,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "fit-content",
  minHeight: 30,
  padding: "0 12px",
  borderRadius: 999,
  border: "1px solid #d8e5dc",
  background: "#fff",
  color: "#294234",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
};

const openOnlyChipActive: React.CSSProperties = {
  border: "1px solid #145c2a",
  background: "#145c2a",
  color: "#fff",
};

const headerRow: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const monthTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  lineHeight: 1.2,
  textAlign: "center",
};

const weekHeaderGrid: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 6,
};

const weekLabel: React.CSSProperties = {
  textAlign: "center",
  fontWeight: 800,
  fontSize: 12,
  minWidth: 0,
};

const calendarGrid: React.CSSProperties = {
  marginTop: 6,
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 6,
};

const calCell: React.CSSProperties = {
  minWidth: 0,
  width: "100%",
  height: 57,
  padding: "5px 5px 4px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  cursor: "pointer",
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  justifyContent: "flex-start",
  gap: 1,
  overflow: "hidden",
};

const calCellPast: React.CSSProperties = {
  background: "#f8fafc",
};

const calCellSelected: React.CSSProperties = {
  border: "2px solid #86efac",
  background: "#f0fdf4",
  boxShadow: "0 0 0 3px rgba(134,239,172,0.18)",
};

const dayNumText: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 13,
  lineHeight: 1,
};

const statusText: React.CSSProperties = {
  width: "100%",
  marginTop: 1,
  fontSize: 10,
  fontWeight: 900,
  lineHeight: 1.05,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const summaryCountText: React.CSSProperties = {
  width: "100%",
  marginTop: 0,
  fontSize: 11,
  fontWeight: 900,
  lineHeight: 1.05,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const bottomRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 12,
};

const listWrap: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 14,
  background: "#fff",
  padding: 14,
  display: "grid",
  gap: 10,
};

const listHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const listTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "#16391f",
};

const listSub: React.CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
};

const list: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const card: React.CSSProperties = {
  padding: 12,
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
};

const cardTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const time: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 15,
  color: "#16391f",
};

const badge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 24,
  padding: "0 8px",
  borderRadius: 999,
  background: "#dbeafe",
  color: "#1d4ed8",
  fontSize: 11,
  fontWeight: 900,
};

const meta: React.CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  color: "#5b6470",
  lineHeight: 1.6,
};

const empty: React.CSSProperties = {
  padding: 18,
  textAlign: "center",
  color: "#666",
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
  lineHeight: 1.8,
};