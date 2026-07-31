// /app/selection/SelectionPageClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import { supabase } from "@/app/lib/supabase";

import {
  fetchSelectionEvents,
  getCachedSelectionEvents,
  groupSelectionEvents,
  hasUpcomingDate,
  ymdOnly,
  type GroupedSelectionEvent,
} from "@/app/lib/selections";

import type { SelectionEvent } from "@/app/types/selection";

import {
  buildCalendarCells,
  addMonths,
  startOfMonth,
  toMonthKey,
} from "@/app/match/utils/date";

import {
  MatchCalendarBase,
  type CalendarItem,
} from "@/app/match/components/MatchCalendarBase";

import AppTabNav from "@/app/components/AppTabNav";

// セレクションページ専用のカテゴリ選択肢（共有マスタ lib/categories.ts とは独立）
type SelectionCategoryOption = { value: string; label: string };

const SELECTION_CATEGORY_OPTIONS: SelectionCategoryOption[] = [
  { value: "U12", label: "U-12" },
  { value: "U13", label: "U-13" },
  { value: "U15", label: "U-15" },
  { value: "U18", label: "U-18" },
  { value: "U23", label: "U-23" },
  { value: "OPEN", label: "一般" },
  { value: "GK", label: "GK" },
  { value: "女子", label: "女子" },
];

// 表記ゆれ(ハイフン有無など)を吸収するローカル正規化マップ
const SELECTION_CATEGORY_ALIAS_MAP: Record<string, string> = {
  U12: "U12",
  "U-12": "U12",
  U13: "U13",
  "U-13": "U13",
  U15: "U15",
  "U-15": "U15",
  U18: "U18",
  "U-18": "U18",
  U23: "U23",
  "U-23": "U23",
  OPEN: "OPEN",
  一般: "OPEN",
  GK: "GK",
  女子: "女子",
};

// 都道府県プルダウンの表示順（標準的な関東順：東京→神奈川→埼玉→千葉→茨城→栃木→群馬→山梨）
// この配列に無い値は末尾に回す
const KANTO_PREFECTURE_ORDER: string[] = [
  "東京都",
  "神奈川県",
  "埼玉県",
  "千葉県",
  "茨城県",
  "栃木県",
  "群馬県",
  "山梨県",
];

function prefectureSortIndex(p: string): number {
  const idx = KANTO_PREFECTURE_ORDER.indexOf(p);
  return idx === -1 ? KANTO_PREFECTURE_ORDER.length : idx;
}

function normalizeSelectionCategory(v: string | null | undefined): string {
  if (!v) return "";
  const key = String(v).trim().toUpperCase();
  return SELECTION_CATEGORY_ALIAS_MAP[key] ?? key;
}

function selectionCategoryLabel(v: string | null | undefined): string {
  if (!v) return "";
  const resolved = normalizeSelectionCategory(v);
  const hit = SELECTION_CATEGORY_OPTIONS.find((o) => o.value === resolved);
  return hit?.label ?? v;
}

type RankFilter =
  | "all"
  | "j_academy"
  | "pref_top"
  | "pref_2"
  | "pref_3"
  | "pref_4"
  | "district"
  | "school"
  | "girls";

type StatusFilter =
  | "all"
  | "募集中"
  | "申込終了"
  | "開催終了"
  | "日程未定"
  | "日付未取得";

// セレクション一覧の並び替え順
type SortOrder = "newest" | "date_asc" | "date_desc";

function validSortOrder(value: string | null): SortOrder {
  const values: SortOrder[] = ["newest", "date_asc", "date_desc"];
  return values.includes(value as SortOrder) ? (value as SortOrder) : "newest";
}

const SOURCE_PREFECTURE_MAP: Record<string, string> = {
  鹿島アントラーズ: "茨城県",
  水戸ホーリーホック: "茨城県",
  浦和レッズ: "埼玉県",
  RB大宮アルディージャ: "埼玉県",
  "ジェフユナイテッド市原・千葉": "千葉県",
  柏レイソル: "千葉県",
  FC東京: "東京都",
  東京ヴェルディ: "東京都",
  FC町田ゼルビア: "東京都",
  川崎フロンターレ: "神奈川県",
  "横浜F・マリノス": "神奈川県",
  横浜FC: "神奈川県",
  湘南ベルマーレ: "神奈川県",
  栃木SC: "栃木県",
  ザスパ群馬: "群馬県",
  ヴァンフォーレ甲府: "山梨県",
};

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function sevenDaysAgoTime() {
  return Date.now() - 1000 * 60 * 60 * 24 * 7;
}

function formatDate(date?: string | null) {
  if (!date) return "未定";
  return new Date(date).toLocaleDateString("ja-JP");
}

const SELECTION_SCROLL_KEY = "selection-list-scroll-y";

// [2026-07-31 修正] NEWバッジの基準を content_updated_at(本当に内容が
// 変わった時だけ動くタイムスタンプ) に統一。
// 一度 fetched_at(クロール実行時刻)を基準にしたところ、10分おきの巡回
// だけで(内容が変わらなくても)ほぼ全件がNEW扱いされてしまう不具合が
// 発生した。content_updated_at はクローラー側で「実際に日程・締切・
// 会場・状態・タイトルのいずれかが変化した場合だけ」更新されるため、
// 「情報が更新されたらNEWにしたい」という意図を正しく満たせる。
function isNewArrival(item: SelectionEvent) {
  const t = new Date(
    (item as any).content_updated_at || item.created_at || item.fetched_at || 0
  ).getTime();
  return Number.isFinite(t) && t >= sevenDaysAgoTime();
}

// 同じチーム・同じsource_urlの記事から、時期の異なる複数の告知がまとめて
// グルーピングされると、表示用の日付が単純に「全日程の中で一番古い日付」に
// なってしまい、実際は今後の日程があるにも関わらずカード上は過去日付に
// 見えてしまう問題があった。
// → 今日以降の日程があればその中で一番近いものを優先して表示し、
//   全部過去の場合だけ一番古い日付にフォールバックする。
function earliestDisplayDate(dates: string[]): string | null {
  if (dates.length === 0) return null;
  const today = todayYmd();
  const upcoming = dates.filter((d) => d >= today).sort();
  if (upcoming.length > 0) return upcoming[0];
  return [...dates].sort()[0];
}

// ソート用: 未来日程があればその中で一番近い日付、無ければ一番古い日付、
// 日程が全く無ければ最後尾に回るよう非常に大きい値を返す。
function earliestUpcomingOrFirst(dates: string[]): string {
  if (dates.length === 0) return "9999-99-99";
  const today = todayYmd();
  const upcoming = dates.filter((d) => d >= today).sort();
  return upcoming.length > 0 ? upcoming[0] : [...dates].sort()[0];
}

// 「入団年度」が既に終わっているサイクルかどうかを判定する。
// 4月入団の選考は、実施年の前年(例: 2027年度入団なら2026年)に行われるのが通例。
// 現在の月が4月以降なら「今年+1年度」以降を、3月以前なら「今年度」以降を
// 有効な(まだ終わっていない)入団年度とみなす。
function currentValidAdmissionYearCutoff(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 4 ? year + 1 : year;
}

function isStaleAdmissionYear(admissionFiscalYear: number | null): boolean {
  if (admissionFiscalYear == null) return false;
  return admissionFiscalYear < currentValidAdmissionYearCutoff();
}

function inferredPrefecture(item: SelectionEvent) {
  if (item.prefecture) return item.prefecture;

  const name = item.organization_name || "";
  const matched = Object.keys(SOURCE_PREFECTURE_MAP).find((key) =>
    name.includes(key)
  );

  return matched ? SOURCE_PREFECTURE_MAP[matched] : null;
}

function rankLabel(rank?: string | null, prefecture?: string | null) {
  if (rank === "j_academy") return "J下部";

  if (prefecture === "東京都") {
    if (rank === "pref_top") return "T1";
    if (rank === "pref_2") return "T2";
    if (rank === "pref_3") return "T3";
    if (rank === "pref_4") return "T4";
  }

  if (rank === "pref_top") return "1部";
  if (rank === "pref_2") return "2部";
  if (rank === "pref_3") return "3部";
  if (rank === "pref_4") return "4部";
  if (rank === "district") return "地区リーグ";
  if (rank === "school") return "スクール";
  if (rank === "girls") return "女子";

  return "未設定";
}

function rankSelectLabel(rank: RankFilter) {
  if (rank === "all") return "ランクすべて";
  if (rank === "j_academy") return "J下部";
  if (rank === "pref_top") return "T1 / 1部";
  if (rank === "pref_2") return "T2 / 2部";
  if (rank === "pref_3") return "T3 / 3部";
  if (rank === "pref_4") return "T4 / 4部";
  if (rank === "district") return "地区リーグ";
  if (rank === "school") return "スクール";
  if (rank === "girls") return "女子";
  return "ランク未設定";
}

function statusStyle(status?: string): CSSProperties {
  if (status === "募集中") {
    return {
      background: "#ecfdf3",
      color: "#166534",
      border: "1px solid #bbf7d0",
    };
  }

  if (status === "申込終了" || status === "開催終了") {
    return {
      background: "#f3f4f6",
      color: "#374151",
      border: "1px solid #d1d5db",
    };
  }

  return {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
  };
}

// [2026-07-31 修正] 「新着順」の基準を content_updated_at 優先に統一。
// NEWバッジ(isNewArrival)と同じ基準列を使うことで、「新着順」で上位に
// 並ぶカードには必ずNEWバッジが付く(逆もまた然り)という一貫性を保つ。
function sortNewestFirst<T extends SelectionEvent>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const aa = new Date(
      (a as any).content_updated_at || a.created_at || a.fetched_at || 0
    ).getTime();
    const bb = new Date(
      (b as any).content_updated_at || b.created_at || b.fetched_at || 0
    ).getTime();
    return bb - aa;
  });
}

// 選択中の並び替え順に応じてソートする。
function sortByOrder<T extends GroupedSelectionEvent>(
  rows: T[],
  order: SortOrder
): T[] {
  if (order === "date_asc") {
    return [...rows].sort((a, b) =>
      earliestUpcomingOrFirst(a.allEventDates).localeCompare(
        earliestUpcomingOrFirst(b.allEventDates)
      )
    );
  }
  if (order === "date_desc") {
    return [...rows].sort((a, b) =>
      earliestUpcomingOrFirst(b.allEventDates).localeCompare(
        earliestUpcomingOrFirst(a.allEventDates)
      )
    );
  }
  return sortNewestFirst(rows);
}

function validRank(value: string | null): RankFilter {
  const values: RankFilter[] = [
    "all",
    "j_academy",
    "pref_top",
    "pref_2",
    "pref_3",
    "pref_4",
    "district",
    "school",
    "girls",
  ];
  return values.includes(value as RankFilter) ? (value as RankFilter) : "all";
}

function validStatus(value: string | null): StatusFilter {
  const values: StatusFilter[] = [
    "all",
    "募集中",
    "申込終了",
    "開催終了",
    "日程未定",
    "日付未取得",
  ];
  return values.includes(value as StatusFilter)
    ? (value as StatusFilter)
    : "all";
}

export default function SelectionListPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(() => getCachedSelectionEvents() === null);
  const [items, setItems] = useState<SelectionEvent[]>(
    () => getCachedSelectionEvents() ?? []
  );

  const [keyword, setKeyword] = useState(() => searchParams.get("q") || "");
  const [prefectures, setPrefectures] = useState<string[]>(() => {
    const v = searchParams.get("pref");
    return v ? v.split(",").filter(Boolean) : [];
  });
  const [city, setCity] = useState(() => searchParams.get("city") || "all");
  const [ranks, setRanks] = useState<RankFilter[]>(() => {
    const v = searchParams.get("rank");
    return v
      ? (v.split(",").filter(Boolean) as RankFilter[]).filter((r) =>
          validRank(r) === r
        )
      : [];
  });
  const [status, setStatus] = useState<StatusFilter>(() =>
    validStatus(searchParams.get("status"))
  );
  const [categories, setCategories] = useState<string[]>(() => {
    const v = searchParams.get("category");
    return v ? v.split(",").filter(Boolean) : [];
  });
  const [includePast, setIncludePast] = useState(
    () => searchParams.get("past") === "1"
  );

  // 🔔 あなた宛の新着だけ表示するトグル。
  // URLパラメータに同期させることで、詳細ページから「戻る」で戻ってきた際にも、
  // このトグルの状態(ON/OFF)が保持されるようにした。
  const [showOnlyNotified, setShowOnlyNotified] = useState(
    () => searchParams.get("notified") === "1"
  );

  // 並び替え順。URLパラメータ(sort)に同期させる。
  const [sortOrder, setSortOrder] = useState<SortOrder>(() =>
    validSortOrder(searchParams.get("sort"))
  );

  const resultsSectionRef = useRef<HTMLDivElement | null>(null);

  const [showCalendar, setShowCalendar] = useState(
    () => searchParams.get("calendar") !== "0"
  );
  const [monthDate, setMonthDate] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(
    () => searchParams.get("date") || ""
  );

  // セレクション新着通知(この条件で通知を受け取る)関連の状態
  const [notifySaving, setNotifySaving] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [savedNotifyCondition, setSavedNotifyCondition] = useState<{
    prefectures: string[] | null;
    categories: string[] | null;
    ranks: string[] | null;
    enabled: boolean;
  } | null>(null);
  const [notifyConditionLoading, setNotifyConditionLoading] = useState(true);

  // 自分宛ての未読セレクション新着通知が指しているレコードID一覧
  const [myUnreadNotifiedIds, setMyUnreadNotifiedIds] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    const params = new URLSearchParams();

    if (keyword.trim()) params.set("q", keyword.trim());
    if (prefectures.length > 0) params.set("pref", prefectures.join(","));
    if (city !== "all") params.set("city", city);
    if (ranks.length > 0) params.set("rank", ranks.join(","));
    if (status !== "all") params.set("status", status);
    if (categories.length > 0) params.set("category", categories.join(","));
    if (selectedDate) params.set("date", selectedDate);
    if (!showCalendar) params.set("calendar", "0");
    if (includePast) params.set("past", "1");
    if (showOnlyNotified) params.set("notified", "1");
    if (sortOrder !== "newest") params.set("sort", sortOrder);

    const nextUrl = params.toString()
      ? `${pathname}?${params.toString()}`
      : pathname;

    router.replace(nextUrl, { scroll: false });
  }, [
    keyword,
    prefectures,
    city,
    ranks,
    status,
    categories,
    selectedDate,
    showCalendar,
    includePast,
    showOnlyNotified,
    sortOrder,
    pathname,
    router,
  ]);

  useLayoutEffect(() => {
    // ブラウザ標準のスクロール復元(戻る操作時に自動でトップへ戻ろうとする動き)を止め、
    // このページ側のスクロール制御だけに一本化する
    try {
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "manual";
      }
    } catch {
      // 何もしない
    }

    try {
      const saved = sessionStorage.getItem(SELECTION_SCROLL_KEY);
      if (saved == null) return;

      if (getCachedSelectionEvents() !== null) {
        window.scrollTo(0, Number(saved));
      }
    } catch {
      // sessionStorageが使えない環境では何もしない
    }
  }, []);

  useEffect(() => {
    let active = true;

    function restoreScrollIfNeeded() {
      try {
        const saved = sessionStorage.getItem(SELECTION_SCROLL_KEY);
        if (saved == null) return;

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo(0, Number(saved));
            sessionStorage.removeItem(SELECTION_SCROLL_KEY);
          });
        });
      } catch {
        // sessionStorageが使えない環境では何もしない
      }
    }

    async function load() {
      const hadCache = getCachedSelectionEvents() !== null;

      // キャッシュがある場合は、ネットワーク再取得(fetchSelectionEvents)の
      // 完了を待たずに、その場で即座にスクロール位置を復元する。
      if (hadCache) {
        restoreScrollIfNeeded();
      } else {
        setLoading(true);
      }

      try {
        const rows = await fetchSelectionEvents();

        if (!active) return;

        setItems(sortNewestFirst(rows));
      } catch (e) {
        console.error("selection page load error", e);
        if (!active) return;
        if (!hadCache) {
          setItems([]);
        }
      } finally {
        if (active) {
          setLoading(false);
          // キャッシュが無かった場合(初回アクセス時)は、データが揃って
          // 画面が描画されてからここで復元する
          if (!hadCache) {
            restoreScrollIfNeeded();
          }
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const currentQuery = useMemo(() => {
    const params = new URLSearchParams();

    if (keyword.trim()) params.set("q", keyword.trim());
    if (prefectures.length > 0) params.set("pref", prefectures.join(","));
    if (city !== "all") params.set("city", city);
    if (ranks.length > 0) params.set("rank", ranks.join(","));
    if (status !== "all") params.set("status", status);
    if (categories.length > 0) params.set("category", categories.join(","));
    if (selectedDate) params.set("date", selectedDate);
    if (!showCalendar) params.set("calendar", "0");
    if (includePast) params.set("past", "1");
    if (showOnlyNotified) params.set("notified", "1");
    if (sortOrder !== "newest") params.set("sort", sortOrder);

    return params.toString();
  }, [
    keyword,
    prefectures,
    city,
    ranks,
    status,
    categories,
    selectedDate,
    showCalendar,
    includePast,
    showOnlyNotified,
    sortOrder,
  ]);

  const calendarCells = useMemo(() => buildCalendarCells(monthDate), [monthDate]);
  const monthKey = useMemo(() => toMonthKey(monthDate), [monthDate]);

  // グルーピング（同じ団体・同じ記事由来の複数日付行を1件にまとめる）
  const groupedItems = useMemo(() => groupSelectionEvents(items), [items]);

  const newArrivalCount = useMemo(() => {
    return groupedItems.filter(isNewArrival).length;
  }, [groupedItems]);

  // ホーム画面(HomeCalendar.tsx)の集計基準(未来日程を持つグループのみをカウント)と揃える。
  const totalHandledCount = useMemo(() => {
    return groupedItems.filter((g) => hasUpcomingDate(g.allEventDates)).length;
  }, [groupedItems]);

  // 入団年度ごとの内訳（データが揃うにつれて自動的に育っていく）
  // 既に募集サイクルが終わっているはずの過去の入団年度は内訳の集計から除外する。
  const admissionYearBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of groupedItems) {
      if (!g.isRollingRecruitment && isStaleAdmissionYear(g.admissionFiscalYear)) {
        continue;
      }

      let key: string;
      if (g.isRollingRecruitment) {
        key = "随時募集";
      } else if (g.admissionFiscalYear) {
        key = `${g.admissionFiscalYear}年度入団`;
      } else {
        key = "未分類";
      }
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => {
      // 「未分類」は最後に、それ以外は件数の多い順
      if (a[0] === "未分類") return 1;
      if (b[0] === "未分類") return -1;
      return b[1] - a[1];
    });
  }, [groupedItems]);

  // 都道府県プルダウンの選択肢（標準的な関東順で表示。この並びに無い値は末尾へ）
  const availablePrefectures = useMemo(() => {
    return Array.from(
      new Set(groupedItems.map((v) => inferredPrefecture(v)).filter(Boolean).map(String))
    ).sort((a, b) => prefectureSortIndex(a) - prefectureSortIndex(b));
  }, [groupedItems]);

  const cities = useMemo(() => {
    return Array.from(
      new Set(
        groupedItems
          .filter((v) => {
            const itemPrefecture = inferredPrefecture(v);
            return (
              prefectures.length === 0 ||
              (itemPrefecture && prefectures.includes(itemPrefecture))
            );
          })
          .map((v) => v.city)
          .filter(Boolean)
          .map(String)
      )
    ).sort((a, b) => a.localeCompare(b, "ja"));
  }, [groupedItems, prefectures]);

  const filteredItems = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    const rows = groupedItems.filter((item) => {
      // 🔔 あなた宛の新着だけ表示がONなら、他の条件より先にここで絞り込む
      if (showOnlyNotified && !myUnreadNotifiedIds.has(item.id)) {
        return false;
      }

      // 過去の入団年度サイクル(既に選考が終わっているはず)は、
      // 「過去の開催も含めて表示」がONの時だけ一覧にも表示する。
      if (
        !includePast &&
        !item.isRollingRecruitment &&
        isStaleAdmissionYear(item.admissionFiscalYear)
      ) {
        return false;
      }

      const itemPrefecture = inferredPrefecture(item);
      const itemRank =
        (item as SelectionEvent & { source_rank?: string }).source_rank || null;

      // 過去も含めて表示、がOFFなら未来日程を含まないグループは除外
      if (!includePast && !hasUpcomingDate(item.allEventDates)) {
        return false;
      }

      if (selectedDate) {
        if (!item.allEventDates.includes(selectedDate)) {
          return false;
        }
      }

      if (
        prefectures.length > 0 &&
        !(itemPrefecture && prefectures.includes(itemPrefecture))
      ) {
        return false;
      }
      if (city !== "all" && item.city !== city) return false;
      if (ranks.length > 0 && !(itemRank && ranks.includes(itemRank as RankFilter))) {
        return false;
      }
      if (status !== "all" && item.display_status !== status) return false;

      if (categories.length > 0) {
        const normalizedItemCats = (item.target_categories ?? []).map(
          normalizeSelectionCategory
        );
        const normalizedSelectedCats = categories.map(normalizeSelectionCategory);
        const matches = normalizedItemCats.some((c) =>
          normalizedSelectedCats.includes(c)
        );
        if (!matches) {
          return false;
        }
      }

      if (q) {
        const hay = [
          item.title,
          item.organization_name,
          itemRank,
          rankLabel(itemRank, itemPrefecture || undefined),
          itemPrefecture,
          item.city,
          item.area,
          item.venue_name,
          item.venue_address,
          ...(item.target_categories ?? []),
        ]
          .join(" ")
          .toLowerCase();

        if (!hay.includes(q)) return false;
      }

      return true;
    });

    return sortByOrder(rows, sortOrder);
  }, [
    groupedItems,
    keyword,
    prefectures,
    city,
    ranks,
    status,
    categories,
    selectedDate,
    includePast,
    showOnlyNotified,
    myUnreadNotifiedIds,
    sortOrder,
  ]);

  const selectionItemsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    const countMap = new Map<string, number>();

    for (const item of filteredItems) {
      for (const d of item.allEventDates) {
        const ymd = ymdOnly(d);
        if (!ymd) continue;
        countMap.set(ymd, (countMap.get(ymd) ?? 0) + 1);
      }
    }

    for (const [ymd, count] of countMap.entries()) {
      map.set(ymd, [
        {
          label: "選",
          count,
          tone: "open",
        },
      ]);
    }

    return map;
  }, [filteredItems]);

  const selectedDateText = useMemo(() => {
    if (!selectedDate) return "すべての日程";
    return `${formatDate(selectedDate)} 開催分`;
  }, [selectedDate]);

  useEffect(() => {
    let active = true;

    async function loadSavedNotifyCondition() {
      setNotifyConditionLoading(true);

      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        if (!user) {
          if (active) {
            setSavedNotifyCondition(null);
            setNotifyConditionLoading(false);
          }
          return;
        }

        const { data, error } = await supabase
          .from("selection_alert_subscriptions")
          .select("prefectures, categories, ranks, enabled")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!active) return;

        if (error) {
          console.error("loadSavedNotifyCondition error:", error);
          setSavedNotifyCondition(null);
          return;
        }

        if (data) {
          setSavedNotifyCondition({
            prefectures: Array.isArray(data.prefectures) ? data.prefectures : null,
            categories: Array.isArray(data.categories) ? data.categories : null,
            ranks: Array.isArray((data as any).ranks) ? (data as any).ranks : null,
            enabled: data.enabled ?? true,
          });
        } else {
          setSavedNotifyCondition(null);
        }
      } catch (e) {
        console.error("loadSavedNotifyCondition catch:", e);
        if (active) setSavedNotifyCondition(null);
      } finally {
        if (active) setNotifyConditionLoading(false);
      }
    }

    void loadSavedNotifyCondition();

    return () => {
      active = false;
    };
  }, []);

  // 自分宛ての未読セレクション新着通知(type=selection_event)が指すレコードIDを取得する。
  // 通知が指すイベントの日程が全て過去になっている場合、そのイベントは
  // 「あなた宛の新着」からは除外する(バッジ・件数・ハイライト表示に出さない)。
  useEffect(() => {
    let active = true;

    async function loadMyUnreadNotifiedIds() {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;

        if (!user) {
          if (active) setMyUnreadNotifiedIds(new Set());
          return;
        }

        const { data, error } = await supabase
          .from("notifications")
          .select("target_url")
          .eq("user_id", user.id)
          .eq("type", "selection_event")
          .eq("is_read", false);

        if (!active) return;

        if (error) {
          console.error("loadMyUnreadNotifiedIds error:", error);
          setMyUnreadNotifiedIds(new Set());
          return;
        }

        const ids = new Set<string>();
        for (const row of data ?? []) {
          const url = String((row as any).target_url ?? "");
          const m = url.match(/\/selection\/([^/?]+)/);
          if (m?.[1]) ids.add(m[1]);
        }

        if (items.length === 0) {
          setMyUnreadNotifiedIds(ids);
          return;
        }

        const today = todayYmd();
        const stillRelevantIds = new Set<string>();
        for (const id of ids) {
          const relatedItems = items.filter((it) => it.id === id);

          if (relatedItems.length === 0) {
            stillRelevantIds.add(id);
            continue;
          }

          const anyUpcoming = relatedItems.some(
            (it) => it.event_date && it.event_date >= today
          );
          const anyUndated = relatedItems.some((it) => !it.event_date);

          if (anyUpcoming || anyUndated) {
            stillRelevantIds.add(id);
          }
        }

        setMyUnreadNotifiedIds(stillRelevantIds);
      } catch (e) {
        console.error("loadMyUnreadNotifiedIds catch:", e);
        if (active) setMyUnreadNotifiedIds(new Set());
      }
    }

    void loadMyUnreadNotifiedIds();

    function handleUpdated() {
      void loadMyUnreadNotifiedIds();
    }
    window.addEventListener("badge-updated", handleUpdated);
    window.addEventListener("notifications-updated", handleUpdated);

    return () => {
      active = false;
      window.removeEventListener("badge-updated", handleUpdated);
      window.removeEventListener("notifications-updated", handleUpdated);
    };
  }, [items]);

  const savedNotifyConditionText = useMemo(() => {
    if (!savedNotifyCondition) return null;
    if (!savedNotifyCondition.enabled) return "通知オフ";

    const prefText =
      !savedNotifyCondition.prefectures || savedNotifyCondition.prefectures.length === 0
        ? "全都道府県"
        : savedNotifyCondition.prefectures.join("・");

    const catText =
      !savedNotifyCondition.categories || savedNotifyCondition.categories.length === 0
        ? "全カテゴリ"
        : savedNotifyCondition.categories
            .map((c) => selectionCategoryLabel(c) || c)
            .join("・");

    const rankText =
      !savedNotifyCondition.ranks || savedNotifyCondition.ranks.length === 0
        ? "全ランク"
        : savedNotifyCondition.ranks.map((r) => rankSelectLabel(r as RankFilter)).join("・");

    return `${prefText} / ${catText} / ${rankText}`;
  }, [savedNotifyCondition]);

  // 「現在の通知条件」を検索フィルターに反映する。
  // 検索フィルターも複数選択に対応したので、登録されている条件をそのまま全部反映できる。
  function applySavedNotifyConditionToFilters() {
    if (!savedNotifyCondition || !savedNotifyCondition.enabled) return;

    setPrefectures(savedNotifyCondition.prefectures ?? []);
    setCity("all");
    setCategories(
      (savedNotifyCondition.categories ?? []).map(normalizeSelectionCategory)
    );
    setRanks((savedNotifyCondition.ranks ?? []) as RankFilter[]);
  }

  const clearFilters = () => {

    setKeyword("");
    setPrefectures([]);
    setCity("all");
    setRanks([]);
    setStatus("all");
    setCategories([]);
    setSelectedDate("");
    setShowCalendar(true);
    setIncludePast(false);
    setSortOrder("newest");
  };

  // カードを開いた時、それが自分宛の未読通知に該当するものであれば既読にする
  async function markNotificationReadForItem(itemId: string) {
    if (!myUnreadNotifiedIds.has(itemId)) return;

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("type", "selection_event")
        .eq("is_read", false)
        .ilike("target_url", `%/selection/${itemId}%`);

      // このページ内の状態もすぐ更新する
      setMyUnreadNotifiedIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });

      // タブのバッジ等、他のコンポーネントにも既読化を伝える
      window.dispatchEvent(new Event("badge-updated"));
      window.dispatchEvent(new Event("notifications-updated"));
    } catch (e) {
      console.error("markNotificationReadForItem error:", e);
    }
  }

  // 「あなた宛の新着」を一括で既読にする。
  async function markAllNotifiedRead() {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("type", "selection_event")
        .eq("is_read", false);

      if (error) {
        console.error("markAllNotifiedRead error:", error);
        return;
      }

      setMyUnreadNotifiedIds(new Set());
      setShowOnlyNotified(false);

      window.dispatchEvent(new Event("badge-updated"));
      window.dispatchEvent(new Event("notifications-updated"));
    } catch (e) {
      console.error("markAllNotifiedRead catch:", e);
    }
  }

  // 今選んでいる都道府県・カテゴリの条件をそのまま通知設定として保存する
  // (市区町村・ランク・状態は通知条件には含めない: 詳細はmypage側の設定で調整可能)
  async function saveNotifyCondition() {
    if (notifySaving) return;

    setNotifySaving(true);
    setNotifyMessage("");

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        setNotifyMessage("通知設定にはログインが必要です");
        return;
      }

      const { error } = await supabase
        .from("selection_alert_subscriptions")
        .upsert(
          {
            user_id: user.id,
            prefectures: prefectures.length > 0 ? prefectures : null,
            categories: categories.length > 0 ? categories : null,
            ranks: ranks.length > 0 ? ranks : null,
            enabled: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (error) {
        console.error("saveNotifyCondition error:", error);
        setNotifyMessage(`保存に失敗しました: ${error.message}`);
        return;
      }

      const prefText = prefectures.length > 0 ? prefectures.join("・") : "全都道府県";
      const catText =
        categories.length > 0
          ? categories.map((c) => selectionCategoryLabel(c) || c).join("・")
          : "全カテゴリ";
      const rankText =
        ranks.length > 0 ? ranks.map((r) => rankSelectLabel(r)).join("・") : "全ランク";

      setNotifyMessage(
        `✅ 「${prefText} / ${catText} / ${rankText}」で通知を保存しました`
      );

      // このページ内の「現在の通知条件」表示もすぐに更新する
      setSavedNotifyCondition({
        prefectures: prefectures.length > 0 ? prefectures : null,
        categories: categories.length > 0 ? categories : null,
        ranks: ranks.length > 0 ? ranks : null,
        enabled: true,
      });
    } catch (e) {
      console.error("saveNotifyCondition error:", e);
      setNotifyMessage("保存に失敗しました");
    } finally {
      setNotifySaving(false);
    }
  }

  return (
    <main style={wrap}>
      <AppTabNav />

      <div style={topBar}>
        <div style={pageTitle}>セレクション情報</div>
      </div>

      <section className="ui-card" style={statsBox}>
        <div style={statsRow}>
          <div style={statItem}>
            <div style={statNumber}>{totalHandledCount}</div>
            <div style={statLabel}>掲載件数</div>
          </div>
          <div style={statDivider} />
          <div style={statItem}>
            <div style={statNumber}>{newArrivalCount}</div>
            <div style={statLabel}>過去7日間の新着</div>
          </div>
        </div>

        {admissionYearBreakdown.some(([label]) => label !== "未分類") ? (
          <div style={breakdownRow}>
            {admissionYearBreakdown
              .filter(([label]) => label !== "未分類")
              .map(([label, count]) => (
                <span key={label} style={breakdownChip}>
                  {label} {count}件
                </span>
              ))}
          </div>
        ) : null}
      </section>

      {myUnreadNotifiedIds.size > 0 ? (
        <div style={notifiedBannerRow}>
          <button
            type="button"
            onClick={() => {
              setShowOnlyNotified((v) => {
                const next = !v;
                if (next) {
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      resultsSectionRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    });
                  });
                }
                return next;
              });
            }}
            style={{
              ...notifiedBanner,
              ...(showOnlyNotified ? notifiedBannerActive : {}),
            }}
          >
            🔔{" "}
            {showOnlyNotified
              ? "すべて表示に戻す"
              : `あなた宛の新着(${myUnreadNotifiedIds.size}件)だけ見る`}
          </button>

          <button
            type="button"
            className="sh-btn"
            onClick={markAllNotifiedRead}
            style={markAllNotifiedButton}
          >
            すべて既読
          </button>
        </div>
      ) : null}

      <section className="ui-card" style={searchBox}>
        <div style={searchHeader}>
          <div className="ui-title" style={searchTitle}>
            条件検索
          </div>

          <button
            type="button"
            className="sh-btn"
            onClick={() => setShowCalendar((v) => !v)}
          >
            {showCalendar ? "カレンダーを閉じる" : "カレンダー表示"}
          </button>
        </div>

        {/* 「現在の通知条件」を上、通知登録ボタンをその下に配置 */}
        {!notifyConditionLoading ? (
          <button
            type="button"
            style={currentNotifyConditionBox}
            onClick={applySavedNotifyConditionToFilters}
            disabled={!savedNotifyCondition || !savedNotifyCondition.enabled}
          >
            現在の通知条件:{" "}
            {savedNotifyConditionText ?? "未設定(通知は届きません)"}
            {savedNotifyCondition?.enabled ? (
              <span style={applyHintText}>(タップで検索条件に反映)</span>
            ) : null}
          </button>
        ) : null}

        <div style={notifyRow}>
          <button
            type="button"
            className="sh-btn sh-btn--primary"
            onClick={saveNotifyCondition}
            disabled={notifySaving}
          >
            {notifySaving ? "保存中…" : "🔔 この条件で通知を受け取る"}
          </button>

          {notifyMessage ? (
            <span style={notifyMessageText}>{notifyMessage}</span>
          ) : null}
        </div>

        <div style={notifyHint}>
          ※ 通知の対象になるのは「都道府県・カテゴリ・ランク」です(市区町村・状態は対象外です)
        </div>

        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="チーム名・地域・カテゴリなど"
          style={input}
        />

        <div style={chipFilterGroup}>
          <div style={chipFilterLabel}>都道府県(未選択ですべて)</div>
          <div style={chipFilterRow}>
            {availablePrefectures.map((p) => {
              const active = prefectures.includes(p);
              return (
                <button
                  key={p}
                  type="button"
                  style={{ ...filterChip, ...(active ? filterChipActive : {}) }}
                  onClick={() => {
                    setPrefectures((prev) =>
                      prev.includes(p)
                        ? prev.filter((v) => v !== p)
                        : [...prev, p]
                    );
                    setCity("all");
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        <div style={chipFilterGroup}>
          <div style={chipFilterLabel}>対象カテゴリ(未選択ですべて)</div>
          <div style={chipFilterRow}>
            {SELECTION_CATEGORY_OPTIONS.map((opt) => {
              const active = categories.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  style={{ ...filterChip, ...(active ? filterChipActive : {}) }}
                  onClick={() => {
                    setCategories((prev) =>
                      prev.includes(opt.value)
                        ? prev.filter((v) => v !== opt.value)
                        : [...prev, opt.value]
                    );
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div style={chipFilterGroup}>
          <div style={chipFilterLabel}>ランク(未選択ですべて)</div>
          <div style={chipFilterRow}>
            {(
              [
                "j_academy",
                "pref_top",
                "pref_2",
                "pref_3",
                "pref_4",
                "district",
                "school",
                "girls",
              ] as RankFilter[]
            ).map((r) => {
              const active = ranks.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  style={{ ...filterChip, ...(active ? filterChipActive : {}) }}
                  onClick={() => {
                    setRanks((prev) =>
                      prev.includes(r) ? prev.filter((v) => v !== r) : [...prev, r]
                    );
                  }}
                >
                  {rankSelectLabel(r)}
                </button>
              );
            })}
          </div>
        </div>

        <div style={filterGrid}>
          <select value={city} onChange={(e) => setCity(e.target.value)} style={select}>
            <option value="all">市区町村すべて</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            style={select}
          >
            <option value="all">状態すべて</option>
            <option value="募集中">募集中</option>
            <option value="申込終了">申込終了</option>
            <option value="開催終了">開催終了</option>
            <option value="日程未定">日程未定</option>
            <option value="日付未取得">日付未取得</option>
          </select>
        </div>

        <label style={pastToggleRow}>
          <input
            type="checkbox"
            checked={includePast}
            onChange={(e) => setIncludePast(e.target.checked)}
          />
          <span>過去の開催も含めて表示</span>
        </label>

        <div style={filterFooter}>
          <div className="ui-meta">
            {selectedDateText} / 表示件数：{filteredItems.length}件 / 取得件数：
            {groupedItems.length}件 / 過去7日間の新着：{newArrivalCount}件
          </div>

          <button type="button" className="sh-btn" onClick={clearFilters}>
            条件クリア
          </button>
        </div>
      </section>

      {showCalendar ? (
        <section className="ui-card" style={calendarBox}>
          <div style={calendarTitle}>開催日カレンダー</div>

          <div style={calendarHint} className="ui-meta">
            日付を押すと、その日に開催されるセレクションだけを表示します。
          </div>

          <div style={calendarInner}>
            <MatchCalendarBase
              monthKey={monthKey}
              cells={calendarCells}
              selectedYmd={selectedDate}
              itemsByDate={selectionItemsByDate}
              onSelectDate={(ymd) => {
                setSelectedDate((current) => (current === ymd ? "" : ymd));
              }}
              onPrevMonth={() => setMonthDate((prev) => addMonths(prev, -1))}
              onNextMonth={() => setMonthDate((prev) => addMonths(prev, 1))}
            />
          </div>
        </section>
      ) : null}

      {loading ? (
        <div className="ui-card" style={emptyBox}>
          読み込み中…
        </div>
      ) : (
        <>
          {filteredItems.length > 0 ? (
            <section style={listWrap} ref={resultsSectionRef}>
              <div style={sectionTitleRow}>
                <div className="ui-title" style={sectionTitle}>
                  セレクション情報
                </div>

                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                  style={sortSelect}
                >
                  <option value="newest">新着順</option>
                  <option value="date_asc">開催日が近い順</option>
                  <option value="date_desc">開催日が遠い順</option>
                </select>
              </div>

              {filteredItems.map((item) => {
                const itemPrefecture = inferredPrefecture(item);
                const itemRank =
                  (item as SelectionEvent & { source_rank?: string }).source_rank ||
                  null;

                const detailHref = currentQuery
                  ? `/selection/${item.id}?${currentQuery}`
                  : `/selection/${item.id}`;

                const isPastOnly = !hasUpcomingDate(item.allEventDates);
                const isNew = isNewArrival(item);
                const isNotifiedToMe = myUnreadNotifiedIds.has(item.id);

                return (
                  <Link
                    key={item.id}
                    href={detailHref}
                    style={linkStyle}
                    onClick={() => {
                      markNotificationReadForItem(item.id);
                      try {
                        sessionStorage.setItem(
                          SELECTION_SCROLL_KEY,
                          String(window.scrollY)
                        );
                      } catch {
                        // 何もしない
                      }
                    }}
                  >
                    <article
                      className="ui-card"
                      style={{
                        ...card,
                        ...(isPastOnly ? cardPast : {}),
                        ...(isNotifiedToMe ? cardNotified : {}),
                      }}
                    >
                      <div style={cardTop}>
                        <div style={cardTopLeft}>
                          {isNotifiedToMe ? (
                            <span style={notifiedBadge}>🔔 あなた宛の新着</span>
                          ) : isNew ? (
                            <span style={newBadge}>NEW</span>
                          ) : null}
                          <span style={rankBadge}>
                            {rankLabel(itemRank, itemPrefecture || undefined)}
                          </span>
                        </div>

                        <span
                          style={{
                            ...statusBadge,
                            ...statusStyle(item.display_status),
                          }}
                        >
                          {isPastOnly ? "終了" : item.display_status || "日程未定"}
                        </span>
                      </div>

                      <h2 style={cardTitle}>{item.title}</h2>

                      <div className="ui-meta" style={orgName}>
                        {item.organization_name || "団体名未設定"}
                      </div>

                      {item.target_categories?.length > 0 ? (
                        <div style={tagWrap}>
                          {item.target_categories.map((cat) => (
                            <span key={selectionCategoryLabel(cat) || cat} style={tag}>
                              {selectionCategoryLabel(cat) || cat}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div style={infoGrid}>
                        <div>
                          <div style={label}>開催日</div>
                          <div style={value}>
                            {(() => {
                              const displayDate = earliestDisplayDate(
                                item.allEventDates
                              );
                              if (!displayDate) return "未定";
                              return (
                                <>
                                  {formatDate(displayDate)}
                                  {item.allEventDates.length > 1 && (
                                    <span
                                      style={{
                                        fontSize: "0.8em",
                                        color: "#666",
                                        marginLeft: 4,
                                      }}
                                    >
                                      他{item.allEventDates.length - 1}日程
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>

                        <div>
                          <div style={label}>地域</div>
                          <div style={value}>
                            {[itemPrefecture, item.city].filter(Boolean).join(" ") ||
                              "未定"}
                          </div>
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </section>
          ) : (
            <div className="ui-card" style={emptyBox}>
              条件に合うセレクション情報がありません
            </div>
          )}
        </>
      )}
    </main>
  );
}

const wrap: CSSProperties = {
  padding: 16,
  width: "100%",
  maxWidth: 900,
  margin: "0 auto",
  display: "grid",
  gap: 12,
  boxSizing: "border-box",
  overflowX: "hidden",
};

const topBar: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  minWidth: 0,
  maxWidth: "100%",
  flexWrap: "wrap",
};

const pageTitle: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#16391f",
  minWidth: 0,
  overflowWrap: "break-word",
};

const statsBox: CSSProperties = {
  padding: 14,
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  background: "linear-gradient(135deg, #16391f, #2d5a3d)",
};

const statsRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 24,
  flexWrap: "wrap",
};

const statItem: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 2,
};

const statNumber: CSSProperties = {
  fontSize: 32,
  fontWeight: 900,
  color: "#fff",
  lineHeight: 1.1,
};

const statLabel: CSSProperties = {
  fontSize: 12,
  color: "#d1e7d5",
  fontWeight: 700,
};

const statDivider: CSSProperties = {
  width: 1,
  height: 36,
  background: "rgba(255,255,255,0.3)",
};

const breakdownRow: CSSProperties = {
  marginTop: 12,
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: 6,
};

const breakdownChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 10px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.15)",
  color: "#fff",
  fontSize: 11,
  fontWeight: 700,
};

const searchBox: CSSProperties = {
  padding: 14,
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  overflow: "hidden",
};

const searchHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 10,
  minWidth: 0,
};

const searchTitle: CSSProperties = {
  fontSize: 18,
};

const sectionTitle: CSSProperties = {
  fontSize: 18,
  margin: 0,
};

const sectionTitleRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 8,
};

const sortSelect: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#fff",
  fontSize: 13,
  fontWeight: 700,
  color: "#374151",
  flexShrink: 0,
};

const input: CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  fontSize: 16,
  outline: "none",
  background: "#fff",
  marginTop: 12,
};

const filterGrid: CSSProperties = {
  marginTop: 10,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 8,
  minWidth: 0,
};

const chipFilterGroup: CSSProperties = {
  marginTop: 12,
};

const chipFilterLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#4b5563",
  marginBottom: 6,
};

const chipFilterRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const filterChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid #d1d5db",
  background: "#fff",
  color: "#374151",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const filterChipActive: CSSProperties = {
  background: "#dcfce7",
  borderColor: "#bbf7d0",
  color: "#166534",
};

const select: CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  padding: "11px 10px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#fff",
  fontSize: 14,
};

const pastToggleRow: CSSProperties = {
  marginTop: 10,
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14,
  color: "#374151",
};

const notifyRow: CSSProperties = {
  marginTop: 10,
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const notifyMessageText: CSSProperties = {
  fontSize: 13,
  color: "#166534",
  fontWeight: 700,
};

const notifyHint: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#6b7280",
};

const currentNotifyConditionBox: CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "8px 12px",
  borderRadius: 10,
  background: "#f0fdf4",
  border: "1px solid #bbf7d0",
  fontSize: 13,
  color: "#166534",
  fontWeight: 700,
  cursor: "pointer",
  boxSizing: "border-box",
};

const applyHintText: CSSProperties = {
  marginLeft: 6,
  fontSize: 11,
  fontWeight: 700,
  color: "#4d7c0f",
};

const filterFooter: CSSProperties = {
  marginTop: 10,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  minWidth: 0,
};

const calendarBox: CSSProperties = {
  padding: 14,
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  overflow: "hidden",
};

const calendarTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
};

const calendarHint: CSSProperties = {
  marginTop: 4,
  marginBottom: 10,
  maxWidth: "100%",
  overflowWrap: "break-word",
  wordBreak: "break-word",
};

const calendarInner: CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  overflow: "hidden",
};

const listWrap: CSSProperties = {
  display: "grid",
  gap: 10,
  minWidth: 0,
  maxWidth: "100%",
};

const linkStyle: CSSProperties = {
  textDecoration: "none",
  color: "inherit",
  minWidth: 0,
  maxWidth: "100%",
};

const card: CSSProperties = {
  padding: 14,
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  overflow: "hidden",
};

const cardPast: CSSProperties = {
  opacity: 0.6,
};

const cardTop: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  alignItems: "center",
  minWidth: 0,
  flexWrap: "wrap",
};

const cardTopLeft: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
  minWidth: 0,
};

const newBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "0 10px",
  borderRadius: 999,
  background: "#dc2626",
  color: "#fff",
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.5,
};

const notifiedBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "0 10px",
  borderRadius: 999,
  background: "#7c3aed",
  color: "#fff",
  fontSize: 12,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const cardNotified: CSSProperties = {
  border: "2px solid #7c3aed",
  background: "#faf5ff",
};

const notifiedBannerRow: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "stretch",
};

const notifiedBanner: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flex: 1,
  padding: "12px 16px",
  borderRadius: 14,
  border: "2px solid #7c3aed",
  background: "#faf5ff",
  color: "#6d28d9",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
  boxSizing: "border-box",
};

const notifiedBannerActive: CSSProperties = {
  background: "#7c3aed",
  color: "#fff",
};

const markAllNotifiedButton: CSSProperties = {
  flexShrink: 0,
  whiteSpace: "nowrap",
};

const rankBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "0 10px",
  borderRadius: 999,
  background: "#fff7ed",
  color: "#9a3412",
  border: "1px solid #fed7aa",
  fontSize: 12,
  fontWeight: 900,
  maxWidth: "100%",
};

const statusBadge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "0 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
  maxWidth: "100%",
};

const cardTitle: CSSProperties = {
  margin: "10px 0 0",
  fontSize: 18,
  lineHeight: 1.45,
  color: "#111827",
  minWidth: 0,
  maxWidth: "100%",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const orgName: CSSProperties = {
  marginTop: 6,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const infoGrid: CSSProperties = {
  marginTop: 12,
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
  minWidth: 0,
};

const label: CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  marginBottom: 3,
};

const value: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#1f2937",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const tagWrap: CSSProperties = {
  marginTop: 12,
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  minWidth: 0,
  maxWidth: "100%",
};

const tag: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  padding: "0 10px",
  borderRadius: 999,
  background: "#f3f4f6",
  color: "#374151",
  fontSize: 12,
  fontWeight: 700,
  maxWidth: "100%",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const emptyBox: CSSProperties = {
  padding: 22,
  textAlign: "center",
  width: "100%",
  maxWidth: "100%",
  boxSizing: "border-box",
  overflow: "hidden",
};
