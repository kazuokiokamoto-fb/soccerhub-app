"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { mergeHomeTeams, type HomeTeam } from "@/lib/home/membership";

export function useHomeTeams(userId: string, authLoading: boolean) {
  const [teams, setTeams] = useState<HomeTeam[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (loadedFor !== userId) {
    setLoadedFor(userId);
    setTeams([]);
    setStatus(userId ? "loading" : "ready");
  }

  useEffect(() => {
    if (authLoading || !userId) return;

    let mounted = true;

    void (async () => {
      try {
        const [ownedRes, memberRes] = await Promise.all([
          supabase.from("teams").select("id").eq("owner_id", userId),
          supabase.from("team_members").select("team_id,role").eq("user_id", userId),
        ]);

        if (!mounted) return;

        if (ownedRes.error || memberRes.error) {
          console.error("home teams error:", ownedRes.error ?? memberRes.error);
          setTeams([]);
          setStatus("error");
          return;
        }

        setTeams(
          mergeHomeTeams({
            owned: ownedRes.data ?? [],
            members: memberRes.data ?? [],
          }),
        );
        setStatus("ready");
      } catch (error) {
        console.error("home teams error:", error);
        if (!mounted) return;
        setTeams([]);
        setStatus("error");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [authLoading, userId]);

  return { teams, status };
}
