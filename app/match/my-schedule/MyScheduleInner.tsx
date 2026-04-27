"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import { useSearchParams } from "next/navigation";
import { categoryLabel } from "@/app/lib/categories";

type Role = "owner" | "coach" | "member";

type TeamIdRow = {
  id: string;
};

type TeamMemberRow = {
  team_id: string;
  user_id?: string;
  role?: Role | string;
};

type MatchSlotRow = {
  id: string;
  host_team_id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  area: string | null;
  area_text: string | null;
  category: string | null;
  is_closed: boolean | null;
};

type MatchRequestRow = {
  id: string;
  slot_id: string;
  requester_team_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
};

type AttendanceStatus = "attend" | "absent" | "maybe";

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

type MyScheduleItem = {
  id: string;
  slotId: string;
  teamId: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  category: string;
  opponent: string;
  strength: string | null;
  venueName: string | null;
  address: string | null;
  meetupTime: string | null;
  dissolveTime: string | null;
  parking: string | null;
  belongings: string | null;
  note: string | null;
  threadId: string | null;
  status: "confirmed" | "draft";
  role: "host" | "guest";
  canSeeAttendanceSummary: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBooleanOrNull(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function toArray<T>(value: unknown, mapper: (v: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(mapper).filter((v): v is T => v !== null);
}

function toTeamIdRow(value: unknown): TeamIdRow | null {
  const r = asRecord(value);
  if (!r) return null;
  const id = asString(r.id);
  if (!id) return null;
  return { id };
}

function toTeamMemberRow(value: unknown): TeamMemberRow | null {
  const r = asRecord(value);
  if (!r) return null;
  const team_id = asString(r.team_id);
  if (!team_id) return null;
  return {
    team_id,
    user_id: asString(r.user_id),
    role: asString(r.role),
  };
}

function toMatchSlotRow(value: unknown): MatchSlotRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const host_team_id = asString(r.host_team_id);
  const date = asString(r.date);

  if (!id || !host_team_id || !date) return null;

  return {
    id,
    host_team_id,
    date,
    start_time: asNullableString(r.start_time),
    end_time: asNullableString(r.end_time),
    area: asNullableString(r.area),
    area_text: asNullableString(r.area_text),
    category: asNullableString(r.category),
    is_closed: asBooleanOrNull(r.is_closed),
  };
}

function toMatchRequestRow(value: unknown): MatchRequestRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const slot_id = asString(r.slot_id);
  const requester_team_id = asString(r.requester_team_id);
  const status = asString(r.status) as MatchRequestRow["status"];

  if (!id || !slot_id || !requester_team_id || !status) return null;
  return { id, slot_id, requester_team_id, status };
}

function toAttendanceRow(value: unknown): AttendanceRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const slot_id = asString(r.slot_id);
  const team_id = asString(r.team_id);
  const user_id = asString(r.user_id);
  const status = asString(r.status) as AttendanceStatus;

  if (!slot_id || !team_id || !user_id) return null;
  if (status !== "attend" && status !== "absent" && status !== "maybe") {
    return null;
  }

  return { slot_id, team_id, user_id, status };
}

function ymdToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;

  const dt = new Date(y, m - 1, d);
  const week = ["日", "月", "火", "水", "木", "金", "土"][dt.getDay()];
  return `${m}/${d}（${week}）`;
}

function formatTime(v?: string | null) {
  if (!v) return "";
  return String(v).slice(0, 5);
}

function statusLabel(status?: "confirmed" | "draft" | null) {
  return status === "confirmed" ? "確定" : "交渉";
}

function attendanceLabel(status?: AttendanceStatus | null) {
  if (status === "attend") return "参加";
  if (status === "absent") return "不参加";
  if (status === "maybe") return "未定";
  return "未回答";
}

function teamStrengthLabel(team: any) {
  if (!team) return null;
  if (typeof team.strength_rank === "string" && team.strength_rank.trim()) {
    return team.strength_rank;
  }

  const level = Number(team.level ?? 0);
  if (!Number.isFinite(level)) return null;
  if (level >= 9) return "SS";
  if (level >= 7) return "S";
  if (level >= 5) return "A";
  if (level >= 3) return "B";
  return "C";
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

export default function MyScheduleInner() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();

  const userId = user?.id ?? "";
  const selectedDate = searchParams.get("date");

  const [loading, setLoading] = useState(true);
  const [savingAttendanceKey, setSavingAttendanceKey] = useState("");
  const [schedules, setSchedules] = useState<MyScheduleItem[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<
    Map<string, AttendanceStatus>
  >(new Map());
  const [attendanceSummaryMap, setAttendanceSummaryMap] = useState<
    Map<string, AttendanceSummary>
  >(new Map());
  const [errorText, setErrorText] = useState("");

  const load = async () => {
    if (authLoading) return;

    if (!userId) {
      setSchedules([]);
      setAttendanceMap(new Map());
      setAttendanceSummaryMap(new Map());
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorText("");

    try {
      const { data: ownerTeamsRaw, error: ownerTeamsError } = await supabase
        .from("teams")
        .select("id")
        .eq("owner_id", userId);

      if (ownerTeamsError) throw ownerTeamsError;

      const { data: memberTeamsRaw, error: memberTeamsError } = await supabase
        .from("team_members")
        .select("team_id,user_id,role")
        .eq("user_id", userId);

      if (memberTeamsError) throw memberTeamsError;

      const ownerTeamIds = toArray(ownerTeamsRaw, toTeamIdRow).map(
        (row) => row.id
      );

      const memberRows = toArray(memberTeamsRaw, toTeamMemberRow);
      const memberTeamIds = memberRows.map((row) => row.team_id);

      const myTeamIds = Array.from(new Set([...ownerTeamIds, ...memberTeamIds]));

      const manageableTeamIds = Array.from(
        new Set([
          ...ownerTeamIds,
          ...memberRows
            .filter((row) => row.role === "coach" || row.role === "owner")
            .map((row) => row.team_id),
        ])
      );

      if (myTeamIds.length === 0) {
        setSchedules([]);
        setAttendanceMap(new Map());
        setAttendanceSummaryMap(new Map());
        setLoading(false);
        return;
      }

      const { data: allTeamsRaw, error: allTeamsError } = await supabase
        .from("teams")
        .select("id,name,level,strength_rank,owner_id")
        .order("updated_at", { ascending: false });

      if (allTeamsError) throw allTeamsError;

      const allTeams = Array.isArray(allTeamsRaw) ? allTeamsRaw : [];

      const teamMap = new Map(allTeams.map((t: any) => [t.id, t]));

      const today = ymdToday();

      const hostedSlotsQuery = supabase
        .from("match_slots")
        .select(
          "id,host_team_id,date,start_time,end_time,area,area_text,category,is_closed"
        )
        .in("host_team_id", myTeamIds)
        .gte("date", selectedDate || today)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(200);

      const { data: hostedSlotsRaw, error: hostedSlotsError } = selectedDate
        ? await hostedSlotsQuery.eq("date", selectedDate)
        : await hostedSlotsQuery;

      if (hostedSlotsError) throw hostedSlotsError;

      const hostedSlots = toArray(hostedSlotsRaw, toMatchSlotRow);
      const hostedSlotIds = hostedSlots.map((slot) => slot.id);

      let hostedRequests: MatchRequestRow[] = [];
      if (hostedSlotIds.length > 0) {
        const { data: hostedRequestsRaw, error: hostedRequestsError } =
          await supabase
            .from("match_requests")
            .select("id,slot_id,requester_team_id,status")
            .in("slot_id", hostedSlotIds)
            .in("status", ["pending", "accepted"]);

        if (hostedRequestsError) throw hostedRequestsError;
        hostedRequests = toArray(hostedRequestsRaw, toMatchRequestRow);
      }

      const hostedRequestBySlotId = new Map<string, MatchRequestRow>();
      for (const req of hostedRequests) {
        const current = hostedRequestBySlotId.get(req.slot_id);
        if (!current || req.status === "accepted") {
          hostedRequestBySlotId.set(req.slot_id, req);
        }
      }

      const { data: requesterRequestsRaw, error: requesterRequestsError } =
        await supabase
          .from("match_requests")
          .select("id,slot_id,requester_team_id,status")
          .in("requester_team_id", myTeamIds)
          .in("status", ["pending", "accepted"]);

      if (requesterRequestsError) throw requesterRequestsError;

      const requesterRequests = toArray(
        requesterRequestsRaw,
        toMatchRequestRow
      );

      const requesterSlotIds = Array.from(
        new Set(requesterRequests.map((row) => row.slot_id))
      ).filter((id) => !hostedSlotIds.includes(id));

      let requesterSlots: MatchSlotRow[] = [];
      if (requesterSlotIds.length > 0) {
        const requesterSlotsQuery = supabase
          .from("match_slots")
          .select(
            "id,host_team_id,date,start_time,end_time,area,area_text,category,is_closed"
          )
          .in("id", requesterSlotIds)
          .gte("date", selectedDate || today)
          .order("date", { ascending: true })
          .order("start_time", { ascending: true });

        const { data: requesterSlotsRaw, error: requesterSlotsError } =
          selectedDate
            ? await requesterSlotsQuery.eq("date", selectedDate)
            : await requesterSlotsQuery;

        if (requesterSlotsError) throw requesterSlotsError;
        requesterSlots = toArray(requesterSlotsRaw, toMatchSlotRow);
      }

      const requesterRequestBySlotId = new Map<string, MatchRequestRow>();
      for (const req of requesterRequests) {
        const current = requesterRequestBySlotId.get(req.slot_id);
        if (!current || req.status === "accepted") {
          requesterRequestBySlotId.set(req.slot_id, req);
        }
      }

      const hostedItems: MyScheduleItem[] = hostedSlots.map((slot) => {
        const req = hostedRequestBySlotId.get(slot.id);
        const opponentTeam = req ? teamMap.get(req.requester_team_id) : null;

        return {
          id: `host:${slot.id}`,
          slotId: slot.id,
          teamId: slot.host_team_id,
          date: slot.date,
          startTime: slot.start_time,
          endTime: slot.end_time,
          category: categoryLabel(slot.category) || slot.category || "未設定",
          opponent: opponentTeam?.name || (req ? "対戦相手未設定" : "募集中"),
          strength: teamStrengthLabel(opponentTeam),
          venueName: slot.area_text || slot.area || null,
          address: slot.area_text || slot.area || null,
          meetupTime: null,
          dissolveTime: null,
          parking: null,
          belongings: null,
          note: null,
          threadId: null,
          status: req?.status === "accepted" ? "confirmed" : "draft",
          role: "host",
          canSeeAttendanceSummary: manageableTeamIds.includes(slot.host_team_id),
        };
      });

      const requesterItems: MyScheduleItem[] = requesterSlots.map((slot) => {
        const req = requesterRequestBySlotId.get(slot.id);
        const hostTeam = teamMap.get(slot.host_team_id);
        const myRequestTeamId =
          req?.requester_team_id && myTeamIds.includes(req.requester_team_id)
            ? req.requester_team_id
            : myTeamIds[0];

        return {
          id: `guest:${slot.id}`,
          slotId: slot.id,
          teamId: myRequestTeamId,
          date: slot.date,
          startTime: slot.start_time,
          endTime: slot.end_time,
          category: categoryLabel(slot.category) || slot.category || "未設定",
          opponent: hostTeam?.name || "対戦相手未設定",
          strength: teamStrengthLabel(hostTeam),
          venueName: slot.area_text || slot.area || null,
          address: slot.area_text || slot.area || null,
          meetupTime: null,
          dissolveTime: null,
          parking: null,
          belongings: null,
          note: null,
          threadId: null,
          status: req?.status === "accepted" ? "confirmed" : "draft",
          role: "guest",
          canSeeAttendanceSummary: manageableTeamIds.includes(myRequestTeamId),
        };
      });

      const merged = [...hostedItems, ...requesterItems].sort((a, b) => {
        const aa = `${a.date} ${a.startTime ?? ""}`;
        const bb = `${b.date} ${b.startTime ?? ""}`;
        return aa.localeCompare(bb);
      });

      const deduped: MyScheduleItem[] = [];
      const seen = new Set<string>();

      for (const item of merged) {
        const key = `${item.slotId}:${item.teamId}:${item.role}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(item);
      }

      const slotIds = Array.from(new Set(deduped.map((item) => item.slotId)));
      const relatedTeamIds = Array.from(new Set(deduped.map((item) => item.teamId)));

      let myAttendances: AttendanceRow[] = [];
      let allAttendances: AttendanceRow[] = [];
      let allTeamMembers: TeamMemberRow[] = [];

      if (slotIds.length > 0) {
        const { data: myAttendancesRaw, error: myAttendancesError } =
          await supabase
            .from("match_attendances")
            .select("slot_id,team_id,user_id,status")
            .eq("user_id", userId)
            .in("slot_id", slotIds);

        if (myAttendancesError) throw myAttendancesError;
        myAttendances = toArray(myAttendancesRaw, toAttendanceRow);

        const { data: allAttendancesRaw, error: allAttendancesError } =
          await supabase
            .from("match_attendances")
            .select("slot_id,team_id,user_id,status")
            .in("slot_id", slotIds)
            .in("team_id", relatedTeamIds);

        if (allAttendancesError) throw allAttendancesError;
        allAttendances = toArray(allAttendancesRaw, toAttendanceRow);
      }

      if (relatedTeamIds.length > 0) {
        const { data: teamMembersRaw, error: teamMembersError } = await supabase
          .from("team_members")
          .select("team_id,user_id,role")
          .in("team_id", relatedTeamIds);

        if (teamMembersError) throw teamMembersError;
        allTeamMembers = toArray(teamMembersRaw, toTeamMemberRow);
      }

      const memberTotalByTeamId = new Map<string, Set<string>>();

      for (const teamIdValue of relatedTeamIds) {
        memberTotalByTeamId.set(teamIdValue, new Set<string>());

        const ownerId = teamMap.get(teamIdValue)?.owner_id;
        if (typeof ownerId === "string" && ownerId) {
          memberTotalByTeamId.get(teamIdValue)!.add(ownerId);
        }
      }

      for (const member of allTeamMembers) {
        if (!member.user_id) continue;
        if (!memberTotalByTeamId.has(member.team_id)) {
          memberTotalByTeamId.set(member.team_id, new Set<string>());
        }
        memberTotalByTeamId.get(member.team_id)!.add(member.user_id);
      }

      const nextAttendanceMap = new Map<string, AttendanceStatus>();
      for (const row of myAttendances) {
        nextAttendanceMap.set(`${row.slot_id}:${row.team_id}`, row.status);
      }

      const nextSummaryMap = new Map<string, AttendanceSummary>();

      for (const item of deduped) {
        const key = `${item.slotId}:${item.teamId}`;
        const memberTotal = memberTotalByTeamId.get(item.teamId)?.size ?? 0;
        nextSummaryMap.set(key, emptySummary(memberTotal));
      }

      for (const row of allAttendances) {
        const key = `${row.slot_id}:${row.team_id}`;
        const current =
          nextSummaryMap.get(key) ??
          emptySummary(memberTotalByTeamId.get(row.team_id)?.size ?? 0);

        if (row.status === "attend") current.attend += 1;
        if (row.status === "maybe") current.maybe += 1;
        if (row.status === "absent") current.absent += 1;
        current.totalAnswered += 1;

        nextSummaryMap.set(key, current);
      }

      setSchedules(deduped);
      setAttendanceMap(nextAttendanceMap);
      setAttendanceSummaryMap(nextSummaryMap);
    } catch (e: any) {
      console.error(e);
      setSchedules([]);
      setAttendanceMap(new Map());
      setAttendanceSummaryMap(new Map());
      setErrorText(e?.message ?? "予定の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [authLoading, userId, selectedDate]);

  const groupedSchedules = useMemo(() => {
    const map = new Map<string, MyScheduleItem[]>();

    schedules.forEach((s) => {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    });

    return Array.from(map.entries());
  }, [schedules]);

  const updateAttendance = async (
    item: MyScheduleItem,
    status: AttendanceStatus
  ) => {
    if (!userId) return;

    const key = `${item.slotId}:${item.teamId}`;
    const prevStatus = attendanceMap.get(key);
    setSavingAttendanceKey(key);

    try {
      const { error } = await supabase.from("match_attendances").upsert(
        {
          slot_id: item.slotId,
          team_id: item.teamId,
          user_id: userId,
          status,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "slot_id,team_id,user_id",
        }
      );

      if (error) throw error;

      setAttendanceMap((prev) => {
        const next = new Map(prev);
        next.set(key, status);
        return next;
      });

      setAttendanceSummaryMap((prev) => {
        const next = new Map(prev);
        const current = next.get(key) ?? emptySummary(0);

        if (!prevStatus) current.totalAnswered += 1;
        if (prevStatus === "attend") current.attend -= 1;
        if (prevStatus === "maybe") current.maybe -= 1;
        if (prevStatus === "absent") current.absent -= 1;

        if (status === "attend") current.attend += 1;
        if (status === "maybe") current.maybe += 1;
        if (status === "absent") current.absent += 1;

        next.set(key, current);
        return next;
      });
    } catch (e: any) {
      console.error(e);
      alert(`出欠の保存に失敗しました: ${e?.message ?? "unknown error"}`);
    } finally {
      setSavingAttendanceKey("");
    }
  };

  return (
    <main style={pageWrap}>
      <AppTabNav />

      <AppHero
        icon="🗓"
        title={
          selectedDate
            ? `日別予定（${formatDateLabel(selectedDate)}）`
            : "予定一覧"
        }
        desc={
          selectedDate
            ? "選択した日の予定と出欠を確認できます。"
            : "チームの試合予定と出欠を一覧で確認できます。"
        }
      />

      <div style={topNavWrap}>
        <Link href="/match/my-schedule/calendar" className="sh-btn">
          カレンダー
        </Link>
        {selectedDate ? (
          <Link href="/match/my-schedule" className="sh-btn sh-btn--primary">
            予定一覧
          </Link>
        ) : null}
      </div>

      {selectedDate ? (
        <div style={filterBar}>
          <div style={filterText}>
            絞り込み中：<b>{formatDateLabel(selectedDate)}</b>
          </div>

          <button
            type="button"
            className="sh-btn"
            onClick={() => {
              window.location.href = "/match/my-schedule";
            }}
          >
            絞り込み解除
          </button>
        </div>
      ) : null}

      {errorText ? (
        <div style={errorBox} className="ui-card">
          <div style={errorTitle} className="ui-title">
            読み込みエラー
          </div>
          <div className="ui-body">{errorText}</div>
        </div>
      ) : null}

      {loading || authLoading ? (
        <div style={emptyBox} className="ui-meta">
          読み込み中…
        </div>
      ) : !userId ? (
        <div style={emptyBox} className="ui-meta">
          ログイン後に表示されます
        </div>
      ) : schedules.length === 0 ? (
        <div style={emptyBox} className="ui-meta">
          {selectedDate ? "この日の予定はありません" : "直近の予定はありません"}
        </div>
      ) : (
        <section style={sectionWrap}>
          {groupedSchedules.map(([date, items]) => (
            <section key={date} style={dateSection}>
              <div style={dateTitleRow}>
                <div style={dateTitle} className="ui-title">
                  {formatDateLabel(date)}
                </div>
              </div>

              <div style={dateList}>
                {items.map((item) => {
                  const attendanceKey = `${item.slotId}:${item.teamId}`;
                  const attendance = attendanceMap.get(attendanceKey);
                  const saving = savingAttendanceKey === attendanceKey;
                  const summary = attendanceSummaryMap.get(attendanceKey);

                  return (
                    <div key={item.id} style={scheduleCard} className="ui-card">
                      <button
                        type="button"
                        style={cardMainButton}
                        onClick={() => {
                          window.location.href = `/match/${item.slotId}`;
                        }}
                      >
                        <div style={scheduleCardTop}>
                          <div style={timeText} className="ui-title">
                            {formatTime(item.startTime)}
                            {item.endTime ? `–${formatTime(item.endTime)}` : ""}
                          </div>

                          <div style={badgeRow}>
                            <span
                              style={
                                item.status === "confirmed"
                                  ? confirmedBadge
                                  : draftBadge
                              }
                            >
                              {statusLabel(item.status)}
                            </span>

                            <span style={roleBadge}>
                              {item.role === "host" ? "主催" : "参加"}
                            </span>

                            <span
                              style={
                                attendance === "attend"
                                  ? attendBadge
                                  : attendance === "absent"
                                    ? absentBadge
                                    : attendance === "maybe"
                                      ? maybeBadge
                                      : unansweredBadge
                              }
                            >
                              {attendanceLabel(attendance)}
                            </span>
                          </div>
                        </div>

                        <div style={mainInfo} className="ui-body">
                          <div>
                            <b>カテゴリ</b>：{item.category || "未設定"}
                          </div>
                          <div>
                            <b>対戦相手</b>：{item.opponent || "未設定"}
                          </div>
                          <div>
                            <b>強さ</b>：{item.strength || "未設定"}
                          </div>
                        </div>

                        <div style={subInfo} className="ui-meta">
                          <div>
                            <b>会場</b>：{item.venueName || "未設定"}
                          </div>
                          <div>
                            <b>住所</b>：{item.address || "未設定"}
                          </div>
                        </div>
                      </button>

                      <div style={attendanceActionRow}>
                        <button
                          type="button"
                          className="sh-btn sh-btn--primary"
                          onClick={() => {
                            const ok = window.confirm("この予定の出欠確認をチームチャットに送りますか？");
                            if (!ok) return;

                            window.location.href = `/chat/team/${item.teamId}?from=attendance&slotId=${item.slotId}&teamId=${item.teamId}`;
                          }}
                        >
                          出欠
                        </button>

                        <button
                          type="button"
                          className="sh-btn"
                          onClick={() => {
                            window.location.href = `/chat/team/${item.teamId}?from=my-schedule&slotId=${item.slotId}&teamId=${item.teamId}`;
                          }}
                        >
                          チャット
                        </button>
                      </div>

                      <div style={attendanceBox}>
                        <div style={attendanceTitle}>
                          自分の出欠：{attendanceLabel(attendance)}
                        </div>

                        <div style={attendanceButtonRow}>
                          <button
                            type="button"
                            style={{
                              ...attendanceButton,
                              ...(attendance === "attend"
                                ? attendanceButtonAttendActive
                                : null),
                            }}
                            disabled={saving}
                            onClick={() => updateAttendance(item, "attend")}
                          >
                            参加
                          </button>

                          <button
                            type="button"
                            style={{
                              ...attendanceButton,
                              ...(attendance === "maybe"
                                ? attendanceButtonMaybeActive
                                : null),
                            }}
                            disabled={saving}
                            onClick={() => updateAttendance(item, "maybe")}
                          >
                            未定
                          </button>

                          <button
                            type="button"
                            style={{
                              ...attendanceButton,
                              ...(attendance === "absent"
                                ? attendanceButtonAbsentActive
                                : null),
                            }}
                            disabled={saving}
                            onClick={() => updateAttendance(item, "absent")}
                          >
                            不参加
                          </button>
                        </div>

                        {item.canSeeAttendanceSummary ? (
                          <div style={summaryBox}>
                            <div style={summaryTitle}>出欠集計</div>
                            <div style={summaryGrid}>
                              <span style={summaryPillAttend}>
                                参加 {summary?.attend ?? 0}
                              </span>
                              <span style={summaryPillMaybe}>
                                未定 {summary?.maybe ?? 0}
                              </span>
                              <span style={summaryPillAbsent}>
                                不参加 {summary?.absent ?? 0}
                              </span>
                              <span style={summaryPillTotal}>
                                回答 {summary?.totalAnswered ?? 0}/
                                {summary?.memberTotal ?? 0}
                              </span>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </section>
      )}
    </main>
  );
}

const pageWrap: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  padding: 16,
};

const topNavWrap: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const filterBar: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  padding: 12,
  borderRadius: 12,
  border: "1px solid #dbeafe",
  background: "#eff6ff",
};

const filterText: React.CSSProperties = {
  color: "#1e3a8a",
  fontSize: 14,
  lineHeight: 1.6,
};

const errorBox: React.CSSProperties = {
  marginTop: 12,
  padding: 12,
};

const errorTitle: React.CSSProperties = {
  marginBottom: 4,
};

const emptyBox: React.CSSProperties = {
  marginTop: 14,
  padding: 18,
  textAlign: "center",
};

const sectionWrap: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gap: 14,
};

const dateSection: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const dateTitleRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const dateTitle: React.CSSProperties = {
  fontSize: 18,
};

const dateList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const scheduleCard: React.CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  background: "#fff",
};

const cardMainButton: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: 0,
  border: "none",
  background: "transparent",
  cursor: "pointer",
};

const scheduleCardTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const badgeRow: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "flex-end",
};

const timeText: React.CSSProperties = {
  fontSize: 16,
};

const mainInfo: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gap: 4,
  lineHeight: 1.7,
};

const subInfo: React.CSSProperties = {
  marginTop: 8,
  display: "grid",
  gap: 4,
  lineHeight: 1.7,
};

const confirmedBadge: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 700,
};

const draftBadge: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "#ffedd5",
  color: "#c2410c",
  fontWeight: 700,
};

const roleBadge: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "#eef6f0",
  color: "#14532d",
  fontWeight: 700,
};

const attendBadge: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 700,
};

const maybeBadge: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "#fef3c7",
  color: "#92400e",
  fontWeight: 700,
};

const absentBadge: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "#fee2e2",
  color: "#991b1b",
  fontWeight: 700,
};

const unansweredBadge: React.CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  background: "#f3f4f6",
  color: "#4b5563",
  fontWeight: 700,
};

const attendanceBox: React.CSSProperties = {
  marginTop: 12,
  paddingTop: 12,
  borderTop: "1px solid #e5e7eb",
  display: "grid",
  gap: 8,
};

const attendanceTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#374151",
};

const attendanceButtonRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const attendanceButton: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 999,
  background: "#fff",
  color: "#374151",
  padding: "7px 12px",
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
  marginTop: 6,
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

const attendanceActionRow: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};