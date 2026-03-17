"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { getOrCreateThread } from "@/app/lib/chat";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";

type MatchRequestRow = {
  id: string;
  slot_id: string;
  requester_team_id: string;
  requester_user_id: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  comment: string | null;
  created_at: string;
};

type MatchSlotRow = {
  id: string;
  host_team_id: string;
  owner_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  area: string | null;
  area_text?: string | null;
  category: string | null;
  is_closed: boolean | null;
};

type TeamRow = {
  id: string;
  owner_id: string | null;
  name: string | null;
  category: string | null;
};

type ReceivedOfferCard = {
  request: MatchRequestRow;
  slot: MatchSlotRow;
  requesterTeam: TeamRow | null;
};

export default function ReceivedOffersPage() {
  const router = useRouter();

  const [meId, setMeId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<MatchRequestRow[]>([]);
  const [slots, setSlots] = useState<MatchSlotRow[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMeId(data?.user?.id ?? "");
    })();
  }, []);

  const load = async () => {
    if (!meId) return;

    setLoading(true);
    try {
      const { data: myTeamsData } = await supabase
        .from("teams")
        .select("id, owner_id, name, category")
        .eq("owner_id", meId);

      const myTeamIds = (myTeamsData ?? []).map((t: any) => t.id);

      if (myTeamIds.length === 0) {
        setRequests([]);
        setSlots([]);
        setTeams([]);
        setLoading(false);
        return;
      }

      const { data: slotsData } = await supabase
        .from("match_slots")
        .select("id, host_team_id, owner_id, date, start_time, end_time, area, area_text, category, is_closed")
        .in("host_team_id", myTeamIds)
        .order("date", { ascending: true });

      const slotIds = (slotsData ?? []).map((s: any) => s.id);

      if (slotIds.length === 0) {
        setRequests([]);
        setSlots((slotsData ?? []) as MatchSlotRow[]);
        setTeams((myTeamsData ?? []) as TeamRow[]);
        setLoading(false);
        return;
      }

      const { data: requestsData } = await supabase
        .from("match_requests")
        .select("id, slot_id, requester_team_id, requester_user_id, status, comment, created_at")
        .in("slot_id", slotIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      const requesterTeamIds = Array.from(
        new Set((requestsData ?? []).map((r: any) => r.requester_team_id).filter(Boolean))
      );

      let requesterTeams: TeamRow[] = [];
      if (requesterTeamIds.length > 0) {
        const { data } = await supabase
          .from("teams")
          .select("id, owner_id, name, category")
          .in("id", requesterTeamIds);

        requesterTeams = (data ?? []) as TeamRow[];
      }

      setRequests((requestsData ?? []) as MatchRequestRow[]);
      setSlots((slotsData ?? []) as MatchSlotRow[]);
      setTeams([...(myTeamsData ?? []), ...requesterTeams] as TeamRow[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [meId]);

  const receivedOffers = useMemo<ReceivedOfferCard[]>(() => {
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    const teamMap = new Map(teams.map((t) => [t.id, t]));

    return requests
      .map((req) => {
        const slot = slotMap.get(req.slot_id);
        if (!slot) return null;

        return {
          request: req,
          slot,
          requesterTeam: teamMap.get(req.requester_team_id) ?? null,
        };
      })
      .filter(Boolean) as ReceivedOfferCard[];
  }, [requests, slots, teams]);

  const approve = async (req: MatchRequestRow) => {
    const ok = window.confirm("このオファーを承認しますか？");
    if (!ok) return;

    try {
      const slot = slots.find((s) => s.id === req.slot_id);
      if (!slot) {
        alert("対象の募集が見つかりません");
        return;
      }

      await supabase
        .from("match_requests")
        .update({ status: "accepted" })
        .eq("id", req.id);

      await supabase
        .from("match_slots")
        .update({ is_closed: true })
        .eq("id", req.slot_id);

      await supabase
        .from("match_requests")
        .update({ status: "rejected" })
        .eq("slot_id", req.slot_id)
        .neq("id", req.id);

      const { data: me } = await supabase.auth.getUser();
      const myUserId = me?.user?.id ?? null;

      const requesterTeam = teams.find((t) => t.id === req.requester_team_id);
      const requesterUserId = requesterTeam?.owner_id ?? req.requester_user_id ?? null;

      const threadId = await getOrCreateThread({
        slotId: req.slot_id,
        teamAId: req.requester_team_id,
        teamBId: slot.host_team_id,
      });

      const membersToUpsert = [
        myUserId ? { thread_id: threadId, user_id: myUserId } : null,
        requesterUserId ? { thread_id: threadId, user_id: requesterUserId } : null,
      ].filter(Boolean);

      if (membersToUpsert.length > 0) {
        await supabase.from("chat_members").upsert(membersToUpsert as any[], {
          onConflict: "thread_id,user_id",
        });
      }

      await supabase.from("chat_messages").insert({
        thread_id: threadId,
        sender_id: myUserId,
        body: "試合が成立しました。こちらで詳細を調整しましょう。",
      });

      router.push(`/chat/${threadId}`);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "承認に失敗しました");
    }
  };

  const reject = async (req: MatchRequestRow) => {
    const ok = window.confirm("このオファーを辞退しますか？");
    if (!ok) return;

    try {
      await supabase
        .from("match_requests")
        .update({ status: "rejected" })
        .eq("id", req.id);

      await load();
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "辞退に失敗しました");
    }
  };

  return (
    <main style={wrap}>
      <AppTabNav />

      <AppHero
        icon="📩"
        title="オファー受信"
        desc="相手チームから届いた試合オファーを確認し、承認または辞退できます。"
      />

      <section style={sectionCard}>
        {loading ? (
          <div style={emptyText}>読み込み中…</div>
        ) : receivedOffers.length === 0 ? (
          <div style={emptyText}>現在、受信中のオファーはありません。</div>
        ) : (
          <div style={listWrap}>
            {receivedOffers.map(({ request, slot, requesterTeam }) => (
              <div key={request.id} style={card}>
                <div style={titleRow}>
                  <div style={cardTitle}>
                    {requesterTeam?.name ?? "チーム未設定"} からのオファー
                  </div>
                  <div style={statusBadge}>pending</div>
                </div>

                <div style={meta}>
                  <div>
                    {slot.date} {slot.start_time?.slice(0, 5)}-{slot.end_time?.slice(0, 5)}
                  </div>
                  <div>{slot.area_text ?? slot.area ?? "エリア未設定"}</div>
                  <div>カテゴリ: {slot.category ?? "未設定"}</div>
                  {request.comment ? <div>コメント: {request.comment}</div> : null}
                </div>

                <div style={buttonRow}>
                  <button type="button" className="sh-btn sh-btn--primary" onClick={() => approve(request)}>
                    承認してチャットへ
                  </button>
                  <button type="button" className="sh-btn" onClick={() => reject(request)}>
                    辞退
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
};

const sectionCard: React.CSSProperties = {
  marginTop: 12,
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#fff",
  padding: 16,
};

const listWrap: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#fff",
  padding: 16,
};

const titleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  flexWrap: "wrap",
};

const cardTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
};

const statusBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 999,
  background: "#ecfdf3",
  color: "#166534",
  fontWeight: 800,
  fontSize: 12,
};

const meta: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gap: 6,
  color: "#444",
  lineHeight: 1.7,
};

const buttonRow: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const emptyText: React.CSSProperties = {
  color: "#777",
  fontSize: 14,
};