import { supabase } from "@/app/lib/supabase";
import type { SelectionEvent } from "@/app/types/selection";

export async function fetchSelectionEvents(): Promise<SelectionEvent[]> {
  const { data, error } = await supabase
    .from("selection_events_public")
    .select("*")
    .order("event_date", { ascending: true });

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