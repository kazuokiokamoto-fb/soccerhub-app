// app/match/page.tsx
"use client";

import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useRouter } from "next/navigation";

import { Calendar } from "./components/Calendar";
import { DaySlotList } from "./components/DaySlotList";

import { CATEGORY_OPTIONS } from "@/app/lib/categories";
import { CheckboxGroup } from "@/app/components/CheckboxGroup";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";
import {
  StrengthRankPicker,
  type StrengthRank,
} from "@/app/components/StrengthRankPicker";

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

export default function MatchCalendarPage() {
  const router = useRouter();

  const [monthDate, setMonthDate] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedYmd, setSelectedYmd] = useState<string>(ymdToday());
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

  const [requestTeamId, setRequestTeamId] = useState<string>("");
  const [requestComment, setRequestComment] = useState<string>("");

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
    return slotsInMonth.filter((s: any) => matchesSlotFilters(s, teamMap as any, appliedFilters));
  }, [slotsInMonth, teamMap, appliedFilters]);

  const draftFilteredSlotsInMonth = useMemo(() => {
    return slotsInMonth.filter((s: any) => matchesSlotFilters(s, teamMap as any, draftFilters));
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
    router.push(`/match/new?date=${encodeURIComponent(ymd)}`);
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
      (r) => r.slot_id === slotId && r.requester_user_id === uid && r.status !== "cancelled"
    );
    if (already) {
      alert("すでに申込み済みです");
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

    const { error } = await supabase.from("match_requests").insert(payload);

    if (error) {
      console.error(error);
      alert(`申込みに失敗しました: ${error.message}`);
      return;
    }

    const hostTeam = teamMap.get(slot.host_team_id);
    const requesterTeam = myTeams.find((t) => t.id === requestTeamId);

    try {
      const threadId = await getOrCreateDmThread(requestTeamId, slot.host_team_id);

      const bodyLines = [
        "【試合申込】",
        `${slot.date} ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`,
        `カテゴリ: ${slot.category ?? "未設定"}`,
        `エリア: ${slot.area_text ?? slot.area ?? "未設定"}`,
        `申込チーム: ${requesterTeam?.name ?? "未設定"}`,
        `募集チーム: ${hostTeam?.name ?? "未設定"}`,
        requestComment.trim() ? `コメント: ${requestComment.trim()}` : "",
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

  const updateRequestStatus = async (requestId: string, status: "accepted" | "rejected") => {
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
          const threadId = await getOrCreateDmThread(slot.host_team_id, target.requester_team_id);

          const requesterTeamName =
            requestTeamNameMap.get(target.requester_team_id) ?? "相手チーム";
          const hostTeamName =
            requestTeamNameMap.get(slot.host_team_id) ?? "募集チーム";

          await insertChatMessage({
            threadId,
            senderId: uid,
            senderTeamId: slot.host_team_id,
            body: [
              "【試合申込 承認】",
              `${slot.date} ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`,
              `募集チーム: ${hostTeamName}`,
              `申込チーム: ${requesterTeamName}`,
              "申込が承認されました。詳細はこのチャットで調整してください。",
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
        const threadId = await getOrCreateDmThread(req.requester_team_id, slot.host_team_id);
        const requesterTeamName =
          requestTeamNameMap.get(req.requester_team_id) ?? "申込チーム";

        await insertChatMessage({
          threadId,
          senderId: uid,
          senderTeamId: req.requester_team_id,
          body: `【試合申込 取消】\n${requesterTeamName} が申込みをキャンセルしました。`,
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
      <AppHero
        icon="⚽️"
        title="試合を探す / 募集する"
        desc="カレンダーで募集枠を確認しながら、条件を指定して相手を探せます。"
      />

      <AppTabNav />

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
                入力中の募集（{draftSlotsOnSelectedDate.length}件／{slotsOnSelectedDate.length}件）
              </div>
            </div>

            <button
              type="button"
              className="sh-btn"
              style={createButtonInline}
              onClick={() => goToCreatePage(selectedYmd)}
              disabled={loading || myTeams.length === 0}
            >
              ＋募集を作る
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

              <button type="button" className="sh-btn" onClick={scrollToDayList}>
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
                placeholder="例：三宿 / 青 / 強度高め / U-12 / SS"
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

            <StrengthRankPicker
              value={draftStrengthFilter as StrengthRank | ""}
              onChange={setDraftStrengthFilter}
              disabled={loading}
              title="強さ"
              allowEmpty={true}
              emptyLabel="指定なし"
            />

            <div style={twoCols}>
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
            </div>

            <div style={twoCols}>
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
    </main>
  );
}