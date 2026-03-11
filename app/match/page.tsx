"use client";

import React, { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Calendar } from "./components/Calendar";
import { DaySlotList } from "./components/DaySlotList";
import { CreateSlotModal } from "./components/CreateSlotModal";

import { CATEGORY_OPTIONS } from "@/app/lib/categories";
import { CheckboxGroup } from "@/app/components/CheckboxGroup";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";
import {
  StrengthRankPicker,
  type StrengthRank,
} from "@/app/components/StrengthRankPicker";

import { buildCalendarCells, addMonths, startOfMonth, toMonthKey, ymdToday } from "./utils/date";
import { matchesSlotFilters } from "./utils/filters";

import { useMatchFilters } from "./hooks/useMatchFilters";
import { useMatchData } from "./hooks/useMatchData";

import {
  heroBox,
  heroTitle,
  heroDesc,
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
  appliedBox,
  appliedTitle,
  appliedText,
  toastBox,
  toastSuccess,
  toastError,
  toastInfo,
  toastClose,
} from "./styles/matchPageStyles";

export default function MatchCalendarPage() {
  const router = useRouter();

  const [monthDate, setMonthDate] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedYmd, setSelectedYmd] = useState<string>(ymdToday());
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

  const [openCreate, setOpenCreate] = useState(false);

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

  const teamMap = useMemo(() => {
    return new Map(allTeams.map((t) => [t.id, t]));
  }, [allTeams]);

  const filteredSlotsInMonth = useMemo(() => {
    return slotsInMonth.filter((s: any) =>
      matchesSlotFilters(s, teamMap, appliedFilters)
    );
  }, [slotsInMonth, teamMap, appliedFilters]);

  const draftFilteredSlotsInMonth = useMemo(() => {
    return slotsInMonth.filter((s: any) =>
      matchesSlotFilters(s, teamMap, draftFilters)
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

  return (
    <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <section style={heroBox}>
        <h1 style={heroTitle}>⚽ 試合を探す / 募集する</h1>
        <p style={heroDesc}>
          カレンダーで募集枠を確認しながら、条件を指定して相手を探せます。
        </p>
      </section>

      <Calendar
        monthKey={monthKey}
        loading={loading}
        cells={calendarCells}
        selectedYmd={selectedYmd}
        countByDate={countByDate}
        onSelectDate={(ymd) => {
          setSelectedYmd(ymd);
          setSelectedSlotId("");
          scrollToDayList();
        }}
        onPrevMonth={() => setMonthDate(addMonths(monthDate, -1))}
        onNextMonth={() => setMonthDate(addMonths(monthDate, 1))}
        onCreateForDate={() => setOpenCreate(true)}
        disableCreate={myTeams.length === 0}
      />

      <div ref={dayListRef} style={dayListWrap}>
        <div style={stickySummaryBar}>
          <div style={stickySummaryDate}>📅 {selectedYmd}</div>
          <div style={stickySummaryCount}>
            入力中：{draftSlotsOnSelectedDate.length}件 / 表示中：
            {slotsOnSelectedDate.length}件
          </div>
        </div>

        <div style={dayListHeaderRow}>
          <h2 style={dayListTitle}>募集一覧</h2>

          <button className="sh-btn" onClick={scrollToFilter}>
            絞り込み
          </button>
        </div>

        <DaySlotList
          selectedYmd={selectedYmd}
          slots={slotsOnSelectedDate as any}
          venues={venues}
          myTeams={myTeams as any}
          meId={meId}
          requestsForMonth={requestsForMonth}
          selectedSlotId={selectedSlotId}
          onToggleDetail={(slotId) =>
            setSelectedSlotId(selectedSlotId === slotId ? "" : slotId)
          }
          requestTeamId=""
          onChangeRequestTeamId={() => {}}
          onRequestSlot={() => {}}
          onCancelMyRequest={() => {}}
          selectedSlot={null}
          selectedSlotRequests={[]}
          isMineSlot={false}
          onAccept={() => {}}
          onReject={() => {}}
          onOpenChatWithTeam={() => {}}
          loading={loading}
        />
      </div>

      <section ref={filterRef} style={filterWrap}>
        <div style={filterHeaderRow}>
          <h2 style={filterTitle}>絞り込み条件</h2>

          <button className="sh-btn" onClick={scrollToDayList}>
            募集一覧へ
          </button>
        </div>

        <label style={label}>
          <span style={labelTitle}>キーワード</span>

          <input
            value={draftKeyword}
            onChange={(e) => setDraftKeyword(e.target.value)}
            className="sh-input"
          />
        </label>

        <AreaPickerKanto
          title="エリア"
          prefecture={draftPrefectureFilter}
          setPrefecture={setDraftPrefectureFilter}
          city={draftCityFilter}
          setCity={setDraftCityFilter}
          town={draftTownFilter}
          setTown={setDraftTownFilter}
        />

        <CheckboxGroup
          title="カテゴリ"
          options={CATEGORY_OPTIONS}
          values={draftCategoryFilter}
          onChange={setDraftCategoryFilter}
          columns={3}
        />

        <StrengthRankPicker
          value={draftStrengthFilter}
          onChange={setDraftStrengthFilter}
          title="強さ"
        />

        <div style={twoCols}>
          <label style={label}>
            <span style={labelTitle}>グラウンド</span>

            <select
              value={draftGroundFilter}
              onChange={(e) =>
                setDraftGroundFilter(e.target.value as any)
              }
              className="sh-select"
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
              onChange={(e) =>
                setDraftBikeFilter(e.target.value as any)
              }
              className="sh-select"
            >
              <option value="all">指定なし</option>
              <option value="あり">あり</option>
              <option value="なし">なし</option>
              <option value="不明">不明</option>
            </select>
          </label>
        </div>

        <div style={actionRow}>
          <button
            className="sh-btn sh-btn--primary"
            disabled={!hasDraftChanges}
          >
            この条件で表示
          </button>

          <button className="sh-btn" onClick={loadMonth}>
            再読み込み
          </button>
        </div>
      </section>

      <CreateSlotModal
        open={openCreate}
        loading={loading}
        myTeams={myTeams as any}
        venues={venues}
        slotDate={selectedYmd}
        hostTeamId=""
        startTime="13:00"
        endTime="15:00"
        slotArea=""
        slotCategory="U-12"
        venueId=""
        setSlotDate={() => {}}
        setHostTeamId={() => {}}
        setStartTime={() => {}}
        setEndTime={() => {}}
        setSlotArea={() => {}}
        setSlotCategory={() => {}}
        setVenueId={() => {}}
        onClose={() => setOpenCreate(false)}
        onCreate={() => {}}
      />
    </main>
  );
}