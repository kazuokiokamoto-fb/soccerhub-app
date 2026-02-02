// app/match/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";

import type { DbTeam, DbVenue, DbSlot, DbRequest, Toast } from "./types";

import { Calendar } from "./components/Calendar";
import { DaySlotList } from "./components/DaySlotList";
import { CreateSlotModal } from "./components/CreateSlotModal";

// ✅ 追加：検索UI
import { CATEGORY_OPTIONS } from "@/app/lib/categories";
import { CheckboxGroup } from "@/app/components/CheckboxGroup";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";

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

/** ===== helpers ===== */
type SlotEx = DbSlot & {
  prefecture?: string | null;
  city?: string | null;
  town?: string | null;
};

const KANTO_PREFS = ["東京都", "神奈川県", "千葉県", "埼玉県", "茨城県", "栃木県", "群馬県"];

// slot.area 互換から推定（完璧じゃないが、旧データ救済用）
function guessPartsFromAreaText(area?: string | null): { prefecture?: string; city?: string; town?: string } {
  const raw = (area ?? "").trim();
  if (!raw) return {};

  // 例："東京都 世田谷区・三宿" / "世田谷区・三宿" / "横浜市・中区"
  let prefecture = "";
  let rest = raw;

  for (const p of KANTO_PREFS) {
    if (raw.startsWith(p)) {
      prefecture = p;
      rest = raw.slice(p.length).trim();
      break;
    }
  }

  // rest 先頭の市区町村を推定：スペース区切りがあれば最初、なければ全体
  // ただし "世田谷区・三宿" なら city=世田谷区, town=三宿
  const firstToken = rest.split(/\s+/).filter(Boolean)[0] ?? rest;
  const [city, town] = firstToken.split("・").map((s) => s.trim());

  return {
    prefecture: prefecture || undefined,
    city: city || undefined,
    town: town || undefined,
  };
}

function slotParts(s: SlotEx) {
  const p = (s.prefecture ?? "").trim();
  const c = (s.city ?? "").trim();
  const t = (s.town ?? "").trim();

  if (p || c || t) return { prefecture: p || undefined, city: c || undefined, town: t || undefined };
  return guessPartsFromAreaText(s.area ?? "");
}

/** ===== Page ===== */
export default function MatchCalendarPage() {
  const [toast, setToast] = useState<Toast | null>(null);

  const [loadingBase, setLoadingBase] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);

  const [meId, setMeId] = useState<string>("");

  // ✅ 検索フィルター：カテゴリ複数 + エリア（都県→市区町村→町名）
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [prefectureFilter, setPrefectureFilter] = useState<string>(""); // "" = すべて
  const [cityFilter, setCityFilter] = useState<string>("");
  const [townFilter, setTownFilter] = useState<string>("");

  // month state
  const [monthDate, setMonthDate] = useState<Date>(() => startOfMonth(new Date()));
  const monthKey = useMemo(() => toMonthKey(monthDate), [monthDate]);

  // base data
  const [myTeams, setMyTeams] = useState<DbTeam[]>([]);
  const [venues, setVenues] = useState<DbVenue[]>([]);

  // month data
  const [slotsInMonth, setSlotsInMonth] = useState<SlotEx[]>([]);
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

  // toast auto close
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  /** ===== auth ===== */
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setMeId(data?.user?.id || "");
    });
  }, []);

  /** ===== Base load (my teams + venues) ===== */
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

        // defaults
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

  /** ===== Month load (slots + requests) ===== */
  const loadMonth = async () => {
    setLoadingMonth(true);
    setToast({ type: "info", text: "カレンダー更新中…" });

    try {
      const start = formatYmd(startOfMonth(monthDate));
      const end = formatYmd(endOfMonth(monthDate));

      // ✅ prefecture/city/town を取得
      const { data: slotRows, error: slotErr } = await supabase
        .from("match_slots")
        .select(
          "id,owner_id,host_team_id,date,start_time,end_time,venue_id,area,category,prefecture,city,town,created_at"
        )
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

  /** ===== フィルタ適用（month全体に適用） ===== */
  const filteredSlotsInMonth = useMemo(() => {
    return slotsInMonth.filter((s) => {
      // カテゴリ（複数）
      if (categoryFilter.length > 0) {
        const cat = (s.category ?? "").trim();
        if (!cat) return false;
        if (!categoryFilter.includes(cat)) return false;
      }

      // エリア（prefecture/city/town 優先、なければ area から推定）
      const parts = slotParts(s);

      if (prefectureFilter) {
        if ((parts.prefecture ?? "") !== prefectureFilter) return false;
      }
      if (cityFilter) {
        if ((parts.city ?? "") !== cityFilter) return false;
      }
      if (townFilter) {
        if ((parts.town ?? "") !== townFilter) return false;
      }

      return true;
    });
  }, [slotsInMonth, categoryFilter, prefectureFilter, cityFilter, townFilter]);

  /** ===== Calendar countByDate ===== */
  const countByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of filteredSlotsInMonth) {
      const k = s.date;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [filteredSlotsInMonth]);

  /** ===== derived ===== */
  const slotsOnSelectedDate = useMemo(() => {
    return filteredSlotsInMonth.filter((s) => s.date === selectedYmd);
  }, [filteredSlotsInMonth, selectedYmd]);

  const selectedSlot = useMemo(() => {
    return slotsInMonth.find((s) => s.id === selectedSlotId) || null;
  }, [slotsInMonth, selectedSlotId]);

  const selectedSlotRequests = useMemo(() => {
    if (!selectedSlotId) return [];
    return requestsForMonth.filter((r) => r.slot_id === selectedSlotId);
  }, [requestsForMonth, selectedSlotId]);

  const isMineSlot = useMemo(() => {
    if (!selectedSlot) return false;
    return !!meId && (selectedSlot as any).owner_id === meId;
  }, [selectedSlot, meId]);

  /** ===== actions ===== */
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

  // ✅ ここが今回の本丸：match_slots に prefecture/city/town を保存
  const createSlot = async () => {
    if (!slotDate) return setToast({ type: "error", text: "日付が必要です" });
    if (!hostTeamId) return setToast({ type: "error", text: "ホストチームを選んでください" });
    if (!startTime || !endTime) return setToast({ type: "error", text: "開始/終了時刻が必要です" });

    setToast({ type: "info", text: "募集枠を作成中…" });

    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return setToast({ type: "error", text: "ログインが必要です" });

    // ✅ ホストチームから都県/市区町村/町名を引く
    const host = (myTeams.find((t: any) => t.id === hostTeamId) ?? null) as any;
    const hostPrefecture = (host?.prefecture ?? "").trim();
    const hostCity = (host?.city ?? "").trim();
    const hostTown = (host?.town ?? "").trim();

    // ✅ 互換 area は必ず残す（host の area があればそれ優先）
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

      // ✅ 互換
      area: areaText,

      // ✅ 現行（検索の主軸）
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
      (r) => r.slot_id === slotId && r.requester_user_id === uid && r.status !== "cancelled"
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

  // 自分の申込みキャンセル
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

  /** ===== Calendar cells ===== */
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
      {/* Toast */}
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

      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>マッチング（カレンダー）</h1>
          <p style={{ margin: "6px 0 0", color: "#555" }}>
            日付ごとに「募集中の枠数」→ クリックで詳細 → 募集/申込み/承認
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/" className="sh-btn">
            トップ
          </Link>
          <Link href="/teams" className="sh-btn">
            チーム
          </Link>
          <Link href="/venues" className="sh-btn">
            グラウンド
          </Link>
          <button className="sh-btn" type="button" onClick={loadMonth} disabled={loading}>
            {loading ? "更新中…" : "再読み込み"}
          </button>
        </div>
      </header>

      {/* ===== 検索フィルター（統一UI）===== */}
      <section style={filterWrap}>
        <div style={{ display: "grid", gap: 12 }}>
          {/* ✅ エリア（関東：都県→市区町村→町名） */}
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

          {/* ✅ カテゴリ（複数） */}
          <CheckboxGroup
            title="カテゴリで絞り込み（複数）"
            options={CATEGORY_OPTIONS}
            values={categoryFilter}
            onChange={setCategoryFilter}
            columns={3}
            disabled={loading}
          />

          {(categoryFilter.length > 0 || prefectureFilter || cityFilter || townFilter) ? (
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button className="sh-btn" type="button" onClick={clearFilters} disabled={loading}>
                条件クリア
              </button>
              <span style={{ color: "#666", fontSize: 12 }}>
                絞り込み中：
                {prefectureFilter ? ` ${prefectureFilter}` : "（都県なし）"} /
                {cityFilter ? ` ${cityFilter}` : "（市区町村なし）"} /
                {townFilter ? ` ${townFilter}` : "（町名なし）"} /
                カテゴリ {categoryFilter.length}
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
        selectedSlot={selectedSlot as any}
        selectedSlotRequests={selectedSlotRequests as DbRequest[]}
        isMineSlot={isMineSlot}
        onAccept={accept}
        onReject={reject}
        onCancelMyRequest={cancelMyRequest}
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

/** ===== styles ===== */
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

const toastSuccess: React.CSSProperties = {
  background: "#ecfdf3",
  borderColor: "#bbf7d0",
  color: "#166534",
};

const toastError: React.CSSProperties = {
  background: "#fef2f2",
  borderColor: "#fecaca",
  color: "#991b1b",
};

const toastInfo: React.CSSProperties = {
  background: "#eff6ff",
  borderColor: "#bfdbfe",
  color: "#1e3a8a",
};

const toastClose: React.CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 20,
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
  opacity: 0.7,
};