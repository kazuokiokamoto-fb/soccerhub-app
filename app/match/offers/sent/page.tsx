"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";
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

type SentOfferCard = {
  request: MatchRequestRow;
  slot: MatchSlotRow;
  myTeam: TeamRow | null;
  hostTeam: TeamRow | null;
};

export default function SentOffersPage() {
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

      const { data: requestsData } = await supabase
        .from("match_requests")
        .select("id, slot_id, requester_team_id, requester_user_id, status, comment, created_at")
        .in("requester_team_id", myTeamIds)
        .order("created_at", { ascending: false });

      const slotIds = Array.from(
        new Set((requestsData ?? []).map((r: any) => r.slot_id).filter(Boolean))
      );

      let slotsData: MatchSlotRow[] = [];
      if (slotIds.length > 0) {
        const { data } = await supabase
          .from("match_slots")
          .select("id, host_team_id, owner_id, date, start_time, end_time, area, area_text, category, is_closed")
          .in("id", slotIds);

        slotsData = (data ?? []) as MatchSlotRow[];
      }

      const hostTeamIds = Array.from(
        new Set(slotsData.map((s) => s.host_team_id).filter(Boolean))
      );

      let hostTeams: TeamRow[] = [];
      if (hostTeamIds.length > 0) {
        const { data } = await supabase
          .from("teams")
          .select("id, owner_id, name, category")
          .in("id", hostTeamIds);

        hostTeams = (data ?? []) as TeamRow[];
      }

      setRequests((requestsData ?? []) as MatchRequestRow[]);
      setSlots(slotsData);
      setTeams([...(myTeamsData ?? []), ...hostTeams] as TeamRow[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [meId]);

  const sentOffers = useMemo<SentOfferCard[]>(() => {
    const slotMap = new Map(slots.map((s) => [s.id, s]));
    const teamMap = new Map(teams.map((t) => [t.id, t]));

    return requests
      .map((req) => {
        const slot = slotMap.get(req.slot_id);
        if (!slot) return null;

        return {
          request: req,
          slot,
          myTeam: teamMap.get(req.requester_team_id) ?? null,
          hostTeam: teamMap.get(slot.host_team_id) ?? null,
        };
      })
      .filter(Boolean) as SentOfferCard[];
  }, [requests, slots, teams]);

  const cancelOffer = async (req: MatchRequestRow) => {
    const ok = window.confirm("このオファーを取り消しますか？");
    if (!ok) return;

    try {
      const { error } = await supabase
        .from("match_requests")
        .update({ status: "cancelled" })
        .eq("id", req.id);

      if (error) {
        console.error(error);
        alert(`オファー取消に失敗しました: ${error.message}`);
        return;
      }

      await load();
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "オファー取消に失敗しました");
    }
  };

  const statusLabel = (status: MatchRequestRow["status"]) => {
    switch (status) {
      case "pending":
        return "回答待ち";
      case "accepted":
        return "成立";
      case "rejected":
        return "辞退";
      case "cancelled":
        return "取消済み";
      default:
        return status;
    }
  };

  const statusStyle = (status: MatchRequestRow["status"]): React.CSSProperties => {
    if (status === "accepted") {
      return {
        background: "#ecfdf3",
        color: "#166534",
      };
    }

    if (status === "rejected" || status === "cancelled") {
      return {
        background: "#f3f4f6",
        color: "#555",
      };
    }

    return {
      background: "#eff6ff",
      color: "#1d4ed8",
    };
  };

  return (
    <main style={wrap}>
      <AppTabNav />

      <AppHero
        icon="📤"
        title="オファー送信"
        desc="自分が送った試合オファーの状況を確認できます。"
      />

      <section style={sectionCard}>
        {loading ? (
          <div style={emptyText}>読み込み中…</div>
        ) : sentOffers.length === 0 ? (
          <div style={emptyText}>現在、送信中のオファーはありません。</div>
        ) : (
          <div style={listWrap}>
            {sentOffers.map(({ request, slot, myTeam, hostTeam }) => (
              <div key={request.id} style={card}>
                <div style={titleRow}>
                  <div style={cardTitle}>
                    {hostTeam?.name ?? "相手チーム未設定"} へのオファー
                  </div>

                  <div
                    style={{
                      ...statusBadge,
                      ...statusStyle(request.status),
                    }}
                  >
                    {statusLabel(request.status)}
                  </div>
                </div>

                <div style={meta}>
                  <div>送信チーム: {myTeam?.name ?? "未設定"}</div>
                  <div>
                    日時: {slot.date} {slot.start_time?.slice(0, 5)}-{slot.end_time?.slice(0, 5)}
                  </div>
                  <div>場所: {slot.area_text ?? slot.area ?? "エリア未設定"}</div>
                  <div>カテゴリ: {slot.category ?? "未設定"}</div>
                  {request.comment ? <div>コメント: {request.comment}</div> : null}
                </div>

                {request.status === "pending" ? (
                  <div style={buttonRow}>
                    <button type="button" className="sh-btn" onClick={() => cancelOffer(request)}>
                      オファー取消
                    </button>
                  </div>
                ) : null}
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