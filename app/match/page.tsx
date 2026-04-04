"use client";

import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import { AppToast } from "@/app/components/AppToast";
import React, {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";

import { Calendar } from "./components/Calendar";
import { DaySlotList } from "./components/DaySlotList";
import { MatchFilterPanel } from "./components/MatchFilterPanel";
import { MatchHelpModals } from "./components/MatchHelpModals";

import { categoryLabel } from "@/app/lib/categories";
import type { StrengthRank } from "@/app/components/StrengthRankPicker";

import {
  buildCalendarCells,
  addMonths,
  startOfMonth,
  toMonthKey,
  ymdToday,
} from "./utils/date";
import { matchesSlotFilters } from "./utils/filters";

import { useMatchFilters } from "./hooks/useMatchFilters";
import { useMatchData } from "./hooks/useMatchData";

import {
  dayListWrap,
  stickySummaryBar,
  stickySummaryDate,
  stickySummaryCount,
  dayListHeaderRow,
  dayListTitle,
} from "./styles/matchPageStyles";

type StrengthGuide = {
  rank: StrengthRank;
  short: string;
  title: string;
  bullets: string[];
  note: string;
};

type CalendarShortStatus = "decided" | "open" | "other";
type DetailFilterStatus = "all" | "decided" | "open" | "other";

type DayCalendarSummary = {
  label: "決" | "募" | "他";
  count: number;
  tone: CalendarShortStatus;
};

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
    note: "⭐︎ 「強度の高い実戦形式」を求めるチーム向け",
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
    note: "⭐︎ 「しっかり競り合える相手」を求めるチーム向け",
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
    note: "⭐︎ 「公式戦を想定しつつ育成も重視」するチーム向け",
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
    note: "⭐︎「経験を積みたい」「自信をつけたい」チーム向け",
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
    note: "⭐︎「楽しく真剣に」「幅広い交流」を希望するチーム向け",
  },
];

const summaryWrap: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
};

const summaryHeaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const createButtonInline: React.CSSProperties = {
  flexShrink: 0,
};

const contentScrollBox: React.CSSProperties = {
  maxHeight: "calc(100vh - 260px)",
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
};

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

function isValidYmd(v?: string | null) {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function buildMatchCarryQuery(params: {
  slotId?: string | null;
  date?: string | null;
}) {
  const qs = new URLSearchParams();
  qs.set("from", "match-calendar");
  if (params.slotId) qs.set("slotId", params.slotId);
  if (params.date) qs.set("date", params.date);
  return qs.toString();
}

export default function MatchCalendarPage() {
  return (
    <Suspense
      fallback={
        <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
          <AppTabNav />
          <div
            style={{
              marginTop: 16,
              padding: 20,
              borderRadius: 16,
              border: "1px solid #e5ece7",
              background: "#fff",
              color: "#666",
              textAlign: "center",
            }}
          >
            読み込み中…
          </div>
        </main>
      }
    >
      <MatchCalendarPageInner />
    </Suspense>
  );
}

function MatchCalendarPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryDate = searchParams.get("date");
  const querySlotId = searchParams.get("slotId");

  const initialYmd = isValidYmd(queryDate) ? queryDate! : ymdToday();

  const [monthDate, setMonthDate] = useState<Date>(() =>
    startOfMonth(new Date(initialYmd))
  );
  const [selectedYmd, setSelectedYmd] = useState<string>(initialYmd);
  const [selectedSlotId, setSelectedSlotId] = useState<string>(querySlotId ?? "");
  const [selectedDetailFilter, setSelectedDetailFilter] =
    useState<DetailFilterStatus>("all");

  const [requestTeamId, setRequestTeamId] = useState<string>("");
  const [requestComment, setRequestComment] = useState<string>("");
  const [showStrengthHelp, setShowStrengthHelp] = useState(false);
  const [showCalendarHelp, setShowCalendarHelp] = useState(false);

  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

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

  const loading = loadingBase || loadingMonth;

  const dayListRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<HTMLElement | null>(null);
  const initialQueryAppliedRef = useRef(false);

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastOpen(true);
    window.setTimeout(() => {
      setToastOpen(false);
    }, 1200);
  };

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

  const countByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of filteredSlotsInMonth) {
      const k = (s as any).date;
      m.set(k, (m.get(k) ?? 0) + 1);
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

  const detailCountSummary = useMemo(() => {
    let decided = 0;
    let open = 0;
    let other = 0;

    for (const slot of slotsOnSelectedDate) {
      const status = getSlotStatus(slot);
      if (status === "decided") decided += 1;
      else if (status === "open") open += 1;
      else if (status === "other") other += 1;
    }

    return { decided, open, other };
  }, [slotsOnSelectedDate, getSlotStatus]);

  const visibleSlotsOnSelectedDate = useMemo(() => {
    if (selectedDetailFilter === "all") return slotsOnSelectedDate;

    return slotsOnSelectedDate.filter((slot) => {
      const status = getSlotStatus(slot);
      return status === selectedDetailFilter;
    });
  }, [slotsOnSelectedDate, selectedDetailFilter, getSlotStatus]);

  const selectedSlot = useMemo(() => {
    return slotsInMonth.find((s) => s.id === selectedSlotId) || null;
  }, [slotsInMonth, selectedSlotId]);

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
    return !!meId && selectedSlot.owner_id === meId;
  }, [selectedSlot, meId]);

  const calendarCells = useMemo(() => {
    return buildCalendarCells(monthDate);
  }, [monthDate]);

  const monthKey = useMemo(() => toMonthKey(monthDate), [monthDate]);

  useEffect(() => {
    if (initialQueryAppliedRef.current) return;
    if (!querySlotId && !isValidYmd(queryDate)) {
      initialQueryAppliedRef.current = true;
      return;
    }
    if (loadingMonth) return;

    if (isValidYmd(queryDate)) {
      setSelectedYmd(queryDate!);
      setMonthDate(startOfMonth(new Date(queryDate!)));
    }

    if (querySlotId) {
      const targetSlot = slotsInMonth.find((s) => s.id === querySlotId);
      if (targetSlot) {
        setSelectedSlotId(targetSlot.id);
        setSelectedYmd(targetSlot.date);

        const status = getSlotStatus(targetSlot);
        setSelectedDetailFilter(status);

        setTimeout(() => {
          dayListRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 180);
      } else {
        setSelectedSlotId(querySlotId);
      }
    }

    initialQueryAppliedRef.current = true;
  }, [queryDate, querySlotId, slotsInMonth, loadingMonth, getSlotStatus]);

  const scrollToDayList = () => {
    setTimeout(() => {
      dayListRef.current?.scrollIntoView({
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

  const handleApplyAndJump = () => {
    applyDraftToApplied();
    setSelectedSlotId("");
    setSelectedDetailFilter("all");
    scrollToDayList();
  };

  const handleResetFilters = () => {
    clearAllFilters();
    setSelectedSlotId("");
    setSelectedDetailFilter("all");
    scrollToDayList();
  };

  const goToCreatePage = (ymd: string) => {
    const params = new URLSearchParams();

    if (ymd) params.set("date", ymd);

    const firstTeam = myTeams[0];
    if (firstTeam?.id) params.set("hostTeamId", firstTeam.id);
    if (firstTeam?.category) params.set("category", firstTeam.category);
    if (firstTeam?.area) params.set("area", firstTeam.area);

    const query = params.toString();
    router.push(query ? `/match/new?${query}` : "/match/new");
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

      showToast("チャットへ移動します…");
      window.setTimeout(() => {
        window.location.href = `/chat/${threadId}?${carryQuery}`;
      }, 450);
    } catch (e: any) {
      console.error(e);
      alert(`チャットを開けません: ${e?.message ?? "unknown error"}`);
    }
  };

  const requestSlot = async (slotId: string) => {
    const slot = slotsInMonth.find((s) => s.id === slotId);
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

    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
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

      showToast("申込みを送信しました。チャットへ移動します…");
      window.setTimeout(() => {
        window.location.href = `/chat/${threadId}?${carryQuery}`;
      }, 500);
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

    const slot = slotsInMonth.find((s) => s.id === target.slot_id);
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
        const { data: u } = await supabase.auth.getUser();
        const uid = u?.user?.id;
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
      const slot = slotsInMonth.find((s) => s.id === req.slot_id);
      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
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

  return (
    <>
      <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
        <AppTabNav />

        <AppHero
          icon="⚽️"
          title="試合を探す / 募集する"
          desc="カレンダーで募集枠を確認しながら、条件を指定して相手を探せます。"
        />

        <section style={{ marginTop: 12 }}>
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
              setSelectedDetailFilter("all");
              scrollToDayList();
            }}
            onPrevMonth={() => setMonthDate(addMonths(monthDate, -1))}
            onNextMonth={() => setMonthDate(addMonths(monthDate, 1))}
            onCreateForDate={(ymd) => goToCreatePage(ymd)}
            disableCreate={myTeams.length === 0}
          />
        </section>

        <div style={summaryWrap}>
          <div style={stickySummaryBar}>
            <div style={summaryHeaderRow}>
              <div>
                <div style={stickySummaryDate}>📅 {selectedYmd}</div>
                <div style={stickySummaryCount}>
                  入力中の募集（{draftSlotsOnSelectedDate.length}件／
                  {slotsOnSelectedDate.length}件）
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  type="button"
                  style={calendarHelpButton}
                  onClick={() => setShowCalendarHelp(true)}
                  aria-label="カレンダー表示の説明"
                  title="カレンダー表示の説明"
                >
                  ?
                </button>

                <button
                  type="button"
                  className="sh-btn"
                  style={createButtonInline}
                  onClick={() => goToCreatePage(selectedYmd)}
                  disabled={loading || myTeams.length === 0}
                >
                  募集する
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style={contentScrollBox}>
          <div ref={dayListRef} style={dayListWrap}>
            <div style={dayListHeaderRow}>
              <h2 style={dayListTitle}>募集一覧</h2>

              <button type="button" className="sh-btn" onClick={scrollToFilter}>
                絞り込み
              </button>
            </div>

            <div style={detailFilterWrap}>
              <DetailFilterChip
                label="すべて"
                count={slotsOnSelectedDate.length}
                active={selectedDetailFilter === "all"}
                onClick={() => setSelectedDetailFilter("all")}
              />
              <DetailFilterChip
                label="決定済"
                count={detailCountSummary.decided}
                active={selectedDetailFilter === "decided"}
                onClick={() =>
                  setSelectedDetailFilter((prev) =>
                    prev === "decided" ? "all" : "decided"
                  )
                }
              />
              <DetailFilterChip
                label="募集中"
                count={detailCountSummary.open}
                active={selectedDetailFilter === "open"}
                onClick={() =>
                  setSelectedDetailFilter((prev) =>
                    prev === "open" ? "all" : "open"
                  )
                }
              />
              <DetailFilterChip
                label="他決定"
                count={detailCountSummary.other}
                active={selectedDetailFilter === "other"}
                onClick={() =>
                  setSelectedDetailFilter((prev) =>
                    prev === "other" ? "all" : "other"
                  )
                }
              />
            </div>

            <DaySlotList
              selectedYmd={selectedYmd}
              slots={visibleSlotsOnSelectedDate as any}
              venues={venues}
              allTeams={allTeams as any}
              myTeams={myTeams as any}
              meId={meId}
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
            onReset={handleResetFilters}
            onBackToList={scrollToDayList}
            onOpenStrengthHelp={() => setShowStrengthHelp(true)}
            strengthGuides={STRENGTH_GUIDES}
          />
        </div>

        <MatchHelpModals
          showStrengthHelp={showStrengthHelp}
          showCalendarHelp={showCalendarHelp}
          onCloseStrengthHelp={() => setShowStrengthHelp(false)}
          onCloseCalendarHelp={() => setShowCalendarHelp(false)}
          strengthGuides={STRENGTH_GUIDES}
        />
      </main>

      <AppToast open={toastOpen} message={toastMessage} />
    </>
  );
}

function DetailFilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...detailFilterChip,
        ...(active ? detailFilterChipActive : {}),
      }}
    >
      {label} {count}
    </button>
  );
}

const detailFilterWrap: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 12,
};

const detailFilterChip: React.CSSProperties = {
  border: "1px solid #d8e5dc",
  borderRadius: 999,
  background: "#fff",
  color: "#294234",
  padding: "8px 12px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const detailFilterChipActive: React.CSSProperties = {
  border: "2px solid #145c2a",
  background: "#f3fbf5",
  color: "#145c2a",
};

const calendarHelpButton: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  border: "1px solid #d6eadb",
  background: "#fff",
  color: "#23412c",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 18,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};