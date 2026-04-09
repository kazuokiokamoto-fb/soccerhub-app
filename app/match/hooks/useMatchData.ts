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

  const [baseError, setBaseError] = useState<string>("");
  const [monthError, setMonthError] = useState<string>("");

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
        const result = teamsRes.value;
        const error = result.error;

        if (error) {
          console.error("[useMatchData] teams load error:", error);
          setAllTeams([]);
          setBaseError((prev) =>
            prev ? `${prev}\nteams: ${error.message}` : `teams: ${error.message}`
          );
        } else {
          setAllTeams(result.data ?? []);
        }
      } else {
        console.error("[useMatchData] teams timeout/unexpected:", teamsRes.reason);
        setAllTeams([]);
        setBaseError((prev) =>
          prev
            ? `${prev}\nteams: ${String(teamsRes.reason)}`
            : `teams: ${String(teamsRes.reason)}`
        );
      }

      if (venuesRes.status === "fulfilled") {
        const result = venuesRes.value;
        const error = result.error;

        if (error) {
          console.error("[useMatchData] venues load error:", error);
          setVenues([]);
          setBaseError((prev) =>
            prev ? `${prev}\nvenues: ${error.message}` : `venues: ${error.message}`
          );
        } else {
          setVenues(result.data ?? []);
        }
      } else {
        console.error("[useMatchData] venues timeout/unexpected:", venuesRes.reason);
        setVenues([]);
        setBaseError((prev) =>
          prev
            ? `${prev}\nvenues: ${String(venuesRes.reason)}`
            : `venues: ${String(venuesRes.reason)}`
        );
      }

      if (myTeamsRes.status === "fulfilled") {
        const result = myTeamsRes.value;
        const error = result.error;

        if (error) {
          console.error("[useMatchData] myTeams load error:", error);
          setMyTeams([]);
          setBaseError((prev) =>
            prev ? `${prev}\nmyTeams: ${error.message}` : `myTeams: ${error.message}`
          );
        } else {
          setMyTeams(result.data ?? []);
        }
      } else {
        console.error("[useMatchData] myTeams timeout/unexpected:", myTeamsRes.reason);
        setMyTeams([]);
        setBaseError((prev) =>
          prev
            ? `${prev}\nmyTeams: ${String(myTeamsRes.reason)}`
            : `myTeams: ${String(myTeamsRes.reason)}`
        );
      }
    } catch (e: any) {
      console.error("[useMatchData] loadBase unexpected error:", e);
      setAllTeams([]);
      setMyTeams([]);
      setVenues([]);
      setBaseError(e?.message ?? "loadBase unexpected error");
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
        const result = slotsRes.value;
        const error = result.error;

        if (error) {
          console.error("[useMatchData] match_slots load error:", error);
          setSlotsInMonth([]);
          setMonthError((prev) =>
            prev
              ? `${prev}\nmatch_slots: ${error.message}`
              : `match_slots: ${error.message}`
          );
        } else {
          setSlotsInMonth(result.data ?? []);
        }
      } else {
        console.error("[useMatchData] match_slots timeout/unexpected:", slotsRes.reason);
        setSlotsInMonth([]);
        setMonthError((prev) =>
          prev
            ? `${prev}\nmatch_slots: ${String(slotsRes.reason)}`
            : `match_slots: ${String(slotsRes.reason)}`
        );
      }

      if (reqsRes.status === "fulfilled") {
        const result = reqsRes.value;
        const error = result.error;

        if (error) {
          console.error("[useMatchData] match_requests load error:", error);
          setRequestsForMonth([]);
          setMonthError((prev) =>
            prev
              ? `${prev}\nmatch_requests: ${error.message}`
              : `match_requests: ${error.message}`
          );
        } else {
          setRequestsForMonth(result.data ?? []);
        }
      } else {
        console.error("[useMatchData] match_requests timeout/unexpected:", reqsRes.reason);
        setRequestsForMonth([]);
        setMonthError((prev) =>
          prev
            ? `${prev}\nmatch_requests: ${String(reqsRes.reason)}`
            : `match_requests: ${String(reqsRes.reason)}`
        );
      }
    } catch (e: any) {
      console.error("[useMatchData] loadMonth unexpected error:", e);
      setSlotsInMonth([]);
      setRequestsForMonth([]);
      setMonthError(e?.message ?? "loadMonth unexpected error");
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