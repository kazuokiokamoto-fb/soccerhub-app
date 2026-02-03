import { supabase } from "@/app/lib/supabase";

export const openDm = async (
  myTeamId: string,
  otherTeamId: string
): Promise<string> => {
  const { data, error } = await supabase.rpc(
    "rpc_get_or_create_dm_thread",
    {
      my_team_id: myTeamId,
      other_team_id: otherTeamId,
    }
  );

  if (error) {
    console.error(error);
    throw error;
  }

  return data as string; // thread_id
};