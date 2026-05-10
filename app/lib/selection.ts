import { supabase } from "@/app/lib/supabase";
import type { SelectionEvent } from "@/app/types/selection";

export async function fetchSelectionEvents(): Promise<
  SelectionEvent[]
> {
  const { data, error } = await supabase
    .from("selection_events_public")
    .select("*")
    .order("event_date", { ascending: true });

  if (error) {
    console.error(error);
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
    .single();

  if (error) {
    console.error(error);
    return null;
  }

  return data as SelectionEvent;
}