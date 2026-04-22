"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";

type TeamIdRow = {
  id: string;
};

type MatchSlotRow = {
  id: string;
  host_team_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  area: string | null;
  area_text: string | null;
  category: string | null;
  is_closed: boolean | null;
};

type MatchRequestRow = {
  id: string;
  slot_id: string;
  requester_team_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
};

type DaySummary = {
  total: number;
  confirmed: number;
  draft: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBooleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function toArray<T>(
  value: unknown,
  mapper: (v: unknown) => T | null
): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(mapper).filter((v): v is T => v !== null);
}

function toTeamIdRow(value: unknown): TeamIdRow | null {
  const r = asRecord(value);
  if (!r) return null;
  const id = asString(r.id);
  if (!id) return null;
  return { id };
}

function toMatchSlotRow(value: unknown): MatchSlotRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const host_team_id = asString(r.host_team_id);
  const date = asString(r.date);

  if (!id || !host_team_id || !date) return null;

  return {
    id,
    host_team_id,
    date,
    start_time: asNullableString(r.start_time),
    end_time: asNullableString(r.end_time),
    area: asNullableString(r.area),
    area_text: asNullableString(r.area_text),
    category: asNullableString(r.category),
    is_closed: asBooleanOrNull(r.is_closed),
  };
}

function toMatchRequestRow(value: unknown): MatchRequestRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const slot_id = asString(r.slot_id);
  const requester_team_id = asString(r.requester_team_id);
  const status = asString(r.status) as MatchRequestRow["status"];

  if (!id || !slot_id || !requester_team_id || !status) return null;

  return {
    id,
    slot_id,
    requester_team_id,
    status,
  };
}

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
  const [summaries, setSummaries] = useState<Map<string, DaySummary>>(new Map());
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
          setSummaries(new Map());
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

        const myTeamIds = toArray(myTeamsRaw, toTeamIdRow).map((row) => row.id);

        if (myTeamIds.length === 0) {
          if (active) {
            setSummaries(new Map());
            setLoading(false);
          }
          return;
        }

        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const start = new Date(year, month, 1);
        const end = new Date(year, month + 1, 1);

        const startStr = `${start.getFullYear()}-${String(
          start.getMonth() + 1
        ).padStart(2, "0")}-01`;
        const endStr = `${end.getFullYear()}-${String(
          end.getMonth() + 1
        ).padStart(2, "0")}-01`;

        const { data: hostedSlotsRaw, error: hostedSlotsError } = await supabase
          .from("match_slots")
          .select("id,host_team_id,date,start_time,end_time,area,area_text,category,is_closed")
          .in("host_team_id", myTeamIds)
          .gte("date", startStr)
          .lt("date", endStr)
          .order("date", { ascending: true })
          .order("start_time", { ascending: true });

        if (hostedSlotsError) throw hostedSlotsError;

        const hostedSlots = toArray(hostedSlotsRaw, toMatchSlotRow);
        const hostedSlotIds = hostedSlots.map((slot) => slot.id);

        let hostedAcceptedRequests: MatchRequestRow[] = [];
        if (hostedSlotIds.length > 0) {
          const { data: hostedAcceptedRaw, error: hostedAcceptedError } =
            await supabase
              .from("match_requests")
              .select("id,slot_id,requester_team_id,status")
              .in("slot_id", hostedSlotIds)
              .eq("status", "accepted");

          if (hostedAcceptedError) throw hostedAcceptedError;
          hostedAcceptedRequests = toArray(hostedAcceptedRaw, toMatchRequestRow);
        }

        const hostedAcceptedBySlotId = new Map<string, MatchRequestRow>();
        for (const req of hostedAcceptedRequests) {
          if (!hostedAcceptedBySlotId.has(req.slot_id)) {
            hostedAcceptedBySlotId.set(req.slot_id, req);
          }
        }

        const { data: requesterAcceptedRaw, error: requesterAcceptedError } =
          await supabase
            .from("match_requests")
            .select("id,slot_id,requester_team_id,status")
            .in("requester_team_id", myTeamIds)
            .eq("status", "accepted");

        if (requesterAcceptedError) throw requesterAcceptedError;

        const requesterAccepted = toArray(
          requesterAcceptedRaw,
          toMatchRequestRow
        );

        const requesterSlotIds = Array.from(
          new Set(requesterAccepted.map((row) => row.slot_id))
        ).filter((id) => !hostedSlotIds.includes(id));

        let requesterSlots: MatchSlotRow[] = [];
        if (requesterSlotIds.length > 0) {
          const { data: requesterSlotsRaw, error: requesterSlotsError } =
            await supabase
              .from("match_slots")
              .select("id,host_team_id,date,start_time,end_time,area,area_text,category,is_closed")
              .in("id", requesterSlotIds)
              .gte("date", startStr)
              .lt("date", endStr)
              .order("date", { ascending: true })
              .order("start_time", { ascending: true });

          if (requesterSlotsError) throw requesterSlotsError;
          requesterSlots = toArray(requesterSlotsRaw, toMatchSlotRow);
        }

        const merged = [...hostedSlots, ...requesterSlots];
        const map = new Map<string, DaySummary>();
        const seen = new Set<string>();

        for (const slot of merged) {
          if (seen.has(slot.id)) continue;
          seen.add(slot.id);

          const current = map.get(slot.date) ?? {
            total: 0,
            confirmed: 0,
            draft: 0,
          };

          current.total += 1;

          if (hostedAcceptedBySlotId.has(slot.id) || requesterSlotIds.includes(slot.id)) {
            current.confirmed += 1;
          } else {
            current.draft += 1;
          }

          map.set(slot.date, current);
        }

        if (!active) return;
        setSummaries(map);
      } catch (e: any) {
        console.error(e);
        if (!active) return;
        setSummaries(new Map());
        setErrorText(e?.message ?? "予定の取得に失敗しました");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [authLoading, userId, currentMonth]);

  const monthCells = useMemo(() => buildMonthCells(currentMonth), [currentMonth]);

  const monthHasAnySchedule = useMemo(() => {
    return monthCells.some((cell) => cell.ymd && summaries.has(cell.ymd));
  }, [monthCells, summaries]);

  return (
    <main style={pageWrap}>
      <AppTabNav />

      <AppHero
        icon="🗓"
        title="カレンダー"
        desc="予定を月表示で確認できます。決定と下書きを色分け表示します。"
      />

      <div style={topNavWrap}>
        <Link href="/match/my-schedule" className="sh-btn sh-btn--primary">
          予定一覧へ
        </Link>
      </div>

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

              const summary = summaries.get(cell.ymd);
              const isToday = cell.ymd === ymdToday();

              return (
                <button
                  key={cell.ymd}
                  type="button"
                  style={{
                    ...dayCell,
                    ...(isToday ? todayCell : null),
                    ...(summary ? clickableCell : null),
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

const topNavWrap: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
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