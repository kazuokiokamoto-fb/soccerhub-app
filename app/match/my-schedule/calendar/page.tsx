"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import {
  MatchCalendarBase,
  type CalendarItem,
} from "@/app/match/components/MatchCalendarBase";
import {
  buildCalendarCells,
  toMonthKey,
} from "@/app/match/utils/date";

type TeamIdRow = {
  id: string;
};

type MatchSlotRow = {
  id: string;
  host_team_id: string;
  date: string;
};

type MatchRequestRow = {
  id: string;
  slot_id: string;
  requester_team_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
};

type TeamScheduleRow = {
  id: string;
  team_id: string;
  date: string;
  status: "confirmed" | "draft" | string | null;
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

function toArray<T>(value: unknown, mapper: (v: unknown) => T | null): T[] {
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

  return { id, host_team_id, date };
}

function toMatchRequestRow(value: unknown): MatchRequestRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const slot_id = asString(r.slot_id);
  const requester_team_id = asString(r.requester_team_id);
  const status = asString(r.status) as MatchRequestRow["status"];

  if (!id || !slot_id || !requester_team_id || !status) return null;

  return { id, slot_id, requester_team_id, status };
}

function toTeamScheduleRow(value: unknown): TeamScheduleRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const team_id = asString(r.team_id);
  const date = asString(r.date);
  const status = asString(r.status, "draft");

  if (!id || !team_id || !date) return null;

  return { id, team_id, date, status };
}

function ymdToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

        const { data: teamSchedulesRaw, error: teamSchedulesError } =
          await supabase
            .from("team_schedules")
            .select("id,team_id,date,status")
            .in("team_id", myTeamIds)
            .gte("date", startStr)
            .lt("date", endStr)
            .order("date", { ascending: true });

        if (teamSchedulesError) throw teamSchedulesError;

        const teamSchedules = toArray(teamSchedulesRaw, toTeamScheduleRow);

        const { data: hostedSlotsRaw, error: hostedSlotsError } = await supabase
          .from("match_slots")
          .select("id,host_team_id,date")
          .in("host_team_id", myTeamIds)
          .gte("date", startStr)
          .lt("date", endStr)
          .order("date", { ascending: true });

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

        const hostedAcceptedBySlotId = new Set(
          hostedAcceptedRequests.map((req) => req.slot_id)
        );

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
              .select("id,host_team_id,date")
              .in("id", requesterSlotIds)
              .gte("date", startStr)
              .lt("date", endStr)
              .order("date", { ascending: true });

          if (requesterSlotsError) throw requesterSlotsError;
          requesterSlots = toArray(requesterSlotsRaw, toMatchSlotRow);
        }

        const map = new Map<string, DaySummary>();
        const seen = new Set<string>();

        function addSummary(date: string, status: "confirmed" | "draft") {
          const current = map.get(date) ?? {
            total: 0,
            confirmed: 0,
            draft: 0,
          };

          current.total += 1;
          if (status === "confirmed") current.confirmed += 1;
          else current.draft += 1;

          map.set(date, current);
        }

        for (const item of teamSchedules) {
          if (seen.has(`team_schedule:${item.id}`)) continue;
          seen.add(`team_schedule:${item.id}`);

          addSummary(
            item.date,
            item.status === "confirmed" ? "confirmed" : "draft"
          );
        }

        for (const slot of [...hostedSlots, ...requesterSlots]) {
          if (seen.has(`slot:${slot.id}`)) continue;
          seen.add(`slot:${slot.id}`);

          const confirmed =
            hostedAcceptedBySlotId.has(slot.id) ||
            requesterSlotIds.includes(slot.id);

          addSummary(slot.date, confirmed ? "confirmed" : "draft");
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

  const calendarCells = useMemo(
    () => buildCalendarCells(currentMonth),
    [currentMonth]
  );

  const monthKey = useMemo(() => toMonthKey(currentMonth), [currentMonth]);

  const calendarItemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();

    for (const [ymd, summary] of summaries.entries()) {
      const items: CalendarItem[] = [];

      if (summary.confirmed > 0) {
        items.push({
          label: "決定",
          count: summary.confirmed,
          tone: "decided",
        });
      }

      if (summary.draft > 0) {
        items.push({
          label: "交渉",
          count: summary.draft,
          tone: "negotiating",
        });
      }

      if (items.length > 0) {
        map.set(ymd, items);
      }
    }

    return map;
  }, [summaries]);

  const monthHasAnySchedule = useMemo(() => {
    return summaries.size > 0;
  }, [summaries]);

  return (
    <main style={pageWrap}>
      <AppTabNav />

      <AppHero
        icon="🗓"
        title="マイスケジュール"
        desc="予定を月表示で確認できます。決定と交渉を色分け表示します。"
      />

      <div style={topNavWrap}>
        <Link href="/match/my-schedule" className="sh-btn sh-btn--primary">
          予定一覧
        </Link>

        <Link href="/match/my-schedule/new" className="sh-btn">
          予定作成
        </Link>
      </div>

      {errorText ? (
        <div style={errorBox} className="ui-card">
          <div style={errorTitle} className="ui-title">
            読み込みエラー
          </div>
          <div className="ui-body">{errorText}</div>
        </div>
      ) : null}

      {loading || authLoading ? (
        <div style={emptyBox} className="ui-meta">
          読み込み中…
        </div>
      ) : !userId ? (
        <div style={emptyBox} className="ui-meta">
          ログイン後に表示されます
        </div>
      ) : (
        <>
          <section style={calendarCard}>
            <div style={calendarTitle}>マイスケジュール</div>

            <div style={legendWrap}>
              <span style={legendItem}>
                <span style={legendDotConfirmed} />
                決定
              </span>
              <span style={legendItem}>
                <span style={legendDotNegotiating} />
                交渉
              </span>
            </div>

            <MatchCalendarBase
              monthKey={monthKey}
              cells={calendarCells}
              selectedYmd={ymdToday()}
              itemsByDate={calendarItemsByDate}
              onSelectDate={(ymd) => {
                window.location.href = `/match/my-schedule?date=${ymd}`;
              }}
              onPrevMonth={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() - 1,
                    1
                  )
                )
              }
              onNextMonth={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() + 1,
                    1
                  )
                )
              }
            />
          </section>

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

const calendarCard: React.CSSProperties = {
  marginTop: 16,
  padding: "12px 14px",
  border: "1px solid #dce9df",
  borderRadius: 14,
  background: "#fff",
};

const calendarTitle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.25,
};

const legendWrap: React.CSSProperties = {
  marginTop: 8,
  marginBottom: 8,
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
  alignItems: "center",
};

const legendItem: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  color: "#4b5563",
  fontWeight: 700,
};

const legendDotConfirmed: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "#16a34a",
  display: "inline-block",
};

const legendDotNegotiating: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "#f97316",
  display: "inline-block",
};