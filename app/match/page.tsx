// app/match/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

import type { DbTeam, DbVenue, DbSlot, DbRequest, Toast } from "./types";

import { Calendar } from "./components/Calendar";
import { DaySlotList } from "./components/DaySlotList";
import { CreateSlotModal } from "./components/CreateSlotModal";

/** ===== Date utils ===== */
function ymdToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function toMonthKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function weekdayIndexMondayFirst(date: Date) {
  const w = date.getDay();
  return (w + 6) % 7;
}

/** ===== Page ===== */
export default function MatchCalendarPage() {
  const [toast, setToast] = useState<Toast | null>(null);

  const [loadingBase, setLoadingBase] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);

  const [meId, setMeId] = useState<string>("");

  // ===== 検索フィルター =====
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterArea, setFilterArea] = useState<string>("");

  // month state
  const [monthDate, setMonthDate] = useState<Date>(() => startOfMonth(new Date()));
  const monthKey = useMemo(() => toMonthKey(monthDate), [monthDate]);

  // base data
  const [myTeams, setMyTeams] = useState<DbTeam[]>([]);
  const [venues, setVenues] = useState<DbVenue[]>([]);

  // month data
  const [slotsInMonth, setSlotsInMonth] = useState<DbSlot[]>([]);
  const [requestsForMonth, setRequestsForMonth] = useState<DbRequest[]>([]);

  // selection
  const [selectedYmd, setSelectedYmd] = useState<string>(ymdToday());
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

  // create modal
  const [openCreate, setOpenCreate] = useState(false);
  const [hostTeamId, setHostTeamId] = useState<string>("");
  const [slotDate, setSlotDate] = useState<string>(ymdToday());
  const [startTime, setStartTime] = useState<string>("13:00");
  const [endTime, setEndTime] = useState<string>("15:00");
  const [slotArea, setSlotArea] = useState<string>("");
  const [slotCategory, setSlotCategory] = useState<string>("U-12");
  const [venueId, setVenueId] = useState<string>("");

  // request form
  const [requestTeamId, setRequestTeamId] = useState<string>("");

  const loading = loadingBase || loadingMonth;

  /** ===== auth ===== */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setMeId(data?.user?.id || "");
    });
  }, []);

  /** ===== Base load ===== */
  const loadBase = async () => {
    setLoadingBase(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id || "";
      if (!uid) return;

      const { data: teamRows } = await supabase
        .from("teams")
        .select("id,name,area,category")
        .eq("owner_id", uid);

      setMyTeams((teamRows ?? []) as DbTeam[]);

      const { data: venueRows } = await supabase
        .from("venues")
        .select("id,name,area,address");

      setVenues((venueRows ?? []) as DbVenue[]);
    } finally {
      setLoadingBase(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  /** ===== Month load ===== */
  const loadMonth = async () => {
    setLoadingMonth(true);
    try {
      const start = formatYmd(startOfMonth(monthDate));
      const end = formatYmd(endOfMonth(monthDate));

      const { data: slotRows } = await supabase
        .from("match_slots")
        .select("id,owner_id,host_team_id,date,start_time,end_time,venue_id,area,category,created_at")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true });

      const slots = (slotRows ?? []) as DbSlot[];
      setSlotsInMonth(slots);

      const slotIds = slots.map((s) => s.id);
      if (slotIds.length > 0) {
        const { data: reqRows } = await supabase
          .from("match_requests")
          .select("id,slot_id,requester_team_id,requester_user_id,status")
          .in("slot_id", slotIds);

        setRequestsForMonth((reqRows ?? []) as DbRequest[]);
      } else {
        setRequestsForMonth([]);
      }
    } finally {
      setLoadingMonth(false);
    }
  };

  useEffect(() => {
    loadMonth();
  }, [monthKey]);

  /** ===== フィルタ適用 ===== */
  const filteredSlotsInMonth = useMemo(() => {
    return slotsInMonth.filter((s) => {
      if (filterCategory && s.category !== filterCategory) return false;
      if (filterArea && !s.area?.includes(filterArea)) return false;
      return true;
    });
  }, [slotsInMonth, filterCategory, filterArea]);

  const slotsOnSelectedDate = useMemo(() => {
    return filteredSlotsInMonth.filter((s) => s.date === selectedYmd);
  }, [filteredSlotsInMonth, selectedYmd]);

  const countByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of filteredSlotsInMonth) {
      m.set(s.date, (m.get(s.date) ?? 0) + 1);
    }
    return m;
  }, [filteredSlotsInMonth]);

  /** ===== Calendar cells ===== */
  const calendarCells = useMemo(() => {
    const first = startOfMonth(monthDate);
    const last = endOfMonth(monthDate);
    const prefix = weekdayIndexMondayFirst(first);
    const cells: any[] = [];

    for (let i = 0; i < prefix; i++) {
      const d = new Date(first);
      d.setDate(1 - (prefix - i));
      cells.push({ ymd: formatYmd(d), dayNum: d.getDate(), inMonth: false });
    }

    for (let day = 1; day <= last.getDate(); day++) {
      const d = new Date(first.getFullYear(), first.getMonth(), day);
      cells.push({ ymd: formatYmd(d), dayNum: day, inMonth: true });
    }

    while (cells.length % 7 !== 0) {
      const d = new Date(cells[cells.length - 1].ymd);
      d.setDate(d.getDate() + 1);
      cells.push({ ymd: formatYmd(d), dayNum: d.getDate(), inMonth: false });
    }
    return cells;
  }, [monthDate]);

  return (
    <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>マッチング</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/" className="sh-btn">トップ</Link>
          <button className="sh-btn" onClick={loadMonth}>再読み込み</button>
        </div>
      </header>

      {/* ===== 検索フィルター ===== */}
      <section style={filterBox}>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={filterItem}>
          <option value="">学年（すべて）</option>
          <option value="U-8">U-8</option>
          <option value="U-9">U-9</option>
          <option value="U-10">U-10</option>
          <option value="U-11">U-11</option>
          <option value="U-12">U-12</option>
        </select>

        <input
          placeholder="エリア（例：世田谷区）"
          value={filterArea}
          onChange={(e) => setFilterArea(e.target.value)}
          style={filterItem}
        />

        {(filterArea || filterCategory) && (
          <button className="sh-btn" onClick={() => { setFilterArea(""); setFilterCategory(""); }}>
            クリア
          </button>
        )}
      </section>

      <Calendar
        monthKey={monthKey}
        loading={loading}
        cells={calendarCells}
        selectedYmd={selectedYmd}
        countByDate={countByDate}
        onSelectDate={(ymd) => setSelectedYmd(ymd)}
        onPrevMonth={() => setMonthDate(addMonths(monthDate, -1))}
        onNextMonth={() => setMonthDate(addMonths(monthDate, 1))}
        onCreateForDate={() => {}}
        disableCreate={true}
      />

      <DaySlotList
        selectedYmd={selectedYmd}
        slots={slotsOnSelectedDate}
        venues={venues}
        myTeams={myTeams}
        meId={meId}
        requestsForMonth={requestsForMonth}
        selectedSlotId={selectedSlotId}
        onToggleDetail={setSelectedSlotId}
        requestTeamId={requestTeamId}
        onChangeRequestTeamId={setRequestTeamId}
        onRequestSlot={() => {}}
        selectedSlot={null}
        selectedSlotRequests={[]}
        isMineSlot={false}
        onAccept={() => {}}
        onReject={() => {}}
        onCancelMyRequest={() => {}}
        loading={loading}
      />
    </main>
  );
}

/** ===== styles ===== */
const filterBox: React.CSSProperties = {
  display: "flex",
  gap: 12,
  margin: "16px 0",
  flexWrap: "wrap",
};

const filterItem: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #ddd",
};