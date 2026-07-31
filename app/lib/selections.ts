import { supabase } from "@/app/lib/supabase";
import type { SelectionEvent } from "@/app/types/selection";

const PAGE_SIZE = 1000;

let cachedSelectionEvents: SelectionEvent[] | null = null;

export function getCachedSelectionEvents(): SelectionEvent[] | null {
  return cachedSelectionEvents;
}

export function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export function ymdOnly(date?: string | null) {
  if (!date) return "";
  return String(date).slice(0, 10);
}

function baseTitle(title?: string | null): string {
  if (!title) return "";
  return title.replace(/\s*\d{4}-\d{2}-\d{2}\s*$/, "").trim();
}

function groupKeyOf(item: SelectionEvent): string {
  const teamKey = (item as any).team_master_id || item.organization_name || "";
  const urlKey = (item as any).source_url || (item as any).official_url || "";
  return `${teamKey}::${urlKey}`;
}

export type GroupedSelectionEvent = SelectionEvent & {
  allEventDates: string[];
  duplicateCount: number;
  admissionFiscalYear: number | null;
  isRollingRecruitment: boolean;
};

// [2026-07-31 追加] グループの代表行を決めるための並び替え基準。
// content_updated_at(本当に内容が変わった時だけ動くタイムスタンプ)を
// 最優先にし、無ければ fetched_at → created_at の順にフォールバックする。
function representativeSortKey(item: SelectionEvent): number {
  const t = new Date(
    (item as any).content_updated_at || item.fetched_at || item.created_at || 0
  ).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function groupSelectionEvents(
  items: SelectionEvent[]
): GroupedSelectionEvent[] {
  const groups = new Map<string, SelectionEvent[]>();

  for (const item of items) {
    const key = groupKeyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const result: GroupedSelectionEvent[] = [];

  for (const groupRows of groups.values()) {
    const sorted = [...groupRows].sort(
      (a, b) => representativeSortKey(b) - representativeSortKey(a)
    );
    const representative = sorted[0] as any;

    const dateSet = new Set<string>();
    for (const row of groupRows) {
      const rowDates = row.event_dates?.length
        ? row.event_dates
        : row.event_date
        ? [row.event_date]
        : [];
      for (const d of rowDates) {
        const ymd = ymdOnly(d);
        if (ymd) dateSet.add(ymd);
      }
    }
    const allEventDates = Array.from(dateSet).sort();

    const admissionFiscalYear =
      groupRows
        .map((r) => (r as any).admission_fiscal_year)
        .find((v) => v != null) ?? null;
    const isRollingRecruitment = groupRows.some(
      (r) => (r as any).is_rolling_recruitment === true
    );

    result.push({
      ...representative,
      title: baseTitle(representative.title) || representative.title,
      event_dates: allEventDates,
      allEventDates,
      duplicateCount: groupRows.length,
      admissionFiscalYear,
      isRollingRecruitment,
    });
  }

  return result;
}

export function hasUpcomingDate(dates: string[]): boolean {
  if (dates.length === 0) return true;
  const today = todayYmd();
  return dates.some((d) => d >= today);
}

// 一覧表示に本当に必要なカラムだけを明示的に指定する。
// select("*") で raw_text(最大20,000文字)や description(最大800文字)
// といった重量級カラムまで毎回全件取得すると、読み込みが大きく遅くなるため、
// 詳細ページ用の全カラムは fetchSelectionEventById 側でのみ取得する。
const LIST_COLUMNS = [
  "id",
  "team_master_id",
  "organization_name",
  "organization_type",
  "target_categories",
  "gender",
  "prefecture",
  "area",
  "city",
  "venue_name",
  "venue_address",
  "event_date",
  "event_dates",
  "source_url",
  "official_url",
  "title",
  "display_status",
  "source_rank",
  "admission_fiscal_year",
  "is_rolling_recruitment",
  "fetched_at",
  "created_at",
  "content_updated_at", // [2026-07-31 追加] NEW判定・新着順ソートの正式な基準列
].join(",");

export async function fetchSelectionEvents(): Promise<SelectionEvent[]> {
  const today = todayYmd();
  const allRows: SelectionEvent[] = [];

  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("selection_events_public")
      .select(LIST_COLUMNS)
      .or(`event_date.gte.${today},event_date.is.null`)
      .order("event_date", { ascending: true, nullsFirst: false })
      .order("fetched_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("fetchSelectionEvents error:", error);
      return allRows;
    }

    const rows = (data ?? []) as unknown as SelectionEvent[];

    allRows.push(...rows);

    if (rows.length < PAGE_SIZE) break;

    from += PAGE_SIZE;
  }

  cachedSelectionEvents = allRows;
  return allRows;
}

export async function fetchSelectionEventById(
  id: string
): Promise<SelectionEvent | null> {
  // 詳細ページでは summary / description 等も含めて全カラム取得してよい
  // (1件だけなので負荷は軽微)
  const { data, error } = await supabase
    .from("selection_events_public")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("fetchSelectionEventById error:", error);
    return null;
  }

  return data as SelectionEvent | null;
}
