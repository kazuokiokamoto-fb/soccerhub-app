"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import { categoryLabel } from "@/app/lib/categories";

import { Calendar } from "@/app/match/components/Calendar";
import { DaySlotList } from "@/app/match/components/DaySlotList";
import { MatchHelpModals } from "@/app/match/components/MatchHelpModals";

import { useMatchFilters } from "@/app/match/hooks/useMatchFilters";
import { useMatchData } from "@/app/match/hooks/useMatchData";

import {
  buildCalendarCells,
  addMonths,
  startOfMonth,
  toMonthKey,
  ymdToday,
} from "@/app/match/utils/date";
import { matchesSlotFilters } from "@/app/match/utils/filters";

import type { StrengthRank } from "@/app/components/StrengthRankPicker";

import {
  MatchCalendarBase,
  type CalendarItem,
} from "@/app/match/components/MatchCalendarBase";

import { SelectionSection } from "@/app/home/components/SelectionSection";

type CalendarShortStatus = "decided" | "open" | "other";

type DayCalendarSummary = {
  label: "決" | "募" | "他";
  count: number;
  tone: CalendarShortStatus;
};

type PanelMode = "none" | "team";

type MyScheduleItem = {
  slotId: string;
  date: string;
  startTime: string;
  endTime: string;
  areaText: string;
  categoryText: string;
  role: "host" | "guest";
};

function norm(v?: string | null) {
  return String(v ?? "").trim();
}

function levelToRank(level?: number | null) {
  const n = Number(level ?? 0);
  if (!Number.isFinite(n)) return "";
  if (n >= 9) return "SS";
  if (n >= 7) return "S";
  if (n >= 5) return "A";
  if (n >= 3) return "B";
  return "C";
}

function teamStrengthLabel(team: any) {
  if (!team) return "未設定";
  if (team.strength_rank) return team.strength_rank;

  const level = Number(team.level ?? 0);
  if (!Number.isFinite(level)) return "未設定";
  if (level >= 9) return "SS";
  if (level >= 7) return "S";
  if (level >= 5) return "A";
  if (level >= 3) return "B";
  return "C";
}

function parseBikeCapacity(value?: string | null) {
  const v = String(value ?? "").trim();
  if (!v || v === "不明") return null;
  if (v.includes("50")) return 50;

  const n = Number(v.replace(/[^\d]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function buildMatchCarryQuery(params: {
  slotId?: string | null;
  date?: string | null;
}) {
  const qs = new URLSearchParams();
  qs.set("from", "home");
  if (params.slotId) qs.set("slotId", params.slotId);
  if (params.date) qs.set("date", params.date);
  return qs.toString();
}

function filterSummaryTextFromFilters(filters: {
  keyword: string;
  categoryFilter: string[];
  prefectureFilter: string;
  cityFilter: string;
  townFilter: string;
  groundFilter: "all" | "あり" | "なし";
  strengthFilter: StrengthRank[];
  bikeFilter: "all" | "あり" | "なし" | "不明";
  bikeCapacityMin: string;
  memberCountMin: string;
}) {
  const parts: string[] = [];

  if (filters.keyword.trim()) {
    parts.push(`キーワード: ${filters.keyword.trim()}`);
  }

  if (filters.prefectureFilter) {
    parts.push(`都道府県: ${filters.prefectureFilter}`);
  }

  if (filters.cityFilter) {
    parts.push(`市区町村: ${filters.cityFilter}`);
  }

  if (filters.townFilter) {
    parts.push(`町名: ${filters.townFilter}`);
  }

  if (filters.categoryFilter.length > 0) {
    parts.push(
      `カテゴリ: ${filters.categoryFilter
        .map((v) => categoryLabel(v) || v)
        .join(" / ")}`
    );
  }

  if (filters.groundFilter !== "all") {
    parts.push(`グラウンド: ${filters.groundFilter}`);
  }

  if (filters.strengthFilter.length > 0) {
    parts.push(`強さ: ${filters.strengthFilter.join(" / ")}`);
  }

  if (filters.bikeFilter !== "all") {
    parts.push(`駐輪場: ${filters.bikeFilter}`);
  }

  if (filters.bikeCapacityMin) {
    parts.push(`駐輪場台数: ${filters.bikeCapacityMin}台以上`);
  }

  if (filters.memberCountMin) {
    parts.push(`所属人数: ${filters.memberCountMin}人以上`);
  }

  return parts.join(" / ");
}

function firstDayYmdOfMonth(date: Date) {
  return `${toMonthKey(date)}-01`;
}

function teamMatchesFilters(
  team: any,
  filters: {
    keyword: string;
    categoryFilter: string[];
    prefectureFilter: string;
    cityFilter: string;
    townFilter: string;
    groundFilter: "all" | "あり" | "なし";
    strengthFilter: StrengthRank[];
    bikeFilter: "all" | "あり" | "なし" | "不明";
    bikeCapacityMin: string;
    memberCountMin: string;
  }
) {
  if (!team) return false;

  const teamCategories =
    Array.isArray(team.categories) && team.categories.length > 0
      ? team.categories
      : team.category
        ? [team.category]
        : [];

  if (filters.categoryFilter.length > 0) {
    const ok = teamCategories.some((c: string) =>
      filters.categoryFilter.includes(String(c).trim())
    );
    if (!ok) return false;
  }

  if (
    filters.prefectureFilter &&
    norm(team.prefecture) !== filters.prefectureFilter
  ) {
    return false;
  }

  if (filters.cityFilter && norm(team.city) !== filters.cityFilter) {
    return false;
  }

  if (filters.townFilter && norm(team.town) !== filters.townFilter) {
    return false;
  }

  if (filters.groundFilter !== "all") {
    const ground = team.has_ground ? "あり" : "なし";
    if (ground !== filters.groundFilter) return false;
  }

  if (filters.strengthFilter.length > 0) {
    const rank = team.strength_rank || levelToRank(team.level);
    if (!filters.strengthFilter.includes(rank)) return false;
  }

  if (filters.bikeFilter !== "all") {
    const bike = (team.bike_parking ?? "不明") as "あり" | "なし" | "不明";
    if (bike !== filters.bikeFilter) return false;
  }

  if (filters.bikeCapacityMin) {
    const cap = parseBikeCapacity(team.bike_parking_capacity);
    if (cap == null || cap < Number(filters.bikeCapacityMin)) return false;
  }

  if (filters.memberCountMin) {
    const count = Number(team.member_count ?? 0);
    if (count < Number(filters.memberCountMin)) return false;
  }

  if (filters.keyword.trim()) {
    const q = filters.keyword.trim().toLowerCase();
    const hay = [
      team.name,
      team.area,
      team.prefecture,
      team.city,
      team.town,
      team.category,
      ...(teamCategories ?? []),
      team.uniform_main,
      team.uniform_sub,
      team.note,
      team.bike_parking,
      team.bike_parking_capacity,
      String(team.member_count ?? ""),
      String(team.strength_rank ?? ""),
      levelToRank(team.level),
    ]
      .join(" ")
      .toLowerCase();

    if (!hay.includes(q)) return false;
  }

  return true;
}

function formatScheduleDate(ymd: string) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return `${m}/${d}`;
}

export default function HomeCalendar(props: {
  initialPanelMode?: PanelMode;
}) {
  const { initialPanelMode = "none" } = props;

  const { user, loading: authLoading } = useAuth();
  const authUserId = user?.id ?? "";

  const [monthDate, setMonthDate] = useState<Date>(() =>
    startOfMonth(new Date())
  );
  const [selectedYmd, setSelectedYmd] = useState<string>(ymdToday());
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

  const [requestTeamId, setRequestTeamId] = useState<string>("");
  const [requestComment, setRequestComment] = useState<string>("");

  const [showStrengthHelp, setShowStrengthHelp] = useState(false);
  const [showCalendarHelp, setShowCalendarHelp] = useState(false);
  const [showMatchCalendar, setShowMatchCalendar] = useState(false);

  const [showMyScheduleCalendar, setShowMyScheduleCalendar] = useState(false);
  const [myScheduleCalendarMonth, setMyScheduleCalendarMonth] = useState(() =>
    startOfMonth(new Date())
  );
  const [myScheduleCalendarLoading, setMyScheduleCalendarLoading] = useState(false);
  const [myScheduleCalendarError, setMyScheduleCalendarError] = useState("");
  const [myScheduleSummaries, setMyScheduleSummaries] = useState<
    Map<string, { total: number; confirmed: number; draft: number }>
  >(new Map());

  const [myUpcomingSchedules, setMyUpcomingSchedules] = useState<
    MyScheduleItem[]
  >([]);
  const [myScheduleLoading, setMyScheduleLoading] = useState(false);

  const homeTopRef = useRef<HTMLDivElement | null>(null);
  const calendarRef = useRef<HTMLDivElement | null>(null);
  const dayListRef = useRef<HTMLDivElement | null>(null);

  const myScheduleCalendarRef = useRef<HTMLDivElement | null>(null);

  const {
    keyword,
    setKeyword,
    categoryFilter,
    setCategoryFilter,
    prefectureFilter,
    setPrefectureFilter,
    cityFilter,
    setCityFilter,
    townFilter,
    setTownFilter,
    groundFilter,
    setGroundFilter,
    strengthFilter,
    setStrengthFilter,
    bikeFilter,
    setBikeFilter,
    bikeCapacityMin,
    setBikeCapacityMin,
    memberCountMin,
    setMemberCountMin,
    filters,
    clearAllFilters,
  } = useMatchFilters();

  const authReady = !authLoading;

  const {
    loadingBase,
    loadingMonth,
    baseError,
    monthError,
    meId,
    allTeams,
    myTeams,
    venues,
    slotsInMonth,
    requestsForMonth,
    loadMonth,
  } = useMatchData({
    monthDate,
    authReady,
    currentUserId: authUserId,
  });

  const loading = loadingBase || loadingMonth;
  const currentUserId = authUserId || meId;

  useEffect(() => {
    if (!requestTeamId && myTeams[0]?.id) {
      setRequestTeamId(myTeams[0].id);
    }
  }, [myTeams, requestTeamId]);

  const myTeamIds = useMemo(() => myTeams.map((t: any) => t.id), [myTeams]);

  useEffect(() => {
    let active = true;

    const loadMyScheduleCalendar = async () => {
      if (!showMyScheduleCalendar) return;

      if (!authReady || myTeamIds.length === 0) {
        setMyScheduleSummaries(new Map());
        return;
      }

      setMyScheduleCalendarLoading(true);
      setMyScheduleCalendarError("");

      try {
        const startStr = `${toMonthKey(myScheduleCalendarMonth)}-01`;
        const endMonth = addMonths(myScheduleCalendarMonth, 1);
        const endStr = `${toMonthKey(endMonth)}-01`;

        const { data: teamSchedulesRaw, error: teamSchedulesError } =
          await supabase
            .from("team_schedules")
            .select("id,team_id,date,status")
            .in("team_id", myTeamIds)
            .gte("date", startStr)
            .lt("date", endStr)
            .order("date", { ascending: true });

        if (teamSchedulesError) throw teamSchedulesError;

        const { data: hostedSlotsRaw, error: hostedSlotsError } = await supabase
          .from("match_slots")
          .select("id,host_team_id,date")
          .in("host_team_id", myTeamIds)
          .gte("date", startStr)
          .lt("date", endStr)
          .order("date", { ascending: true });

        if (hostedSlotsError) throw hostedSlotsError;

        const hostedSlots = Array.isArray(hostedSlotsRaw) ? hostedSlotsRaw : [];
        const hostedSlotIds = hostedSlots.map((slot: any) => slot.id);

        let hostedRequests: any[] = [];

        if (hostedSlotIds.length > 0) {
          const { data, error } = await supabase
            .from("match_requests")
            .select("id,slot_id,requester_team_id,status")
            .in("slot_id", hostedSlotIds)
            .in("status", ["pending", "accepted"]);

          if (error) throw error;
          hostedRequests = Array.isArray(data) ? data : [];
        }

        const hostedRequestBySlotId = new Map<string, any>();
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

        const requesterRequests = Array.isArray(requesterRequestsRaw)
          ? requesterRequestsRaw
          : [];

        const requesterSlotIds = Array.from(
          new Set(requesterRequests.map((row: any) => row.slot_id))
        ).filter((id) => !hostedSlotIds.includes(id));

        let requesterSlots: any[] = [];

        if (requesterSlotIds.length > 0) {
          const { data, error } = await supabase
            .from("match_slots")
            .select("id,host_team_id,date")
            .in("id", requesterSlotIds)
            .gte("date", startStr)
            .lt("date", endStr)
            .order("date", { ascending: true });

          if (error) throw error;
          requesterSlots = Array.isArray(data) ? data : [];
        }

        const requesterRequestBySlotId = new Map<string, any>();
        for (const req of requesterRequests) {
          const current = requesterRequestBySlotId.get(req.slot_id);
          if (!current || req.status === "accepted") {
            requesterRequestBySlotId.set(req.slot_id, req);
          }
        }

        const map = new Map<
          string,
          { total: number; confirmed: number; draft: number }
        >();

        const seen = new Set<string>();

        const addSummary = (date: string, status: "confirmed" | "draft") => {
          if (!date) return;

          const current = map.get(date) ?? {
            total: 0,
            confirmed: 0,
            draft: 0,
          };

          current.total += 1;

          if (status === "confirmed") {
            current.confirmed += 1;
          } else {
            current.draft += 1;
          }

          map.set(date, current);
        };

        for (const item of Array.isArray(teamSchedulesRaw) ? teamSchedulesRaw : []) {
          const seenKey = `team_schedule:${item.id}`;
          if (seen.has(seenKey)) continue;
          seen.add(seenKey);

          addSummary(
            String(item.date ?? ""),
            item.status === "confirmed" ? "confirmed" : "draft"
          );
        }

        for (const slot of hostedSlots) {
          const seenKey = `host:${slot.id}`;
          if (seen.has(seenKey)) continue;
          seen.add(seenKey);

          const req = hostedRequestBySlotId.get(slot.id);
          addSummary(
            String(slot.date ?? ""),
            req?.status === "accepted" ? "confirmed" : "draft"
          );
        }

        for (const slot of requesterSlots) {
          const req = requesterRequestBySlotId.get(slot.id);
          const requesterTeamId = req?.requester_team_id ?? "";

          const seenKey = `guest:${slot.id}:${requesterTeamId}`;
          if (seen.has(seenKey)) continue;
          seen.add(seenKey);

          addSummary(
            String(slot.date ?? ""),
            req?.status === "accepted" ? "confirmed" : "draft"
          );
        }

        if (!active) return;
        setMyScheduleSummaries(map);
      } catch (e: any) {
        console.error("loadMyScheduleCalendar error:", e);
        if (!active) return;
        setMyScheduleSummaries(new Map());
        setMyScheduleCalendarError(e?.message ?? "予定の取得に失敗しました");
      } finally {
        if (active) setMyScheduleCalendarLoading(false);
      }
    };

    void loadMyScheduleCalendar();

    return () => {
      active = false;
    };
  }, [showMyScheduleCalendar, authReady, myTeamIds, myScheduleCalendarMonth]);

  const teamMap = useMemo(() => {
    return new Map(allTeams.map((t) => [t.id, t]));
  }, [allTeams]);

  const requestTeamNameMap = useMemo(() => {
    return new Map(allTeams.map((t) => [t.id, t.name || "チーム未設定"]));
  }, [allTeams]);

  const hasAnyActiveFilter = useMemo(() => {
    return (
      !!filters.keyword.trim() ||
      filters.categoryFilter.length > 0 ||
      !!filters.prefectureFilter ||
      !!filters.cityFilter ||
      !!filters.townFilter ||
      filters.groundFilter !== "all" ||
      filters.strengthFilter.length > 0 ||
      filters.bikeFilter !== "all" ||
      !!filters.bikeCapacityMin ||
      !!filters.memberCountMin
    );
  }, [filters]);

  const filteredSlotsInMonth = useMemo(() => {
    if (!hasAnyActiveFilter) return slotsInMonth;

    return slotsInMonth.filter((s: any) =>
      matchesSlotFilters(s, teamMap as any, filters)
    );
  }, [slotsInMonth, teamMap, filters, hasAnyActiveFilter]);

  const filteredTeams = useMemo(() => {
    if (!hasAnyActiveFilter) {
      return allTeams;
    }

    return allTeams.filter((team: any) => {
      return teamMatchesFilters(team, filters);
    });
  }, [allTeams, filters, hasAnyActiveFilter]);

  const countByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of filteredSlotsInMonth) {
      m.set(s.date, (m.get(s.date) ?? 0) + 1);
    }
    return m;
  }, [filteredSlotsInMonth]);

  const requestsBySlotId = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of requestsForMonth) {
      if (!m.has(r.slot_id)) m.set(r.slot_id, []);
      m.get(r.slot_id)!.push(r);
    }
    return m;
  }, [requestsForMonth]);

  const getSlotStatus = React.useCallback(
    (slot: any): CalendarShortStatus => {
      const reqs = requestsBySlotId.get(slot.id) ?? [];
      const acceptedReq = reqs.find((r) => r.status === "accepted");

      if (acceptedReq) {
        if (
          myTeamIds.includes(slot.host_team_id) ||
          myTeamIds.includes(acceptedReq.requester_team_id)
        ) {
          return "decided";
        }
        return "other";
      }

      return "open";
    },
    [requestsBySlotId, myTeamIds]
  );

  const dayStatusSummaryByDate = useMemo(() => {
    const grouped = new Map<string, any[]>();

    for (const slot of filteredSlotsInMonth) {
      const day = slot.date;
      if (!grouped.has(day)) grouped.set(day, []);
      grouped.get(day)!.push(slot);
    }

    const result = new Map<string, DayCalendarSummary>();

    for (const [day, daySlots] of grouped.entries()) {
      let decidedCount = 0;
      let openCount = 0;
      let otherCount = 0;

      for (const slot of daySlots) {
        const status = getSlotStatus(slot);
        if (status === "decided") decidedCount += 1;
        else if (status === "open") openCount += 1;
        else if (status === "other") otherCount += 1;
      }

      if (decidedCount > 0) {
        result.set(day, {
          label: "決",
          count: decidedCount,
          tone: "decided",
        });
      } else if (openCount > 0) {
        result.set(day, {
          label: "募",
          count: openCount,
          tone: "open",
        });
      } else if (otherCount > 0) {
        result.set(day, {
          label: "他",
          count: otherCount,
          tone: "other",
        });
      }
    }

    return result;
  }, [filteredSlotsInMonth, getSlotStatus]);

  const slotsOnSelectedDate = useMemo(() => {
    return filteredSlotsInMonth.filter((s: any) => s.date === selectedYmd);
  }, [filteredSlotsInMonth, selectedYmd]);

  const selectedSlot = useMemo(() => {
    return filteredSlotsInMonth.find((s) => s.id === selectedSlotId) || null;
  }, [filteredSlotsInMonth, selectedSlotId]);

  const selectedHostTeam = useMemo(() => {
    if (!selectedSlot) return null;
    return teamMap.get(selectedSlot.host_team_id) || null;
  }, [selectedSlot, teamMap]);

  const selectedSlotRequests = useMemo(() => {
    if (!selectedSlotId) return [];
    return requestsForMonth.filter((r) => r.slot_id === selectedSlotId);
  }, [requestsForMonth, selectedSlotId]);

  const isMineSlot = useMemo(() => {
    if (!selectedSlot) return false;
    return !!currentUserId && selectedSlot.owner_id === currentUserId;
  }, [selectedSlot, currentUserId]);

  const calendarCells = useMemo(
    () => buildCalendarCells(monthDate),
    [monthDate]
  );
  const monthKey = useMemo(() => toMonthKey(monthDate), [monthDate]);

  useEffect(() => {
    const selectedMonthKey = toMonthKey(monthDate);
    const today = ymdToday();
    const todayMonthKey = today.slice(0, 7);

    if (selectedYmd.startsWith(selectedMonthKey)) return;

    if (selectedMonthKey === todayMonthKey) {
      setSelectedYmd(today);
      return;
    }

    setSelectedYmd(firstDayYmdOfMonth(monthDate));
  }, [monthDate, selectedYmd]);

  useEffect(() => {
    let active = true;

    const loadMyUpcomingSchedules = async () => {
      if (!authReady || myTeamIds.length === 0) {
        if (active) {
          setMyUpcomingSchedules([]);
          setMyScheduleLoading(false);
        }
        return;
      }

      setMyScheduleLoading(true);

      try {
        const today = ymdToday();

        const { data: hostedSlotsRaw, error: hostedSlotsError } = await supabase
          .from("match_slots")
          .select(
            "id, date, start_time, end_time, area, area_text, category, host_team_id"
          )
          .in("host_team_id", myTeamIds)
          .gte("date", today)
          .order("date", { ascending: true })
          .order("start_time", { ascending: true })
          .limit(50);

        if (hostedSlotsError) throw hostedSlotsError;

        const hostedSlots = (hostedSlotsRaw ?? []) as any[];
        const hostedSlotIds = hostedSlots.map((slot) => slot.id);

        let hostedAcceptedSlotIds: string[] = [];
        if (hostedSlotIds.length > 0) {
          const { data: hostedAcceptedRaw, error: hostedAcceptedError } =
            await supabase
              .from("match_requests")
              .select("slot_id")
              .in("slot_id", hostedSlotIds)
              .eq("status", "accepted");

          if (hostedAcceptedError) throw hostedAcceptedError;

          hostedAcceptedSlotIds = Array.from(
            new Set(
              ((hostedAcceptedRaw ?? []) as Array<{ slot_id: string }>).map(
                (row) => row.slot_id
              )
            )
          );
        }

        const { data: requesterAcceptedRaw, error: requesterAcceptedError } =
          await supabase
            .from("match_requests")
            .select("slot_id, requester_team_id")
            .in("requester_team_id", myTeamIds)
            .eq("status", "accepted");

        if (requesterAcceptedError) throw requesterAcceptedError;

        const requesterAccepted = (requesterAcceptedRaw ?? []) as Array<{
          slot_id: string;
          requester_team_id: string;
        }>;

        const requesterSlotIds = Array.from(
          new Set(requesterAccepted.map((row) => row.slot_id))
        ).filter((id) => !hostedSlotIds.includes(id));

        let requesterSlots: any[] = [];
        if (requesterSlotIds.length > 0) {
          const { data: requesterSlotsRaw, error: requesterSlotsError } =
            await supabase
              .from("match_slots")
              .select(
                "id, date, start_time, end_time, area, area_text, category, host_team_id"
              )
              .in("id", requesterSlotIds)
              .gte("date", today)
              .order("date", { ascending: true })
              .order("start_time", { ascending: true });

          if (requesterSlotsError) throw requesterSlotsError;
          requesterSlots = (requesterSlotsRaw ?? []) as any[];
        }

        const hostedItems: MyScheduleItem[] = hostedSlots
          .filter((slot) => hostedAcceptedSlotIds.includes(slot.id))
          .map((slot) => ({
            slotId: slot.id,
            date: String(slot.date ?? ""),
            startTime: String(slot.start_time ?? ""),
            endTime: String(slot.end_time ?? ""),
            areaText: String(slot.area_text ?? slot.area ?? "未設定"),
            categoryText: String(
              categoryLabel(slot.category) || slot.category || "未設定"
            ),
            role: "host" as const,
          }));

        const requesterItems: MyScheduleItem[] = requesterSlots.map((slot) => ({
          slotId: slot.id,
          date: String(slot.date ?? ""),
          startTime: String(slot.start_time ?? ""),
          endTime: String(slot.end_time ?? ""),
          areaText: String(slot.area_text ?? slot.area ?? "未設定"),
          categoryText: String(
            categoryLabel(slot.category) || slot.category || "未設定"
          ),
          role: "guest" as const,
        }));

        const merged = [...hostedItems, ...requesterItems]
          .filter((item) => !!item.date)
          .sort((a, b) => {
            const aa = `${a.date} ${a.startTime}`;
            const bb = `${b.date} ${b.startTime}`;
            return aa.localeCompare(bb);
          });

        const deduped: MyScheduleItem[] = [];
        const seen = new Set<string>();

        for (const item of merged) {
          if (seen.has(item.slotId)) continue;
          seen.add(item.slotId);
          deduped.push(item);
        }

        if (!active) return;
        setMyUpcomingSchedules(deduped);
      } catch (e) {
        console.error("loadMyUpcomingSchedules error:", e);
        if (!active) return;
        setMyUpcomingSchedules([]);
      } finally {
        if (active) {
          setMyScheduleLoading(false);
        }
      }
    };

    void loadMyUpcomingSchedules();

    return () => {
      active = false;
    };
  }, [authReady, myTeamIds]);

  const scrollToDayList = () => {
    setTimeout(() => {
      dayListRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  };

  const openTeamFilterPage = () => {
    window.location.href = "/teams/search";
  };

  const openTeamListWindow = () => {
    window.location.href = "/teams";
  };

  const openMySchedulePage = () => {
    window.location.href = "/match/my-schedule";
  };

  const openManualScheduleCreatePage = () => {
    if (!authReady) return;

    if (!currentUserId) {
      window.location.href = "/login";
      return;
    }

    const firstTeam = myTeams[0];
    if (!firstTeam?.id) {
      alert("先にチーム登録をしてください");
      window.location.href = "/teams/new";
      return;
    }

    const params = new URLSearchParams();
    params.set("teamId", firstTeam.id);
    params.set("date", ymdToday());

    window.location.href = `/match/my-schedule/new?${params.toString()}`;
  };

  const goToCreatePage = (ymd: string) => {
    if (!authReady) return;

    if (!currentUserId) {
      window.location.href = "/login";
      return;
    }

    const firstTeam = myTeams[0];
    if (!firstTeam?.id) {
      alert("先にチーム登録をしてください");
      window.location.href = "/teams/new";
      return;
    }

    const params = new URLSearchParams();
    if (ymd) params.set("date", ymd);
    params.set("hostTeamId", firstTeam.id);

    if (firstTeam.category) params.set("category", firstTeam.category);
    if (firstTeam.area) params.set("area", firstTeam.area);

    const query = params.toString();
    window.location.href = query ? `/match/new?${query}` : "/match/new";
  };

  const getOrCreateDmThread = async (myTeamId: string, otherTeamId: string) => {
    const { data, error } = await supabase.rpc("rpc_get_or_create_dm_thread", {
      my_team_id: myTeamId,
      other_team_id: otherTeamId,
    });

    if (error) throw error;
    return data as string;
  };

  const insertChatMessage = async (params: {
    threadId: string;
    senderId: string;
    senderTeamId: string | null;
    body: string;
  }) => {
    const { threadId, senderId, senderTeamId, body } = params;

    const { error } = await supabase.from("chat_messages").insert({
      thread_id: threadId,
      sender_id: senderId,
      sender_team_id: senderTeamId,
      body,
    });

    if (error) throw error;
  };

  const openDmAndGo = async (otherTeamId: string, slot?: any | null) => {
    try {
      if (!currentUserId) {
        window.location.href = "/login";
        return;
      }

      const myTeamId = requestTeamId || myTeams[0]?.id;
      if (!myTeamId) {
        alert("自分のチームがありません");
        return;
      }
      if (!otherTeamId || myTeamId === otherTeamId) return;

      const threadId = await getOrCreateDmThread(myTeamId, otherTeamId);

      const carryQuery = buildMatchCarryQuery({
        slotId: slot?.id ?? selectedSlotId ?? "",
        date: slot?.date ?? selectedYmd,
      });

      window.location.href = `/chat/${threadId}?${carryQuery}`;
    } catch (e: any) {
      console.error(e);
      alert(`チャットを開けません: ${e?.message ?? "unknown error"}`);
    }
  };

  const requestSlot = async (slotId: string) => {
    const slot = filteredSlotsInMonth.find((s) => s.id === slotId);
    if (!slot) return;

    if (!currentUserId) {
      window.location.href = "/login";
      return;
    }

    if (slot.is_closed) {
      alert("この募集は締切です");
      return;
    }

    const acceptedExists = requestsForMonth.some(
      (r) => r.slot_id === slotId && r.status === "accepted"
    );
    if (acceptedExists) {
      alert("この募集はすでに成立済みです");
      return;
    }

    if (!requestTeamId) {
      alert("申込みチームを選んでください");
      return;
    }

    const uid = currentUserId;

    const already = requestsForMonth.some(
      (r) =>
        r.slot_id === slotId &&
        r.requester_team_id === requestTeamId &&
        r.status !== "cancelled"
    );
    if (already) {
      alert("この募集にはこのチームですでに申込済みです");
      return;
    }

    const defaultComment =
      "はじめまして。練習試合を希望しています。条件が合えばぜひお願いします。";

    const finalComment = (requestComment.trim() || defaultComment).trim();
    const confirmText = `この内容で試合申込しますか？\n\nコメント:\n${finalComment}`;
    if (!window.confirm(confirmText)) return;

    const payload = {
      slot_id: slotId,
      requester_team_id: requestTeamId,
      requester_user_id: uid,
      status: "pending" as const,
      comment: finalComment || null,
    };

    const { data: insertedRequest, error } = await supabase
      .from("match_requests")
      .insert(payload)
      .select(
        "id, slot_id, requester_team_id, requester_user_id, status, comment, created_at"
      )
      .single();

    if (error) {
      console.error(error);

      if (
        error.message?.includes("match_requests_slot_id_requester_team_id_key") ||
        error.message?.includes("match_requests_active_unique_idx")
      ) {
        alert("この募集にはこのチームですでに申込済みです");
        return;
      }

      alert(`申込みに失敗しました: ${error.message}`);
      return;
    }

    const hostTeam = teamMap.get(slot.host_team_id);
    const requesterTeam = myTeams.find((t) => t.id === requestTeamId);

    let threadId = "";
    try {
      threadId = await getOrCreateDmThread(requestTeamId, slot.host_team_id);
    } catch (e) {
      console.error("thread create failed:", e);
    }

    try {
      const { data: hostTeamRow, error: hostTeamErr } = await supabase
        .from("teams")
        .select("owner_id")
        .eq("id", slot.host_team_id)
        .maybeSingle();

      if (hostTeamErr) {
        console.error("host team owner fetch error:", hostTeamErr);
      }

      const hostUserId =
        (hostTeamRow as { owner_id?: string | null } | null)?.owner_id ?? "";

      if (hostUserId) {
        const notificationTitle = "新しい試合申込み";
        const notificationBody = `${
          requesterTeam?.name ?? "相手チーム"
        } から申込みが届きました`;

        const carryQuery = buildMatchCarryQuery({
          slotId: slot.id,
          date: slot.date,
        });

        const notificationUrl = threadId
          ? `/chat/${threadId}?${carryQuery}`
          : "/chat";

        const { error: notificationErr } = await supabase
          .from("notifications")
          .insert({
            user_id: hostUserId,
            type: "match_request",
            title: notificationTitle,
            body: notificationBody,
            target_url: notificationUrl,
            is_read: false,
            related_team_id: requestTeamId,
            related_request_id: insertedRequest.id,
            related_thread_id: threadId || null,
          });

        if (notificationErr) {
          console.error("notification insert error:", notificationErr);
        } else {
          try {
            const pushRes = await fetch("/api/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: hostUserId,
                title: notificationTitle,
                body: notificationBody,
                url: notificationUrl,
              }),
            });

            if (!pushRes.ok) {
              const pushJson = await pushRes.json().catch(() => null);
              console.error("push send error:", pushJson ?? pushRes.statusText);
            }
          } catch (e) {
            console.error("push send fetch error:", e);
          }
        }
      }
    } catch (e) {
      console.error("request notification error:", e);
    }

    try {
      if (!threadId) {
        threadId = await getOrCreateDmThread(requestTeamId, slot.host_team_id);
      }

      const bodyLines = [
        "━━━━━━━━━━━━",
        "⚽️ 試合申込",
        "━━━━━━━━━━━━",
        `📅 ${slot.date} ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`,
        `📍 ${slot.area_text ?? slot.area ?? "未設定"}`,
        `🏷 ${categoryLabel(slot.category) || slot.category || "未設定"}`,
        "",
        `👥 申込チーム：${requesterTeam?.name ?? "未設定"}`,
        `💪 強さ：${teamStrengthLabel(requesterTeam)}`,
        "",
        `👥 募集チーム：${hostTeam?.name ?? "未設定"}`,
        `💪 強さ：${teamStrengthLabel(hostTeam)}`,
        "",
        `💬 ${finalComment}`,
      ].filter(Boolean);

      await insertChatMessage({
        threadId,
        senderId: uid,
        senderTeamId: requestTeamId,
        body: bodyLines.join("\n"),
      });

      const carryQuery = buildMatchCarryQuery({
        slotId: slot.id,
        date: slot.date,
      });

      window.location.href = `/chat/${threadId}?${carryQuery}`;
      return;
    } catch (e) {
      console.error("chat relay failed:", e);
    }

    setRequestComment("");
    setSelectedSlotId(slotId);
    await loadMonth();
    scrollToDayList();
  };

  const updateRequestStatus = async (
    requestId: string,
    status: "accepted" | "rejected"
  ) => {
    const target = requestsForMonth.find((r) => r.id === requestId);
    if (!target) return false;

    const slot = filteredSlotsInMonth.find((s) => s.id === target.slot_id);
    if (!slot) return false;

    const { error } = await supabase
      .from("match_requests")
      .update({ status })
      .eq("id", requestId);

    if (error) {
      console.error(error);
      alert(`更新に失敗しました: ${error.message}`);
      return false;
    }

    if (status === "accepted") {
      await supabase
        .from("match_slots")
        .update({ is_closed: true })
        .eq("id", target.slot_id);

      try {
        const uid = currentUserId;
        if (uid) {
          const threadId = await getOrCreateDmThread(
            slot.host_team_id,
            target.requester_team_id
          );

          const requesterTeamName =
            requestTeamNameMap.get(target.requester_team_id) ?? "相手チーム";
          const hostTeamName =
            requestTeamNameMap.get(slot.host_team_id) ?? "募集チーム";
          const requesterTeam = teamMap.get(target.requester_team_id);
          const hostTeam = teamMap.get(slot.host_team_id);

          await insertChatMessage({
            threadId,
            senderId: uid,
            senderTeamId: slot.host_team_id,
            body: [
              "━━━━━━━━━━━━",
              "✅ 試合成立（承認）",
              "━━━━━━━━━━━━",
              `📅 ${slot.date} ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`,
              `🏷 ${categoryLabel(slot.category) || slot.category || "未設定"}`,
              "",
              `👥 募集チーム：${hostTeamName}`,
              `💪 強さ：${teamStrengthLabel(hostTeam)}`,
              "",
              `👥 対戦チーム：${requesterTeamName}`,
              `💪 強さ：${teamStrengthLabel(requesterTeam)}`,
              "",
              "📩 このチャットで詳細を調整してください",
            ].join("\n"),
          });
        }
      } catch (e) {
        console.error("accepted auto chat failed:", e);
      }
    }

    return true;
  };

  const accept = async (requestId: string) => {
    const ok = await updateRequestStatus(requestId, "accepted");
    if (!ok) return;
    await loadMonth();
  };

  const reject = async (requestId: string) => {
    const ok = await updateRequestStatus(requestId, "rejected");
    if (!ok) return;
    await loadMonth();
  };

  const cancelMyRequest = async (requestId: string) => {
    if (!window.confirm("申込みを撤回しますか？")) return;

    const req = requestsForMonth.find((r) => r.id === requestId);
    if (!req) return;

    const { error } = await supabase
      .from("match_requests")
      .update({ status: "cancelled" })
      .eq("id", requestId);

    if (error) {
      console.error(error);
      alert(`申込み撤回に失敗しました: ${error.message}`);
      return;
    }

    try {
      const slot = filteredSlotsInMonth.find((s) => s.id === req.slot_id);
      const uid = currentUserId;

      if (slot && uid) {
        const threadId = await getOrCreateDmThread(
          req.requester_team_id,
          slot.host_team_id
        );
        const requesterTeamName =
          requestTeamNameMap.get(req.requester_team_id) ?? "申込チーム";

        await insertChatMessage({
          threadId,
          senderId: uid,
          senderTeamId: req.requester_team_id,
          body: [
            "━━━━━━━━━━━━",
            "⚠️ 試合申込 取消",
            "━━━━━━━━━━━━",
            `${requesterTeamName} が申込みをキャンセルしました`,
          ].join("\n"),
        });
      }
    } catch (e) {
      console.error("cancel chat relay failed:", e);
    }

    await loadMonth();
  };

  const toggleClosed = async (slotId: string, nextClosed: boolean) => {
    const { error } = await supabase
      .from("match_slots")
      .update({ is_closed: nextClosed })
      .eq("id", slotId);

    if (error) {
      console.error(error);
      alert(`募集状態の更新に失敗しました: ${error.message}`);
      return;
    }

    await loadMonth();
  };

  const filterSummaryText = useMemo(() => {
    const text = filterSummaryTextFromFilters(filters);
    return text || "すべての条件で表示中";
  }, [filters]);

  const selectedDateSummaryText = useMemo(() => {
    return `${selectedYmd} / 募集件数 ${slotsOnSelectedDate.length}件`;
  }, [selectedYmd, slotsOnSelectedDate.length]);

  const myScheduleCalendarCells = useMemo(
    () => buildCalendarCells(myScheduleCalendarMonth),
    [myScheduleCalendarMonth]
  );

  const myScheduleCalendarMonthKey = useMemo(
    () => toMonthKey(myScheduleCalendarMonth),
    [myScheduleCalendarMonth]
  );

  const myScheduleItemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();

    for (const [ymd, summary] of myScheduleSummaries.entries()) {
      const items: CalendarItem[] = [];

      if (summary.confirmed > 0) {
        items.push({
          label: "決定",
          count: summary.confirmed,
          tone: "decided",
        });
      }

      if (summary.draft > 0) {
        items.push({
          label: "交渉",
          count: summary.draft,
          tone: "negotiating",
        });
      }

      if (items.length > 0) {
        map.set(ymd, items);
      }
    }

    return map;
  }, [myScheduleSummaries]);

  const topConditionText = useMemo(
    () => filterSummaryText,
    [filterSummaryText]
  );

  const totalTeamCountText = useMemo(() => {
    return `登録チーム総数：${allTeams.length}件`;
  }, [allTeams.length]);

  const totalOpenSlotCountText = useMemo(() => {
    const today = ymdToday();

    const count = slotsInMonth.filter((slot: any) => {
      return !slot.is_closed && slot.date >= today;
    }).length;

    return `試合募集中：${count}件`;
  }, [slotsInMonth]);

  const showCriticalError =
    (baseError && baseError.includes("teams:")) ||
    (monthError && monthError.includes("match_slots:"));

  const nextSchedule = myUpcomingSchedules[0] ?? null;

  return (
    <section style={wrap} ref={homeTopRef}>
      {showCriticalError ? (
        <div style={errorBox} className="ui-card">
          <div style={errorTitle} className="ui-title">読み込みエラー</div>

          {baseError && baseError.includes("teams:") ? (
            <div className="ui-body">基礎データ: {baseError}</div>
          ) : null}

          {monthError && monthError.includes("match_slots:") ? (
            <div className="ui-body">月データ: {monthError}</div>
          ) : null}

          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={() => {
                void loadMonth();
                window.location.reload();
              }}
            >
              再読み込み
            </button>
          </div>
        </div>
      ) : null}

      <section style={summaryStatsBox} className="ui-card-soft">
        <div style={summaryStatsInner} className="ui-meta ui-strong">
          {totalTeamCountText}
          <span style={summaryStatsDivider}> / </span>
          {totalOpenSlotCountText}
        </div>
      </section>

      <section style={summaryBox} className="ui-card">
        <div style={summaryCardTop}>
          <div style={summaryDateText} className="ui-title">
            マイスケジュール
          </div>
        </div>

        <div style={summaryInnerCompactBox} className="ui-card-soft">
          {myScheduleLoading ? (
            <div style={summarySub} className="ui-meta">
              予定を読み込み中…
            </div>
          ) : nextSchedule ? (
            <>
              <div style={scheduleMainRow}>
                <div style={schedulePrimaryText}>
                  <span style={scheduleDateBadge}>
                    {formatScheduleDate(nextSchedule.date)}
                  </span>
                  <span style={scheduleTimeText} className="ui-title">
                    {nextSchedule.startTime.slice(0, 5)}–
                    {nextSchedule.endTime.slice(0, 5)}
                  </span>
                  <span style={scheduleRoleBadge}>
                    {nextSchedule.role === "host" ? "主催" : "参加"}
                  </span>
                </div>
              </div>

              <div style={summarySubTight} className="ui-meta">
                {nextSchedule.categoryText} / {nextSchedule.areaText}
              </div>

              <div style={scheduleActionRowRight}>
                <button
                  type="button"
                  className="sh-btn"
                  onClick={() => {
                    const next = !showMyScheduleCalendar;

                    setShowMyScheduleCalendar(next);

                    if (next) {
                      setTimeout(() => {
                        myScheduleCalendarRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }, 80);
                    }
                  }}
                >
                  {showMyScheduleCalendar ? "閉じる" : "カレンダー"}
                </button>

                <button
                  type="button"
                  className="sh-btn"
                  onClick={openManualScheduleCreatePage}
                >
                  予定作成
                </button>

                <button
                  type="button"
                  className="sh-btn sh-btn--primary"
                  onClick={openMySchedulePage}
                >
                  予定一覧
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={summarySub} className="ui-meta">
                直近の予定はありません。
              </div>

              <div style={scheduleActionRowRight}>
                <button
                  type="button"
                  className="sh-btn"
                  onClick={() => {
                    const next = !showMyScheduleCalendar;

                    setShowMyScheduleCalendar(next);

                    if (next) {
                      setTimeout(() => {
                        myScheduleCalendarRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                      }, 80);
                    }
                  }}
                >
                  {showMyScheduleCalendar ? "閉じる" : "カレンダー"}
                </button>
                
                <button
                  type="button"
                  className="sh-btn"
                  onClick={openManualScheduleCreatePage}
                >
                  予定作成
                </button>

                <button
                  type="button"
                  className="sh-btn sh-btn--primary"
                  onClick={openMySchedulePage}
                >
                  予定一覧
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {showMyScheduleCalendar ? (
        <section
          ref={myScheduleCalendarRef}
          style={calendarCard}
        >
          <div style={calendarTitle}>マイスケジュール</div>

          <div style={legendWrap}>
            <span style={legendItem}>
              <span style={legendDotConfirmed} />
              決定
            </span>
            <span style={legendItem}>
              <span style={legendDotNegotiating} />
              交渉
            </span>
          </div>

          {myScheduleCalendarError ? (
            <div style={errorBox} className="ui-card">
              {myScheduleCalendarError}
            </div>
          ) : myScheduleCalendarLoading ? (
            <div style={emptyBox} className="ui-meta">
              読み込み中…
            </div>
          ) : (
            <MatchCalendarBase
              monthKey={myScheduleCalendarMonthKey}
              cells={myScheduleCalendarCells}
              selectedYmd={ymdToday()}
              itemsByDate={myScheduleItemsByDate}
              onSelectDate={(ymd) => {
                window.location.href = `/match/my-schedule?date=${ymd}`;
              }}
              onPrevMonth={() =>
                setMyScheduleCalendarMonth((prev) => addMonths(prev, -1))
              }
              onNextMonth={() =>
                setMyScheduleCalendarMonth((prev) => addMonths(prev, 1))
              }
            />
          )}
        </section>
      ) : null}

      <section style={summaryBox} className="ui-card">
        <div style={summaryCardTop}>
          <div style={summaryDateText} className="ui-title">
            練習試合を探す
          </div>
        </div>

        <div style={summaryInnerCompactBox} className="ui-card-soft">
          <div>
            <div style={summaryCountLineCompact} className="ui-title">
              対象チーム数：{filteredTeams.length}件
            </div>

            <div style={summarySubTight} className="ui-meta">
              表示条件：{topConditionText}
            </div>
          </div>

          <div style={summaryActionRowCompact}>
            <button
              type="button"
              className="sh-btn"
              onClick={() => {
                const next = !showMatchCalendar;

                setShowMatchCalendar(next);

                if (next) {
                  setTimeout(() => {
                    calendarRef.current?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }, 80);
                }
              }}
            >
              {showMatchCalendar ? "閉じる" : "カレンダー"}
            </button>

            <button
              type="button"
              className="sh-btn"
              onClick={openTeamFilterPage}
            >
              条件検索
            </button>

            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={openTeamListWindow}
            >
              チーム一覧
            </button>
          </div>
        </div>
      </section>

      {showMatchCalendar ? (
        <>
          <div ref={calendarRef}>
            <Calendar
              monthKey={monthKey}
              loading={loading}
              cells={calendarCells}
              selectedYmd={selectedYmd}
              countByDate={countByDate}
              dayStatusSummaryByDate={dayStatusSummaryByDate}
              onSelectDate={(ymd) => {
                setSelectedYmd(ymd);
                setSelectedSlotId("");
                setRequestComment("");
                scrollToDayList();
              }}
              onPrevMonth={() => {
                const nextMonth = addMonths(monthDate, -1);
                setMonthDate(nextMonth);
                setSelectedYmd(firstDayYmdOfMonth(nextMonth));
                setSelectedSlotId("");
                setRequestComment("");
              }}
              onNextMonth={() => {
                const nextMonth = addMonths(monthDate, 1);
                setMonthDate(nextMonth);
                setSelectedYmd(firstDayYmdOfMonth(nextMonth));
                setSelectedSlotId("");
                setRequestComment("");
              }}
              onCreateForDate={(ymd) => goToCreatePage(ymd)}
              disableCreate={!authReady}
              selectedDateSummaryText={selectedDateSummaryText}
              titleText="試合日で探す"
            />
          </div>

          <div ref={dayListRef}>
            <DaySlotList
              selectedYmd={selectedYmd}
              slots={slotsOnSelectedDate as any}
              venues={venues}
              allTeams={allTeams as any}
              myTeams={myTeams as any}
              meId={currentUserId}
              requestsForMonth={requestsForMonth}
              selectedSlotId={selectedSlotId}
              slotStatusResolver={getSlotStatus}
              onToggleDetail={(slotId) => {
                const next = selectedSlotId === slotId ? "" : slotId;
                setSelectedSlotId(next);
                setRequestComment("");
              }}
              requestTeamId={requestTeamId}
              onChangeRequestTeamId={setRequestTeamId}
              requestComment={requestComment}
              onChangeRequestComment={setRequestComment}
              onRequestSlot={requestSlot}
              onCancelMyRequest={cancelMyRequest}
              selectedSlot={selectedSlot}
              selectedHostTeam={selectedHostTeam as any}
              selectedSlotRequests={selectedSlotRequests}
              isMineSlot={isMineSlot}
              onAccept={accept}
              onReject={reject}
              onOpenChatWithTeam={openDmAndGo}
              onToggleClosed={toggleClosed}
              loading={loading}
            />
          </div>
        </>
      ) : null}

      <SelectionSection />      

      <MatchHelpModals
        showStrengthHelp={showStrengthHelp}
        showCalendarHelp={showCalendarHelp}
        onCloseStrengthHelp={() => setShowStrengthHelp(false)}
        onCloseCalendarHelp={() => setShowCalendarHelp(false)}
        strengthGuides={[]}
      />
    </section>
  );
}

const wrap: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gap: 10,
};

const errorBox: React.CSSProperties = {
  padding: 10,
  fontSize: 14,
  lineHeight: 1.6,
};

const errorTitle: React.CSSProperties = {
  marginBottom: 4,
};

const summaryStatsBox: React.CSSProperties = {
  marginTop: 2,
  padding: "12px 14px",
};

const summaryStatsInner: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.5,
  textAlign: "center",
};

const summaryStatsDivider: React.CSSProperties = {
  opacity: 0.7,
};

const summaryBox: React.CSSProperties = {
  marginTop: 2,
  padding: "12px 14px",
};

const summaryCardTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const summaryDateText: React.CSSProperties = {
  fontSize: 20,
  lineHeight: 1.25,
};

const summaryInnerCompactBox: React.CSSProperties = {
  marginTop: 8,
  padding: 12,
  display: "grid",
  gap: 10,
};

const summaryActionRowCompact: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const summaryCountLineCompact: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.5,
};

const summarySub: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  lineHeight: 1.6,
};

const summarySubTight: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.55,
};

const scheduleMainRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
};

const schedulePrimaryText: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  minWidth: 0,
};

const scheduleActionRowRight: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
  marginTop: 2,
};

const scheduleDateBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 999,
  background: "#ecfdf3",
  color: "#166534",
  fontSize: 13,
  fontWeight: 900,
  border: "1px solid #bbf7d0",
};

const scheduleTimeText: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.4,
};

const scheduleRoleBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "0 9px",
  borderRadius: 999,
  background: "#eef6f0",
  color: "#14532d",
  fontSize: 12,
  fontWeight: 900,
  border: "1px solid #dce9df",
};

const emptyRecruitBox: React.CSSProperties = {
  marginTop: 8,
  padding: 18,
  borderRadius: 14,
  border: "1px solid #e5ece7",
  background: "#fff",
  textAlign: "center",
};

const emptyRecruitTitle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.45,
};

const emptyRecruitText: React.CSSProperties = {
  marginTop: 8,
  color: "#666",
  lineHeight: 1.35,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "clip",
  letterSpacing: "-0.02em",
  fontSize: "clamp(9px, 2.7vw, 15px)",
};

const calendarCard: React.CSSProperties = {
  marginTop: 2,
  padding: "12px 14px",
  border: "1px solid #dce9df",
  borderRadius: 14,
  background: "#fff",
};

const calendarTitle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.25,
};

const legendWrap: React.CSSProperties = {
  marginTop: 8,
  marginBottom: 8,
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
  alignItems: "center",
};

const legendItem: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 13,
  color: "#4b5563",
  fontWeight: 700,
};

const legendDotConfirmed: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "#16a34a",
  display: "inline-block",
};

const legendDotNegotiating: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "#f97316",
  display: "inline-block",
};

const emptyBox: React.CSSProperties = {
  marginTop: 14,
  padding: 18,
  textAlign: "center",
};