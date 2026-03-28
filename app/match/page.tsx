"use client";

import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";

import { Calendar } from "./components/Calendar";
import { DaySlotList } from "./components/DaySlotList";

import { CATEGORY_OPTIONS, categoryLabel } from "@/app/lib/categories";
import { CheckboxGroup } from "@/app/components/CheckboxGroup";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";
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
  filterWrap,
  filterHeaderRow,
  filterTitle,
  label,
  labelTitle,
  twoCols,
  actionRow,
} from "./styles/matchPageStyles";

type StrengthGuide = {
  rank: StrengthRank;
  short: string;
  title: string;
  bullets: string[];
  note: string;
};

const STRENGTH_OPTIONS = [
  { value: "SS", label: "SS 都・県リーグ1・2部" },
  { value: "S", label: "S 都・県リーグ3・4部" },
  { value: "A", label: "A 地域リーグ1・2部" },
  { value: "B", label: "B 地域リーグ3・4部" },
  { value: "C", label: "C フレンドリー" },
];

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

const strengthCard: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 16,
  padding: 14,
  background: "#fff",
};

const strengthHead: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 12,
};

const strengthTitleWrap: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const strengthTitleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const strengthTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "#1f5d30",
};

const strengthSubText: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
};

const strengthHeadRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const helpButton: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  border: "1px solid #d6eadb",
  background: "#fff",
  color: "#23412c",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 18,
  transition: "all 0.15s ease",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "none",
  WebkitAppearance: "none",
  appearance: "none",
};

const strengthSimpleList: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const strengthSimpleButton: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #d6eadb",
  background: "#fff",
  cursor: "pointer",
  transition: "all 0.15s ease",
  fontSize: 14,
  fontWeight: 800,
  color: "#23412c",
  lineHeight: 1.5,
  boxShadow: "none",
  WebkitAppearance: "none",
  appearance: "none",
};

const strengthSimpleButtonDisabled: React.CSSProperties = {
  opacity: 0.6,
  cursor: "not-allowed",
};

const strengthSimpleCode: React.CSSProperties = {
  display: "inline-block",
  minWidth: 28,
  fontWeight: 900,
};

const modalOverlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.42)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 2000,
};

const modalCard: React.CSSProperties = {
  width: "100%",
  maxWidth: 720,
  maxHeight: "80vh",
  overflowY: "auto",
  background: "#fff",
  borderRadius: 20,
  border: "1px solid #e5ece7",
  boxShadow: "0 18px 40px rgba(0,0,0,0.18)",
  padding: 18,
};

const modalHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
  position: "sticky",
  top: 0,
  background: "#fff",
  paddingBottom: 8,
};

const modalTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 900,
  color: "#16391f",
};

const modalCloseButton: React.CSSProperties = {
  border: "1px solid #d6ded9",
  background: "#fff",
  borderRadius: 12,
  padding: "8px 12px",
  fontWeight: 800,
  cursor: "pointer",
};

const guideList: React.CSSProperties = {
  display: "grid",
  gap: 12,
};

const guideCard: React.CSSProperties = {
  border: "1px solid #e7ece9",
  borderRadius: 16,
  background: "#fafcfb",
  padding: 14,
};

const guideTop: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const guideRank: React.CSSProperties = {
  minWidth: 42,
  height: 30,
  padding: "0 12px",
  borderRadius: 999,
  background: "#145c2a",
  color: "#fff",
  fontWeight: 900,
  fontSize: 14,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const guideShort: React.CSSProperties = {
  fontWeight: 900,
  color: "#16391f",
  fontSize: 15,
};

const guideTitleText: React.CSSProperties = {
  marginTop: 10,
  fontWeight: 800,
  color: "#314137",
  lineHeight: 1.7,
};

const guideBulletList: React.CSSProperties = {
  marginTop: 10,
  display: "grid",
  gap: 6,
};

const guideBulletRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "12px 1fr",
  gap: 8,
  alignItems: "start",
  color: "#314137",
  fontSize: 14,
  lineHeight: 1.7,
};

const guideBulletMark: React.CSSProperties = {
  fontWeight: 900,
  color: "#1f5d30",
};

const guideNote: React.CSSProperties = {
  marginTop: 10,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e7d08a",
  background: "#fff8dd",
  color: "#4d3a00",
  fontWeight: 800,
  lineHeight: 1.7,
  fontSize: 13,
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

export default function MatchCalendarPage() {
  const router = useRouter();

  const [monthDate, setMonthDate] = useState<Date>(() =>
    startOfMonth(new Date())
  );
  const [selectedYmd, setSelectedYmd] = useState<string>(ymdToday());
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

  const [requestTeamId, setRequestTeamId] = useState<string>("");
  const [requestComment, setRequestComment] = useState<string>("");
  const [showStrengthHelp, setShowStrengthHelp] = useState(false);

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
  const filterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!requestTeamId && myTeams[0]?.id) {
      setRequestTeamId(myTeams[0].id);
    }
  }, [myTeams, requestTeamId]);

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

  const slotsOnSelectedDate = useMemo(() => {
    return filteredSlotsInMonth.filter((s: any) => s.date === selectedYmd);
  }, [filteredSlotsInMonth, selectedYmd]);

  const draftSlotsOnSelectedDate = useMemo(() => {
    return draftFilteredSlotsInMonth.filter((s: any) => s.date === selectedYmd);
  }, [draftFilteredSlotsInMonth, selectedYmd]);

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
    scrollToDayList();
  };

  const handleResetFilters = () => {
    clearAllFilters();
    setSelectedSlotId("");
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

  const openDmAndGo = async (otherTeamId: string) => {
    try {
      const myTeamId = requestTeamId || myTeams[0]?.id;
      if (!myTeamId) {
        alert("自分のチームがありません");
        return;
      }
      if (!otherTeamId || myTeamId === otherTeamId) return;

      const threadId = await getOrCreateDmThread(myTeamId, otherTeamId);
      window.location.href = `/chat/${threadId}`;
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

    const confirmText = requestComment.trim()
      ? `この内容で試合申込しますか？\n\nコメント:\n${requestComment.trim()}`
      : "この内容で試合申込しますか？";

    if (!window.confirm(confirmText)) return;

    const payload = {
      slot_id: slotId,
      requester_team_id: requestTeamId,
      requester_user_id: uid,
      status: "pending" as const,
      comment: requestComment.trim() || null,
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
        const notificationUrl = threadId ? `/chat/${threadId}` : "/chat";

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
        requestComment.trim() ? `💬 ${requestComment.trim()}` : "",
      ].filter(Boolean);

      await insertChatMessage({
        threadId,
        senderId: uid,
        senderTeamId: requestTeamId,
        body: bodyLines.join("\n"),
      });
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
    if (!window.confirm("申込みをキャンセルしますか？")) return;

    const req = requestsForMonth.find((r) => r.id === requestId);
    if (!req) return;

    const { error } = await supabase
      .from("match_requests")
      .update({ status: "cancelled" })
      .eq("id", requestId);

    if (error) {
      console.error(error);
      alert(`キャンセル失敗: ${error.message}`);
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
          onSelectDate={(ymd) => {
            setSelectedYmd(ymd);
            setSelectedSlotId("");
            setRequestComment("");
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

            <button
              type="button"
              className="sh-btn"
              style={createButtonInline}
              onClick={() => goToCreatePage(selectedYmd)}
              disabled={loading || myTeams.length === 0}
            >
              ＋募集枠を作る
            </button>
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

          <DaySlotList
            selectedYmd={selectedYmd}
            slots={slotsOnSelectedDate as any}
            venues={venues}
            allTeams={allTeams as any}
            myTeams={myTeams as any}
            meId={meId}
            requestsForMonth={requestsForMonth}
            selectedSlotId={selectedSlotId}
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

        <section ref={filterRef} style={filterWrap}>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={filterHeaderRow}>
              <h2 style={filterTitle}>絞り込み条件</h2>

              <button
                type="button"
                className="sh-btn"
                onClick={scrollToDayList}
              >
                募集一覧へ
              </button>
            </div>

            <label style={label}>
              <span style={labelTitle}>キーワード</span>

              <input
                value={draftKeyword}
                onChange={(e) => setDraftKeyword(e.target.value)}
                className="sh-input"
                disabled={loading}
                placeholder="例：三宿 / 青 / 強度高め / 小学5年 / キッズ / SS"
              />
            </label>

            <AreaPickerKanto
              title="エリア"
              allowAll={true}
              allLabel="関東（すべて）"
              disabled={loading}
              prefecture={draftPrefectureFilter}
              setPrefecture={setDraftPrefectureFilter}
              city={draftCityFilter}
              setCity={setDraftCityFilter}
              town={draftTownFilter}
              setTown={setDraftTownFilter}
              townOptional={true}
              useChipUI={true}
            />

            <CheckboxGroup
              title="カテゴリ"
              options={CATEGORY_OPTIONS}
              values={draftCategoryFilter}
              onChange={setDraftCategoryFilter}
              columns={3}
              disabled={loading}
              useChipUI={true}
            />

            <div style={strengthCard}>
              <div style={strengthHead}>
                <div style={strengthTitleWrap}>
                  <div style={strengthTitleRow}>
                    <div style={strengthTitle}>強さ</div>
                    <button
                      type="button"
                      aria-label="強さの説明"
                      title="強さの説明"
                      style={helpButton}
                      onClick={() => setShowStrengthHelp(true)}
                      disabled={loading}
                    >
                      ?
                    </button>
                  </div>
                  <div style={strengthSubText}>複数選択できます</div>
                </div>

                <div style={strengthHeadRight}>
                  <button
                    type="button"
                    className="sh-btn sh-btn--ghost"
                    onClick={() =>
                      setDraftStrengthFilter(
                        STRENGTH_OPTIONS.map((o) => o.value as StrengthRank)
                      )
                    }
                    disabled={loading}
                  >
                    全選択
                  </button>

                  <button
                    type="button"
                    className="sh-btn"
                    onClick={() => setDraftStrengthFilter([])}
                    disabled={loading}
                  >
                    クリア
                  </button>
                </div>
              </div>

              <div style={strengthSimpleList}>
                {STRENGTH_GUIDES.map((item) => {
                  const active = draftStrengthFilter.includes(item.rank);

                  return (
                    <button
                      key={item.rank}
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        setDraftStrengthFilter((prev) => {
                          if (prev.includes(item.rank)) {
                            return prev.filter((v) => v !== item.rank);
                          }
                          return [...prev, item.rank];
                        });
                      }}
                      aria-pressed={active}
                      style={{
                        ...strengthSimpleButton,
                        border: active
                          ? "1px solid #145c2a"
                          : "1px solid #d6eadb",
                        background: active ? "#145c2a" : "#fff",
                        color: active ? "#fff" : "#23412c",
                        boxShadow: active
                          ? "0 6px 14px rgba(20,92,42,0.14)"
                          : "none",
                        ...(loading ? strengthSimpleButtonDisabled : {}),
                      }}
                    >
                      <span style={strengthSimpleCode}>{item.rank}</span>
                      <span>{item.short}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={twoCols}>
              <label style={label}>
                <span style={labelTitle}>チーム所属人数（以上）</span>

                <select
                  value={draftMemberCountMin}
                  onChange={(e) => setDraftMemberCountMin(e.target.value)}
                  className="sh-select"
                  disabled={loading}
                >
                  <option value="">指定なし</option>
                  <option value="5">5人以上</option>
                  <option value="10">10人以上</option>
                  <option value="15">15人以上</option>
                  <option value="20">20人以上</option>
                  <option value="25">25人以上</option>
                  <option value="30">30人以上</option>
                </select>
              </label>

              <label style={label}>
                <span style={labelTitle}>グラウンド</span>

                <select
                  value={draftGroundFilter}
                  onChange={(e) => setDraftGroundFilter(e.target.value as any)}
                  className="sh-select"
                  disabled={loading}
                >
                  <option value="all">指定なし</option>
                  <option value="あり">あり</option>
                  <option value="なし">なし</option>
                </select>
              </label>
            </div>

            <div style={twoCols}>
              <label style={label}>
                <span style={labelTitle}>駐輪場</span>

                <select
                  value={draftBikeFilter}
                  onChange={(e) => setDraftBikeFilter(e.target.value as any)}
                  className="sh-select"
                  disabled={loading}
                >
                  <option value="all">指定なし</option>
                  <option value="あり">あり</option>
                  <option value="なし">なし</option>
                  <option value="不明">不明</option>
                </select>
              </label>

              <label style={label}>
                <span style={labelTitle}>駐輪場台数（以上）</span>

                <select
                  value={draftBikeCapacityMin}
                  onChange={(e) => setDraftBikeCapacityMin(e.target.value)}
                  className="sh-select"
                  disabled={loading}
                >
                  <option value="">指定なし</option>
                  <option value="5">5台以上</option>
                  <option value="10">10台以上</option>
                  <option value="15">15台以上</option>
                  <option value="20">20台以上</option>
                  <option value="25">25台以上</option>
                  <option value="30">30台以上</option>
                  <option value="40">40台以上</option>
                  <option value="50">50台以上</option>
                </select>
              </label>
            </div>

            <div style={actionRow}>
              <button
                type="button"
                className="sh-btn sh-btn--primary"
                onClick={handleApplyAndJump}
                disabled={!hasDraftChanges || loading}
              >
                この条件で一覧表示
              </button>

              <button
                type="button"
                className="sh-btn"
                onClick={handleResetFilters}
                disabled={loading}
              >
                条件リセット
              </button>
            </div>
          </div>
        </section>
      </div>

      {showStrengthHelp ? (
        <div
          style={modalOverlay}
          onClick={() => setShowStrengthHelp(false)}
          role="dialog"
          aria-modal="true"
          aria-label="強さの説明"
        >
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h3 style={modalTitle}>強さの説明</h3>
              <button
                type="button"
                style={modalCloseButton}
                onClick={() => setShowStrengthHelp(false)}
              >
                閉じる
              </button>
            </div>

            <div style={guideList}>
              {STRENGTH_GUIDES.map((item) => (
                <div key={item.rank} style={guideCard}>
                  <div style={guideTop}>
                    <div style={guideRank}>{item.rank}</div>
                    <div style={guideShort}>{item.short}</div>
                  </div>

                  <div style={guideTitleText}>{item.title}</div>

                  <div style={guideBulletList}>
                    {item.bullets.map((bullet) => (
                      <div key={bullet} style={guideBulletRow}>
                        <span style={guideBulletMark}>•</span>
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>

                  <div style={guideNote}>{item.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}