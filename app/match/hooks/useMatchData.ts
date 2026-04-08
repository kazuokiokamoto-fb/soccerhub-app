"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";

export function useMatchData(monthDate: Date) {
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingMonth, setLoadingMonth] = useState(true);

  const [meId, setMeId] = useState<string>("");

  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);

  const [slotsInMonth, setSlotsInMonth] = useState<any[]>([]);
  const [requestsForMonth, setRequestsForMonth] = useState<any[]>([]);

  useEffect(() => {
    let alive = true;

    const init = async () => {
      setLoadingBase(true);

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error("[useMatchData] getUser error:", userError);
        }

        const uid = user?.id ?? "";
        if (!alive) return;
        setMeId(uid);

        const { data: teams, error: teamsError } = await supabase
          .from("teams")
          .select("*");

        if (teamsError) {
          console.error("[useMatchData] teams error:", teamsError);
        }

        if (!alive) return;
        setAllTeams(teams ?? []);

        if (uid) {
          const { data: my, error: myError } = await supabase
            .from("teams")
            .select("*")
            .eq("owner_id", uid);

          if (myError) {
            console.error("[useMatchData] myTeams error:", myError);
          }

          if (!alive) return;
          setMyTeams(my ?? []);
        } else {
          if (!alive) return;
          setMyTeams([]);
        }

        const { data: venueRows, error: venuesError } = await supabase
          .from("venues")
          .select("*");

        if (venuesError) {
          console.error("[useMatchData] venues error:", venuesError);
        }

        if (!alive) return;
        setVenues(venueRows ?? []);
      } catch (e) {
        console.error("[useMatchData] init fatal error:", e);

        if (!alive) return;
        setMeId("");
        setAllTeams([]);
        setMyTeams([]);
        setVenues([]);
      } finally {
        if (alive) {
          setLoadingBase(false);
        }
      }
    };

    void init();

    return () => {
      alive = false;
    };
  }, []);

  const loadMonth = useCallback(async () => {
    setLoadingMonth(true);

    try {
      const y = monthDate.getFullYear();
      const m = monthDate.getMonth();

      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 1);

      const startStr = start.toISOString().slice(0, 10);
      const endStr = end.toISOString().slice(0, 10);

      const { data: slots, error: slotsError } = await supabase
        .from("match_slots")
        .select("*")
        .gte("date", startStr)
        .lt("date", endStr)
        .order("date", { ascending: true });

      if (slotsError) {
        console.error("[useMatchData] match_slots error:", slotsError);
      }

      setSlotsInMonth(slots ?? []);

      const { data: reqs, error: requestsError } = await supabase
        .from("match_requests")
        .select("*")
        .gte("created_at", `${startStr}T00:00:00`)
        .lt("created_at", `${endStr}T00:00:00`);

      if (requestsError) {
        console.error("[useMatchData] match_requests error:", requestsError);
      }

      setRequestsForMonth(reqs ?? []);
    } catch (e) {
      console.error("[useMatchData] loadMonth fatal error:", e);
      setSlotsInMonth([]);
      setRequestsForMonth([]);
    } finally {
      setLoadingMonth(false);
    }
  }, [monthDate]);

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
    loadMonth,
  };
}