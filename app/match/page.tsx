"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

import type { DbVenue, DbSlot, DbRequest, Toast } from "./types";
import { Calendar } from "./components/Calendar";
import { DaySlotList } from "./components/DaySlotList";
import { CreateSlotModal } from "./components/CreateSlotModal";

import { CATEGORY_OPTIONS } from "@/app/lib/categories";
import { CheckboxGroup } from "@/app/components/CheckboxGroup";
import { AreaPickerKanto } from "@/app/components/AreaPickerKanto";
import { StrengthRankPicker, type StrengthRank } from "@/app/components/StrengthRankPicker";

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

type TeamFilterRow = {
  id: string;
  owner_id: string | null;
  name: string;
  area: string | null;
  category: string | null;
  categories: string[] | null;
  prefecture: string | null;
  city: string | null;
  town: string | null;
  level: number | null;
  strength_rank?: string | null;
  has_ground: boolean | null;
  bike_parking: string | null;
  bike_parking_capacity?: string | null;
  member_count?: number | null;
  uniform_main: string | null;
  uniform_sub: string | null;
  roster_by_grade: Record<string, number> | null;
  note: string | null;
  updated_at: string;
};

type MatchFilters = {
  keyword: string;
  categoryFilter: string[];
  prefectureFilter: string;
  cityFilter: string;
  townFilter: string;
  groundFilter: "all" | "あり" | "なし";
  strengthFilter: StrengthRank | "";
  bikeFilter: "all" | "あり" | "なし" | "不明";
  bikeCapacityMin: string;
  memberCountMin: string;
};

const KANTO_PREFS = ["東京都", "神奈川県", "千葉県", "埼玉県", "茨城県", "栃木県", "群馬県"];

function isMissingColumnError(err: any) {
  const msg = String(err?.message ?? "");
  return (
    msg.includes("does not exist") ||
    msg.includes("Could not find") ||
    msg.includes("schema cache") ||
    (msg.includes("column") &&
      (msg.includes("bike_parking_capacity") ||
        msg.includes("member_count") ||
        msg.includes("strength_rank")))
  );
}

function guessPartsFromAreaText(area?: string | null): {
  prefecture?: string;
  city?: string;
  town?: string;
} {
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
    return {
      prefecture: prefecture || undefined,
      city: c || undefined,
      town: t || undefined,
    };
  }

  const tokens = rest.split(/\s+/).filter(Boolean);
  const city = tokens[0] ?? "";
  const town = tokens[1] ?? "";

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

  if (p || c || t) {
    return {
      prefecture: p || undefined,
      city: c || undefined,
      town: t || undefined,
    };
  }

  return guessPartsFromAreaText((s as any).area ?? "");
}

function levelLabel(level: number) {
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

function sumRoster(roster?: Record<string, number> | null) {
  if (!roster) return 0;
  return Object.values(roster).reduce((sum, v) => sum + (Number(v) || 0), 0);
}

function includesKeyword(team: TeamFilterRow | undefined, slot: SlotEx, keyword: string) {
  const q = keyword.trim().toLowerCase();
  if (!q) return true;

  const hay = [
    team?.name,
    team?.area,
    team?.category,
    ...(team?.categories ?? []),
    team?.note,
    team?.uniform_main,
    team?.uniform_sub,
    team?.bike_parking,
    team?.bike_parking_capacity,
    slot.area,
    slot.category,
    levelLabel(Number(team?.level ?? 0)),
    String(team?.member_count ?? sumRoster(team?.roster_by_grade)),
  ]
    .join(" ")
    .toLowerCase();

  return hay.includes(q);
}

function matchesSlotFilters(
  s: SlotEx,
  teamMap: Map<string, TeamFilterRow>,
  filters: MatchFilters
) {
  const team = teamMap.get((s as any).host_team_id);

  const cats =
    Array.isArray(team?.categories) && team?.categories.length > 0
      ? team?.categories
      : team?.category
        ? [team.category]
        : s.category
          ? [s.category]
          : [];

  if (filters.categoryFilter.length > 0) {
    if (cats.length === 0) return false;
    if (!cats.some((c) => c && filters.categoryFilter.includes(String(c).trim()))) return false;
  }

  const parts = team
    ? {
        prefecture: team.prefecture ?? slotParts(s).prefecture,
        city: team.city ?? slotParts(s).city,
        town: team.town ?? slotParts(s).town,
      }
    : slotParts(s);

  if (filters.prefectureFilter && (parts.prefecture ?? "") !== filters.prefectureFilter) return false;
  if (filters.cityFilter && (parts.city ?? "") !== filters.cityFilter) return false;
  if (filters.townFilter && (parts.town ?? "") !== filters.townFilter) return false;

  if (filters.groundFilter !== "all") {
    const val = team?.has_ground ? "あり" : "なし";
    if (val !== filters.groundFilter) return false;
  }

  if (filters.strengthFilter) {
    const rank = levelLabel(Number(team?.level ?? 0));
    if (rank !== filters.strengthFilter) return false;
  }

  if (filters.bikeFilter !== "all") {
    const bike = String(team?.bike_parking ?? "不明");
    if (bike !== filters.bikeFilter) return false;
  }

  if (filters.bikeCapacityMin) {
    const cap = parseBikeCapacity(team?.bike_parking_capacity);
    if (cap == null || cap < Number(filters.bikeCapacityMin)) return false;
  }

  if (filters.memberCountMin) {
    const count =
      team?.member_count != null
        ? Number(team.member_count)
        : sumRoster(team?.roster_by_grade);
    if (count < Number(filters.memberCountMin)) return false;
  }

  if (!includesKeyword(team, s, filters.keyword)) return false;

  return true;
}

export default function MatchCalendarPage() {
  const router = useRouter();

  const [toast, setToast] = useState<Toast | null>(null);
  const [loadingBase, setLoadingBase] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);
  const loading = loadingBase || loadingMonth;

  const [meId, setMeId] = useState<string>("");

  const [draftKeyword, setDraftKeyword] = useState("");
  const [draftCategoryFilter, setDraftCategoryFilter] = useState<string[]>([]);
  const [draftPrefectureFilter, setDraftPrefectureFilter] = useState<string>("");
  const [draftCityFilter, setDraftCityFilter] = useState<string>("");
  const [draftTownFilter, setDraftTownFilter] = useState<string>("");
  const [draftGroundFilter, setDraftGroundFilter] = useState<"all" | "あり" | "なし">("all");
  const [draftStrengthFilter, setDraftStrengthFilter] = useState<StrengthRank | "">("");
  const [draftBikeFilter, setDraftBikeFilter] = useState<"all" | "あり" | "なし" | "不明">("all");
  const [draftBikeCapacityMin, setDraftBikeCapacityMin] = useState<string>("");
  const [draftMemberCountMin, setDraftMemberCountMin] = useState<string>("");

  const [keyword, setKeyword] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [prefectureFilter, setPrefectureFilter] = useState<string>("");
  const [cityFilter, setCityFilter] = useState<string>("");
  const [townFilter, setTownFilter] = useState<string>("");
  const [groundFilter, setGroundFilter] = useState<"all" | "あり" | "なし">("all");
  const [strengthFilter, setStrengthFilter] = useState<StrengthRank | "">("");
  const [bikeFilter, setBikeFilter] = useState<"all" | "あり" | "なし" | "不明">("all");
  const [bikeCapacityMin, setBikeCapacityMin] = useState<string>("");
  const [memberCountMin, setMemberCountMin] = useState<string>("");

  const [monthDate, setMonthDate] = useState<Date>(() => startOfMonth(new Date()));
  const monthKey = useMemo(() => toMonthKey(monthDate), [monthDate]);

  const [allTeams, setAllTeams] = useState<TeamFilterRow[]>([]);
  const [myTeams, setMyTeams] = useState<TeamFilterRow[]>([]);
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

  const dayListRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<HTMLDivElement | null>(null);

  const teamMap = useMemo(() => {
    return new Map(allTeams.map((t) => [t.id, t]));
  }, [allTeams]);

  const appliedFilters = useMemo<MatchFilters>(() => {
    return {
      keyword,
      categoryFilter,
      prefectureFilter,
      cityFilter,
      townFilter,
      groundFilter,
      strengthFilter,
      bikeFilter,
      bikeCapacityMin,
      memberCountMin,
    };
  }, [
    keyword,
    categoryFilter,
    prefectureFilter,
    cityFilter,
    townFilter,
    groundFilter,
    strengthFilter,
    bikeFilter,
    bikeCapacityMin,
    memberCountMin,
  ]);

  const draftFilters = useMemo<MatchFilters>(() => {
    return {
      keyword: draftKeyword,
      categoryFilter: draftCategoryFilter,
      prefectureFilter: draftPrefectureFilter,
      cityFilter: draftCityFilter,
      townFilter: draftTownFilter,
      groundFilter: draftGroundFilter,
      strengthFilter: draftStrengthFilter,
      bikeFilter: draftBikeFilter,
      bikeCapacityMin: draftBikeCapacityMin,
      memberCountMin: draftMemberCountMin,
    };
  }, [
    draftKeyword,
    draftCategoryFilter,
    draftPrefectureFilter,
    draftCityFilter,
    draftTownFilter,
    draftGroundFilter,
    draftStrengthFilter,
    draftBikeFilter,
    draftBikeCapacityMin,
    draftMemberCountMin,
  ]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeId(data?.user?.id || ""));
  }, []);

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

  const applyFilters = () => {
    setKeyword(draftKeyword);
    setCategoryFilter(draftCategoryFilter);
    setPrefectureFilter(draftPrefectureFilter);
    setCityFilter(draftCityFilter);
    setTownFilter(draftTownFilter);
    setGroundFilter(draftGroundFilter);
    setStrengthFilter(draftStrengthFilter);
    setBikeFilter(draftBikeFilter);
    setBikeCapacityMin(draftBikeCapacityMin);
    setMemberCountMin(draftMemberCountMin);
    setSelectedSlotId("");

    scrollToDayList();
  };

  const clearFilters = () => {
    setDraftKeyword("");
    setDraftCategoryFilter([]);
    setDraftPrefectureFilter("");
    setDraftCityFilter("");
    setDraftTownFilter("");
    setDraftGroundFilter("all");
    setDraftStrengthFilter("");
    setDraftBikeFilter("all");
    setDraftBikeCapacityMin("");
    setDraftMemberCountMin("");

    setKeyword("");
    setCategoryFilter([]);
    setPrefectureFilter("");
    setCityFilter("");
    setTownFilter("");
    setGroundFilter("all");
    setStrengthFilter("");
    setBikeFilter("all");
    setBikeCapacityMin("");
    setMemberCountMin("");
    setSelectedSlotId("");
  };

  const hasDraftChanges = useMemo(() => {
    return (
      draftKeyword !== keyword ||
      JSON.stringify(draftCategoryFilter) !== JSON.stringify(categoryFilter) ||
      draftPrefectureFilter !== prefectureFilter ||
      draftCityFilter !== cityFilter ||
      draftTownFilter !== townFilter ||
      draftGroundFilter !== groundFilter ||
      draftStrengthFilter !== strengthFilter ||
      draftBikeFilter !== bikeFilter ||
      draftBikeCapacityMin !== bikeCapacityMin ||
      draftMemberCountMin !== memberCountMin
    );
  }, [
    draftKeyword,
    keyword,
    draftCategoryFilter,
    categoryFilter,
    draftPrefectureFilter,
    prefectureFilter,
    draftCityFilter,
    cityFilter,
    draftTownFilter,
    townFilter,
    draftGroundFilter,
    groundFilter,
    draftStrengthFilter,
    strengthFilter,
    draftBikeFilter,
    bikeFilter,
    draftBikeCapacityMin,
    bikeCapacityMin,
    draftMemberCountMin,
    memberCountMin,
  ]);

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

      let teamRes = await supabase.from("teams").select(
        "id,owner_id,name,area,category,categories,prefecture,city,town,level,strength_rank,has_ground,bike_parking,bike_parking_capacity,member_count,uniform_main,uniform_sub,roster_by_grade,note,updated_at"
      );

      if (teamRes.error && isMissingColumnError(teamRes.error)) {
        teamRes = await supabase.from("teams").select(
          "id,owner_id,name,area,category,categories,prefecture,city,town,level,has_ground,bike_parking,uniform_main,uniform_sub,roster_by_grade,note,updated_at"
        );
      }

      if (teamRes.error) {
        console.error(teamRes.error);
        setToast({ type: "error", text: `チーム読み込みに失敗: ${teamRes.error.message}` });
        setAllTeams([]);
        setMyTeams([]);
      } else {
        const rows = (teamRes.data ?? []) as TeamFilterRow[];
        setAllTeams(rows);

        const mine = rows.filter((t) => t.owner_id === uid);
        setMyTeams(mine);

        if (!hostTeamId && mine[0]?.id) setHostTeamId(mine[0].id);
        if (!requestTeamId && mine[0]?.id) setRequestTeamId(mine[0].id);
        if (!slotArea && mine[0]?.area) setSlotArea(mine[0].area || "");
        if (mine[0]?.category) setSlotCategory(mine[0].category || "U-12");
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
    return slotsInMonth.filter((s) => matchesSlotFilters(s, teamMap, appliedFilters));
  }, [slotsInMonth, teamMap, appliedFilters]);

  const draftFilteredSlotsInMonth = useMemo(() => {
    return slotsInMonth.filter((s) => matchesSlotFilters(s, teamMap, draftFilters));
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

      if (!myTeamId) {
        return setToast({ type: "error", text: "自分のチームがありません（先にチーム作成/選択）" });
      }
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
    scrollToDayList();
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
      const { error } = await supabase
        .from("match_requests")
        .update({ status: "cancelled" })
        .eq("id", requestId);

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

  const appliedSummary = useMemo(() => {
    const parts: string[] = [];
    if (keyword) parts.push(`キーワード: ${keyword}`);
    if (prefectureFilter) parts.push(`都県: ${prefectureFilter}`);
    if (cityFilter) parts.push(`市区町村: ${cityFilter}`);
    if (townFilter) parts.push(`町名: ${townFilter}`);
    if (categoryFilter.length > 0) parts.push(`カテゴリ: ${categoryFilter.join(" / ")}`);
    if (strengthFilter) parts.push(`強さ: ${strengthFilter}`);
    if (groundFilter !== "all") parts.push(`グラウンド提供: ${groundFilter}`);
    if (bikeFilter !== "all") parts.push(`駐輪場: ${bikeFilter}`);
    if (bikeCapacityMin) parts.push(`駐輪場台数: ${bikeCapacityMin}台以上`);
    if (memberCountMin) parts.push(`所属人数: ${memberCountMin}人以上`);
    return parts;
  }, [
    keyword,
    prefectureFilter,
    cityFilter,
    townFilter,
    categoryFilter,
    strengthFilter,
    groundFilter,
    bikeFilter,
    bikeCapacityMin,
    memberCountMin,
  ]);

  return (
    <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      {toast ? (
        <div
          style={{
            ...toastBox,
            ...(toast.type === "success"
              ? toastSuccess
              : toast.type === "error"
                ? toastError
                : toastInfo),
          }}
          role="status"
          aria-live="polite"
        >
          <div style={{ whiteSpace: "pre-wrap" }}>{toast.text}</div>
          <button
            type="button"
            onClick={() => setToast(null)}
            style={toastClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
      ) : null}

      <section style={heroBox}>
        <h1 style={heroTitle}>⚽ 試合を探す / 募集する</h1>
        <p style={heroDesc}>
          カレンダーで募集枠を確認しながら、条件を指定して相手を探せます。
          自分のチームで募集枠を作ることもできます。
        </p>
      </section>

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
            scrollToDayList();
          }}
          onPrevMonth={() => setMonthDate(addMonths(monthDate, -1))}
          onNextMonth={() => setMonthDate(addMonths(monthDate, 1))}
          onCreateForDate={openCreateForDate}
          disableCreate={myTeams.length === 0}
        />
      </section>

      <div ref={dayListRef} style={dayListWrap}>
        <div style={stickySummaryBar}>
          <div style={stickySummaryDate}>📅 {selectedYmd} の募集一覧</div>
          <div style={stickySummaryCount}>
            入力中：{draftSlotsOnSelectedDate.length}件 / 表示中：{slotsOnSelectedDate.length}件
          </div>
        </div>

        <div style={dayListHeaderRow}>
          <h2 style={dayListTitle}>📋 {selectedYmd} の募集一覧</h2>

          <button
            type="button"
            className="sh-btn"
            onClick={scrollToFilter}
          >
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
            <span style={labelTitle}>キーワード検索</span>
            <input
              value={draftKeyword}
              onChange={(e) => setDraftKeyword(e.target.value)}
              className="sh-input"
              placeholder="例：三宿 / 青 / 強度高め / U-12 / SS"
              disabled={loading}
            />
          </label>

          <AreaPickerKanto
            title="エリアで絞り込み（関東）"
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
            title="カテゴリで絞り込み（複数）"
            options={CATEGORY_OPTIONS}
            values={draftCategoryFilter}
            onChange={setDraftCategoryFilter}
            columns={3}
            disabled={loading}
            useChipUI={true}
          />

          <StrengthRankPicker
            value={draftStrengthFilter}
            onChange={setDraftStrengthFilter}
            disabled={loading}
            title="強さ"
            allowEmpty={true}
            emptyLabel="指定なし"
          />

          <div style={twoCols}>
            <label style={label}>
              <span style={labelTitle}>グラウンド提供</span>
              <select
                value={draftGroundFilter}
                onChange={(e) => setDraftGroundFilter(e.target.value as "all" | "あり" | "なし")}
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
                onChange={(e) =>
                  setDraftBikeFilter(e.target.value as "all" | "あり" | "なし" | "不明")
                }
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
              className="sh-btn sh-btn--primary"
              type="button"
              onClick={applyFilters}
              disabled={loading || !hasDraftChanges}
            >
              {loading ? "更新中…" : "この条件で表示"}
            </button>

            <button className="sh-btn" type="button" onClick={clearFilters} disabled={loading}>
              条件クリア
            </button>

            <button className="sh-btn" type="button" onClick={loadMonth} disabled={loading}>
              {loading ? "更新中…" : "再読み込み"}
            </button>

            <div style={{ color: "#666", fontSize: 12 }}>
              表示中の募集枠：{filteredSlotsInMonth.length}
            </div>
          </div>

          {appliedSummary.length > 0 ? (
            <div style={appliedBox}>
              <div style={appliedTitle}>現在の表示条件</div>
              <div style={appliedText}>{appliedSummary.join(" / ")}</div>
            </div>
          ) : (
            <div style={{ color: "#777", fontSize: 12 }}>
              ※ 条件を入力して「この条件で表示」を押すと、募集一覧に反映されます
            </div>
          )}
        </div>
      </section>

      <CreateSlotModal
        open={openCreate}
        loading={loading}
        myTeams={myTeams as any}
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

const heroBox: React.CSSProperties = {
  borderRadius: 20,
  background: "linear-gradient(135deg, #1e7f3c 0%, #145c2a 100%)",
  color: "#fff",
  padding: 18,
  boxShadow: "0 10px 28px rgba(20,92,42,0.16)",
  marginBottom: 12,
};

const heroTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 900,
  lineHeight: 1.3,
};

const heroDesc: React.CSSProperties = {
  margin: "10px 0 0",
  color: "rgba(255,255,255,0.92)",
  lineHeight: 1.8,
  fontSize: 14,
};

const dayListWrap: React.CSSProperties = {
  marginTop: 12,
  scrollMarginTop: 88,
};

const stickySummaryBar: React.CSSProperties = {
  position: "sticky",
  top: 10,
  zIndex: 20,
  marginBottom: 10,
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #dbe7df",
  background: "rgba(247,251,248,0.96)",
  backdropFilter: "blur(8px)",
  boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
};

const stickySummaryDate: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#1f5d30",
  lineHeight: 1.4,
};

const stickySummaryCount: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  fontWeight: 800,
  color: "#166534",
  lineHeight: 1.4,
};

const dayListHeaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 10,
};

const dayListTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 900,
  color: "#1f5d30",
};

const filterWrap: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
  padding: 12,
  borderRadius: 14,
  border: "1px solid #eee",
  background: "#fff",
  scrollMarginTop: 88,
};

const filterHeaderRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const filterTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 900,
  color: "#1f5d30",
};

const label: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const labelTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
};

const twoCols: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "1fr 1fr",
};

const actionRow: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const appliedBox: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  background: "#fafafa",
  padding: "10px 12px",
};

const appliedTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
  marginBottom: 4,
};

const appliedText: React.CSSProperties = {
  fontSize: 13,
  color: "#444",
  lineHeight: 1.7,
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

const stickySummaryOuter: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
};

const stickyDraftCountWrap: React.CSSProperties = {
  position: "sticky",
  top: 10,
  zIndex: 30,
};

const draftCountBox: React.CSSProperties = {
  border: "1px solid #dbe7df",
  borderRadius: 12,
  background: "rgba(247,251,248,0.96)",
  backdropFilter: "blur(6px)",
  padding: "10px 12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
};

const draftCountDate: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#5b6d61",
  marginBottom: 4,
};

const draftCountMain: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#166534",
};