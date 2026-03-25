"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import AppTabNav from "@/app/components/AppTabNav";
import AppHero from "@/app/components/AppHero";
import PageBackNav from "@/app/components/PageBackNav";

type Team = {
  id: string;
  name: string | null;
  category: string | null;
};

type Offer = {
  id: string;
  slot_id: string | null;
  from_team_id: string;
  to_team_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  message: string | null;
  created_at: string;
};

export default function OfferReceivedPage() {
  const [meId, setMeId] = useState("");
  const [loading, setLoading] = useState(true);

  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [teamMap, setTeamMap] = useState<Map<string, Team>>(new Map());

  const [openId, setOpenId] = useState("");
  const [updatingId, setUpdatingId] = useState("");

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

      const { data: teams, error: teamsErr } = await supabase
        .from("teams")
        .select("id,name,category")
        .eq("owner_id", meId);

      if (teamsErr) {
        console.error(teamsErr);
        setMyTeams([]);
        setOffers([]);
        setTeamMap(new Map());
        setLoading(false);
        return;
      }

      const myTeamRows = (teams ?? []) as Team[];
      setMyTeams(myTeamRows);

      const myTeamIds = myTeamRows.map((t) => t.id).filter(Boolean);

      if (myTeamIds.length === 0) {
        setOffers([]);
        setTeamMap(new Map());
        setLoading(false);
        return;
      }

      const { data: offerRows, error: offersErr } = await supabase
        .from("match_offers")
        .select("*")
        .in("to_team_id", myTeamIds)
        .order("created_at", { ascending: false });

      if (offersErr) {
        console.error(offersErr);
        setOffers([]);
        setTeamMap(new Map());
        setLoading(false);
        return;
      }

      const offerData = (offerRows ?? []) as Offer[];
      setOffers(offerData);

      const teamIds = Array.from(
        new Set([
          ...offerData.map((o) => o.from_team_id),
          ...offerData.map((o) => o.to_team_id),
        ].filter(Boolean))
      );

      if (teamIds.length > 0) {
        const { data: teamRows, error: teamErr } = await supabase
          .from("teams")
          .select("id,name,category")
          .in("id", teamIds);

        if (teamErr) {
          console.error(teamErr);
          setTeamMap(new Map());
        } else {
          const map = new Map<string, Team>();
          ((teamRows ?? []) as Team[]).forEach((t) => map.set(t.id, t));
          setTeamMap(map);
        }
      } else {
        setTeamMap(new Map());
      }

      setLoading(false);
    })();
  }, [meId]);

  const counts = useMemo(() => {
    return {
      pending: offers.filter((o) => o.status === "pending").length,
      accepted: offers.filter((o) => o.status === "accepted").length,
      rejected: offers.filter((o) => o.status === "rejected").length,
      cancelled: offers.filter((o) => o.status === "cancelled").length,
    };
  }, [offers]);

  const updateStatus = async (
    offerId: string,
    nextStatus: "accepted" | "rejected"
  ) => {
    const confirmText =
      nextStatus === "accepted"
        ? "この招待を承認しますか？"
        : "この招待を見送りしますか？";

    if (!window.confirm(confirmText)) return;

    setUpdatingId(offerId);

    const { error } = await supabase
      .from("match_offers")
      .update({ status: nextStatus })
      .eq("id", offerId);

    if (error) {
      console.error(error);
      alert(
        nextStatus === "accepted"
          ? `承認に失敗しました: ${error.message}`
          : `見送りに失敗しました: ${error.message}`
      );
      setUpdatingId("");
      return;
    }

    setOffers((prev) =>
      prev.map((o) => (o.id === offerId ? { ...o, status: nextStatus } : o))
    );
    setUpdatingId("");
  };

  return (
    <main style={wrap}>
      <AppTabNav />
      <PageBackNav current="届いた招待" />

      <AppHero
        icon="📥"
        title="届いた招待"
        desc="相手チームから届いた試合招待一覧です。"
      />

      <div style={summary}>
        <Stat label="未対応" value={counts.pending} />
        <Stat label="承認" value={counts.accepted} />
        <Stat label="見送り" value={counts.rejected} />
        <Stat label="取消" value={counts.cancelled} />
      </div>

      {loading ? <div style={infoText}>読み込み中…</div> : null}

      {!loading && myTeams.length === 0 ? (
        <div style={empty}>自分のチームがまだ登録されていません</div>
      ) : null}

      {!loading && myTeams.length > 0 && offers.length === 0 ? (
        <div style={empty}>届いた招待はまだありません</div>
      ) : null}

      <div style={list}>
        {offers.map((o) => {
          const fromTeam = teamMap.get(o.from_team_id);
          const toTeam = teamMap.get(o.to_team_id);
          const expanded = openId === o.id;
          const isPending = o.status === "pending";
          const busy = updatingId === o.id;

          return (
            <div key={o.id} style={card}>
              <div style={titleRow}>
                <div>
                  <div style={teamName}>
                    {fromTeam?.name ?? "相手チーム"}
                  </div>
                  <div style={subText}>
                    宛先：{toTeam?.name ?? "自チーム"}
                  </div>
                </div>

                <span style={badge(o.status)}>
                  {label(o.status)}
                </span>
              </div>

              <div style={meta}>受信日時：{fmt(o.created_at)}</div>

              <div style={btnRow}>
                <button
                  className="sh-btn"
                  type="button"
                  onClick={() => setOpenId(expanded ? "" : o.id)}
                >
                  {expanded ? "閉じる" : "詳細"}
                </button>

                <Link href="/chat" className="sh-btn sh-btn--primary">
                  チャット
                </Link>

                {isPending ? (
                  <>
                    <button
                      className="sh-btn sh-btn--primary"
                      type="button"
                      onClick={() => updateStatus(o.id, "accepted")}
                      disabled={busy}
                    >
                      {busy ? "更新中…" : "承認"}
                    </button>

                    <button
                      className="sh-btn"
                      type="button"
                      onClick={() => updateStatus(o.id, "rejected")}
                      disabled={busy}
                    >
                      {busy ? "更新中…" : "見送り"}
                    </button>
                  </>
                ) : null}
              </div>

              {expanded ? (
                <div style={detail}>
                  <div style={detailBlock}>
                    <div style={detailLabel}>送信チーム</div>
                    <div style={detailValue}>
                      {fromTeam?.name ?? "相手チーム"}
                      {fromTeam?.category ? `（${fromTeam.category}）` : ""}
                    </div>
                  </div>

                  <div style={detailBlock}>
                    <div style={detailLabel}>受信チーム</div>
                    <div style={detailValue}>
                      {toTeam?.name ?? "自チーム"}
                      {toTeam?.category ? `（${toTeam.category}）` : ""}
                    </div>
                  </div>

                  <div style={detailBlock}>
                    <div style={detailLabel}>メッセージ</div>
                    <div style={detailValue}>{o.message || "なし"}</div>
                  </div>

                  <div style={detailBlock}>
                    <div style={detailLabel}>送信日時</div>
                    <div style={detailValue}>{fmt(o.created_at)}</div>
                  </div>

                  {o.slot_id ? (
                    <div style={detailBlock}>
                      <div style={detailLabel}>関連募集ID</div>
                      <div style={detailValue}>{o.slot_id}</div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </main>
  );
}

function label(s: string) {
  switch (s) {
    case "pending":
      return "未対応";
    case "accepted":
      return "承認";
    case "rejected":
      return "見送り";
    case "cancelled":
      return "取消";
    default:
      return s;
  }
}

function badge(s: string): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };

  if (s === "pending") return { ...base, background: "#fef3c7", color: "#92400e" };
  if (s === "accepted") return { ...base, background: "#dcfce7", color: "#166534" };
  if (s === "rejected") return { ...base, background: "#fee2e2", color: "#991b1b" };
  return { ...base, background: "#eee", color: "#444" };
}

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString("ja-JP");
  } catch {
    return dt;
  }
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={statBox}>
      <div style={statLabel}>{label}</div>
      <div style={statValue}>{value}</div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
};

const summary: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
  marginTop: 12,
};

const statBox: React.CSSProperties = {
  background: "#fff",
  padding: 10,
  borderRadius: 12,
  border: "1px solid #e5ece7",
};

const statLabel: React.CSSProperties = {
  fontSize: 12,
  color: "#5b6d61",
  fontWeight: 800,
};

const statValue: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#145c2a",
  marginTop: 4,
};

const infoText: React.CSSProperties = {
  marginTop: 16,
  color: "#666",
};

const list: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gap: 12,
};

const card: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 16,
  padding: 14,
  background: "#fff",
};

const titleRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
};

const teamName: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  color: "#16391f",
};

const subText: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#666",
};

const meta: React.CSSProperties = {
  fontSize: 12,
  color: "#666",
  marginTop: 8,
};

const btnRow: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const detail: React.CSSProperties = {
  marginTop: 12,
  background: "#fafafa",
  padding: 12,
  borderRadius: 12,
  border: "1px solid #edf1ee",
  display: "grid",
  gap: 12,
};

const detailBlock: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const detailLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
};

const detailValue: React.CSSProperties = {
  fontSize: 14,
  color: "#374151",
  lineHeight: 1.7,
};

const empty: React.CSSProperties = {
  marginTop: 20,
  textAlign: "center",
  color: "#888",
  padding: 20,
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: 16,
};