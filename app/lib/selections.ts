import { supabase } from "@/app/lib/supabase";
import type { SelectionEvent } from "@/app/types/selection";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

const PAGE_SIZE = 1000;

export async function fetchSelectionEvents(): Promise<SelectionEvent[]> {
  const today = todayYmd();
  const allRows: SelectionEvent[] = [];

  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from("selection_events_public")
      .select("*")
      .or(`event_date.gte.${today},event_date.is.null`)
      .order("event_date", { ascending: true, nullsFirst: false })
      .order("fetched_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("fetchSelectionEvents error:", error);
      return allRows;
    }

    const rows = (data ?? []) as SelectionEvent[];
    allRows.push(...rows);

    if (rows.length < PAGE_SIZE) break;

    from += PAGE_SIZE;
  }

  return allRows;
}

export async function fetchSelectionEventById(
  id: string
): Promise<SelectionEvent | null> {
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