"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import AppTabNav from "@/app/components/AppTabNav";

type MatchSlotRow = {
  id: string;
  host_team_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_closed: boolean | null;
};

type TeamRow = {
  id: string;
  owner_id: string | null;
  name: string | null;
};

export default function RecruitingPage() {
  const [meId, setMeId] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<MatchSlotRow[]>([]);
  const [teams, setTeams] = useState<Record<string, TeamRow>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMeId(data?.user?.id ?? "");
    })();
  }, []);

  useEffect(() => {
    if (!meId) return;

    (async () => {
      setLoading(true);

      try {
        // 自分のチーム取得
        const { data: teamData } = await supabase
          .from("teams")
          .select("id,owner_id,name")
          .eq("owner_id", meId);

        const myTeams = (teamData ?? []) as TeamRow[];
        const myTeamIds = myTeams.map((t) => t.id);

        const teamMap: Record<string, TeamRow> = {};
        myTeams.forEach((t) => {
          teamMap[t.id] = t;
        });

        setTeams(teamMap);

        if (myTeamIds.length === 0) {
          setSlots([]);
          setLoading(false);
          return;
        }

        // 募集中スロット
        const { data: slotData } = await supabase
          .from("match_slots")
          .select("id,host_team_id,date,start_time,end_time,is_closed")
          .in("host_team_id", myTeamIds)
          .eq("is_closed", false)
          .order("date", { ascending: true });

        setSlots((slotData ?? []) as MatchSlotRow[]);
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
    })();
  }, [meId]);

  return (
    <main style={wrap}>
      <AppTabNav />

      <h1 style={title}>募集中の試合</h1>

      {loading ? (
        <div>読み込み中...</div>
      ) : slots.length === 0 ? (
        <div style={empty}>現在募集中の試合はありません</div>
      ) : (
        <div style={list}>
          {slots.map((slot) => {
            const team = teams[slot.host_team_id];

            return (
              <div key={slot.id} style={card}>
                <div style={cardHeader}>
                  <div style={date}>
                    {formatDate(slot.date)} {formatTime(slot.start_time)}
                  </div>

                  <div style={teamName}>{team?.name ?? "チーム名不明"}</div>
                </div>

                <div style={cardFooter}>
                  <Link
                    href={`/match/slot/${slot.id}`}
                    style={detailBtn}
                  >
                    詳細
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function formatDate(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function formatTime(time?: string | null) {
  if (!time) return "";
  return time.slice(0, 5);
}

const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 900,
  margin: "0 auto",
};

const title: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  marginBottom: 16,
};

const list: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 14,
  background: "#fff",
};

const cardHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 10,
};

const date: React.CSSProperties = {
  fontWeight: 700,
};

const teamName: React.CSSProperties = {
  color: "#666",
};

const cardFooter: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};

const detailBtn: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  background: "#145c2a",
  color: "#fff",
  textDecoration: "none",
  fontSize: 13,
};

const empty: React.CSSProperties = {
  padding: 20,
  textAlign: "center",
  color: "#666",
};