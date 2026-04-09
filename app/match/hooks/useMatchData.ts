"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";

async function withTimeout<T>(
  fn: () => PromiseLike<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race<T>([
      Promise.resolve(fn()),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timeout (${ms}ms)`));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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
    if (!authReady) return;

    setLoadingBase(true);

    try {
      const uid = currentUserId ?? "";
      setMeId(uid);

      const [teamsRes, venuesRes, myTeamsRes] = await Promise.allSettled([
        withTimeout(() => supabase.from("teams").select("*"), 8000, "teams"),
        withTimeout(() => supabase.from("venues").select("*"), 8000, "venues"),
        uid
          ? withTimeout(
              () => supabase.from("teams").select("*").eq("owner_id", uid),
              8000,
              "myTeams"
            )
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (teamsRes.status === "fulfilled") {
        if (teamsRes.value.error) {
          console.error("[useMatchData] teams load error:", teamsRes.value.error);
          setAllTeams([]);
        } else {
          setAllTeams(teamsRes.value.data ?? []);
        }
      } else {
        console.error("[useMatchData] teams timeout/unexpected:", teamsRes.reason);
        setAllTeams([]);
      }

      if (venuesRes.status === "fulfilled") {
        if (venuesRes.value.error) {
          console.error("[useMatchData] venues load error:", venuesRes.value.error);
          setVenues([]);
        } else {
          setVenues(venuesRes.value.data ?? []);
        }
      } else {
        console.error("[useMatchData] venues timeout/unexpected:", venuesRes.reason);
        setVenues([]);
      }

      if (myTeamsRes.status === "fulfilled") {
        if (myTeamsRes.value.error) {
          console.error("[useMatchData] myTeams load error:", myTeamsRes.value.error);
          setMyTeams([]);
        } else {
          setMyTeams(myTeamsRes.value.data ?? []);
        }
      } else {
        console.error("[useMatchData] myTeams timeout/unexpected:", myTeamsRes.reason);
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
    if (!authReady) return;

    setLoadingMonth(true);

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

      const slotPromise = withTimeout(
        () =>
          supabase
            .from("match_slots")
            .select("*")
            .gte("date", startStr)
            .lt("date", endStr)
            .order("date", { ascending: true }),
        8000,
        "match_slots"
      );

      const reqPromise = currentUserId
        ? withTimeout(
            () =>
              supabase
                .from("match_requests")
                .select("*")
                .gte("created_at", `${startStr} 00:00:00+00`)
                .lt("created_at", `${endStr} 00:00:00+00`),
            8000,
            "match_requests"
          )
        : Promise.resolve({ data: [], error: null });

      const [slotsRes, reqsRes] = await Promise.allSettled([
        slotPromise,
        reqPromise,
      ]);

      if (slotsRes.status === "fulfilled") {
        if (slotsRes.value.error) {
          console.error("[useMatchData] match_slots load error:", slotsRes.value.error);
          setSlotsInMonth([]);
        } else {
          setSlotsInMonth(slotsRes.value.data ?? []);
        }
      } else {
        console.error("[useMatchData] match_slots timeout/unexpected:", slotsRes.reason);
        setSlotsInMonth([]);
      }

      if (reqsRes.status === "fulfilled") {
        if (reqsRes.value.error) {
          console.error("[useMatchData] match_requests load error:", reqsRes.value.error);
          setRequestsForMonth([]);
        } else {
          setRequestsForMonth(reqsRes.value.data ?? []);
        }
      } else {
        console.error("[useMatchData] match_requests timeout/unexpected:", reqsRes.reason);
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