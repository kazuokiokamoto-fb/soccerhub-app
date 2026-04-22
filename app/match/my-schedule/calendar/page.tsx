"use client";

import React, { useEffect, useMemo, useState } from "react";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import type { TeamSchedule, ScheduleStatus } from "@/app/lib/types";

type TeamIdRow = {
  id: string;
};

type TeamScheduleRow = {
  id: string;
  team_id: string;
  category: string | null;
  opponent: string | null;
  strength: string | null;
  date: string | null;
  venue_name: string | null;
  address: string | null;
  meetup_time: string | null;
  dissolve_time: string | null;
  start_time: string | null;
  end_time: string | null;
  parking: string | null;
  belongings: string | null;
  note: string | null;
  thread_id: string | null;
  status: ScheduleStatus | null;
  google_event_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function ymdToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatMonthLabel(date: Date) {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function toTeamSchedule(row: TeamScheduleRow): TeamSchedule {
  return {
    id: row.id,
    teamId: row.team_id,
    category: row.category ?? "",
    opponent: row.opponent ?? "",
    strength: row.strength,
    date: row.date ?? "",
    venueName: row.venue_name,
    address: row.address,
    meetupTime: row.meetup_time,
    dissolveTime: row.dissolve_time,
    startTime: row.start_time,
    endTime: row.end_time,
    parking: row.parking,
    belongings: row.belongings,
    note: row.note,
    threadId: row.thread_id,
    status: row.status === "confirmed" ? "confirmed" : "draft",
    googleEventId: row.google_event_id,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

function buildMonthCells(baseDate: Date) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startWeekday = firstDay.getDay();
  const totalDays = lastDay.getDate();

  const cells: Array<{ ymd: string | null; day: number | null }> = [];

  for (let i = 0; i < startWeekday; i++) {
    cells.push({ ymd: null, day: null });
  }

  for (let day = 1; day <= totalDays; day++) {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    cells.push({
      ymd: `${year}-${mm}-${dd}`,
      day,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ ymd: null, day: null });
  }

  return cells;
}

export default function MyScheduleCalendarPage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<TeamSchedule[]>([]);
  const [errorText, setErrorText] = useState("");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (authLoading) return;

      if (!userId) {
        if (active) {
          setSchedules([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setErrorText("");

      try {
        const { data: myTeamsRaw, error: myTeamsError } = await supabase
          .from("teams")
          .select("id")
          .eq("owner_id", userId);

        if (myTeamsError) throw myTeamsError;

        const myTeamIds = ((myTeamsRaw ?? []) as TeamIdRow[]).map((row) => row.id);

        if (myTeamIds.length === 0) {
          if (active) {
            setSchedules([]);
            setLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from("team_schedules")
          .select(
            [
              "id",
              "team_id",
              "category",
              "opponent",
              "strength",
              "date",
              "venue_name",
              "address",
              "meetup_time",
              "dissolve_time",
              "start_time",
              "end_time",
              "parking",
              "belongings",
              "note",
              "thread_id",
              "status",
              "google_event_id",
              "created_at",
              "updated_at",
            ].join(",")
          )
          .in("team_id", myTeamIds)
          .gte("date", ymdToday())
          .order("date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(500);

        if (error) throw error;

        const rows = (data ?? []) as unknown as TeamScheduleRow[];
        const mapped = rows.map(toTeamSchedule);

        if (!active) return;
        setSchedules(mapped);
      } catch (e: any) {
        console.error(e);
        if (!active) return;
        setSchedules([]);
        setErrorText(e?.message ?? "予定の取得に失敗しました");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [authLoading, userId]);

  const monthCells = useMemo(() => buildMonthCells(currentMonth), [currentMonth]);

  const scheduleMap = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number;
        confirmed: number;
        draft: number;
      }
    >();

    for (const item of schedules) {
      if (!item.date) continue;

      const current = map.get(item.date) ?? {
        total: 0,
        confirmed: 0,
        draft: 0,
      };

      current.total += 1;

      if (item.status === "confirmed") {
        current.confirmed += 1;
      } else {
        current.draft += 1;
      }

      map.set(item.date, current);
    }

    return map;
  }, [schedules]);

  const monthHasAnySchedule = useMemo(() => {
    return monthCells.some((cell) => cell.ymd && scheduleMap.has(cell.ymd));
  }, [monthCells, scheduleMap]);

  return (
    <main style={pageWrap}>
      <AppTabNav />

      <AppHero
        icon="🗓"
        title="カレンダー"
        desc="予定を月表示で確認できます。決定と下書きを色分け表示します。"
      />

      {errorText ? (
        <div style={errorBox} className="ui-card">
          <div style={errorTitle} className="ui-title">読み込みエラー</div>
          <div className="ui-body">{errorText}</div>
        </div>
      ) : null}

      <div style={monthHeader}>
        <button
          type="button"
          style={monthNavButton}
          onClick={() =>
            setCurrentMonth(
              new Date(
                currentMonth.getFullYear(),
                currentMonth.getMonth() - 1,
                1
              )
            )
          }
        >
          ← 前月
        </button>

        <div style={monthTitle}>{formatMonthLabel(currentMonth)}</div>

        <button
          type="button"
          style={monthNavButton}
          onClick={() =>
            setCurrentMonth(
              new Date(
                currentMonth.getFullYear(),
                currentMonth.getMonth() + 1,
                1
              )
            )
          }
        >
          次月 →
        </button>
      </div>

      <div style={legendWrap}>
        <span style={legendItem}>
          <span style={legendDotConfirmed} />
          決
        </span>
        <span style={legendItem}>
          <span style={legendDotDraft} />
          下書き
        </span>
      </div>

      {loading || authLoading ? (
        <div style={emptyBox} className="ui-meta">読み込み中…</div>
      ) : !userId ? (
        <div style={emptyBox} className="ui-meta">
          ログイン後に表示されます
        </div>
      ) : (
        <>
          <div style={calendarWrap}>
            {weekLabels.map((label) => (
              <div key={label} style={weekLabel}>
                {label}
              </div>
            ))}

            {monthCells.map((cell, idx) => {
              if (!cell.ymd || !cell.day) {
                return <div key={`blank-${idx}`} style={blankCell} />;
              }

              const summary = scheduleMap.get(cell.ymd);
              const hasSchedule = !!summary;
              const isToday = cell.ymd === ymdToday();

              return (
                <button
                  key={cell.ymd}
                  type="button"
                  style={{
                    ...dayCell,
                    ...(isToday ? todayCell : null),
                    ...(hasSchedule ? clickableCell : null),
                  }}
                  onClick={() => {
                    window.location.href = `/match/my-schedule?date=${cell.ymd}`;
                  }}
                >
                  <div style={dayCellTop}>
                    <span style={dayNumber}>{cell.day}</span>

                    {summary ? (
                      <span style={countBadge}>{summary.total}件</span>
                    ) : null}
                  </div>

                  {summary ? (
                    <div style={statusChipWrap}>
                      {summary.confirmed > 0 ? (
                        <span style={confirmedChip}>決 {summary.confirmed}</span>
                      ) : null}

                      {summary.draft > 0 ? (
                        <span style={draftChip}>下 {summary.draft}</span>
                      ) : null}
                    </div>
                  ) : (
                    <div style={emptyChipArea} />
                  )}
                </button>
              );
            })}
          </div>

          {!monthHasAnySchedule ? (
            <div style={emptyBox} className="ui-meta">
              この月の予定はまだありません
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}

const weekLabels = ["日", "月", "火", "水", "木", "金", "土"];

const pageWrap: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  padding: 16,
};

const errorBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
};

const errorTitle: React.CSSProperties = {
  marginBottom: 4,
};

const emptyBox: React.CSSProperties = {
  marginTop: 14,
  padding: 18,
  textAlign: "center",
};

const monthHeader: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const monthTitle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#16391f",
};

const monthNavButton: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#fff",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const legendWrap: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
};

const legendItem: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  color: "#4b5563",
};

const legendDotConfirmed: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "#22c55e",
  display: "inline-block",
};

const legendDotDraft: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "#9ca3af",
  display: "inline-block",
};

const calendarWrap: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
  gap: 8,
};

const weekLabel: React.CSSProperties = {
  textAlign: "center",
  fontWeight: 800,
  fontSize: 13,
  color: "#4b5563",
  paddingBottom: 4,
};

const blankCell: React.CSSProperties = {
  minHeight: 92,
};

const dayCell: React.CSSProperties = {
  minHeight: 92,
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  background: "#fff",
  padding: 10,
  textAlign: "left",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const clickableCell: React.CSSProperties = {
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

const todayCell: React.CSSProperties = {
  border: "2px solid #86efac",
};

const dayCellTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
};

const dayNumber: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#111827",
};

const countBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 22,
  padding: "0 8px",
  borderRadius: 999,
  background: "#eef6f0",
  color: "#14532d",
  fontSize: 12,
  fontWeight: 800,
};

const statusChipWrap: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  marginTop: 10,
};

const confirmedChip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 22,
  padding: "0 8px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontSize: 12,
  fontWeight: 800,
};

const draftChip: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 22,
  padding: "0 8px",
  borderRadius: 999,
  background: "#f3f4f6",
  color: "#4b5563",
  fontSize: 12,
  fontWeight: 800,
};

const emptyChipArea: React.CSSProperties = {
  minHeight: 22,
};