import { supabase } from "@/app/lib/supabase";
import type { SelectionEvent } from "@/app/types/selection";

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchSelectionEvents(): Promise<SelectionEvent[]> {
  const today = todayYmd();

  const { data, error } = await supabase
    .from("selection_events_public")
    .select("*")
    .or(`event_date.gte.${today},event_date.is.null`)
    .order("event_date", { ascending: true, nullsFirst: false })
    .order("fetched_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    console.error("fetchSelectionEvents error:", error);
    return [];
  }

  return (data ?? []) as SelectionEvent[];
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