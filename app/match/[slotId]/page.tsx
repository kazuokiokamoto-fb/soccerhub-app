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
  venue_id?: string | null;
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

type VenueRow = {
  id: string;
  name?: string | null;
  address?: string | null;
  google_map_url?: string | null;
  googleMapUrl?: string | null;
};

type RequestRow = {
  id: string;
  slot_id: string;
  requester_team_id: string;
  status: string;
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
  items.push(team.has_ground ? "グラウンドあり" : "グラウンドなし");

  const bikeText = String(team.bike_parking ?? "").trim();
  if (bikeText) {
    const capText = String(team.bike_parking_capacity ?? "").trim();
    items.push(
      capText ? `駐輪場 ${bikeText} / ${capText}` : `駐輪場 ${bikeText}`
    );
  }

  return items.join(" / ") || "未設定";
}

function buildMapUrl(params: {
  venue?: VenueRow | null;
  slot?: SlotRow | null;
}) {
  const { venue, slot } = params;

  const explicit =
    String(venue?.google_map_url ?? "").trim() ||
    String(venue?.googleMapUrl ?? "").trim();

  if (explicit) return explicit;

  const query =
    String(venue?.address ?? "").trim() ||
    String(slot?.area_text ?? "").trim() ||
    String(slot?.area ?? "").trim();

  if (!query) return "";

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query
  )}`;
}

function buildGroundLabel(params: {
  venue?: VenueRow | null;
  slot?: SlotRow | null;
}) {
  const { venue, slot } = params;

  const venueName = String(venue?.name ?? "").trim();
  const venueAddress = String(venue?.address ?? "").trim();

  if (venueName && venueAddress) {
    return `${venueName} / ${venueAddress}`;
  }

  if (venueName) return venueName;
  if (venueAddress) return venueAddress;

  return String(slot?.area_text ?? slot?.area ?? "未設定");
}

function buildGeminiPrompt(params: {
  teamName: string;
  categoryText: string;
  areaText: string;
  transportationText: string;
  strengthText: string;
}) {
  return `少年サッカー・キッズサッカーの対戦相手チームについて調べたいです。
以下の条件をもとに、日本語で簡潔に整理してください。

チーム名: ${params.teamName}
試合カテゴリ: ${params.categoryText}
活動エリア: ${params.areaText}
交通手段・受入情報: ${params.transportationText}
強さ: ${params.strengthText}

知りたいこと:
・このチームがどんなチームか
・このカテゴリでの活動傾向
・対戦前に確認すると良いこと
・一般的に想定されるレベル感や特徴

不明な情報は推測しすぎず、「不明」と明記してください。`;
}

export default function MatchDetailPage() {
  const params = useParams();
  const { user, loading: authLoading } = useAuth();

  const slotId = String(params?.slotId ?? "");
  const myUserId = user?.id ?? "";

  const [slot, setSlot] = useState<SlotRow | null>(null);
  const [opponentTeam, setOpponentTeam] = useState<TeamRow | null>(null);
  const [venue, setVenue] = useState<VenueRow | null>(null);
  const [myTeamIds, setMyTeamIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  const [showGeminiModal, setShowGeminiModal] = useState(false);
  const [copiedGemini, setCopiedGemini] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!slotId) return;
      if (authLoading) return;

      setLoading(true);
      setErrorText("");

      try {
        let mine: string[] = [];

        if (myUserId) {
          const { data: myTeamsRaw, error: myTeamsError } = await supabase
            .from("teams")
            .select("id")
            .eq("owner_id", myUserId);

          if (myTeamsError) throw myTeamsError;

          mine = ((myTeamsRaw ?? []) as Array<{ id: string }>).map(
            (row) => row.id
          );
        }

        if (!active) return;
        setMyTeamIds(mine);

        const { data: slotData, error: slotError } = await supabase
          .from("match_slots")
          .select("*")
          .eq("id", slotId)
          .single();

        if (slotError) throw slotError;

        const nextSlot = (slotData ?? null) as SlotRow | null;
        if (!active) return;

        setSlot(nextSlot);

        if (!nextSlot) {
          setOpponentTeam(null);
          setVenue(null);
          setLoading(false);
          return;
        }

        let acceptedRequest: RequestRow | null = null;
        const { data: acceptedRaw, error: acceptedError } = await supabase
          .from("match_requests")
          .select("id, slot_id, requester_team_id, status")
          .eq("slot_id", nextSlot.id)
          .eq("status", "accepted")
          .maybeSingle();

        if (acceptedError) throw acceptedError;
        acceptedRequest = (acceptedRaw ?? null) as RequestRow | null;

        let opponentTeamId = nextSlot.host_team_id;

        const iAmHost = mine.includes(nextSlot.host_team_id);
        const iAmRequester =
          !!acceptedRequest &&
          mine.includes(acceptedRequest.requester_team_id);

        if (iAmHost && acceptedRequest?.requester_team_id) {
          opponentTeamId = acceptedRequest.requester_team_id;
        } else if (iAmRequester) {
          opponentTeamId = nextSlot.host_team_id;
        } else if (
          acceptedRequest?.requester_team_id &&
          acceptedRequest.requester_team_id !== nextSlot.host_team_id
        ) {
          opponentTeamId = nextSlot.host_team_id;
        }

        const { data: teamData, error: teamError } = await supabase
          .from("teams")
          .select("*")
          .eq("id", opponentTeamId)
          .single();

        if (teamError) throw teamError;
        if (!active) return;

        setOpponentTeam((teamData ?? null) as TeamRow | null);

        if (nextSlot.venue_id) {
          const { data: venueData, error: venueError } = await supabase
            .from("venues")
            .select("*")
            .eq("id", nextSlot.venue_id)
            .maybeSingle();

          if (venueError) throw venueError;
          if (!active) return;

          setVenue((venueData ?? null) as VenueRow | null);
        } else {
          setVenue(null);
        }
      } catch (e: any) {
        console.error("[match detail] load error:", e);
        if (!active) return;
        setSlot(null);
        setOpponentTeam(null);
        setVenue(null);
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
  }, [slotId, myUserId, authLoading]);

  const canOpenChat = useMemo(() => {
    if (!opponentTeam?.id) return false;
    if (!myUserId) return false;
    if (!myTeamIds.length) return false;
    if (opponentTeam.owner_id === myUserId) return false;
    return true;
  }, [opponentTeam?.id, opponentTeam?.owner_id, myUserId, myTeamIds]);

  const groundLabel = useMemo(() => {
    return buildGroundLabel({ venue, slot });
  }, [venue, slot]);

  const mapUrl = useMemo(() => {
    return buildMapUrl({ venue, slot });
  }, [venue, slot]);

  const geminiPrompt = useMemo(() => {
    return buildGeminiPrompt({
      teamName: String(opponentTeam?.name ?? "未設定"),
      categoryText:
        categoryLabel(slot?.category || "") || slot?.category || "未設定",
      areaText: formatTeamArea(opponentTeam),
      transportationText: formatTransportation(opponentTeam),
      strengthText: teamStrengthLabel(opponentTeam),
    });
  }, [opponentTeam, slot]);

  const openChat = async () => {
    try {
      if (!myUserId) {
        window.location.href = "/login";
        return;
      }

      if (!opponentTeam?.id) return;

      if (!myTeamIds.length) {
        alert("先に自分のチームを登録してください");
        window.location.href = "/teams/new";
        return;
      }

      const myTeamId = myTeamIds[0];

      const { data: threadId, error: threadError } = await supabase.rpc(
        "rpc_get_or_create_dm_thread",
        {
          my_team_id: myTeamId,
          other_team_id: opponentTeam.id,
        }
      );

      if (threadError) throw threadError;
      if (!threadId) throw new Error("チャットスレッドを作成できませんでした");

      window.location.href = `/chat/${threadId}?from=match_detail&slotId=${slotId}`;
    } catch (e: any) {
      console.error("[match detail] open chat error:", e);
      alert(`チャットを開けません。\n\n${e?.message ?? "unknown error"}`);
    }
  };

  const copyGeminiPrompt = async () => {
    try {
      await navigator.clipboard.writeText(geminiPrompt);
      setCopiedGemini(true);
      window.setTimeout(() => setCopiedGemini(false), 2000);
    } catch (e) {
      console.error("[match detail] clipboard error:", e);
      alert("コピーに失敗しました。検索文を手動で選択してコピーしてください。");
    }
  };

  const openGemini = () => {
    window.open("https://gemini.google.com/", "_blank", "noopener,noreferrer");
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

      <div style={titleRow}>
        <h1 style={pageTitle}>試合詳細</h1>

        <button
          type="button"
          className="sh-btn"
          onClick={() => {
            window.location.href = "/match/my-schedule";
          }}
        >
          予定一覧
        </button>
      </div>

      <section style={card}>
        <div style={sectionTitle}>試合情報</div>

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

          <div style={detailRowTop}>
            <span style={icon}>🏟</span>
            <span>{groundLabel}</span>
          </div>

          {mapUrl ? (
            <div style={detailRow}>
              <span style={icon}>🗺️</span>
              <a href={mapUrl} target="_blank" rel="noreferrer" style={mapLink}>
                Googleマップで見る
              </a>
            </div>
          ) : null}

          <div style={detailRow}>
            <span style={icon}>📌</span>
            <span>{slot.is_closed ? "現在は締切" : "受付中"}</span>
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
        <div style={sectionTitle}>相手チーム詳細</div>

        <div style={teamName}>{opponentTeam?.name || "未設定"}</div>

        <div style={teamMetaGrid}>
          <div style={teamMetaItem}>
            <div style={metaLabel}>試合カテゴリ</div>
            <div style={metaValue}>
              {categoryLabel(slot.category || "") || slot.category || "未設定"}
            </div>
          </div>

          <div style={teamMetaItem}>
            <div style={metaLabel}>強さ</div>
            <div style={metaValue}>{teamStrengthLabel(opponentTeam)}</div>
          </div>

          <div style={teamMetaItem}>
            <div style={metaLabel}>エリア</div>
            <div style={metaValue}>{formatTeamArea(opponentTeam)}</div>
          </div>

          <div style={teamMetaItem}>
            <div style={metaLabel}>チーム人数</div>
            <div style={metaValue}>
              {opponentTeam?.member_count != null
                ? `${opponentTeam.member_count}人`
                : "未設定"}
            </div>
          </div>

          <div style={teamMetaItem}>
            <div style={metaLabel}>交通手段・受入情報</div>
            <div style={metaValue}>{formatTransportation(opponentTeam)}</div>
          </div>

          {(opponentTeam?.uniform_main || opponentTeam?.uniform_sub) && (
            <div style={teamMetaItem}>
              <div style={metaLabel}>ユニフォーム</div>
              <div style={metaValue}>
                {[opponentTeam?.uniform_main, opponentTeam?.uniform_sub]
                  .filter(Boolean)
                  .join(" / ")}
              </div>
            </div>
          )}

          {opponentTeam?.address_detail ? (
            <div style={teamMetaItem}>
              <div style={metaLabel}>住所補足</div>
              <div style={metaValue}>{opponentTeam.address_detail}</div>
            </div>
          ) : null}

          {opponentTeam?.note ? (
            <div style={teamMetaItem}>
              <div style={metaLabel}>チームメモ</div>
              <div style={metaValue}>{opponentTeam.note}</div>
            </div>
          ) : null}

          <div style={teamMetaItem}>
            <div style={metaLabel}>Geminiによるチーム情報</div>
            <div style={metaValue}>
              Gemini用の検索文を確認してからコピーできます。
            </div>

            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                className="sh-btn"
                onClick={() => setShowGeminiModal(true)}
              >
                Geminiでこのチームを調べる
              </button>
            </div>
          </div>
        </div>
      </section>

      {canOpenChat ? (
        <div style={bottomActionRow}>
          <button
            type="button"
            className="sh-btn sh-btn--primary"
            onClick={openChat}
          >
            チャットで連絡
          </button>
        </div>
      ) : null}

      {showGeminiModal ? (
        <div
          style={modalOverlay}
          onClick={() => setShowGeminiModal(false)}
        >
          <div
            style={modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={modalTitle}>Gemini検索文</div>

            <div style={modalText}>
              下の文章をコピーして、Geminiに貼り付けて使ってください。
            </div>

            <textarea
              value={geminiPrompt}
              readOnly
              style={promptTextarea}
            />

            <div style={copiedText}>
              {copiedGemini ? "コピーしました" : "そのままコピーして使えます"}
            </div>

            <div style={modalActionRow}>
              <button
                type="button"
                className="sh-btn"
                onClick={copyGeminiPrompt}
              >
                コピー
              </button>

              <button
                type="button"
                className="sh-btn sh-btn--primary"
                onClick={openGemini}
              >
                Geminiを開く
              </button>
            </div>

            <div style={modalCloseRow}>
              <button
                type="button"
                className="sh-btn"
                onClick={() => setShowGeminiModal(false)}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

const pageWrap: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  padding: 16,
};

const titleRow: React.CSSProperties = {
  marginTop: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const pageTitle: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.2,
  margin: 0,
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
  marginTop: 14,
  display: "grid",
  gap: 14,
};

const detailRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 16,
  color: "#1c2b22",
  lineHeight: 1.6,
};

const detailRowTop: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  fontSize: 16,
  color: "#1c2b22",
  lineHeight: 1.7,
};

const icon: React.CSSProperties = {
  width: 28,
  flexShrink: 0,
  textAlign: "center",
};

const mapLink: React.CSSProperties = {
  color: "#145c2a",
  fontWeight: 800,
  textDecoration: "underline",
};

const teamName: React.CSSProperties = {
  marginTop: 14,
  fontSize: 28,
  fontWeight: 900,
  color: "#16391f",
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
  color: "#1c2b22",
  lineHeight: 1.7,
};

const bottomActionRow: React.CSSProperties = {
  marginTop: 20,
  display: "flex",
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

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 1000,
};

const modalCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 720,
  background: "#fff",
  borderRadius: 18,
  border: "1px solid #dce9df",
  padding: 16,
  boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
  display: "grid",
  gap: 12,
};

const modalTitle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.3,
};

const modalText: React.CSSProperties = {
  fontSize: 14,
  color: "#4b5563",
  lineHeight: 1.7,
};

const promptTextarea: React.CSSProperties = {
  width: "100%",
  minHeight: 260,
  borderRadius: 14,
  border: "1px solid #dce9df",
  padding: 14,
  fontSize: 14,
  lineHeight: 1.7,
  color: "#1c2b22",
  background: "#f9fbfa",
  resize: "vertical",
  fontFamily: "inherit",
};

const copiedText: React.CSSProperties = {
  fontSize: 13,
  color: "#166534",
  lineHeight: 1.5,
};

const modalActionRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const modalCloseRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
};