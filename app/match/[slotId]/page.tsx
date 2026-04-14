"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { categoryLabel } from "@/app/lib/categories";

export default function MatchDetailPage() {
  const params = useParams();
  const slotId = params.slotId as string;

  const [slot, setSlot] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      try {
        // スロット取得
        const { data: slotData, error: slotError } = await supabase
          .from("match_slots")
          .select("*")
          .eq("id", slotId)
          .single();

        if (slotError) throw slotError;
        if (!slotData) {
          setSlot(null);
          return;
        }

        // チーム取得
        const { data: teamData, error: teamError } = await supabase
          .from("teams")
          .select("*")
          .eq("id", slotData.host_team_id)
          .single();

        if (teamError) {
          console.warn("team取得失敗:", teamError);
        }

        setSlot(slotData);
        setTeam(teamData ?? null);
      } catch (e) {
        console.error("詳細ページ取得エラー:", e);
        setSlot(null);
      } finally {
        setLoading(false);
      }
    };

    if (slotId) load();
  }, [slotId]);

  const openChat = async () => {
    if (!slot || !team) return;

    try {
      const { data, error } = await supabase.rpc(
        "rpc_get_or_create_dm_thread",
        {
          my_team_id: team.id,
          other_team_id: team.id,
        }
      );

      if (error) throw error;

      window.location.href = `/chat/${data}`;
    } catch (e) {
      alert("チャットを開けませんでした");
    }
  };

  if (loading) {
    return <div style={wrap}>読み込み中...</div>;
  }

  if (!slot) {
    return <div style={wrap}>データがありません</div>;
  }

  return (
    <div style={wrap}>
      <h2 style={title}>試合詳細</h2>

      <div style={card}>
        <div style={row}>📅 {slot.date}</div>
        <div style={row}>
          ⏰ {slot.start_time?.slice(0, 5)}〜
          {slot.end_time?.slice(0, 5)}
        </div>
        <div style={row}>📍 {slot.area_text || slot.area}</div>
        <div style={row}>🏷 {categoryLabel(slot.category)}</div>
      </div>

      <div style={card}>
        <h3 style={subTitle}>募集チーム</h3>
        <div>{team?.name || "不明"}</div>
      </div>

      <div style={actionRow}>
        <button
          className="sh-btn sh-btn--primary"
          onClick={openChat}
        >
          チャットで連絡
        </button>
      </div>
    </div>
  );
}

/* ================= UI ================= */

const wrap: React.CSSProperties = {
  padding: 16,
  display: "grid",
  gap: 12,
};

const title: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
};

const subTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  marginBottom: 6,
};

const card: React.CSSProperties = {
  padding: 14,
  borderRadius: 12,
  border: "1px solid #dce9df",
  background: "#fff",
  display: "grid",
  gap: 6,
};

const row: React.CSSProperties = {
  fontSize: 14,
};

const actionRow: React.CSSProperties = {
  marginTop: 10,
  display: "flex",
  justifyContent: "flex-end",
};