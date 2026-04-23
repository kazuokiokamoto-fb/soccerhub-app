"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import { useSearchParams } from "next/navigation";
import { categoryLabel } from "@/app/lib/categories";

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

type MyScheduleItem = {
  id: string;
  slotId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  category: string;
  opponent: string;
  strength: string | null;
  venueName: string | null;
  address: string | null;
  meetupTime: string | null;
  dissolveTime: string | null;
  parking: string | null;
  belongings: string | null;
  note: string | null;
  threadId: string | null;
  status: "confirmed" | "draft";
  role: "host" | "guest";
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

function formatDateLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;

  const dt = new Date(y, m - 1, d);
  const week = ["日", "月", "火", "水", "木", "金", "土"][dt.getDay()];
  return `${m}/${d}（${week}）`;
}

function formatTime(v?: string | null) {
  if (!v) return "";
  return String(v).slice(0, 5);
}

function statusLabel(status?: "confirmed" | "draft" | null) {
  return status === "confirmed" ? "確定" : "下書き";
}

function teamStrengthLabel(team: any) {
  if (!team) return null;
  if (typeof team.strength_rank === "string" && team.strength_rank.trim()) {
    return team.strength_rank;
  }

  const level = Number(team.level ?? 0);
  if (!Number.isFinite(level)) return null;
  if (level >= 9) return "SS";
  if (level >= 7) return "S";
  if (level >= 5) return "A";
  if (level >= 3) return "B";
  return "C";
}

export default function MyScheduleInner() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();

  const userId = user?.id ?? "";
  const selectedDate = searchParams.get("date");

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<MyScheduleItem[]>([]);
  const [errorText, setErrorText] = useState("");

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

        const myTeamIds = toArray(myTeamsRaw, toTeamIdRow).map((row) => row.id);

        if (myTeamIds.length === 0) {
          if (active) {
            setSchedules([]);
            setLoading(false);
          }
          return;
        }

        const { data: allTeamsRaw, error: allTeamsError } = await supabase
          .from("teams")
          .select("id,name,level,strength_rank")
          .order("updated_at", { ascending: false });

        if (allTeamsError) throw allTeamsError;

        const teamMap = new Map(
          (Array.isArray(allTeamsRaw) ? allTeamsRaw : []).map((t: any) => [
            t.id,
            t,
          ])
        );

        const today = ymdToday();

        const hostedSlotsQuery = supabase
          .from("match_slots")
          .select(
            "id,host_team_id,date,start_time,end_time,area,area_text,category,is_closed"
          )
          .in("host_team_id", myTeamIds)
          .gte("date", selectedDate || today)
          .order("date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(200);

        const { data: hostedSlotsRaw, error: hostedSlotsError } =
          selectedDate
            ? await hostedSlotsQuery.eq("date", selectedDate)
            : await hostedSlotsQuery;

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
          hostedAcceptedRequests = toArray(
            hostedAcceptedRaw,
            toMatchRequestRow
          );
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
          const requesterSlotsQuery = supabase
            .from("match_slots")
            .select(
              "id,host_team_id,date,start_time,end_time,area,area_text,category,is_closed"
            )
            .in("id", requesterSlotIds)
            .gte("date", selectedDate || today)
            .order("date", { ascending: true })
            .order("start_time", { ascending: true });

          const { data: requesterSlotsRaw, error: requesterSlotsError } =
            selectedDate
              ? await requesterSlotsQuery.eq("date", selectedDate)
              : await requesterSlotsQuery;

          if (requesterSlotsError) throw requesterSlotsError;
          requesterSlots = toArray(requesterSlotsRaw, toMatchSlotRow);
        }

        const requesterAcceptedBySlotId = new Map<string, MatchRequestRow>();
        for (const req of requesterAccepted) {
          if (!requesterAcceptedBySlotId.has(req.slot_id)) {
            requesterAcceptedBySlotId.set(req.slot_id, req);
          }
        }

        const hostedItems: MyScheduleItem[] = hostedSlots
          .filter((slot) => hostedAcceptedBySlotId.has(slot.id))
          .map((slot) => {
            const acceptedReq = hostedAcceptedBySlotId.get(slot.id)!;
            const opponentTeam = teamMap.get(acceptedReq.requester_team_id);

            return {
              id: slot.id,
              slotId: slot.id,
              date: slot.date,
              startTime: slot.start_time,
              endTime: slot.end_time,
              category:
                categoryLabel(slot.category) || slot.category || "未設定",
              opponent: opponentTeam?.name || "対戦相手未設定",
              strength: teamStrengthLabel(opponentTeam),
              venueName: slot.area_text || slot.area || null,
              address: slot.area_text || slot.area || null,
              meetupTime: null,
              dissolveTime: null,
              parking: null,
              belongings: null,
              note: null,
              threadId: null,
              status: "confirmed",
              role: "host",
            };
          });

        const requesterItems: MyScheduleItem[] = requesterSlots.map((slot) => {
          const acceptedReq = requesterAcceptedBySlotId.get(slot.id);
          const hostTeam = teamMap.get(slot.host_team_id);

          return {
            id: slot.id,
            slotId: slot.id,
            date: slot.date,
            startTime: slot.start_time,
            endTime: slot.end_time,
            category:
              categoryLabel(slot.category) || slot.category || "未設定",
            opponent: hostTeam?.name || "対戦相手未設定",
            strength: teamStrengthLabel(hostTeam),
            venueName: slot.area_text || slot.area || null,
            address: slot.area_text || slot.area || null,
            meetupTime: null,
            dissolveTime: null,
            parking: null,
            belongings: null,
            note: null,
            threadId: null,
            status: acceptedReq?.status === "accepted" ? "confirmed" : "draft",
            role: "guest",
          };
        });

        const merged = [...hostedItems, ...requesterItems].sort((a, b) => {
          const aa = `${a.date} ${a.startTime ?? ""}`;
          const bb = `${b.date} ${b.startTime ?? ""}`;
          return aa.localeCompare(bb);
        });

        const deduped: MyScheduleItem[] = [];
        const seen = new Set<string>();

        for (const item of merged) {
          if (seen.has(item.slotId)) continue;
          seen.add(item.slotId);
          deduped.push(item);
        }

        if (!active) return;
        setSchedules(deduped);
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
  }, [authLoading, userId, selectedDate]);

  const groupedSchedules = useMemo(() => {
    const map = new Map<string, MyScheduleItem[]>();

    schedules.forEach((s) => {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    });

    return Array.from(map.entries());
  }, [schedules]);

  return (
    <main style={pageWrap}>
      <AppTabNav />

      <AppHero
        icon="🗓"
        title={
          selectedDate
            ? `日別予定（${formatDateLabel(selectedDate)}）`
            : "予定一覧"
        }
        desc={
          selectedDate
            ? "選択した日の予定を確認できます。"
            : "チームの試合予定を一覧で確認できます。"
        }
      />

      <div style={topNavWrap}>
        <Link href="/match/my-schedule/calendar" className="sh-btn">
          カレンダー
        </Link>
        {selectedDate ? (
          <Link href="/match/my-schedule" className="sh-btn sh-btn--primary">
            予定一覧
          </Link>
        ) : null}
      </div>

      {selectedDate ? (
        <div style={filterBar}>
          <div style={filterText}>
            絞り込み中：<b>{formatDateLabel(selectedDate)}</b>
          </div>

          <button
            type="button"
            className="sh-btn"
            onClick={() => {
              window.location.href = "/match/my-schedule";
            }}
          >
            絞り込み解除
          </button>
        </div>
      ) : null}

      {errorText ? (
        <div style={errorBox} className="ui-card">
          <div style={errorTitle} className="ui-title">読み込みエラー</div>
          <div className="ui-body">{errorText}</div>
        </div>
      ) : null}

      {loading || authLoading ? (
        <div style={emptyBox} className="ui-meta">読み込み中…</div>
      ) : !userId ? (
        <div style={emptyBox} className="ui-meta">
          ログイン後に表示されます
        </div>
      ) : schedules.length === 0 ? (
        <div style={emptyBox} className="ui-meta">
          {selectedDate
            ? "この日の予定はありません"
            : "直近の予定はありません"}
        </div>
      ) : (
        <section style={sectionWrap}>
          {groupedSchedules.map(([date, items]) => (
            <section key={date} style={dateSection}>
              <div style={dateTitleRow}>
                <div style={dateTitle} className="ui-title">
                  {formatDateLabel(date)}
                </div>
              </div>

              <div style={dateList}>
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    style={scheduleCard}
                    className="ui-card"
                    onClick={() => {
                      window.location.href = `/match/${item.slotId}`;
                    }}
                  >
                    <div style={scheduleCardTop}>
                      <div style={timeText} className="ui-title">
                        {formatTime(item.startTime)}
                        {item.endTime ? `–${formatTime(item.endTime)}` : ""}
                      </div>

                      <div style={badgeRow}>
                        <span
                          style={
                            item.status === "confirmed"
                              ? confirmedBadge
                              : draftBadge
                          }
                        >
                          {statusLabel(item.status)}
                        </span>

                        <span style={roleBadge}>
                          {item.role === "host" ? "主催" : "参加"}
                        </span>
                      </div>
                    </div>

                    <div style={mainInfo} className="ui-body">
                      <div>
                        <b>カテゴリ</b>：{item.category || "未設定"}
                      </div>
                      <div>
                        <b>対戦相手</b>：{item.opponent || "未設定"}
                      </div>
                      <div>
                        <b>強さ</b>：{item.strength || "未設定"}
                      </div>
                    </div>

                    <div style={subInfo} className="ui-meta">
                      <div>
                        <b>会場</b>：{item.venueName || "未設定"}
                      </div>
                      <div>
                        <b>住所</b>：{item.address || "未設定"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </section>
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

const filterBar: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  padding: 12,
  borderRadius: 12,
  border: "1px solid #dbeafe",
  background: "#eff6ff",
};

const filterText: React.CSSProperties = {
  color: "#1e3a8a",
  fontSize: 14,
  lineHeight: 1.6,
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

const sectionWrap: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gap: 14,
};

const dateSection: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const dateTitleRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const dateTitle: React.CSSProperties = {
  fontSize: 18,
};

const dateList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const scheduleCard: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: 14,
  borderRadius: 14,
  cursor: "pointer",
  border: "1px solid #e5e7eb",
  background: "#fff",
};

const scheduleCardTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const badgeRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  alignItems: "center",
};

const timeText: React.CSSProperties = {
  fontSize: 16,
};

const mainInfo: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gap: 4,
  lineHeight: 1.7,
};

const subInfo: React.CSSProperties = {
  marginTop: 8,
  display: "grid",
  gap: 4,
  lineHeight: 1.7,
};

const confirmedBadge: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 700,
};

const draftBadge: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "#f3f4f6",
  color: "#4b5563",
  fontWeight: 700,
};

const roleBadge: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "#eef6f0",
  color: "#14532d",
  fontWeight: 700,
};