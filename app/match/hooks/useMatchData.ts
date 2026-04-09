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

function ymd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function useMatchData(params: {
  monthDate: Date;
  authReady: boolean;
  currentUserId: string;
}) {
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

  const loadBase = useCallback(async () => {
    if (!authReady) return;

    setLoadingBase(true);
    setBaseError("");

    try {
      const uid = currentUserId ?? "";
      setMeId(uid);

      const settled = await Promise.allSettled([
        withTimeout(
          () => supabase.from("teams").select("*"),
          12000,
          "teams"
        ),
        withTimeout(
          () => supabase.from("venues").select("*"),
          12000,
          "venues"
        ),
        uid
          ? withTimeout(
              () => supabase.from("teams").select("*").eq("owner_id", uid),
              12000,
              "myTeams"
            )
          : Promise.resolve({
              data: [],
              error: null,
            }),
      ]);

      const [teamsRes, venuesRes, myTeamsRes] = settled;

      const errors: string[] = [];

      if (teamsRes.status === "fulfilled") {
        if (teamsRes.value.error) {
          console.error("[useMatchData] teams load error:", teamsRes.value.error);
          errors.push(`teams: ${teamsRes.value.error.message}`);
          setAllTeams([]);
        } else {
          setAllTeams(teamsRes.value.data ?? []);
        }
      } else {
        console.error("[useMatchData] teams unexpected error:", teamsRes.reason);
        errors.push(`teams: ${String(teamsRes.reason)}`);
        setAllTeams([]);
      }

      if (venuesRes.status === "fulfilled") {
        if (venuesRes.value.error) {
          console.error("[useMatchData] venues load error:", venuesRes.value.error);
          errors.push(`venues: ${venuesRes.value.error.message}`);
          setVenues([]);
        } else {
          setVenues(venuesRes.value.data ?? []);
        }
      } else {
        console.error("[useMatchData] venues unexpected error:", venuesRes.reason);
        errors.push(`venues: ${String(venuesRes.reason)}`);
        setVenues([]);
      }

      if (myTeamsRes.status === "fulfilled") {
        if (myTeamsRes.value.error) {
          console.error("[useMatchData] myTeams load error:", myTeamsRes.value.error);
          errors.push(`myTeams: ${myTeamsRes.value.error.message}`);
          setMyTeams([]);
        } else {
          setMyTeams(myTeamsRes.value.data ?? []);
        }
      } else {
        console.error("[useMatchData] myTeams unexpected error:", myTeamsRes.reason);
        errors.push(`myTeams: ${String(myTeamsRes.reason)}`);
        setMyTeams([]);
      }

      if (errors.length > 0) {
        setBaseError(errors.join(" / "));
      }
    } catch (e: any) {
      console.error("[useMatchData] loadBase unexpected error:", e);
      setAllTeams([]);
      setMyTeams([]);
      setVenues([]);
      setBaseError(e?.message ?? "base load failed");
    } finally {
      setLoadingBase(false);
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

      const startStr = ymd(start);
      const endStr = ymd(end);

      const settled = await Promise.allSettled([
        withTimeout(
          () =>
            supabase
              .from("match_slots")
              .select("*")
              .gte("date", startStr)
              .lt("date", endStr)
              .order("date", { ascending: true }),
          12000,
          "match_slots"
        ),
        currentUserId
          ? withTimeout(
              () =>
                supabase
                  .from("match_requests")
                  .select("*")
                  .gte("created_at", `${startStr}T00:00:00`)
                  .lt("created_at", `${endStr}T00:00:00`),
              12000,
              "match_requests"
            )
          : Promise.resolve({
              data: [],
              error: null,
            }),
      ]);

      const [slotsRes, reqsRes] = settled;

      const errors: string[] = [];

      if (slotsRes.status === "fulfilled") {
        if (slotsRes.value.error) {
          console.error("[useMatchData] match_slots load error:", slotsRes.value.error);
          errors.push(`match_slots: ${slotsRes.value.error.message}`);
          setSlotsInMonth([]);
        } else {
          setSlotsInMonth(slotsRes.value.data ?? []);
        }
      } else {
        console.error("[useMatchData] match_slots unexpected error:", slotsRes.reason);
        errors.push(`match_slots: ${String(slotsRes.reason)}`);
        setSlotsInMonth([]);
      }

      if (reqsRes.status === "fulfilled") {
        if (reqsRes.value.error) {
          console.error("[useMatchData] match_requests load error:", reqsRes.value.error);
          errors.push(`match_requests: ${reqsRes.value.error.message}`);
          setRequestsForMonth([]);
        } else {
          setRequestsForMonth(reqsRes.value.data ?? []);
        }
      } else {
        console.error("[useMatchData] match_requests unexpected error:", reqsRes.reason);
        errors.push(`match_requests: ${String(reqsRes.reason)}`);
        setRequestsForMonth([]);
      }

      if (errors.length > 0) {
        setMonthError(errors.join(" / "));
      }
    } catch (e: any) {
      console.error("[useMatchData] loadMonth unexpected error:", e);
      setSlotsInMonth([]);
      setRequestsForMonth([]);
      setMonthError(e?.message ?? "month load failed");
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

  useEffect(() => {
    if (!authReady) return;

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadBase();
        void loadMonth();
      }
    };

    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [authReady, loadBase, loadMonth]);

  useEffect(() => {
    if (!authReady) return;

    const key = currentUserId || "guest";

    const channel = supabase
      .channel(`match-home-${key}-${monthDate.getFullYear()}-${monthDate.getMonth() + 1}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        () => {
          void loadBase();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "venues" },
        () => {
          void loadBase();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_slots" },
        () => {
          void loadMonth();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_requests" },
        () => {
          void loadMonth();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authReady, currentUserId, monthDate, loadBase, loadMonth]);

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