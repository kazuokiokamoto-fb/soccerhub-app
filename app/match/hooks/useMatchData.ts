"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";

export function useMatchData(params: {
  monthDate: Date;
  authReady: boolean;
  currentUserId: string;
}) {
  const { monthDate, authReady, currentUserId } = params;

  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingMonth, setLoadingMonth] = useState(true);

  const [meId, setMeId] = useState<string>("");

  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);

  const [slotsInMonth, setSlotsInMonth] = useState<any[]>([]);
  const [requestsForMonth, setRequestsForMonth] = useState<any[]>([]);

  const loadBase = useCallback(async () => {
    if (!authReady) {
      return;
    }

    setLoadingBase(true);

    try {
      const uid = currentUserId ?? "";
      setMeId(uid);

      const [{ data: teams, error: teamsError }, { data: venuesData, error: venuesError }] =
        await Promise.all([
          supabase.from("teams").select("*"),
          supabase.from("venues").select("*"),
        ]);

      if (teamsError) {
        console.error("[useMatchData] teams load error:", teamsError);
        setAllTeams([]);
      } else {
        setAllTeams(teams ?? []);
      }

      if (venuesError) {
        console.error("[useMatchData] venues load error:", venuesError);
        setVenues([]);
      } else {
        setVenues(venuesData ?? []);
      }

      if (uid) {
        const { data: my, error: myTeamsError } = await supabase
          .from("teams")
          .select("*")
          .eq("owner_id", uid);

        if (myTeamsError) {
          console.error("[useMatchData] myTeams load error:", myTeamsError);
          setMyTeams([]);
        } else {
          setMyTeams(my ?? []);
        }
      } else {
        setMyTeams([]);
      }
    } catch (e) {
      console.error("[useMatchData] loadBase unexpected error:", e);
      setAllTeams([]);
      setMyTeams([]);
      setVenues([]);
    } finally {
      setLoadingBase(false);
    }
  }, [authReady, currentUserId]);

  const loadMonth = useCallback(async () => {
    if (!authReady) {
      return;
    }

    setLoadingMonth(true);

    try {
      const y = monthDate.getFullYear();
      const m = monthDate.getMonth();

      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 1);

      const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
      const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;

      const { data: slots, error: slotsError } = await supabase
        .from("match_slots")
        .select("*")
        .gte("date", startStr)
        .lt("date", endStr)
        .order("date", { ascending: true });

      if (slotsError) {
        console.error("[useMatchData] match_slots load error:", slotsError);
        setSlotsInMonth([]);
      } else {
        setSlotsInMonth(slots ?? []);
      }

      if (currentUserId) {
        const { data: reqs, error: reqsError } = await supabase
          .from("match_requests")
          .select("*")
          .gte("created_at", `${startStr} 00:00:00+00`)
          .lt("created_at", `${endStr} 00:00:00+00`);

        if (reqsError) {
          console.error("[useMatchData] match_requests load error:", reqsError);
          setRequestsForMonth([]);
        } else {
          setRequestsForMonth(reqs ?? []);
        }
      } else {
        setRequestsForMonth([]);
      }
    } catch (e) {
      console.error("[useMatchData] loadMonth unexpected error:", e);
      setSlotsInMonth([]);
      setRequestsForMonth([]);
    } finally {
      setLoadingMonth(false);
    }
  }, [authReady, currentUserId, monthDate]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  return {
    loadingBase,
    loadingMonth,
    meId,
    allTeams,
    myTeams,
    venues,
    slotsInMonth,
    requestsForMonth,
    loadBase,
    loadMonth,
  };
}