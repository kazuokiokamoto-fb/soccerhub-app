"use client";

import React, { useEffect, useMemo, useState } from "react";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import { useSearchParams } from "next/navigation";
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

function toArray<T>(
  value: unknown,
  mapper: (v: unknown) => T | null
): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(mapper).filter((v): v is T => v !== null);
}

function toTeamScheduleRow(value: unknown): TeamScheduleRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const team_id = asString(r.team_id);

  if (!id || !team_id) return null;

  const rawStatus = asNullableString(r.status);
  const status: ScheduleStatus =
    rawStatus === "confirmed" ? "confirmed" : "draft";

  return {
    id,
    team_id,
    category: asNullableString(r.category),
    opponent: asNullableString(r.opponent),
    strength: asNullableString(r.strength),
    date: asNullableString(r.date),
    venue_name: asNullableString(r.venue_name),
    address: asNullableString(r.address),
    meetup_time: asNullableString(r.meetup_time),
    dissolve_time: asNullableString(r.dissolve_time),
    start_time: asNullableString(r.start_time),
    end_time: asNullableString(r.end_time),
    parking: asNullableString(r.parking),
    belongings: asNullableString(r.belongings),
    note: asNullableString(r.note),
    thread_id: asNullableString(r.thread_id),
    status,
    google_event_id: asNullableString(r.google_event_id),
    created_at: asNullableString(r.created_at),
    updated_at: asNullableString(r.updated_at),
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

function statusLabel(status?: ScheduleStatus | null) {
  if (status === "confirmed") return "確定";
  return "下書き";
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

export default function MyScheduleInner() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();

  const userId = user?.id ?? "";
  const selectedDate = searchParams.get("date");

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<TeamSchedule[]>([]);
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

        const myTeamIds = toArray(myTeamsRaw, (row): TeamIdRow | null => {
          const r = asRecord(row);
          if (!r) return null;
          const id = asString(r.id);
          if (!id) return null;
          return { id };
        }).map((row) => row.id);

        if (myTeamIds.length === 0) {
          if (active) {
            setSchedules([]);
            setLoading(false);
          }
          return;
        }

        let query = supabase
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
          .order("date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(200);

        if (selectedDate) {
          query = query.eq("date", selectedDate);
        } else {
          query = query.gte("date", ymdToday());
        }

        const { data, error } = await query;

        if (error) throw error;

        const rows = toArray(data, toTeamScheduleRow);
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
  }, [authLoading, userId, selectedDate]);

  const groupedSchedules = useMemo(() => {
    const map = new Map<string, TeamSchedule[]>();

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
            ? `予定一覧（${formatDateLabel(selectedDate)}）`
            : "予定一覧"
        }
        desc={
          selectedDate
            ? "選択した日の予定を一覧で確認できます。"
            : "チームの試合予定を一覧で確認できます。"
        }
      />

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
              <div style={dateTitle} className="ui-title">
                {formatDateLabel(date)}
              </div>

              <div style={dateList}>
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    style={scheduleCard}
                    className="ui-card"
                    onClick={() => {
                      window.location.href = `/match/my-schedule/${item.id}`;
                    }}
                  >
                    <div style={scheduleCardTop}>
                      <div style={timeText} className="ui-title">
                        {formatTime(item.startTime)}
                        {item.endTime ? `–${formatTime(item.endTime)}` : ""}
                      </div>

                      <span
                        style={
                          item.status === "confirmed"
                            ? confirmedBadge
                            : draftBadge
                        }
                      >
                        {statusLabel(item.status)}
                      </span>
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
                        <b>会場名</b>：{item.venueName || "未設定"}
                      </div>
                      <div>
                        <b>住所</b>：{item.address || "未設定"}
                      </div>
                      <div>
                        <b>集合</b>：{formatTime(item.meetupTime) || "未設定"}　
                        <b>解散</b>：{formatTime(item.dissolveTime) || "未設定"}
                      </div>
                    </div>

                    {item.parking || item.belongings || item.note ? (
                      <div style={extraInfo} className="ui-meta">
                        {item.parking ? (
                          <div>
                            <b>駐輪場・駐車場</b>：{item.parking}
                          </div>
                        ) : null}
                        {item.belongings ? (
                          <div>
                            <b>持ち物</b>：{item.belongings}
                          </div>
                        ) : null}
                        {item.note ? (
                          <div>
                            <b>備考</b>：{item.note}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {item.threadId ? (
                      <div style={threadText} className="ui-meta">
                        元チャットあり
                      </div>
                    ) : null}
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

const extraInfo: React.CSSProperties = {
  marginTop: 8,
  display: "grid",
  gap: 4,
  lineHeight: 1.7,
  paddingTop: 8,
  borderTop: "1px solid #eef2f7",
};

const threadText: React.CSSProperties = {
  marginTop: 10,
  color: "#166534",
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