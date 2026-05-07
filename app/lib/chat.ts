import { supabase } from "./supabase";

export async function getOrCreateThread({
  slotId,
  teamAId,
  teamBId,
}: {
  slotId: string;
  teamAId: string;
  teamBId: string;
}) {
  const [a, b] =
    teamAId < teamBId ? [teamAId, teamBId] : [teamBId, teamAId];

  const { data: existing } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("thread_type", "match")
    .eq("slot_id", slotId)
    .eq("team_a_id", a)
    .eq("team_b_id", b)
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  const { data: thread, error } = await supabase
    .from("chat_threads")
    .insert({
      thread_type: "match",
      slot_id: slotId,
      team_a_id: a,
      team_b_id: b,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  return thread.id;
}