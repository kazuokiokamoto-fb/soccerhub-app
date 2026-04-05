"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import { categoryLabel } from "@/app/lib/categories";

import { Calendar } from "@/app/match/components/Calendar";
import { DaySlotList } from "@/app/match/components/DaySlotList";
import { MatchFilterPanel } from "@/app/match/components/MatchFilterPanel";
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

type StrengthGuide = {
  rank: StrengthRank;
  short: string;
  title: string;
  bullets: string[];
  note: string;
};

type CalendarShortStatus = "decided" | "open" | "other";

type DayCalendarSummary = {
  label: "決" | "募" | "他";
  count: number;
  tone: CalendarShortStatus;
};

type PanelMode = "none" | "match" | "team";
type VisibleMode = "none" | "match" | "team";

const STRENGTH_GUIDES: StrengthGuide[] = [
  {
    rank: "SS",
    short: "都・県リーグ1・2部",
    title: "公式戦上位レベルの強度を想定したカテゴリー",
    bullets: [
      "都・県リーグ上位所属",
      "試合強度：★★★★★（非常に高い）",
      "球際・切り替えが速く、戦術理解度が高い",
      "公式戦同等レベルの緊張感ある試合を希望",
    ],
    note: "「強度の高い実戦形式」を求めるチーム向け",
  },
  {
    rank: "S",
    short: "都・県リーグ3・4部",
    title: "公式戦基準の競争力を持つカテゴリー",
    bullets: [
      "都・県リーグ所属",
      "試合強度：★★★★☆（高い）",
      "基礎技術が安定し、組織的な守備・攻撃ができる",
      "上位リーグ昇格を目指すレベル",
    ],
    note: "「しっかり競り合える相手」を求めるチーム向け",
  },
  {
    rank: "A",
    short: "地域リーグ1・2部",
    title: "育成と競争のバランス型カテゴリー",
    bullets: [
      "地域リーグ上位所属",
      "試合強度：★★★☆☆（中〜やや高）",
      "個人技術向上＋チーム連携を重視",
      "チャレンジマッチにも適したレベル",
    ],
    note: "「公式戦を想定しつつ育成も重視」するチーム向け",
  },
  {
    rank: "B",
    short: "地域リーグ3・4部",
    title: "成長重視の実戦経験カテゴリー",
    bullets: [
      "地域リーグ所属",
      "試合強度：★★☆☆☆（やや穏やか）",
      "試合経験を積みながら基礎力を伸ばす段階",
      "バランスの良いマッチング向き",
    ],
    note: "「経験を積みたい」「自信をつけたい」チーム向け",
  },
  {
    rank: "C",
    short: "フレンドリー",
    title: "交流・経験重視カテゴリー",
    bullets: [
      "リーグ所属問わず",
      "試合強度：★☆☆☆☆（交流中心）",
      "新チーム編成・初心者中心・交流目的",
      "勝敗よりも経験や交流を重視",
    ],
    note: "「楽しく真剣に」「幅広い交流」を希望するチーム向け",
  },
];

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

function appliedFilterSummaryText(filters: {
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

  if (filters.keyword.trim()) parts.push(`キーワード: ${filters.keyword.trim()}`);
  if (filters.prefectureFilter) parts.push(`都道府県: ${filters.prefectureFilter}`);
  if (filters.cityFilter) parts.push(`市区町村: ${filters.cityFilter}`);
  if (filters.townFilter) parts.push(`町名: ${filters.townFilter}`);

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

  if (filters.prefectureFilter && norm(team.prefecture) !== filters.prefectureFilter) {
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

export default function HomeCalendar() {
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

  const [panelMode, setPanelMode] = useState<PanelMode>("none");
  const [visibleMode, setVisibleMode] = useState<VisibleMode>("match");

  const dayListRef = useRef<HTMLDivElement | null>(null);
  const teamListRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<HTMLElement | null>(null);

  const {
    draftKeyword,
    setDraftKeyword,
    draftCategoryFilter,
    setDraftCategoryFilter,
    draftPrefectureFilter,
    setDraftPrefectureFilter,
    draftCityFilter,
    setDraftCityFilter,
    draftTownFilter,
    setDraftTownFilter,
    draftGroundFilter,
    setDraftGroundFilter,
    draftStrengthFilter,
    setDraftStrengthFilter,
    draftBikeFilter,
    setDraftBikeFilter,
    draftBikeCapacityMin,
    setDraftBikeCapacityMin,
    draftMemberCountMin,
    setDraftMemberCountMin,
    appliedFilters,
    draftFilters,
    hasDraftChanges,
    applyDraftToApplied,
    clearAllFilters,
  } = useMatchFilters();

  const {
    loadingBase,
    loadingMonth,
    meId,
    allTeams,
    myTeams,
    venues,
    slotsInMonth,
    requestsForMonth,
    loadMonth,
  } = useMatchData(monthDate);

  const loading = authLoading || loadingBase || loadingMonth;
  const currentUserId = authUserId || meId;

  useEffect(() => {
    if (!requestTeamId && myTeams[0]?.id) {
      setRequestTeamId(myTeams[0].id);
    }
  }, [myTeams, requestTeamId]);

  const myTeamIds = useMemo(() => myTeams.map((t: any) => t.id), [myTeams]);

  const teamMap = useMemo(() => {
    return new Map(allTeams.map((t) => [t.id, t]));
  }, [allTeams]);

  const requestTeamNameMap = useMemo(() => {
    return new Map(allTeams.map((t) => [t.id, t.name || "チーム未設定"]));
  }, [allTeams]);

  const filteredSlotsInMonth = useMemo(() => {
    return slotsInMonth.filter((s: any) =>
      matchesSlotFilters(s, teamMap as any, appliedFilters)
    );
  }, [slotsInMonth, teamMap, appliedFilters]);

  const draftFilteredSlotsInMonth = useMemo(() => {
    return slotsInMonth.filter((s: any) =>
      matchesSlotFilters(s, teamMap as any, draftFilters)
    );
  }, [slotsInMonth, teamMap, draftFilters]);

  const appliedFilteredTeams = useMemo(() => {
    return allTeams.filter((team: any) => {
      if (myTeamIds.includes(team.id)) return false;
      return teamMatchesFilters(team, appliedFilters);
    });
  }, [allTeams, myTeamIds, appliedFilters]);

  const draftFilteredTeams = useMemo(() => {
    return allTeams.filter((team: any) => {
      if (myTeamIds.includes(team.id)) return false;
      return teamMatchesFilters(team, draftFilters);
    });
  }, [allTeams, myTeamIds, draftFilters]);

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
      const ymd = slot.date;
      if (!grouped.has(ymd)) grouped.set(ymd, []);
      grouped.get(ymd)!.push(slot);
    }

    const result = new Map<string, DayCalendarSummary>();

    for (const [ymd, daySlots] of grouped.entries()) {
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
        result.set(ymd, {
          label: "決",
          count: decidedCount,
          tone: "decided",
        });
      } else if (openCount > 0) {
        result.set(ymd, {
          label: "募",
          count: openCount,
          tone: "open",
        });
      } else if (otherCount > 0) {
        result.set(ymd, {
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

  const draftSlotsOnSelectedDate = useMemo(() => {
    return draftFilteredSlotsInMonth.filter((s: any) => s.date === selectedYmd);
  }, [draftFilteredSlotsInMonth, selectedYmd]);

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

  const calendarCells = useMemo(() => {
    return buildCalendarCells(monthDate);
  }, [monthDate]);

  const monthKey = useMemo(() => toMonthKey(monthDate), [monthDate]);

  useEffect(() => {
    const currentCount = slotsOnSelectedDate.length;
    if (currentCount > 0) return;

    const firstAvailable = filteredSlotsInMonth[0]?.date;
    if (firstAvailable) {
      setSelectedYmd(firstAvailable);
      setMonthDate(startOfMonth(new Date(firstAvailable)));
    }
  }, [filteredSlotsInMonth, slotsOnSelectedDate]);

  const scrollToDayList = () => {
    setTimeout(() => {
      dayListRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  };

  const scrollToTeamList = () => {
    setTimeout(() => {
      teamListRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  };

  const scrollToFilter = () => {
    setTimeout(() => {
      filterRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  };

  const openMatchFilterPanel = () => {
    setPanelMode("match");
    scrollToFilter();
  };

  const openTeamFilterPanel = () => {
    setPanelMode("team");
    scrollToFilter();
  };

  const showMatchList = () => {
    setVisibleMode("match");
    setPanelMode("none");
    scrollToDayList();
  };

  const showTeamList = () => {
    setVisibleMode("team");
    setPanelMode("none");
    scrollToTeamList();
  };

  const handleApplyAndJump = () => {
    applyDraftToApplied();
    setSelectedSlotId("");
    setRequestComment("");
    setPanelMode("none");

    if (panelMode === "team") {
      setVisibleMode("team");
      scrollToTeamList();
      return;
    }

    setVisibleMode("match");
    scrollToDayList();
  };

  const handleResetMatchFilters = () => {
    clearAllFilters();
    setSelectedSlotId("");
    setRequestComment("");
    setVisibleMode("match");
    setPanelMode("none");
    scrollToDayList();
  };

  const handleResetTeamFilters = () => {
    clearAllFilters();
    setSelectedSlotId("");
    setRequestComment("");
    setVisibleMode("team");
    setPanelMode("none");
    scrollToTeamList();
  };

  const goToCreatePage = (ymd: string) => {
    const params = new URLSearchParams();

    if (ymd) params.set("date", ymd);

    const firstTeam = myTeams[0];
    if (firstTeam?.id) params.set("hostTeamId", firstTeam.id);
    if (firstTeam?.category) params.set("category", firstTeam.category);
    if (firstTeam?.area) params.set("area", firstTeam.area);

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
    if (!uid) {
      alert("ログインが必要です");
      return;
    }

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
              headers: {
                "Content-Type": "application/json",
              },
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
        `📅 ${slot.date} ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(
          0,
          5
        )}`,
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
              `📅 ${slot.date} ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(
                0,
                5
              )}`,
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
    const text = appliedFilterSummaryText(appliedFilters);
    return text || "すべての条件で表示中";
  }, [appliedFilters]);

  const matchSummaryText = useMemo(() => {
    return `${filterSummaryText} / ${slotsOnSelectedDate.length}件`;
  }, [filterSummaryText, slotsOnSelectedDate.length]);

  const teamSummaryText = useMemo(() => {
    return `${filterSummaryText} / ${appliedFilteredTeams.length}チーム`;
  }, [filterSummaryText, appliedFilteredTeams.length]);

  return (
    <section style={wrap}>
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
          setVisibleMode("match");
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
        disableCreate={myTeams.length === 0}
        filterSummaryText={matchSummaryText}
        onOpenFilters={openMatchFilterPanel}
        onResetFilters={handleResetMatchFilters}
        onShowList={showMatchList}
        bandText="日程"
        titleText="試合日で探す"
      />

      <section style={summaryBox}>
        <div style={summaryHead}>
          <div>
            <div style={summaryBand}>相手を探す</div>
            <div style={summaryTitle}>チーム条件</div>
          </div>

          <div style={summaryButtonRow}>
            <button
              type="button"
              className="sh-btn"
              onClick={openTeamFilterPanel}
              disabled={loading}
            >
              条件変更
            </button>

            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={showTeamList}
              disabled={loading}
            >
              チーム表示
            </button>
          </div>
        </div>

        <div style={summaryCount}>表示条件：{teamSummaryText}</div>
      </section>

      {visibleMode === "match" ? (
        <div ref={dayListRef}>
          <section style={listSummaryBox}>
            <div style={listSummaryTop}>
              <div style={summaryDate}>📅 {selectedYmd}</div>
              <div style={summaryCount}>
                募集件数：{slotsOnSelectedDate.length}件
                {hasDraftChanges ? `（入力中 ${draftSlotsOnSelectedDate.length}件）` : ""}
              </div>
            </div>

            <div style={summaryActions}>
              <button
                type="button"
                className="sh-btn"
                onClick={() => setShowCalendarHelp(true)}
              >
                決・募・他 の見方
              </button>

              <button
                type="button"
                className="sh-btn"
                onClick={openMatchFilterPanel}
              >
                条件変更
              </button>

              <button
                type="button"
                className="sh-btn sh-btn--primary"
                onClick={() => goToCreatePage(selectedYmd)}
                disabled={loading || myTeams.length === 0}
              >
                募集する
              </button>
            </div>
          </section>

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
      ) : null}

      {visibleMode === "team" ? (
        <div ref={teamListRef}>
          <section style={listSummaryBox}>
            <div style={listSummaryTop}>
              <div style={summaryDate}>👥 相手チーム一覧</div>
              <div style={summaryCount}>
                チーム件数：{appliedFilteredTeams.length}件
                {hasDraftChanges ? `（入力中 ${draftFilteredTeams.length}件）` : ""}
              </div>
            </div>

            <div style={summaryActions}>
              <button
                type="button"
                className="sh-btn"
                onClick={openTeamFilterPanel}
              >
                条件変更
              </button>
            </div>
          </section>

          <section style={teamListCard}>
            {appliedFilteredTeams.length === 0 ? (
              <div style={emptyText}>この条件に合うチームはありません。</div>
            ) : (
              <div style={teamGrid}>
                {appliedFilteredTeams.map((team: any) => {
                  const rank = teamStrengthLabel(team);
                  const areaText =
                    norm(team.area) ||
                    `${team.prefecture ?? ""} ${team.city ?? ""}${team.town ? `・${team.town}` : ""}`.trim() ||
                    "未設定";

                  return (
                    <div key={team.id} style={teamCard}>
                      <div style={teamCardTitle}>{team.name || "チーム未設定"}</div>

                      <div style={teamCardMeta}>
                        📍 {areaText}
                        <br />
                        🏷 {categoryLabel(team.category) || team.category || "未設定"}
                        <br />
                        💪 強さ {rank}
                        <br />
                        👥 所属人数 {team.member_count ?? 0}人
                      </div>

                      <div style={teamCardButtons}>
                        <Link href={`/teams/${team.id}`} className="sh-btn">
                          チーム詳細
                        </Link>

                        <button
                          type="button"
                          className="sh-btn sh-btn--primary"
                          onClick={() => openDmAndGo(team.id, null)}
                          disabled={loading || myTeams.length === 0}
                        >
                          チャット
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : null}

      {panelMode !== "none" ? (
        <MatchFilterPanel
          filterRef={filterRef}
          loading={loading}
          draftKeyword={draftKeyword}
          setDraftKeyword={setDraftKeyword}
          draftCategoryFilter={draftCategoryFilter}
          setDraftCategoryFilter={setDraftCategoryFilter}
          draftPrefectureFilter={draftPrefectureFilter}
          setDraftPrefectureFilter={setDraftPrefectureFilter}
          draftCityFilter={draftCityFilter}
          setDraftCityFilter={setDraftCityFilter}
          draftTownFilter={draftTownFilter}
          setDraftTownFilter={setDraftTownFilter}
          draftGroundFilter={draftGroundFilter}
          setDraftGroundFilter={setDraftGroundFilter}
          draftStrengthFilter={draftStrengthFilter}
          setDraftStrengthFilter={setDraftStrengthFilter}
          draftBikeFilter={draftBikeFilter}
          setDraftBikeFilter={setDraftBikeFilter}
          draftBikeCapacityMin={draftBikeCapacityMin}
          setDraftBikeCapacityMin={setDraftBikeCapacityMin}
          draftMemberCountMin={draftMemberCountMin}
          setDraftMemberCountMin={setDraftMemberCountMin}
          hasDraftChanges={hasDraftChanges}
          onApply={handleApplyAndJump}
          onReset={panelMode === "team" ? handleResetTeamFilters : handleResetMatchFilters}
          onBackToList={panelMode === "team" ? showTeamList : showMatchList}
          onOpenStrengthHelp={() => setShowStrengthHelp(true)}
          strengthGuides={STRENGTH_GUIDES}
          bandText="条件検索"
          titleText={panelMode === "team" ? "相手を探す" : "募集を探す"}
          descriptionText={
            panelMode === "team"
              ? "レベル・エリア・人数感などから相手チームを探せます。"
              : "日程に合う募集を条件で絞り込めます。"
          }
          liveCountLabel={
            panelMode === "team"
              ? "現在のヒット件数（チーム）"
              : "現在のヒット件数（募集）"
          }
          liveCountText={
            panelMode === "team"
              ? `${draftFilteredTeams.length}チーム`
              : `${draftFilteredSlotsInMonth.length}件`
          }
        />
      ) : null}

      <MatchHelpModals
        showStrengthHelp={showStrengthHelp}
        showCalendarHelp={showCalendarHelp}
        onCloseStrengthHelp={() => setShowStrengthHelp(false)}
        onCloseCalendarHelp={() => setShowCalendarHelp(false)}
        strengthGuides={STRENGTH_GUIDES}
      />
    </section>
  );
}

const wrap: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gap: 14,
};

const summaryBox: React.CSSProperties = {
  marginTop: 2,
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid #dce9df",
  background: "#f7fbf8",
};

const summaryHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const summaryBand: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 999,
  background: "#e8f5ec",
  color: "#145c2a",
  border: "1px solid #cfe8d7",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.06em",
};

const summaryTitle: React.CSSProperties = {
  marginTop: 8,
  fontWeight: 900,
  fontSize: 22,
  color: "#16391f",
  lineHeight: 1.3,
};

const summaryDate: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  color: "#245233",
};

const summaryCount: React.CSSProperties = {
  marginTop: 6,
  fontSize: 14,
  color: "#3b6a49",
  lineHeight: 1.7,
};

const summaryButtonRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const listSummaryBox: React.CSSProperties = {
  marginTop: 4,
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid #dce9df",
  background: "#f7fbf8",
};

const listSummaryTop: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const summaryActions: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const teamListCard: React.CSSProperties = {
  padding: 14,
  border: "1px solid #eee",
  borderRadius: 18,
  background: "#fff",
};

const teamGrid: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const teamCard: React.CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "#fff",
  boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
};

const teamCardTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.4,
};

const teamCardMeta: React.CSSProperties = {
  marginTop: 8,
  fontSize: 14,
  color: "#4b5563",
  lineHeight: 1.8,
};

const teamCardButtons: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const emptyText: React.CSSProperties = {
  color: "#777",
  lineHeight: 1.8,
};