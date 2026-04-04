"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { categoryLabel } from "@/app/lib/categories";

type Slot = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  area: string | null;
  area_text?: string | null;
  category: string | null;
  is_closed?: boolean | null;

  // 無くても落ちないよう optional
  strength_rank?: string | null;
  has_ground?: boolean | null;
  note?: string | null;
};

function ymdToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildNextDays(count: number) {
  const arr: string[] = [];
  const base = new Date();

  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);

    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    arr.push(`${y}-${m}-${day}`);
  }

  return arr;
}

function formatDayChip(ymd: string) {
  const d = new Date(`${ymd}T00:00:00`);
  const week = ["日", "月", "火", "水", "木", "金", "土"];
  return {
    md: `${d.getMonth() + 1}/${d.getDate()}`,
    week: week[d.getDay()],
  };
}

function hhmm(v?: string | null) {
  if (!v) return "";
  return String(v).slice(0, 5);
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
  if (!value) return true; // 列未整備でも極力落とさない
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

  if (timeZoneFilter === "morning") {
    return start >= "06:00" && start < "12:00";
  }

  if (timeZoneFilter === "afternoon") {
    return start >= "12:00" && start < "17:00";
  }

  if (timeZoneFilter === "evening") {
    return start >= "17:00" && start <= "21:00";
  }

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

export default function HomeCalendar() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(ymdToday());
  const [loading, setLoading] = useState(true);

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
    } catch {}
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel("home-calendar-slots")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_slots",
        },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
      .limit(300);

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

  const days = useMemo(() => buildNextDays(14), []);

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

  useEffect(() => {
    const currentCount = grouped.get(selectedDate)?.length ?? 0;
    if (currentCount > 0) return;

    const firstAvailable = days.find((d) => (grouped.get(d)?.length ?? 0) > 0);
    if (firstAvailable) {
      setSelectedDate(firstAvailable);
    }
  }, [grouped, selectedDate, days]);

  const selectedDateSlots = useMemo(() => {
    return grouped.get(selectedDate) ?? [];
  }, [grouped, selectedDate]);

  const totalFilteredCount = filteredSlots.length;

  return (
    <section style={wrap}>
      <div style={heroCard}>
        <div style={heroHead}>
          <div>
            <div style={eyebrow}>HOME CALENDAR</div>
            <h2 style={title}>試合を探す</h2>
            <p style={desc}>
              日付ごとの募集件数を見ながら、エリア・カテゴリ・強さなどで絞り込めます。
            </p>
          </div>

          <div style={heroActions}>
            <Link href="/match" className="sh-btn">
              もっと見る
            </Link>
            <Link href="/match/new" className="sh-btn sh-btn--primary">
              募集する
            </Link>
          </div>
        </div>

        <div style={filterCard}>
          <div style={filterTop}>
            <div style={filterTitleWrap}>
              <div style={filterEyebrow}>条件から探す</div>
              <div style={filterTitle}>対戦相手・募集をすばやく絞り込み</div>
              <div style={filterDesc}>
                SUUMOのように条件で探して、LINEのようにすぐ連絡できる入口です。
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

        <div style={dayRow}>
          {days.map((d) => {
            const info = formatDayChip(d);
            const count = grouped.get(d)?.length ?? 0;
            const active = selectedDate === d;

            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDate(d)}
                style={{
                  ...dayChip,
                  ...(active ? dayChipActive : {}),
                }}
              >
                <div style={dayChipDate}>{info.md}</div>
                <div style={dayChipWeek}>{info.week}</div>
                <div
                  style={{
                    ...dayCount,
                    ...(active ? dayCountActive : {}),
                  }}
                >
                  {count}件
                </div>
              </button>
            );
          })}
        </div>

        <div ref={listRef} style={listWrap}>
          <div style={listHead}>
            <div style={listTitle}>
              {selectedDate.replaceAll("-", "/")} の募集
            </div>
            <div style={listSub}>
              {loading ? "読み込み中…" : `${selectedDateSlots.length}件`}
            </div>
          </div>

          <div style={list}>
            {loading ? (
              <div style={empty}>読み込み中…</div>
            ) : selectedDateSlots.length === 0 ? (
              <div style={empty}>
                この条件では募集がありません。
                <br />
                条件をゆるめるか、試合一覧で探してみてください。
              </div>
            ) : (
              selectedDateSlots.slice(0, 5).map((s) => (
                <Link
                  key={s.id}
                  href={`/match?date=${encodeURIComponent(s.date)}&slotId=${encodeURIComponent(s.id)}`}
                  style={cardLink}
                >
                  <div style={card}>
                    <div style={cardTop}>
                      <div style={time}>
                        {hhmm(s.start_time)}–{hhmm(s.end_time)}
                      </div>
                      <div style={badge}>募集中</div>
                    </div>

                    <div style={meta}>
                      📍 {s.area_text ?? s.area ?? "エリア未設定"}
                    </div>

                    <div style={meta}>
                      🏷 {categoryLabel(s.category) || s.category || "カテゴリ未設定"}
                    </div>

                    <div style={meta}>
                      💪 {s.strength_rank || "強さ未設定"}
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          {!loading && selectedDateSlots.length > 5 ? (
            <div style={moreRow}>
              <Link
                href={`/match?date=${encodeURIComponent(selectedDate)}`}
                className="sh-btn"
              >
                この日の募集をもっと見る
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

const wrap: React.CSSProperties = {
  marginTop: 16,
};

const heroCard: React.CSSProperties = {
  borderRadius: 18,
  border: "1px solid #e5ece7",
  background: "#fff",
  padding: 16,
  display: "grid",
  gap: 14,
};

const heroHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const eyebrow: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.08em",
  color: "#5b6d61",
};

const title: React.CSSProperties = {
  margin: "4px 0 0",
  fontWeight: 900,
  fontSize: 24,
  color: "#16391f",
};

const desc: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 14,
  color: "#4b5563",
  lineHeight: 1.7,
};

const heroActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
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

const dayRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  overflowX: "auto",
  paddingBottom: 2,
};

const dayChip: React.CSSProperties = {
  minWidth: 74,
  padding: "10px 10px 9px",
  borderRadius: 14,
  border: "1px solid #dbe5de",
  background: "#fff",
  cursor: "pointer",
  textAlign: "center",
  flexShrink: 0,
};

const dayChipActive: React.CSSProperties = {
  background: "#145c2a",
  color: "#fff",
  border: "1px solid #145c2a",
};

const dayChipDate: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  lineHeight: 1.2,
};

const dayChipWeek: React.CSSProperties = {
  marginTop: 2,
  fontSize: 11,
  opacity: 0.8,
};

const dayCount: React.CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  fontWeight: 800,
  color: "#145c2a",
};

const dayCountActive: React.CSSProperties = {
  color: "#fff",
};

const listWrap: React.CSSProperties = {
  borderTop: "1px solid #eef2ef",
  paddingTop: 12,
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

const cardLink: React.CSSProperties = {
  textDecoration: "none",
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

const moreRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-start",
};