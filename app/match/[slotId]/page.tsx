"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppTabNav from "@/app/components/AppTabNav";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import { categoryLabel } from "@/app/lib/categories";

type SlotRow = {
  id: string;
  host_team_id: string;
  owner_id?: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  area: string | null;
  area_text?: string | null;
  category: string | null;
  is_closed?: boolean | null;
  note?: string | null;
};

type TeamRow = {
  id: string;
  owner_id: string | null;
  name: string | null;
  area: string | null;
  prefecture?: string | null;
  city?: string | null;
  town?: string | null;
  address_detail?: string | null;
  category: string | null;
  categories?: string[] | null;
  level: number | null;
  strength_rank?: string | null;
  has_ground?: boolean | null;
  bike_parking?: string | null;
  bike_parking_capacity?: string | null;
  member_count?: number | null;
  uniform_main?: string | null;
  uniform_sub?: string | null;
  roster_by_grade?: Record<string, number> | null;
  note?: string | null;
};

function levelToRank(level?: number | null) {
  const n = Number(level ?? 0);
  if (!Number.isFinite(n)) return "";
  if (n >= 9) return "SS";
  if (n >= 7) return "S";
  if (n >= 5) return "A";
  if (n >= 3) return "B";
  return "C";
}

function teamStrengthLabel(team?: TeamRow | null) {
  if (!team) return "未設定";
  if (team.strength_rank && String(team.strength_rank).trim()) {
    return String(team.strength_rank).trim();
  }
  return levelToRank(team.level) || "未設定";
}

function formatTeamCategories(team?: TeamRow | null) {
  if (!team) return "未設定";

  if (Array.isArray(team.categories) && team.categories.length > 0) {
    return team.categories
      .map((v) => categoryLabel(v) || v)
      .join(" / ");
  }

  return categoryLabel(team.category || "") || team.category || "未設定";
}

function formatTeamArea(team?: TeamRow | null) {
  if (!team) return "未設定";

  const parts = [team.prefecture, team.city, team.town]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

  if (parts.length > 0) {
    return parts.join(" ・ ");
  }

  return team.area || "未設定";
}

function formatTransportation(team?: TeamRow | null) {
  if (!team) return "未設定";

  const items: string[] = [];

  const groundText =
    team.has_ground === true ? "グラウンドあり" : "グラウンドなし";
  items.push(groundText);

  const bikeText = String(team.bike_parking ?? "").trim();
  if (bikeText) {
    const capText = String(team.bike_parking_capacity ?? "").trim();
    items.push(
      capText ? `駐輪場 ${bikeText} / ${capText}` : `駐輪場 ${bikeText}`
    );
  }

  return items.join(" / ") || "未設定";
}

function formatRoster(team?: TeamRow | null) {
  if (!team?.roster_by_grade) return "";

  const entries = Object.entries(team.roster_by_grade)
    .filter(([, count]) => Number(count) > 0)
    .sort(([a], [b]) => a.localeCompare(b, "ja"));

  if (entries.length === 0) return "";

  return entries.map(([grade, count]) => `${grade}:${count}人`).join(" / ");
}

export default function MatchDetailPage() {
  const params = useParams();
  const { user } = useAuth();

  const slotId = String(params?.slotId ?? "");
  const myUserId = user?.id ?? "";

  const [slot, setSlot] = useState<SlotRow | null>(null);
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!slotId) return;

      setLoading(true);
      setErrorText("");

      try {
        const { data: slotData, error: slotError } = await supabase
          .from("match_slots")
          .select("*")
          .eq("id", slotId)
          .single();

        if (slotError) throw slotError;
        if (!active) return;

        const nextSlot = (slotData ?? null) as SlotRow | null;
        setSlot(nextSlot);

        if (!nextSlot?.host_team_id) {
          setTeam(null);
          setLoading(false);
          return;
        }

        const { data: teamData, error: teamError } = await supabase
          .from("teams")
          .select("*")
          .eq("id", nextSlot.host_team_id)
          .single();

        if (teamError) throw teamError;
        if (!active) return;

        setTeam((teamData ?? null) as TeamRow | null);
      } catch (e: any) {
        console.error("[match detail] load error:", e);
        if (!active) return;
        setSlot(null);
        setTeam(null);
        setErrorText(e?.message ?? "詳細の取得に失敗しました");
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
  }, [slotId]);

  const canOpenChat = useMemo(() => {
    if (!team?.id) return false;
    if (!myUserId) return false;
    if (team.owner_id === myUserId) return false;
    return true;
  }, [team?.id, team?.owner_id, myUserId]);

  const openChat = async () => {
    try {
      if (!myUserId) {
        window.location.href = "/login";
        return;
      }

      if (!team?.id) return;
      if (team.owner_id === myUserId) {
        alert("自分のチームにはチャットできません");
        return;
      }

      const { data: myTeams, error: myTeamsError } = await supabase
        .from("teams")
        .select("id")
        .eq("owner_id", myUserId)
        .limit(1);

      if (myTeamsError) throw myTeamsError;

      const myTeamId = myTeams?.[0]?.id;
      if (!myTeamId) {
        alert("先に自分のチームを登録してください");
        window.location.href = "/teams/new";
        return;
      }

      const { data: threadId, error: threadError } = await supabase.rpc(
        "rpc_get_or_create_dm_thread",
        {
          my_team_id: myTeamId,
          other_team_id: team.id,
        }
      );

      if (threadError) throw threadError;

      window.location.href = `/chat/${threadId}?from=match_detail&slotId=${slotId}`;
    } catch (e: any) {
      console.error("[match detail] open chat error:", e);
      alert(`チャットを開けません: ${e?.message ?? "unknown error"}`);
    }
  };

  if (loading) {
    return (
      <main style={pageWrap}>
        <AppTabNav />
        <div style={loadingBox}>読み込み中…</div>
      </main>
    );
  }

  if (errorText) {
    return (
      <main style={pageWrap}>
        <AppTabNav />

        <div style={errorBox}>
          <div style={errorTitle}>読み込みエラー</div>
          <div>{errorText}</div>
          <div style={topButtonRow}>
            <button
              type="button"
              className="sh-btn"
              onClick={() => {
                window.location.href = "/match/my-schedule";
              }}
            >
              予定一覧へ
            </button>
            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              ホームへ
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!slot) {
    return (
      <main style={pageWrap}>
        <AppTabNav />
        <div style={loadingBox}>データがありません</div>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      <AppTabNav />

      <div style={topNavRow}>
        <button
          type="button"
          className="sh-btn"
          onClick={() => {
            window.location.href = "/match/my-schedule";
          }}
        >
          予定一覧へ
        </button>

        <button
          type="button"
          className="sh-btn"
          onClick={() => {
            window.location.href = "/";
          }}
        >
          ホームへ
        </button>
      </div>

      <section style={titleWrap}>
        <h1 style={pageTitle}>試合詳細</h1>
      </section>

      <section style={card}>
        <div style={detailList}>
          <div style={detailRow}>
            <span style={icon}>📅</span>
            <span>{slot.date || "未設定"}</span>
          </div>

          <div style={detailRow}>
            <span style={icon}>⏰</span>
            <span>
              {slot.start_time?.slice(0, 5) || "--:--"}〜
              {slot.end_time?.slice(0, 5) || "--:--"}
            </span>
          </div>

          <div style={detailRow}>
            <span style={icon}>📍</span>
            <span>{slot.area_text || slot.area || "未設定"}</span>
          </div>

          <div style={detailRow}>
            <span style={icon}>🏷</span>
            <span>
              {categoryLabel(slot.category || "") || slot.category || "未設定"}
            </span>
          </div>

          {slot.note ? (
            <div style={detailRowTop}>
              <span style={icon}>📝</span>
              <span>{slot.note}</span>
            </div>
          ) : null}
        </div>
      </section>

      <section style={card}>
        <div style={sectionTitle}>募集チーム詳細</div>

        <div style={teamName}>{team?.name || "未設定"}</div>

        <div style={teamMetaGrid}>
          <div style={teamMetaItem}>
            <div style={metaLabel}>カテゴリ</div>
            <div style={metaValue}>{formatTeamCategories(team)}</div>
          </div>

          <div style={teamMetaItem}>
            <div style={metaLabel}>強さ</div>
            <div style={metaValue}>{teamStrengthLabel(team)}</div>
          </div>

          <div style={teamMetaItem}>
            <div style={metaLabel}>エリア</div>
            <div style={metaValue}>{formatTeamArea(team)}</div>
          </div>

          <div style={teamMetaItem}>
            <div style={metaLabel}>チーム人数</div>
            <div style={metaValue}>
              {team?.member_count != null ? `${team.member_count}人` : "未設定"}
            </div>
          </div>

          <div style={teamMetaItem}>
            <div style={metaLabel}>交通手段・受入情報</div>
            <div style={metaValue}>{formatTransportation(team)}</div>
          </div>

          {(team?.uniform_main || team?.uniform_sub) && (
            <div style={teamMetaItem}>
              <div style={metaLabel}>ユニフォーム</div>
              <div style={metaValue}>
                {[team?.uniform_main, team?.uniform_sub]
                  .filter(Boolean)
                  .join(" / ")}
              </div>
            </div>
          )}

          {team?.address_detail ? (
            <div style={teamMetaItem}>
              <div style={metaLabel}>住所補足</div>
              <div style={metaValue}>{team.address_detail}</div>
            </div>
          ) : null}

          {formatRoster(team) ? (
            <div style={teamMetaItem}>
              <div style={metaLabel}>学年別人数</div>
              <div style={metaValue}>{formatRoster(team)}</div>
            </div>
          ) : null}

          {team?.note ? (
            <div style={teamMetaItem}>
              <div style={metaLabel}>チームメモ</div>
              <div style={metaValue}>{team.note}</div>
            </div>
          ) : null}
        </div>
      </section>

      <div style={bottomActionRow}>
        <button
          type="button"
          className="sh-btn"
          onClick={() => {
            window.location.href = "/match/my-schedule";
          }}
        >
          予定一覧へ
        </button>

        <button
          type="button"
          className="sh-btn"
          onClick={() => {
            window.location.href = "/";
          }}
        >
          ホームへ
        </button>

        {canOpenChat ? (
          <button
            type="button"
            className="sh-btn sh-btn--primary"
            onClick={openChat}
          >
            チャットで連絡
          </button>
        ) : null}
      </div>
    </main>
  );
}

const pageWrap: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  padding: 16,
};

const titleWrap: React.CSSProperties = {
  marginTop: 16,
};

const pageTitle: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.2,
};

const topButtonRow: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const topNavRow: React.CSSProperties = {
  marginTop: 16,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const card: React.CSSProperties = {
  marginTop: 16,
  padding: 16,
  borderRadius: 18,
  border: "1px solid #dce9df",
  background: "#fff",
};

const sectionTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.3,
};

const detailList: React.CSSProperties = {
  display: "grid",
  gap: 14,
};

const detailRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 16,
  color: "#111827",
  lineHeight: 1.6,
};

const detailRowTop: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  fontSize: 16,
  color: "#111827",
  lineHeight: 1.7,
};

const icon: React.CSSProperties = {
  width: 28,
  flexShrink: 0,
  textAlign: "center",
};

const teamName: React.CSSProperties = {
  marginTop: 14,
  fontSize: 28,
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.3,
};

const teamMetaGrid: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gap: 14,
};

const teamMetaItem: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const metaLabel: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#6b7280",
  lineHeight: 1.4,
};

const metaValue: React.CSSProperties = {
  fontSize: 16,
  color: "#111827",
  lineHeight: 1.7,
};

const bottomActionRow: React.CSSProperties = {
  marginTop: 20,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const loadingBox: React.CSSProperties = {
  marginTop: 16,
  padding: 20,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
  color: "#666",
  textAlign: "center",
};

const errorBox: React.CSSProperties = {
  marginTop: 16,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  lineHeight: 1.7,
};

const errorTitle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 4,
};