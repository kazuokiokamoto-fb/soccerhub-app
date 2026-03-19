"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import AppTabNav from "@/app/components/AppTabNav";

type OfferRow = {
  id: string;
  slot_id: string | null;
  from_team_id: string;
  to_team_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  message: string | null;
  created_at: string;
};

type TeamRow = {
  id: string;
  name: string | null;
  category: string | null;
};

function label(status: OfferRow["status"]) {
  switch (status) {
    case "pending":
      return "送信中";
    case "accepted":
      return "承認";
    case "rejected":
      return "辞退";
    case "cancelled":
      return "取消";
    default:
      return status;
  }
}

function badge(status: OfferRow["status"]): React.CSSProperties {
  if (status === "accepted") {
    return {
      ...badgeBase,
      background: "#ecfdf3",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (status === "rejected") {
    return {
      ...badgeBase,
      background: "#fef2f2",
      color: "#991b1b",
      border: "1px solid #fecaca",
    };
  }

  if (status === "cancelled") {
    return {
      ...badgeBase,
      background: "#f3f4f6",
      color: "#4b5563",
      border: "1px solid #e5e7eb",
    };
  }

  return {
    ...badgeBase,
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
  };
}

function formatDt(dt?: string | null) {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleString("ja-JP");
  } catch {
    return dt;
  }
}

export default function OfferSentPage() {
  const [loading, setLoading] = useState(true);
  const [meId, setMeId] = useState("");
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [teamMap, setTeamMap] = useState<Map<string, TeamRow>>(new Map());
  const [openId, setOpenId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMeId(data?.user?.id ?? "");
    })();
  }, []);

  useEffect(() => {
    if (!meId) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);

      const { data: myTeams, error: myTeamsErr } = await supabase
        .from("teams")
        .select("id")
        .eq("owner_id", meId);

      if (myTeamsErr) {
        console.error(myTeamsErr);
        setOffers([]);
        setLoading(false);
        return;
      }

      const myTeamIds = (myTeams ?? []).map((t: any) => t.id).filter(Boolean);

      if (myTeamIds.length === 0) {
        setOffers([]);
        setLoading(false);
        return;
      }

      const { data: offerRows, error: offerErr } = await supabase
        .from("match_offers")
        .select("id, slot_id, from_team_id, to_team_id, status, message, created_at")
        .in("from_team_id", myTeamIds)
        .order("created_at", { ascending: false });

      if (offerErr) {
        console.error(offerErr);
        setOffers([]);
        setLoading(false);
        return;
      }

      const normalizedOffers = (offerRows ?? []) as OfferRow[];
      setOffers(normalizedOffers);

      const teamIds = Array.from(
        new Set(
          normalizedOffers
            .flatMap((o) => [o.from_team_id, o.to_team_id])
            .filter(Boolean)
        )
      );

      if (teamIds.length > 0) {
        const { data: teamRows, error: teamErr } = await supabase
          .from("teams")
          .select("id, name, category")
          .in("id", teamIds);

        if (teamErr) {
          console.error(teamErr);
        } else {
          const nextMap = new Map<string, TeamRow>();
          for (const t of (teamRows ?? []) as TeamRow[]) {
            nextMap.set(t.id, t);
          }
          setTeamMap(nextMap);
        }
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

  return (
    <main style={wrap}>
      <AppTabNav />

      <div style={topRow}>
        <Link href="/" className="sh-btn">
          ← 戻る
        </Link>
      </div>

      <section style={hero}>
        <div style={heroTitle}>送ったオファー</div>
        <div style={heroDesc}>
          こちらから送ったオファーの状況を確認できます。
        </div>
      </section>

      <section style={summaryCard}>
        <div style={summaryTitle}>ステータス集計</div>
        <div style={statsGrid}>
          <Stat label="送信中" value={counts.pending} />
          <Stat label="承認" value={counts.accepted} />
          <Stat label="辞退" value={counts.rejected} />
          <Stat label="取消" value={counts.cancelled} />
        </div>
      </section>

      {loading ? <div style={loadingText}>読み込み中…</div> : null}

      {offers.length === 0 && !loading ? (
        <div style={empty}>送ったオファーはまだありません。</div>
      ) : null}

      <div style={list}>
        {offers.map((o) => {
          const team = teamMap.get(o.to_team_id);
          const expanded = openId === o.id;

          return (
            <div key={o.id} style={card}>
              <div style={titleRow}>
                <div style={teamName}>
                  {team?.name ?? "相手チーム"}
                  {team?.category ? `（${team.category}）` : ""}
                </div>

                <span style={badge(o.status)}>{label(o.status)}</span>
              </div>

              <div style={meta}>
                送信日時：{formatDt(o.created_at)}
              </div>

              {o.message ? (
                <div style={messagePreview}>
                  {expanded ? o.message : `${o.message.slice(0, 80)}${o.message.length > 80 ? "…" : ""}`}
                </div>
              ) : (
                <div style={messagePreviewMuted}>メッセージなし</div>
              )}

              <div style={buttonRow}>
                <button
                  type="button"
                  className="sh-btn"
                  onClick={() => setOpenId(expanded ? "" : o.id)}
                >
                  {expanded ? "詳細を閉じる" : "詳細"}
                </button>

                <Link
                  href={team ? `/chat` : "/chat"}
                  className="sh-btn sh-btn--primary"
                >
                  チャット
                </Link>
              </div>

              {expanded ? (
                <div style={detailBox}>
                  <div style={detailRow}>
                    <strong>相手チーム：</strong>
                    {team?.name ?? "未設定"}
                  </div>
                  <div style={detailRow}>
                    <strong>カテゴリ：</strong>
                    {team?.category ?? "未設定"}
                  </div>
                  <div style={detailRow}>
                    <strong>状態：</strong>
                    {label(o.status)}
                  </div>
                  <div style={detailRow}>
                    <strong>メッセージ：</strong>
                  </div>
                  <div style={detailMessage}>{o.message ?? "（なし）"}</div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </main>
  );
}

function Stat(props: { label: string; value: number }) {
  return (
    <div style={statCard}>
      <div style={statLabel}>{props.label}</div>
      <div style={statValue}>{props.value}</div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
};

const topRow: React.CSSProperties = {
  marginTop: 8,
  marginBottom: 10,
};

const hero: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 16,
  background: "#fff",
  padding: 16,
};

const heroTitle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#16391f",
};

const heroDesc: React.CSSProperties = {
  marginTop: 8,
  color: "#55635a",
  lineHeight: 1.7,
};

const summaryCard: React.CSSProperties = {
  marginTop: 12,
  border: "1px solid #e5ece7",
  borderRadius: 16,
  background: "#fff",
  padding: 16,
};

const summaryTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "#16391f",
  marginBottom: 10,
};

const statsGrid: React.CSSProperties = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
};

const statCard: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 14,
  background: "#fafcfb",
  padding: 12,
};

const statLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
};

const statValue: React.CSSProperties = {
  marginTop: 6,
  fontSize: 22,
  fontWeight: 900,
  color: "#145c2a",
};

const loadingText: React.CSSProperties = {
  marginTop: 14,
  color: "#666",
};

const empty: React.CSSProperties = {
  marginTop: 14,
  textAlign: "center" as const,
  color: "#777",
  padding: 20,
  borderRadius: 14,
  border: "1px solid #eee",
  background: "#fff",
};

const list: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gap: 12,
};

const card: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 16,
  background: "#fff",
  padding: 16,
};

const titleRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap" as const,
};

const teamName: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
};

const meta: React.CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  color: "#6b7280",
};

const messagePreview: React.CSSProperties = {
  marginTop: 10,
  fontSize: 14,
  color: "#374151",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap" as const,
};

const messagePreviewMuted: React.CSSProperties = {
  marginTop: 10,
  fontSize: 14,
  color: "#9ca3af",
};

const buttonRow: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap" as const,
};

const detailBox: React.CSSProperties = {
  marginTop: 12,
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
  padding: 12,
  display: "grid",
  gap: 8,
};

const detailRow: React.CSSProperties = {
  fontSize: 14,
  color: "#374151",
  lineHeight: 1.7,
};

const detailMessage: React.CSSProperties = {
  fontSize: 14,
  color: "#111827",
  lineHeight: 1.8,
  whiteSpace: "pre-wrap" as const,
};

const badgeBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 30,
  padding: "0 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
};