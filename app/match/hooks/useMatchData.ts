"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadBase = useCallback(async () => {
    if (!authReady) return;

    if (mountedRef.current) {
      setLoadingBase(true);
    }

    try {
      const uid = currentUserId || "";
      if (mountedRef.current) {
        setMeId(uid);
      }

      const [
        { data: teams, error: teamsError },
        { data: venuesData, error: venuesError },
      ] = await Promise.all([
        supabase.from("teams").select("*").order("updated_at", { ascending: false }),
        supabase.from("venues").select("*"),
      ]);

      if (!mountedRef.current) return;

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
          .eq("owner_id", uid)
          .order("updated_at", { ascending: false });

        if (!mountedRef.current) return;

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

      if (!mountedRef.current) return;

      setAllTeams([]);
      setMyTeams([]);
      setVenues([]);
    } finally {
      if (mountedRef.current) {
        setLoadingBase(false);
      }
    }
  }, [authReady, currentUserId]);

  const loadMonth = useCallback(async () => {
    if (!authReady) return;

    if (mountedRef.current) {
      setLoadingMonth(true);
    }

    try {
      const y = monthDate.getFullYear();
      const m = monthDate.getMonth();

      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 1);

      const startStr = `${start.getFullYear()}-${String(
        start.getMonth() + 1
      ).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;

      const endStr = `${end.getFullYear()}-${String(
        end.getMonth() + 1
      ).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;

      const { data: slots, error: slotsError } = await supabase
        .from("match_slots")
        .select("*")
        .gte("date", startStr)
        .lt("date", endStr)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (!mountedRef.current) return;

      if (slotsError) {
        console.error("[useMatchData] match_slots load error:", slotsError);
        setSlotsInMonth([]);
        setRequestsForMonth([]);
        return;
      }

      const safeSlots = slots ?? [];
      setSlotsInMonth(safeSlots);

      const slotIds = safeSlots.map((s: any) => s.id).filter(Boolean);

      if (slotIds.length === 0) {
        setRequestsForMonth([]);
        return;
      }

      const { data: reqs, error: reqsError } = await supabase
        .from("match_requests")
        .select("*")
        .in("slot_id", slotIds);

      if (!mountedRef.current) return;

      if (reqsError) {
        console.error("[useMatchData] match_requests load error:", reqsError);
        setRequestsForMonth([]);
      } else {
        setRequestsForMonth(reqs ?? []);
      }
    } catch (e) {
      console.error("[useMatchData] loadMonth unexpected error:", e);

      if (!mountedRef.current) return;

      setSlotsInMonth([]);
      setRequestsForMonth([]);
    } finally {
      if (mountedRef.current) {
        setLoadingMonth(false);
      }
    }
  }, [authReady, monthDate]);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    if (!authReady) return;

    const onFocus = () => {
      void loadBase();
      void loadMonth();
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadBase();
        void loadMonth();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authReady, loadBase, loadMonth]);

  useEffect(() => {
    if (!authReady) return;

    const channel = supabase
      .channel(`match-data-${monthDate.getFullYear()}-${monthDate.getMonth() + 1}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        async () => {
          await loadBase();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "venues" },
        async () => {
          await loadBase();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_slots" },
        async () => {
          await loadMonth();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_requests" },
        async () => {
          await loadMonth();
        }
      )
      .subscribe((status) => {
        console.log("[useMatchData] realtime status:", status);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authReady, monthDate, loadBase, loadMonth]);

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