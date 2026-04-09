"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { withTimeout, getErrorMessage } from "@/app/lib/safeQuery";

type UseMatchDataParams = {
  monthDate: Date;
  authReady: boolean;
  currentUserId: string;
};

export function useMatchData(params: UseMatchDataParams) {
  const { monthDate, authReady, currentUserId } = params;

  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingMonth, setLoadingMonth] = useState(true);

  const [baseError, setBaseError] = useState("");
  const [monthError, setMonthError] = useState("");

  const [meId, setMeId] = useState<string>("");

  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);

  const [slotsInMonth, setSlotsInMonth] = useState<any[]>([]);
  const [requestsForMonth, setRequestsForMonth] = useState<any[]>([]);

  const mountedRef = useRef(true);

  const monthKey = `${monthDate.getFullYear()}-${String(
    monthDate.getMonth() + 1
  ).padStart(2, "0")}`;

  const loadBase = useCallback(async () => {
    if (!authReady) return;

    setLoadingBase(true);
    setBaseError("");

    try {
      const uid = currentUserId ?? "";
      setMeId(uid);

      const [teamsRes, venuesRes, myTeamsRes] = await Promise.allSettled([
        withTimeout(supabase.from("teams").select("*"), 8000, "teams"),
        withTimeout(supabase.from("venues").select("*"), 8000, "venues"),
        uid
          ? withTimeout(
              supabase.from("teams").select("*").eq("owner_id", uid),
              8000,
              "myTeams"
            )
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (!mountedRef.current) return;

      if (teamsRes.status === "fulfilled") {
        if (teamsRes.value.error) {
          console.error("[useMatchData] teams error:", teamsRes.value.error);
          setAllTeams([]);
        } else {
          setAllTeams(teamsRes.value.data ?? []);
        }
      } else {
        console.error("[useMatchData] teams failed:", teamsRes.reason);
        setAllTeams([]);
      }

      if (venuesRes.status === "fulfilled") {
        if (venuesRes.value.error) {
          console.error("[useMatchData] venues error:", venuesRes.value.error);
          setVenues([]);
        } else {
          setVenues(venuesRes.value.data ?? []);
        }
      } else {
        console.error("[useMatchData] venues failed:", venuesRes.reason);
        setVenues([]);
      }

      if (myTeamsRes.status === "fulfilled") {
        if ((myTeamsRes.value as any).error) {
          console.error("[useMatchData] myTeams error:", (myTeamsRes.value as any).error);
          setMyTeams([]);
        } else {
          setMyTeams(((myTeamsRes.value as any).data ?? []) as any[]);
        }
      } else {
        console.error("[useMatchData] myTeams failed:", myTeamsRes.reason);
        setMyTeams([]);
      }
    } catch (e) {
      console.error("[useMatchData] loadBase unexpected error:", e);
      if (!mountedRef.current) return;
      setBaseError(getErrorMessage(e));
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

    setLoadingMonth(true);
    setMonthError("");

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

      const slotsRes = await withTimeout(
        supabase
          .from("match_slots")
          .select("*")
          .gte("date", startStr)
          .lt("date", endStr)
          .order("date", { ascending: true }),
        8000,
        "match_slots"
      );

      if (slotsRes.error) {
        throw slotsRes.error;
      }

      if (!mountedRef.current) return;

      const slots = slotsRes.data ?? [];
      setSlotsInMonth(slots);

      const slotIds = slots
        .map((s: any) => s.id)
        .filter(Boolean);

      if (slotIds.length === 0) {
        setRequestsForMonth([]);
        return;
      }

      const reqsRes = await withTimeout(
        supabase
          .from("match_requests")
          .select("*")
          .in("slot_id", slotIds),
        8000,
        "match_requests by slot_ids"
      );

      if (reqsRes.error) {
        throw reqsRes.error;
      }

      if (!mountedRef.current) return;
      setRequestsForMonth(reqsRes.data ?? []);
    } catch (e) {
      console.error("[useMatchData] loadMonth unexpected error:", e);
      if (!mountedRef.current) return;
      setMonthError(getErrorMessage(e));
      setSlotsInMonth([]);
      setRequestsForMonth([]);
    } finally {
      if (mountedRef.current) {
        setLoadingMonth(false);
      }
    }
  }, [authReady, monthDate]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void loadBase();
  }, [loadBase]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth, monthKey]);

  useEffect(() => {
    if (!authReady) return;

    const onFocusReload = () => {
      if (document.visibilityState === "visible") {
        void loadBase();
        void loadMonth();
      }
    };

    window.addEventListener("focus", onFocusReload);
    document.addEventListener("visibilitychange", onFocusReload);

    const channel = supabase
      .channel(`match-live-${currentUserId || "guest"}-${monthKey}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_slots" },
        () => void loadMonth()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_requests" },
        () => void loadMonth()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        () => void loadBase()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "venues" },
        () => void loadBase()
      )
      .subscribe();

    return () => {
      window.removeEventListener("focus", onFocusReload);
      document.removeEventListener("visibilitychange", onFocusReload);
      void supabase.removeChannel(channel);
    };
  }, [authReady, currentUserId, monthKey, loadBase, loadMonth]);

  return {
    loadingBase,
    loadingMonth,
    baseError,
    monthError,
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