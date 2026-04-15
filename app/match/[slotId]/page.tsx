"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppTabNav from "@/app/components/AppTabNav";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import { categoryLabel } from "@/app/lib/categories";
import TeamProfileCard, {
  TeamProfileCardRow,
} from "@/app/teams/components/TeamProfileCard";

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

type TeamRow = TeamProfileCardRow & {
  has_ground?: boolean | null;
  bike_parking?: string | null;
  bike_parking_capacity?: string | null;
  roster_by_grade?: Record<string, number> | null;
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

export default function MatchDetailPage() {
  const params = useParams();
  const { user, loading: authLoading } = useAuth();

  const slotId = String(params?.slotId ?? "");
  const myUserId = user?.id ?? "";

  const [slot, setSlot] = useState<SlotRow | null>(null);
  const [opponentTeam, setOpponentTeam] = useState<TeamRow | null>(null);
  const [venue, setVenue] = useState<VenueRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

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

  const groundLabel = useMemo(() => {
    return buildGroundLabel({ venue, slot });
  }, [venue, slot]);

  const mapUrl = useMemo(() => {
    return buildMapUrl({ venue, slot });
  }, [venue, slot]);

  const categoryTextForOpponent = useMemo(() => {
    return categoryLabel(slot?.category || "") || slot?.category || "未設定";
  }, [slot]);

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
            <span>{categoryTextForOpponent}</span>
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

      {opponentTeam ? (
        <TeamProfileCard
          title="相手チーム詳細"
          team={opponentTeam}
          myUserId={myUserId}
          categoryTextOverride={categoryTextForOpponent}
          showAddressDetail={true}
          showGeminiSection={true}
          showChatButton={true}
          showStrengthHelpButton={true}
          chatFrom="match_detail"
          chatSlotId={slotId}
        />
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