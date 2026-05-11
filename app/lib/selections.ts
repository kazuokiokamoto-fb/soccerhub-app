import { supabase } from "@/app/lib/supabase";
import type { SelectionEvent } from "@/app/types/selection";

export async function fetchSelectionEvents(): Promise<SelectionEvent[]> {
  const { data, error } = await supabase
    .from("selection_events_public")
    .select("*")
    .order("event_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchSelectionEvents error:", error);
    return [];
  }

  const rows = ((data ?? []) as SelectionEvent[]).sort((a, b) => {
    const aa = new Date(
      a.fetched_at || a.created_at || 0
    ).getTime();

    const bb = new Date(
      b.fetched_at || b.created_at || 0
    ).getTime();

    return bb - aa;
  });

  return rows;
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