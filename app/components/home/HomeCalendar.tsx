"use client";

import React, { useEffect, useMemo, useState } from "react";
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

function matchCategory(slot: Slot, category: string) {
  if (!category) return true;
  return (slot.category ?? "") === category;
}

function matchArea(slot: Slot, areaKeyword: string) {
  if (!areaKeyword.trim()) return true;

  const q = areaKeyword.trim().toLowerCase();
  const haystack = [
    slot.area ?? "",
    slot.area_text ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

export default function HomeCalendar() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(ymdToday());
  const [loading, setLoading] = useState(true);

  const [areaKeyword, setAreaKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

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
      .select("id,date,start_time,end_time,area,area_text,category,is_closed")
      .eq("is_closed", false)
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

  const days = useMemo(() => buildNextDays(14), []);

  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      return (
        matchCategory(slot, categoryFilter) &&
        matchArea(slot, areaKeyword)
      );
    });
  }, [slots, categoryFilter, areaKeyword]);

  const grouped = useMemo(() => {
    const m = new Map<string, Slot[]>();

    for (const s of filteredSlots) {
      if (!m.has(s.date)) m.set(s.date, []);
      m.get(s.date)!.push(s);
    }

    return m;
  }, [filteredSlots]);

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
              日付ごとの募集件数を見ながら、そのまま条件で絞り込めます。
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

          <div style={summaryBox}>
            <div style={summaryLabel}>該当件数</div>
            <div style={summaryValue}>{loading ? "…" : totalFilteredCount}</div>
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

        <div style={listWrap}>
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