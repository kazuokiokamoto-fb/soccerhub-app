"use client";

import React, { useEffect, useMemo, useState } from "react";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import { categoryLabel } from "@/app/lib/categories";

type ScheduleRow = {
  slotId: string;
  date: string;
  startTime: string;
  endTime: string;
  areaText: string;
  categoryText: string;
  role: "host" | "guest";
};

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

export default function MySchedulePage() {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
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

        const myTeamIds = ((myTeamsRaw ?? []) as Array<{ id: string }>).map(
          (row) => row.id
        );

        if (myTeamIds.length === 0) {
          if (active) {
            setSchedules([]);
            setLoading(false);
          }
          return;
        }

        const today = ymdToday();

        const { data: hostedSlotsRaw, error: hostedSlotsError } = await supabase
          .from("match_slots")
          .select(
            "id, date, start_time, end_time, area, area_text, category, host_team_id"
          )
          .in("host_team_id", myTeamIds)
          .gte("date", today)
          .order("date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(100);

        if (hostedSlotsError) throw hostedSlotsError;

        const hostedSlots = (hostedSlotsRaw ?? []) as any[];
        const hostedSlotIds = hostedSlots.map((slot) => slot.id);

        let hostedAcceptedSlotIds: string[] = [];
        if (hostedSlotIds.length > 0) {
          const { data: hostedAcceptedRaw, error: hostedAcceptedError } =
            await supabase
              .from("match_requests")
              .select("slot_id")
              .in("slot_id", hostedSlotIds)
              .eq("status", "accepted");

          if (hostedAcceptedError) throw hostedAcceptedError;

          hostedAcceptedSlotIds = Array.from(
            new Set(
              ((hostedAcceptedRaw ?? []) as Array<{ slot_id: string }>).map(
                (row) => row.slot_id
              )
            )
          );
        }

        const { data: requesterAcceptedRaw, error: requesterAcceptedError } =
          await supabase
            .from("match_requests")
            .select("slot_id, requester_team_id")
            .in("requester_team_id", myTeamIds)
            .eq("status", "accepted");

        if (requesterAcceptedError) throw requesterAcceptedError;

        const requesterAccepted = (requesterAcceptedRaw ?? []) as Array<{
          slot_id: string;
          requester_team_id: string;
        }>;

        const requesterSlotIds = Array.from(
          new Set(requesterAccepted.map((row) => row.slot_id))
        ).filter((id) => !hostedSlotIds.includes(id));

        let requesterSlots: any[] = [];
        if (requesterSlotIds.length > 0) {
          const { data: requesterSlotsRaw, error: requesterSlotsError } =
            await supabase
              .from("match_slots")
              .select(
                "id, date, start_time, end_time, area, area_text, category, host_team_id"
              )
              .in("id", requesterSlotIds)
              .gte("date", today)
              .order("date", { ascending: true })
              .order("start_time", { ascending: true });

          if (requesterSlotsError) throw requesterSlotsError;
          requesterSlots = (requesterSlotsRaw ?? []) as any[];
        }

        const hostedItems: ScheduleRow[] = hostedSlots
          .filter((slot) => hostedAcceptedSlotIds.includes(slot.id))
          .map((slot) => ({
            slotId: slot.id,
            date: String(slot.date ?? ""),
            startTime: String(slot.start_time ?? ""),
            endTime: String(slot.end_time ?? ""),
            areaText: String(slot.area_text ?? slot.area ?? "未設定"),
            categoryText: String(
              categoryLabel(slot.category) || slot.category || "未設定"
            ),
            role: "host" as const,
          }));

        const requesterItems: ScheduleRow[] = requesterSlots.map((slot) => ({
          slotId: slot.id,
          date: String(slot.date ?? ""),
          startTime: String(slot.start_time ?? ""),
          endTime: String(slot.end_time ?? ""),
          areaText: String(slot.area_text ?? slot.area ?? "未設定"),
          categoryText: String(
            categoryLabel(slot.category) || slot.category || "未設定"
          ),
          role: "guest" as const,
        }));

        const merged = [...hostedItems, ...requesterItems]
          .filter((item) => !!item.date)
          .sort((a, b) => {
            const aa = `${a.date} ${a.startTime}`;
            const bb = `${b.date} ${b.startTime}`;
            return aa.localeCompare(bb);
          });

        const deduped: ScheduleRow[] = [];
        const seen = new Set<string>();

        for (const item of merged) {
          if (seen.has(item.slotId)) continue;
          seen.add(item.slotId);
          deduped.push(item);
        }

        if (!active) return;
        setSchedules(deduped);
      } catch (e: any) {
        console.error("[my schedule] load error:", e);
        if (!active) return;
        setSchedules([]);
        setErrorText(e?.message ?? "予定の取得に失敗しました");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [authLoading, userId]);

  const groupedSchedules = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>();

    for (const item of schedules) {
      if (!map.has(item.date)) {
        map.set(item.date, []);
      }
      map.get(item.date)!.push(item);
    }

    return Array.from(map.entries());
  }, [schedules]);

  return (
    <main style={pageWrap}>
      <AppTabNav />

      <AppHero
        icon="🗓"
        title="マイスケジュール"
        desc="成立済みの直近予定を一覧表示します。"
      />

      {errorText ? (
        <div style={errorBox}>
          <div style={errorTitle}>読み込みエラー</div>
          <div>{errorText}</div>
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={() => window.location.reload()}
            >
              再読み込み
            </button>
          </div>
        </div>
      ) : null}

      {loading || authLoading ? (
        <div style={emptyBox}>読み込み中…</div>
      ) : !userId ? (
        <div style={emptyBox}>
          ログイン後にマイスケジュールを表示できます。
        </div>
      ) : schedules.length === 0 ? (
        <div style={emptyBox}>
          直近の予定はありません。
        </div>
      ) : (
        <section style={sectionWrap}>
          {groupedSchedules.map(([date, items]) => (
            <section key={date} style={dateSection}>
              <div style={dateTitle}>{formatDateLabel(date)}</div>

              <div style={dateList}>
                {items.map((item) => (
                  <button
                    key={item.slotId}
                    type="button"
                    style={scheduleCard}
                    onClick={() => {
                      window.location.href = `/match?date=${encodeURIComponent(item.date)}&slotId=${encodeURIComponent(item.slotId)}`;
                    }}
                  >
                    <div style={scheduleCardTop}>
                      <div style={timeText}>
                        {item.startTime.slice(0, 5)}–{item.endTime.slice(0, 5)}
                      </div>

                      <span style={item.role === "host" ? hostBadge : guestBadge}>
                        {item.role === "host" ? "主催" : "参加"}
                      </span>
                    </div>

                    <div style={metaText}>{item.categoryText}</div>
                    <div style={areaText}>{item.areaText}</div>
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

const errorBox: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  lineHeight: 1.7,
};

const errorTitle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 4,
};

const emptyBox: React.CSSProperties = {
  marginTop: 14,
  padding: 18,
  borderRadius: 14,
  border: "1px solid #e5ece7",
  background: "#fff",
  color: "#666",
  lineHeight: 1.7,
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
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.3,
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
  border: "1px solid #dce9df",
  background: "#fff",
  cursor: "pointer",
};

const scheduleCardTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const timeText: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "#14532d",
  lineHeight: 1.4,
};

const metaText: React.CSSProperties = {
  marginTop: 8,
  fontSize: 14,
  fontWeight: 700,
  color: "#2f5d3a",
  lineHeight: 1.5,
};

const areaText: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "#5f6f66",
  lineHeight: 1.6,
};

const hostBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  padding: "0 8px",
  borderRadius: 999,
  background: "#ecfdf3",
  color: "#166534",
  fontSize: 12,
  fontWeight: 900,
  border: "1px solid #bbf7d0",
};

const guestBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
  padding: "0 8px",
  borderRadius: 999,
  background: "#eef6f0",
  color: "#14532d",
  fontSize: 12,
  fontWeight: 900,
  border: "1px solid #dce9df",
};