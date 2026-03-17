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
  // 並び順を固定（A/B入れ替わり防止）
  const [a, b] =
    teamAId < teamBId ? [teamAId, teamBId] : [teamBId, teamAId];

  // 既存検索
  const { data: existing } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("slot_id", slotId)
    .eq("team_a_id", a)
    .eq("team_b_id", b)
    .maybeSingle();

  if (existing?.id) {
    return existing.id;
  }

  // 新規作成
  const { data: thread, error } = await supabase
    .from("chat_threads")
    .insert({
      slot_id: slotId,
      team_a_id: a,
      team_b_id: b,
    })
    .select()
    .single();

  if (error) throw error;

  return thread.id;
}