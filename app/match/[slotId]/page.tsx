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

type AttendanceStatus = "attend" | "absent" | "maybe";
type Role = "owner" | "coach" | "member";

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
  owner_id?: string | null;
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

type TeamMemberRow = {
  team_id: string;
  user_id: string;
  role: Role;
  display_name?: string | null;
};

type AttendanceRow = {
  slot_id: string;
  team_id: string;
  user_id: string;
  status: AttendanceStatus;
};

type AttendanceSummary = {
  attend: number;
  maybe: number;
  absent: number;
  totalAnswered: number;
  memberTotal: number;
};

type AttendanceNameGroups = {
  attend: string[];
  maybe: string[];
  absent: string[];
  unanswered: string[];
};

function isRole(v: string): v is Role {
  return v === "owner" || v === "coach" || v === "member";
}

function isAttendanceStatus(v: string): v is AttendanceStatus {
  return v === "attend" || v === "absent" || v === "maybe";
}

function attendanceLabel(status?: AttendanceStatus | null) {
  if (status === "attend") return "参加";
  if (status === "absent") return "不参加";
  if (status === "maybe") return "未定";
  return "未回答";
}

function emptySummary(memberTotal = 0): AttendanceSummary {
  return {
    attend: 0,
    maybe: 0,
    absent: 0,
    totalAnswered: 0,
    memberTotal,
  };
}

function emptyNameGroups(): AttendanceNameGroups {
  return {
    attend: [],
    maybe: [],
    absent: [],
    unanswered: [],
  };
}

function displayMemberName(row: TeamMemberRow) {
  return row.display_name?.trim() || `ユーザー ${row.user_id.slice(0, 8)}`;
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

  if (venueName && venueAddress) return `${venueName} / ${venueAddress}`;
  if (venueName) return venueName;
  if (venueAddress) return venueAddress;

  return String(slot?.area_text ?? slot?.area ?? "未設定");
}

export default function MatchDetailPage() {
  const params = useParams();
  const { user, loading: authLoading } = useAuth();

  const slotId = String(params?.id ?? params?.slotId ?? "");
  const myUserId = user?.id ?? "";

  const [slot, setSlot] = useState<SlotRow | null>(null);
  const [opponentTeam, setOpponentTeam] = useState<TeamRow | null>(null);
  const [venue, setVenue] = useState<VenueRow | null>(null);

  const [attendanceTeamId, setAttendanceTeamId] = useState("");
  const [myAttendance, setMyAttendance] = useState<AttendanceStatus | null>(null);
  const [attendanceSummary, setAttendanceSummary] =
    useState<AttendanceSummary>(emptySummary());
  const [attendanceNameGroups, setAttendanceNameGroups] =
    useState<AttendanceNameGroups>(emptyNameGroups());
  const [canSeeAttendanceNames, setCanSeeAttendanceNames] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");

  const load = async () => {
    if (!slotId || authLoading) return;

    setLoading(true);
    setErrorText("");

    try {
      let mine: string[] = [];
      let manageable: string[] = [];

      if (myUserId) {
        const { data: myTeamsRaw, error: myTeamsError } = await supabase
          .from("teams")
          .select("id")
          .eq("owner_id", myUserId);

        if (myTeamsError) throw myTeamsError;

        const ownerTeamIds = ((myTeamsRaw ?? []) as Array<{ id: string }>).map(
          (row) => row.id
        );

        const { data: memberTeamsRaw, error: memberTeamsError } = await supabase
          .from("team_members")
          .select("team_id,user_id,role,display_name")
          .eq("user_id", myUserId);

        if (memberTeamsError) throw memberTeamsError;

        const memberRows: TeamMemberRow[] = [];

        if (Array.isArray(memberTeamsRaw)) {
          for (const r of memberTeamsRaw as any[]) {
            const role = String(r.role ?? "");

            if (!isRole(role)) continue;

            const team_id = String(r.team_id ?? "");
            const user_id = String(r.user_id ?? "");

            if (!team_id || !user_id) continue;

            memberRows.push({
              team_id,
              user_id,
              role,
              display_name:
                typeof r.display_name === "string" ? r.display_name : null,
            });
          }
        }

        const memberTeamIds = memberRows.map((row) => row.team_id);

        mine = Array.from(new Set([...ownerTeamIds, ...memberTeamIds]));
        manageable = Array.from(
          new Set([
            ...ownerTeamIds,
            ...memberRows
              .filter((row) => row.role === "owner" || row.role === "coach")
              .map((row) => row.team_id),
          ])
        );
      }

      const { data: slotData, error: slotError } = await supabase
        .from("match_slots")
        .select("*")
        .eq("id", slotId)
        .single();

      if (slotError) throw slotError;

      const nextSlot = (slotData ?? null) as SlotRow | null;
      setSlot(nextSlot);

      if (!nextSlot) {
        setOpponentTeam(null);
        setVenue(null);
        setAttendanceTeamId("");
        setMyAttendance(null);
        setAttendanceSummary(emptySummary());
        setAttendanceNameGroups(emptyNameGroups());
        setCanSeeAttendanceNames(false);
        return;
      }

      const { data: acceptedRaw, error: acceptedError } = await supabase
        .from("match_requests")
        .select("id, slot_id, requester_team_id, status")
        .eq("slot_id", nextSlot.id)
        .eq("status", "accepted")
        .maybeSingle();

      if (acceptedError) throw acceptedError;

      const acceptedRequest = (acceptedRaw ?? null) as RequestRow | null;

      const { data: pendingRaw, error: pendingError } = await supabase
        .from("match_requests")
        .select("id, slot_id, requester_team_id, status")
        .eq("slot_id", nextSlot.id)
        .eq("status", "pending");

      if (pendingError) throw pendingError;

      const pendingRequests = Array.isArray(pendingRaw)
        ? (pendingRaw as RequestRow[])
        : [];

      let nextAttendanceTeamId = "";

      if (mine.includes(nextSlot.host_team_id)) {
        nextAttendanceTeamId = nextSlot.host_team_id;
      } else if (
        acceptedRequest?.requester_team_id &&
        mine.includes(acceptedRequest.requester_team_id)
      ) {
        nextAttendanceTeamId = acceptedRequest.requester_team_id;
      } else {
        const pendingMine = pendingRequests.find((r) =>
          mine.includes(r.requester_team_id)
        );
        if (pendingMine) nextAttendanceTeamId = pendingMine.requester_team_id;
      }

      setAttendanceTeamId(nextAttendanceTeamId);
      setCanSeeAttendanceNames(!!nextAttendanceTeamId);

      let opponentTeamId = nextSlot.host_team_id;

      const iAmHost = mine.includes(nextSlot.host_team_id);
      const iAmRequester =
        !!acceptedRequest &&
        mine.includes(acceptedRequest.requester_team_id);

      if (iAmHost && acceptedRequest?.requester_team_id) {
        opponentTeamId = acceptedRequest.requester_team_id;
      } else if (iAmRequester) {
        opponentTeamId = nextSlot.host_team_id;
      } else {
        opponentTeamId = nextSlot.host_team_id;
      }

      const { data: teamData, error: teamError } = await supabase
        .from("teams")
        .select("*")
        .eq("id", opponentTeamId)
        .single();

      if (teamError) throw teamError;

      setOpponentTeam((teamData ?? null) as TeamRow | null);

      if (nextSlot.venue_id) {
        const { data: venueData, error: venueError } = await supabase
          .from("venues")
          .select("*")
          .eq("id", nextSlot.venue_id)
          .maybeSingle();

        if (venueError) throw venueError;
        setVenue((venueData ?? null) as VenueRow | null);
      } else {
        setVenue(null);
      }

      if (nextAttendanceTeamId && myUserId) {
        const { data: myAttendanceRaw, error: myAttendanceError } =
          await supabase
            .from("match_attendances")
            .select("slot_id,team_id,user_id,status")
            .eq("slot_id", nextSlot.id)
            .eq("team_id", nextAttendanceTeamId)
            .eq("user_id", myUserId)
            .maybeSingle();

        if (myAttendanceError) throw myAttendanceError;

        const status = String((myAttendanceRaw as any)?.status ?? "");
        setMyAttendance(isAttendanceStatus(status) ? status : null);
      } else {
        setMyAttendance(null);
      }

      if (nextAttendanceTeamId) {
        const { data: attendanceRaw, error: attendanceError } = await supabase
          .from("match_attendances")
          .select("slot_id,team_id,user_id,status")
          .eq("slot_id", nextSlot.id)
          .eq("team_id", nextAttendanceTeamId);

        if (attendanceError) throw attendanceError;

        const attendanceRows: AttendanceRow[] = Array.isArray(attendanceRaw)
          ? attendanceRaw
              .map((r: any) => {
                const status = String(r.status ?? "");
                if (!isAttendanceStatus(status)) return null;

                return {
                  slot_id: String(r.slot_id ?? ""),
                  team_id: String(r.team_id ?? ""),
                  user_id: String(r.user_id ?? ""),
                  status,
                };
              })
              .filter((v): v is AttendanceRow => !!v?.user_id)
          : [];

        const { data: teamMembersRaw, error: teamMembersError } = await supabase
          .from("team_members")
          .select("team_id,user_id,role,display_name")
          .eq("team_id", nextAttendanceTeamId);

        if (teamMembersError) throw teamMembersError;

        const { data: teamOwnerRaw } = await supabase
          .from("teams")
          .select("owner_id")
          .eq("id", nextAttendanceTeamId)
          .maybeSingle();

        const ownerId = String((teamOwnerRaw as any)?.owner_id ?? "");

        const memberMap = new Map<string, TeamMemberRow>();

        if (ownerId) {
          memberMap.set(ownerId, {
            team_id: nextAttendanceTeamId,
            user_id: ownerId,
            role: "owner",
            display_name: "チーム管理者",
          });
        }

        if (Array.isArray(teamMembersRaw)) {
          for (const row of teamMembersRaw as any[]) {
            const role = String(row.role ?? "");
            const uid = String(row.user_id ?? "");
            if (!uid || !isRole(role)) continue;

            memberMap.set(uid, {
              team_id: String(row.team_id ?? nextAttendanceTeamId),
              user_id: uid,
              role,
              display_name:
                typeof row.display_name === "string" ? row.display_name : null,
            });
          }
        }

        const attendanceByUser = new Map<string, AttendanceStatus>();
        for (const row of attendanceRows) {
          attendanceByUser.set(row.user_id, row.status);
        }

        const summary = emptySummary(memberMap.size);
        const groups = emptyNameGroups();

        for (const member of memberMap.values()) {
          const status = attendanceByUser.get(member.user_id);
          const name = displayMemberName(member);

          if (status === "attend") {
            summary.attend += 1;
            summary.totalAnswered += 1;
            groups.attend.push(name);
          } else if (status === "maybe") {
            summary.maybe += 1;
            summary.totalAnswered += 1;
            groups.maybe.push(name);
          } else if (status === "absent") {
            summary.absent += 1;
            summary.totalAnswered += 1;
            groups.absent.push(name);
          } else {
            groups.unanswered.push(name);
          }
        }

        setAttendanceSummary(summary);
        setAttendanceNameGroups(groups);
      } else {
        setAttendanceSummary(emptySummary());
        setAttendanceNameGroups(emptyNameGroups());
      }
    } catch (e: any) {
      console.error("[match detail] load error:", e);
      setSlot(null);
      setOpponentTeam(null);
      setVenue(null);
      setAttendanceTeamId("");
      setMyAttendance(null);
      setAttendanceSummary(emptySummary());
      setAttendanceNameGroups(emptyNameGroups());
      setCanSeeAttendanceNames(false);
      setErrorText(e?.message ?? "詳細の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [slotId, myUserId, authLoading]);

  const updateAttendance = async (status: AttendanceStatus) => {
    if (!myUserId || !slot?.id || !attendanceTeamId) {
      alert("この予定に対する出欠回答権限がありません");
      return;
    }

    setSavingAttendance(true);

    try {
      const { error } = await supabase.from("match_attendances").upsert(
        {
          slot_id: slot.id,
          team_id: attendanceTeamId,
          user_id: myUserId,
          status,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "slot_id,team_id,user_id",
        }
      );

      if (error) throw error;

      setMyAttendance(status);
      await load();
    } catch (e: any) {
      console.error(e);
      alert(`出欠の保存に失敗しました: ${e?.message ?? "unknown error"}`);
    } finally {
      setSavingAttendance(false);
    }
  };

  const groundLabel = useMemo(() => {
    return buildGroundLabel({ venue, slot });
  }, [venue, slot]);

  const mapUrl = useMemo(() => {
    return buildMapUrl({ venue, slot });
  }, [venue, slot]);

  const categoryTextForOpponent = useMemo(() => {
    return categoryLabel(slot?.category || "") || slot?.category || "未設定";
  }, [slot]);

  const dayScheduleUrl = useMemo(() => {
    if (!slot?.date) return "/match/my-schedule";
    return `/match/my-schedule?date=${slot.date}`;
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

        <div style={topButtonRow}>
          <button
            type="button"
            className="sh-btn"
            onClick={() => {
              window.location.href = dayScheduleUrl;
            }}
          >
            日別予定
          </button>

          <button
            type="button"
            className="sh-btn sh-btn--primary"
            onClick={() => {
              window.location.href = "/match/my-schedule";
            }}
          >
            予定一覧
          </button>
        </div>
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

      {attendanceTeamId ? (
        <section style={card}>
          <div style={sectionTitle}>出欠確認</div>

          <div style={attendanceStatusText}>
            自分の出欠：<b>{attendanceLabel(myAttendance)}</b>
          </div>

          <div style={attendanceButtonRow}>
            <button
              type="button"
              style={{
                ...attendanceButton,
                ...(myAttendance === "attend"
                  ? attendanceButtonAttendActive
                  : null),
              }}
              disabled={savingAttendance}
              onClick={() => updateAttendance("attend")}
            >
              参加
            </button>

            <button
              type="button"
              style={{
                ...attendanceButton,
                ...(myAttendance === "maybe"
                  ? attendanceButtonMaybeActive
                  : null),
              }}
              disabled={savingAttendance}
              onClick={() => updateAttendance("maybe")}
            >
              未定
            </button>

            <button
              type="button"
              style={{
                ...attendanceButton,
                ...(myAttendance === "absent"
                  ? attendanceButtonAbsentActive
                  : null),
              }}
              disabled={savingAttendance}
              onClick={() => updateAttendance("absent")}
            >
              不参加
            </button>
          </div>

          <div style={teamMessageButtonWrap}>
            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={() => {
                window.location.href = `/teams/${attendanceTeamId}/message?slotId=${slotId}`;
              }}
            >
              このチームに連絡
            </button>
          </div>

          <div style={summaryBox}>
            <div style={summaryTitle}>出欠集計</div>

            <div style={summaryGrid}>
              <span style={summaryPillAttend}>
                参加 {attendanceSummary.attend}
              </span>
              <span style={summaryPillMaybe}>
                未定 {attendanceSummary.maybe}
              </span>
              <span style={summaryPillAbsent}>
                不参加 {attendanceSummary.absent}
              </span>
              <span style={summaryPillTotal}>
                未回答{" "}
                {Math.max(
                  attendanceSummary.memberTotal -
                    attendanceSummary.totalAnswered,
                  0
                )}
              </span>
              <span style={summaryPillTotal}>
                回答 {attendanceSummary.totalAnswered}/
                {attendanceSummary.memberTotal}
              </span>
            </div>

            {canSeeAttendanceNames ? (
              <div style={nameListBox}>
                <AttendanceNameRow
                  label="参加"
                  names={attendanceNameGroups.attend}
                  emptyText="なし"
                  tone="attend"
                />
                <AttendanceNameRow
                  label="未定"
                  names={attendanceNameGroups.maybe}
                  emptyText="なし"
                  tone="maybe"
                />
                <AttendanceNameRow
                  label="不参加"
                  names={attendanceNameGroups.absent}
                  emptyText="なし"
                  tone="absent"
                />
                <AttendanceNameRow
                  label="未回答"
                  names={attendanceNameGroups.unanswered}
                  emptyText="なし"
                  tone="unanswered"
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : myUserId ? (
        <section style={card}>
          <div style={sectionTitle}>出欠確認</div>
          <div style={attendanceStatusText}>
            この試合に紐づくチームメンバーではないため、出欠回答はできません。
          </div>
        </section>
      ) : null}

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

function AttendanceNameRow(props: {
  label: string;
  names: string[];
  emptyText: string;
  tone: "attend" | "maybe" | "absent" | "unanswered";
}) {
  const { label, names, emptyText, tone } = props;

  return (
    <div style={nameRow}>
      <div
        style={{
          ...nameRowLabel,
          ...(tone === "attend"
            ? nameRowAttend
            : tone === "maybe"
              ? nameRowMaybe
              : tone === "absent"
                ? nameRowAbsent
                : nameRowUnanswered),
        }}
      >
        {label}
      </div>
      <div style={nameRowValue}>
        {names.length > 0 ? names.join("、") : emptyText}
      </div>
    </div>
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

const topButtonRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
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

const attendanceStatusText: React.CSSProperties = {
  marginTop: 12,
  fontSize: 14,
  color: "#374151",
  lineHeight: 1.7,
};

const attendanceButtonRow: React.CSSProperties = {
  marginTop: 10,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const attendanceButton: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 999,
  background: "#fff",
  color: "#374151",
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};

const attendanceButtonAttendActive: React.CSSProperties = {
  borderColor: "#86efac",
  background: "#dcfce7",
  color: "#166534",
};

const attendanceButtonMaybeActive: React.CSSProperties = {
  borderColor: "#fcd34d",
  background: "#fef3c7",
  color: "#92400e",
};

const attendanceButtonAbsentActive: React.CSSProperties = {
  borderColor: "#fecaca",
  background: "#fee2e2",
  color: "#991b1b",
};

const summaryBox: React.CSSProperties = {
  marginTop: 14,
  padding: 10,
  borderRadius: 12,
  background: "#f9fafb",
  border: "1px solid #e5e7eb",
  display: "grid",
  gap: 8,
};

const summaryTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#374151",
};

const summaryGrid: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const summaryPillAttend: React.CSSProperties = {
  padding: "3px 8px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontSize: 12,
  fontWeight: 900,
};

const summaryPillMaybe: React.CSSProperties = {
  padding: "3px 8px",
  borderRadius: 999,
  background: "#fef3c7",
  color: "#92400e",
  fontSize: 12,
  fontWeight: 900,
};

const summaryPillAbsent: React.CSSProperties = {
  padding: "3px 8px",
  borderRadius: 999,
  background: "#fee2e2",
  color: "#991b1b",
  fontSize: 12,
  fontWeight: 900,
};

const summaryPillTotal: React.CSSProperties = {
  padding: "3px 8px",
  borderRadius: 999,
  background: "#eef2ff",
  color: "#3730a3",
  fontSize: 12,
  fontWeight: 900,
};

const nameListBox: React.CSSProperties = {
  marginTop: 8,
  display: "grid",
  gap: 8,
};

const nameRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "70px 1fr",
  gap: 8,
  alignItems: "start",
  fontSize: 13,
  lineHeight: 1.6,
};

const nameRowLabel: React.CSSProperties = {
  borderRadius: 999,
  padding: "2px 8px",
  fontWeight: 900,
  textAlign: "center",
};

const nameRowValue: React.CSSProperties = {
  color: "#374151",
  wordBreak: "break-word",
};

const nameRowAttend: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
};

const nameRowMaybe: React.CSSProperties = {
  background: "#fef3c7",
  color: "#92400e",
};

const nameRowAbsent: React.CSSProperties = {
  background: "#fee2e2",
  color: "#991b1b",
};

const nameRowUnanswered: React.CSSProperties = {
  background: "#f3f4f6",
  color: "#4b5563",
};

const teamMessageButtonWrap: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  justifyContent: "flex-start",
};