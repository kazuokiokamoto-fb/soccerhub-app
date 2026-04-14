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
          const { data: hostedAcceptedRaw } = await supabase
            .from("match_requests")
            .select("slot_id")
            .in("slot_id", hostedSlotIds)
            .eq("status", "accepted");

          hostedAcceptedSlotIds = Array.from(
            new Set((hostedAcceptedRaw ?? []).map((r: any) => r.slot_id))
          );
        }

        const { data: requesterAcceptedRaw } = await supabase
          .from("match_requests")
          .select("slot_id, requester_team_id")
          .in("requester_team_id", myTeamIds)
          .eq("status", "accepted");

        const requesterSlotIds = Array.from(
          new Set((requesterAcceptedRaw ?? []).map((r: any) => r.slot_id))
        ).filter((id) => !hostedSlotIds.includes(id));

        let requesterSlots: any[] = [];
        if (requesterSlotIds.length > 0) {
          const { data } = await supabase
            .from("match_slots")
            .select(
              "id, date, start_time, end_time, area, area_text, category, host_team_id"
            )
            .in("id", requesterSlotIds)
            .gte("date", today)
            .order("date", { ascending: true })
            .order("start_time", { ascending: true });

          requesterSlots = data ?? [];
        }

        const hostedItems: ScheduleRow[] = hostedSlots
          .filter((s) => hostedAcceptedSlotIds.includes(s.id))
          .map((s) => ({
            slotId: s.id,
            date: s.date || "",
            startTime: s.start_time || "",
            endTime: s.end_time || "",
            areaText: s.area_text ?? s.area ?? "未設定",
            categoryText:
              categoryLabel(s.category || "") || s.category || "未設定",
            role: "host",
          }));

        const requesterItems: ScheduleRow[] = requesterSlots.map((s) => ({
          slotId: s.id,
          date: s.date || "",
          startTime: s.start_time || "",
          endTime: s.end_time || "",
          areaText: s.area_text ?? s.area ?? "未設定",
          categoryText:
            categoryLabel(s.category || "") || s.category || "未設定",
          role: "guest",
        }));

        const merged = [...hostedItems, ...requesterItems].sort((a, b) =>
          `${a.date} ${a.startTime}`.localeCompare(
            `${b.date} ${b.startTime}`
          )
        );

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

  const groupedSchedules = useMemo(() => {
    const map = new Map<string, ScheduleRow[]>();
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
        title="マイスケジュール"
        desc="成立済みの直近予定を一覧表示します。"
      />

      {errorText && (
        <div style={errorBox} className="ui-card">
          <div style={errorTitle} className="ui-title">読み込みエラー</div>
          <div className="ui-body">{errorText}</div>
        </div>
      )}

      {loading || authLoading ? (
        <div style={emptyBox} className="ui-meta">読み込み中…</div>
      ) : !userId ? (
        <div style={emptyBox} className="ui-meta">
          ログイン後に表示されます
        </div>
      ) : schedules.length === 0 ? (
        <div style={emptyBox} className="ui-meta">
          直近の予定はありません
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
                    key={item.slotId}
                    type="button"
                    style={scheduleCard}
                    className="ui-card"
                    onClick={() =>
                      (window.location.href = `/match/${item.slotId}`)
                    }
                  >
                    <div style={scheduleCardTop}>
                      <div style={timeText} className="ui-title">
                        {item.startTime.slice(0, 5)}–
                        {item.endTime.slice(0, 5)}
                      </div>

                      <span
                        style={item.role === "host" ? hostBadge : guestBadge}
                      >
                        {item.role === "host" ? "主催" : "参加"}
                      </span>
                    </div>

                    <div style={metaText} className="ui-body">
                      {item.categoryText}
                    </div>

                    <div style={areaText} className="ui-meta">
                      {item.areaText}
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
};

const scheduleCardTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const timeText: React.CSSProperties = {
  fontSize: 16,
};

const metaText: React.CSSProperties = {
  marginTop: 8,
};

const areaText: React.CSSProperties = {
  marginTop: 4,
};

const hostBadge: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "#ecfdf3",
};

const guestBadge: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "#eef6f0",
};