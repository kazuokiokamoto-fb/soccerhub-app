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

    const uid = currentUserId ?? "";
    setMeId(uid);

    const errors: string[] = [];

    try {
      const teamsRes = await withTimeout(
        () => supabase.from("teams").select("*"),
        12000,
        "teams"
      );

      if (teamsRes.error) {
        console.error("[useMatchData] teams load error:", teamsRes.error);
        errors.push(`teams: ${teamsRes.error.message}`);
        setAllTeams([]);
      } else {
        setAllTeams(teamsRes.data ?? []);
      }
    } catch (e: any) {
      console.error("[useMatchData] teams unexpected error:", e);
      errors.push(`teams: ${e?.message ?? String(e)}`);
      setAllTeams([]);
    }

    try {
      const venuesRes = await withTimeout(
        () => supabase.from("venues").select("*"),
        12000,
        "venues"
      );

      if (venuesRes.error) {
        console.error("[useMatchData] venues load error:", venuesRes.error);
        errors.push(`venues: ${venuesRes.error.message}`);
        setVenues([]);
      } else {
        setVenues(venuesRes.data ?? []);
      }
    } catch (e: any) {
      console.error("[useMatchData] venues unexpected error:", e);
      errors.push(`venues: ${e?.message ?? String(e)}`);
      setVenues([]);
    }

    if (uid) {
      try {
        const myTeamsRes = await withTimeout(
          () => supabase.from("teams").select("*").eq("owner_id", uid),
          12000,
          "myTeams"
        );

        if (myTeamsRes.error) {
          console.error("[useMatchData] myTeams load error:", myTeamsRes.error);
          errors.push(`myTeams: ${myTeamsRes.error.message}`);
          setMyTeams([]);
        } else {
          setMyTeams(myTeamsRes.data ?? []);
        }
      } catch (e: any) {
        console.error("[useMatchData] myTeams unexpected error:", e);
        errors.push(`myTeams: ${e?.message ?? String(e)}`);
        setMyTeams([]);
      }
    } else {
      setMyTeams([]);
    }

    if (errors.length > 0) {
      setBaseError(errors.join(" / "));
    }

    setLoadingBase(false);
  }, [authReady, currentUserId]);

  const loadMonth = useCallback(async () => {
    if (!authReady) return;

    setLoadingMonth(true);
    setMonthError("");

    const errors: string[] = [];

    try {
      const y = monthDate.getFullYear();
      const m = monthDate.getMonth();

      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 1);

      const startStr = ymd(start);
      const endStr = ymd(end);

      try {
        const slotsRes = await withTimeout(
          () =>
            supabase
              .from("match_slots")
              .select("*")
              .gte("date", startStr)
              .lt("date", endStr)
              .order("date", { ascending: true }),
          12000,
          "match_slots"
        );

        if (slotsRes.error) {
          console.error("[useMatchData] match_slots load error:", slotsRes.error);
          errors.push(`match_slots: ${slotsRes.error.message}`);
          setSlotsInMonth([]);
        } else {
          setSlotsInMonth(slotsRes.data ?? []);
        }
      } catch (e: any) {
        console.error("[useMatchData] match_slots unexpected error:", e);
        errors.push(`match_slots: ${e?.message ?? String(e)}`);
        setSlotsInMonth([]);
      }

      if (currentUserId) {
        try {
          const reqsRes = await withTimeout(
            () =>
              supabase
                .from("match_requests")
                .select("*")
                .gte("created_at", `${startStr}T00:00:00`)
                .lt("created_at", `${endStr}T00:00:00`),
            12000,
            "match_requests"
          );

          if (reqsRes.error) {
            console.error("[useMatchData] match_requests load error:", reqsRes.error);
            errors.push(`match_requests: ${reqsRes.error.message}`);
            setRequestsForMonth([]);
          } else {
            setRequestsForMonth(reqsRes.data ?? []);
          }
        } catch (e: any) {
          console.error("[useMatchData] match_requests unexpected error:", e);
          errors.push(`match_requests: ${e?.message ?? String(e)}`);
          setRequestsForMonth([]);
        }
      } else {
        setRequestsForMonth([]);
      }
    } catch (e: any) {
      console.error("[useMatchData] loadMonth unexpected error:", e);
      errors.push(e?.message ?? "month load failed");
      setSlotsInMonth([]);
      setRequestsForMonth([]);
    }

    if (errors.length > 0) {
      setMonthError(errors.join(" / "));
    }

    setLoadingMonth(false);
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
      .channel(
        `match-home-${key}-${monthDate.getFullYear()}-${monthDate.getMonth() + 1}`
      )
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