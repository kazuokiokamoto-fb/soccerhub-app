// （ファイルパスはあなたの実装に合わせて）例：app/match/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

import type { DbTeam, DbVenue, DbSlot, DbRequest, Toast } from "./types";
import { Calendar } from "./components/Calendar";
import { DaySlotList } from "./components/DaySlotList";
import { CreateSlotModal } from "./components/CreateSlotModal";

import { CATEGORY_OPTIONS } from "@/app/lib/categories";
import { CheckboxGroup } from "@/app/components/CheckboxGroup";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";

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

type SlotEx = DbSlot & {
  prefecture?: string | null;
  city?: string | null;
  town?: string | null;
};

const KANTO_PREFS = ["東京都", "神奈川県", "千葉県", "埼玉県", "茨城県", "栃木県", "群馬県"];

function guessPartsFromAreaText(area?: string | null): { prefecture?: string; city?: string; town?: string } {
  const raw = (area ?? "").trim();
  if (!raw) return {};
  let prefecture = "";
  let rest = raw;
  for (const p of KANTO_PREFS) {
    if (raw.startsWith(p)) {
      prefecture = p;
      rest = raw.slice(p.length).trim();
      break;
    }
  }
  rest = rest.replace(/^\s+/, "");
  if (rest.includes("・")) {
    const [c, t] = rest.split("・").map((s) => s.trim());
    return { prefecture: prefecture || undefined, city: c || undefined, town: t || undefined };
  }
  const tokens = rest.split(/\s+/).filter(Boolean);
  const city = tokens[0] ?? "";
  const town = tokens[1] ?? "";
  return { prefecture: prefecture || undefined, city: city || undefined, town: town || undefined };
}

function slotParts(s: SlotEx) {
  const p = (s.prefecture ?? "").trim();
  const c = (s.city ?? "").trim();
  const t = (s.town ?? "").trim();
  if (p || c || t) return { prefecture: p || undefined, city: c || undefined, town: t || undefined };
  return guessPartsFromAreaText((s as any).area ?? "");
}

export default function MatchCalendarPage() {
  const router = useRouter();

  const [toast, setToast] = useState<Toast | null>(null);
  const [loadingBase, setLoadingBase] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const loading = loadingBase || loadingMonth;

  const [meId, setMeId] = useState<string>("");

  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [prefectureFilter, setPrefectureFilter] = useState<string>("");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [townFilter, setTownFilter] = useState<string>("");

  const [monthDate, setMonthDate] = useState<Date>(() => startOfMonth(new Date()));
  const monthKey = useMemo(() => toMonthKey(monthDate), [monthDate]);

  const [myTeams, setMyTeams] = useState<DbTeam[]>([]);
  const [venues, setVenues] = useState<DbVenue[]>([]);
  const [slotsInMonth, setSlotsInMonth] = useState<SlotEx[]>([]);
  const [requestsForMonth, setRequestsForMonth] = useState<DbRequest[]>([]);

  const [selectedYmd, setSelectedYmd] = useState<string>(ymdToday());
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

  const [openCreate, setOpenCreate] = useState(false);
  const [hostTeamId, setHostTeamId] = useState<string>("");
  const [slotDate, setSlotDate] = useState<string>(ymdToday());
  const [startTime, setStartTime] = useState<string>("13:00");
  const [endTime, setEndTime] = useState<string>("15:00");
  const [slotArea, setSlotArea] = useState<string>("");
  const [slotCategory, setSlotCategory] = useState<string>("U-12");
  const [venueId, setVenueId] = useState<string>("");

  const [requestTeamId, setRequestTeamId] = useState<string>("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data?.user?.id || ""));
  }, []);

  const loadBase = async () => {
    setLoadingBase(true);
    setToast({ type: "info", text: "読み込み中…" });
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id || "";
      if (!uid) {
        setToast({ type: "error", text: "ログインが必要です" });
        return;
      }

      const { data: teamRows, error: teamErr } = await supabase
        .from("teams")
        .select(
          "id,name,area,category,categories,prefecture,city,town,level,has_ground,bike_parking,uniform_main,uniform_sub,roster_by_grade,desired_dates,note,updated_at,owner_id"
        )
        .eq("owner_id", uid)
        .order("updated_at", { ascending: false });

      if (teamErr) {
        console.error(teamErr);
        setToast({ type: "error", text: `チーム読み込みに失敗: ${teamErr.message}` });
        setMyTeams([]);
      } else {
        const ts = (teamRows ?? []) as DbTeam[];
        setMyTeams(ts);
        if (!hostTeamId && ts[0]?.id) setHostTeamId(ts[0].id);
        if (!requestTeamId && ts[0]?.id) setRequestTeamId(ts[0].id);
        if (!slotArea && (ts[0] as any)?.area) setSlotArea(((ts[0] as any).area as string) || "");
        if ((ts[0] as any)?.category) setSlotCategory(((ts[0] as any).category as string) || "U-12");
      }

      const { data: venueRows, error: venueErr } = await supabase
        .from("venues")
        .select("id,name,area,address,has_parking,has_bike_parking,note")
        .order("name", { ascending: true });

      if (venueErr) {
        console.error(venueErr);
        setToast({ type: "error", text: `グラウンド読み込みに失敗: ${venueErr.message}` });
        setVenues([]);
      } else {
        setVenues((venueRows ?? []) as DbVenue[]);
      }

      setToast(null);
    } finally {
      setLoadingBase(false);
    }
  };

  useEffect(() => {
    loadBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMonth = async () => {
    setLoadingMonth(true);
    setToast({ type: "info", text: "カレンダー更新中…" });
    try {
      const start = formatYmd(startOfMonth(monthDate));
      const end = formatYmd(endOfMonth(monthDate));

      const { data: slotRows, error: slotErr } = await supabase
        .from("match_slots")
        .select("id,owner_id,host_team_id,date,start_time,end_time,venue_id,area,category,prefecture,city,town,created_at")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (slotErr) {
        console.error(slotErr);
        setToast({ type: "error", text: `募集枠の読み込みに失敗: ${slotErr.message}` });
        setSlotsInMonth([]);
        setRequestsForMonth([]);
        return;
      }

      const slots = (slotRows ?? []) as SlotEx[];
      setSlotsInMonth(slots);

      const slotIds = slots.map((s) => s.id).filter(Boolean);
      if (slotIds.length === 0) {
        setRequestsForMonth([]);
      } else {
        const { data: reqRows, error: reqErr } = await supabase
          .from("match_requests")
          .select("id,slot_id,requester_team_id,requester_user_id,status,created_at")
          .in("slot_id", slotIds)
          .order("created_at", { ascending: false });

        if (reqErr) {
          console.error(reqErr);
          setRequestsForMonth([]);
        } else {
          setRequestsForMonth((reqRows ?? []) as DbRequest[]);
        }
      }

      setToast(null);
    } finally {
      setLoadingMonth(false);
    }
  };

  useEffect(() => {
    loadMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  const filteredSlotsInMonth = useMemo(() => {
    return slotsInMonth.filter((s) => {
      if (categoryFilter.length > 0) {
        const cat = (s.category ?? "").trim();
        if (!cat) return false;
        if (!categoryFilter.includes(cat)) return false;
      }
      const parts = slotParts(s);
      if (prefectureFilter && (parts.prefecture ?? "") !== prefectureFilter) return false;
      if (cityFilter && (parts.city ?? "") !== cityFilter) return false;
      if (townFilter && (parts.town ?? "") !== townFilter) return false;
      return true;
    });
  }, [slotsInMonth, categoryFilter, prefectureFilter, cityFilter, townFilter]);

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

  const selectedSlot = useMemo(() => {
    return slotsInMonth.find((s: any) => s.id === selectedSlotId) || null;
  }, [slotsInMonth, selectedSlotId]);

  const selectedSlotRequests = useMemo(() => {
    if (!selectedSlotId) return [];
    return requestsForMonth.filter((r: any) => r.slot_id === selectedSlotId);
  }, [requestsForMonth, selectedSlotId]);

  const isMineSlot = useMemo(() => {
    if (!selectedSlot) return false;
    return !!meId && (selectedSlot as any).owner_id === meId;
  }, [selectedSlot, meId]);

  const openCreateForDate = (ymd: string) => {
    setSlotDate(ymd);
    const t0 = myTeams[0] as any;
    if (t0?.id) setHostTeamId(t0.id);
    if (t0?.area) setSlotArea(t0.area || "");
    if (t0?.category) setSlotCategory(t0.category || "U-12");
    setStartTime("13:00");
    setEndTime("15:00");
    setVenueId("");
    setOpenCreate(true);
  };

  const openDmAndGo = async (otherTeamId: string) => {
    try {
      const myTeamId = requestTeamId || (myTeams[0] as any)?.id;

      if (!myTeamId) return setToast({ type: "error", text: "自分のチームがありません（先にチーム作成/選択）" });
      if (!otherTeamId) return setToast({ type: "error", text: "相手チーム情報がありません" });
      if (myTeamId === otherTeamId) return;

      const { data: u } = await supabase.auth.getUser();
      const uid = u?.user?.id;
      if (!uid) return setToast({ type: "error", text: "ログインできていません" });

      const { data, error } = await supabase.rpc("rpc_get_or_create_dm_thread", {
        my_team_id: myTeamId,
        other_team_id: otherTeamId,
      });

      if (error) {
        console.error(error);
        setToast({ type: "error", text: `チャット開始に失敗: ${error.message}` });
        return;
      }

      const threadId = data as string;
      if (!threadId) return setToast({ type: "error", text: "threadId がありません" });

      router.push(`/chat/${threadId}`);
    } catch (e: any) {
      console.error(e);
      setToast({ type: "error", text: `チャットを開けません: ${e?.message ?? "unknown error"}` });
    }
  };

  const createSlot = async () => {
    if (!slotDate) return setToast({ type: "error", text: "日付が必要です" });
    if (!hostTeamId) return setToast({ type: "error", text: "ホストチームを選んでください" });
    if (!startTime || !endTime) return setToast({ type: "error", text: "開始/終了時刻が必要です" });

    setToast({ type: "info", text: "募集枠を作成中…" });

    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return setToast({ type: "error", text: "ログインが必要です" });

    const host = (myTeams.find((t: any) => t.id === hostTeamId) ?? null) as any;
    const hostPrefecture = (host?.prefecture ?? "").trim();
    const hostCity = (host?.city ?? "").trim();
    const hostTown = (host?.town ?? "").trim();

    const areaText =
      (host?.area ?? "").trim() ||
      `${hostPrefecture || ""} ${hostCity || ""}${hostTown ? "・" + hostTown : ""}`.trim() ||
      (slotArea ?? "").trim() ||
      null;

    const payload: any = {
      owner_id: uid,
      host_team_id: hostTeamId,
      date: slotDate,
      start_time: startTime,
      end_time: endTime,
      venue_id: venueId || null,
      area: areaText,
      prefecture: hostPrefecture || null,
      city: hostCity || null,
      town: hostTown || null,
      category: slotCategory?.trim() || null,
    };

    const { error } = await supabase.from("match_slots").insert(payload);
    if (error) {
      console.error(error);
      return setToast({ type: "error", text: `募集枠の作成に失敗: ${error.message}` });
    }

    setToast({ type: "success", text: "✅ 募集枠を作成しました" });
    setOpenCreate(false);
    await loadMonth();
    setSelectedYmd(slotDate);
  };

  const requestSlot = async (slotId: string) => {
    if (!requestTeamId) return setToast({ type: "error", text: "申込みチームを選んでください" });
    setToast({ type: "info", text: "申込み中…" });

    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return setToast({ type: "error", text: "ログインが必要です" });

    const already = requestsForMonth.some(
      (r: any) => r.slot_id === slotId && r.requester_user_id === uid && r.status !== "cancelled"
    );
    if (already) return setToast({ type: "info", text: "すでに申込み済みです" });

    const payload = {
      slot_id: slotId,
      requester_team_id: requestTeamId,
      requester_user_id: uid,
      status: "pending" as const,
    };
    const { error } = await supabase.from("match_requests").insert(payload);
    if (error) {
      console.error(error);
      return setToast({ type: "error", text: `申込みに失敗: ${error.message}` });
    }

    setToast({ type: "success", text: "✅ 申込みしました（承認待ち）" });
    await loadMonth();
    setSelectedSlotId(slotId);
  };

  const updateRequestStatus = async (requestId: string, status: DbRequest["status"]) => {
    setToast({ type: "info", text: "更新中…" });
    const { error } = await supabase.from("match_requests").update({ status }).eq("id", requestId);
    if (error) {
      console.error(error);
      setToast({ type: "error", text: `更新に失敗: ${error.message}` });
      return false;
    }
    setToast({ type: "success", text: status === "accepted" ? "✅ 承認しました" : "🙇 却下しました" });
    return true;
  };

  const accept = async (rid: string) => {
    const ok = await updateRequestStatus(rid, "accepted");
    if (ok) await loadMonth();
  };
  const reject = async (rid: string) => {
    const ok = await updateRequestStatus(rid, "rejected");
    if (ok) await loadMonth();
  };

  const cancelMyRequest = async (requestId: string) => {
    if (!requestId) return;
    setLoadingMonth(true);
    setToast({ type: "info", text: "キャンセル中…" });
    try {
      const { error } = await supabase.from("match_requests").update({ status: "cancelled" }).eq("id", requestId);
      if (error) {
        console.error(error);
        setToast({ type: "error", text: `キャンセル失敗: ${error.message}` });
        return;
      }
      setToast({ type: "success", text: "✅ 申込みをキャンセルしました" });
      await loadMonth();
    } finally {
      setLoadingMonth(false);
    }
  };

  const clearFilters = () => {
    setCategoryFilter([]);
    setPrefectureFilter("");
    setCityFilter("");
    setTownFilter("");
  };

  const calendarCells = useMemo(() => {
    const first = startOfMonth(monthDate);
    const last = endOfMonth(monthDate);
    const prefix = weekdayIndexMondayFirst(first);
    const daysInMonth = last.getDate();

    const cells: Array<{ ymd: string; dayNum: number; inMonth: boolean }> = [];

    for (let i = 0; i < prefix; i++) {
      const d = new Date(first);
      d.setDate(1 - (prefix - i));
      cells.push({ ymd: formatYmd(d), dayNum: d.getDate(), inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(first.getFullYear(), first.getMonth(), day);
      cells.push({ ymd: formatYmd(d), dayNum: day, inMonth: true });
    }
    while (cells.length % 7 !== 0) {
      const lastYmd = cells[cells.length - 1]!.ymd;
      const dd = new Date(lastYmd + "T00:00:00");
      dd.setDate(dd.getDate() + 1);
      cells.push({ ymd: formatYmd(dd), dayNum: dd.getDate(), inMonth: false });
    }
    return cells;
  }, [monthDate]);

  return (
    <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      {toast ? (
        <div
          style={{
            ...toastBox,
            ...(toast.type === "success" ? toastSuccess : toast.type === "error" ? toastError : toastInfo),
          }}
          role="status"
          aria-live="polite"
        >
          <div style={{ whiteSpace: "pre-wrap" }}>{toast.text}</div>
          <button type="button" onClick={() => setToast(null)} style={toastClose} aria-label="閉じる">
            ×
          </button>
        </div>
      ) : null}

      {/* ✅ ヘッダー整理：右上は「チーム検索」「更新」だけ */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>マッチング（カレンダー）</h1>
          <p style={{ margin: "6px 0 0", color: "#555" }}>
            日付ごとに「募集中の枠数」→ クリックで詳細 → 募集/申込み/承認
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <Link href="/teams/search" className="sh-btn">
            チーム検索
          </Link>
        </div>
      </header>

      <section style={filterWrap}>
        <div style={{ display: "grid", gap: 12 }}>
          <AreaPickerKanto
            title="エリアで絞り込み（関東）"
            allowAll={true}
            allLabel="関東（すべて）"
            disabled={loading}
            prefecture={prefectureFilter}
            setPrefecture={setPrefectureFilter}
            city={cityFilter}
            setCity={setCityFilter}
            town={townFilter}
            setTown={setTownFilter}
            townOptional={true}
          />

          <CheckboxGroup
            title="カテゴリで絞り込み（複数）"
            options={CATEGORY_OPTIONS}
            values={categoryFilter}
            onChange={setCategoryFilter}
            columns={3}
            disabled={loading}
          />

          {categoryFilter.length > 0 || prefectureFilter || cityFilter || townFilter ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button className="sh-btn" type="button" onClick={clearFilters} disabled={loading}>
                条件クリア
              </button>
              <span style={{ color: "#666", fontSize: 12 }}>
                絞り込み中：
                {prefectureFilter ? ` ${prefectureFilter}` : "（都県なし）"} /
                {cityFilter ? ` ${cityFilter}` : "（市区町村なし）"} /
                {townFilter ? ` ${townFilter}` : "（町名なし）"} / カテゴリ {categoryFilter.length}
              </span>
            </div>
          ) : (
            <div style={{ color: "#777", fontSize: 12 }}>※ エリア（都県→市区町村→町名）とカテゴリで絞り込みできます</div>
          )}
        </div>
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
        }}
        onPrevMonth={() => setMonthDate(addMonths(monthDate, -1))}
        onNextMonth={() => setMonthDate(addMonths(monthDate, 1))}
        onCreateForDate={openCreateForDate}
        disableCreate={myTeams.length === 0}
      />

      <DaySlotList
        selectedYmd={selectedYmd}
        slots={slotsOnSelectedDate as any}
        venues={venues}
        myTeams={myTeams}
        meId={meId}
        requestsForMonth={requestsForMonth}
        selectedSlotId={selectedSlotId}
        onToggleDetail={(slotId) => setSelectedSlotId(selectedSlotId === slotId ? "" : slotId)}
        requestTeamId={requestTeamId}
        onChangeRequestTeamId={setRequestTeamId}
        onRequestSlot={requestSlot}
        onCancelMyRequest={cancelMyRequest}
        selectedSlot={selectedSlot as any}
        selectedSlotRequests={selectedSlotRequests as DbRequest[]}
        isMineSlot={isMineSlot}
        onAccept={accept}
        onReject={reject}
        onOpenChatWithTeam={openDmAndGo}
        loading={loading}
      />

      <CreateSlotModal
        open={openCreate}
        loading={loading}
        myTeams={myTeams}
        venues={venues}
        slotDate={slotDate}
        hostTeamId={hostTeamId}
        startTime={startTime}
        endTime={endTime}
        slotArea={slotArea}
        slotCategory={slotCategory}
        venueId={venueId}
        setSlotDate={setSlotDate}
        setHostTeamId={setHostTeamId}
        setStartTime={setStartTime}
        setEndTime={setEndTime}
        setSlotArea={setSlotArea}
        setSlotCategory={setSlotCategory}
        setVenueId={setVenueId}
        onClose={() => setOpenCreate(false)}
        onCreate={createSlot}
      />
    </main>
  );
}

const filterWrap: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
  padding: 12,
  borderRadius: 14,
  border: "1px solid #eee",
  background: "#fff",
};

const toastBox: React.CSSProperties = {
  position: "sticky",
  top: 10,
  zIndex: 50,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #eee",
  marginBottom: 12,
};

const toastSuccess: React.CSSProperties = { background: "#ecfdf3", borderColor: "#bbf7d0", color: "#166534" };
const toastError: React.CSSProperties = { background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" };
const toastInfo: React.CSSProperties = { background: "#eff6ff", borderColor: "#bfdbfe", color: "#1e3a8a" };

const toastClose: React.CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
  opacity: 0.7,
};