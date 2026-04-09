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

  const [baseError, setBaseError] = useState<string>("");
  const [monthError, setMonthError] = useState<string>("");

  const [meId, setMeId] = useState<string>("");

  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);

  const [slotsInMonth, setSlotsInMonth] = useState<any[]>([]);
  const [requestsForMonth, setRequestsForMonth] = useState<any[]>([]);

  const loadingBaseRef = useRef(false);
  const loadingMonthRef = useRef(false);

  const loadBase = useCallback(async () => {
    if (!authReady) return;
    if (loadingBaseRef.current) return;

    loadingBaseRef.current = true;
    setLoadingBase(true);
    setBaseError("");

    try {
      const uid = currentUserId ?? "";
      setMeId(uid);

      const [teamsRes, venuesRes, myTeamsRes] = await Promise.all([
        supabase.from("teams").select("*"),
        supabase.from("venues").select("*"),
        uid
          ? supabase.from("teams").select("*").eq("owner_id", uid)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (teamsRes.error) {
        console.error("[useMatchData] teams load error:", teamsRes.error);
        setAllTeams([]);
        setBaseError((prev) =>
          prev
            ? `${prev}\nteams: ${teamsRes.error.message}`
            : `teams: ${teamsRes.error.message}`
        );
      } else {
        setAllTeams(teamsRes.data ?? []);
      }

      if (venuesRes.error) {
        console.error("[useMatchData] venues load error:", venuesRes.error);
        setVenues([]);
        setBaseError((prev) =>
          prev
            ? `${prev}\nvenues: ${venuesRes.error.message}`
            : `venues: ${venuesRes.error.message}`
        );
      } else {
        setVenues(venuesRes.data ?? []);
      }

      if (myTeamsRes.error) {
        console.error("[useMatchData] myTeams load error:", myTeamsRes.error);
        setMyTeams([]);
        setBaseError((prev) =>
          prev
            ? `${prev}\nmyTeams: ${myTeamsRes.error.message}`
            : `myTeams: ${myTeamsRes.error.message}`
        );
      } else {
        setMyTeams(myTeamsRes.data ?? []);
      }
    } catch (e: any) {
      console.error("[useMatchData] loadBase unexpected error:", e);
      setAllTeams([]);
      setMyTeams([]);
      setVenues([]);
      setBaseError(e?.message ?? "loadBase unexpected error");
    } finally {
      loadingBaseRef.current = false;
      setLoadingBase(false);
    }
  }, [authReady, currentUserId]);

  const loadMonth = useCallback(async () => {
    if (!authReady) return;
    if (loadingMonthRef.current) return;

    loadingMonthRef.current = true;
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

      const [slotsRes, reqsRes] = await Promise.all([
        supabase
          .from("match_slots")
          .select("*")
          .gte("date", startStr)
          .lt("date", endStr)
          .order("date", { ascending: true }),
        currentUserId
          ? supabase
              .from("match_requests")
              .select("*")
              .gte("created_at", `${startStr}T00:00:00+00:00`)
              .lt("created_at", `${endStr}T00:00:00+00:00`)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (slotsRes.error) {
        console.error("[useMatchData] match_slots load error:", slotsRes.error);
        setSlotsInMonth([]);
        setMonthError((prev) =>
          prev
            ? `${prev}\nmatch_slots: ${slotsRes.error.message}`
            : `match_slots: ${slotsRes.error.message}`
        );
      } else {
        setSlotsInMonth(slotsRes.data ?? []);
      }

      if (reqsRes.error) {
        console.error(
          "[useMatchData] match_requests load error:",
          reqsRes.error
        );
        setRequestsForMonth([]);
        setMonthError((prev) =>
          prev
            ? `${prev}\nmatch_requests: ${reqsRes.error.message}`
            : `match_requests: ${reqsRes.error.message}`
        );
      } else {
        setRequestsForMonth(reqsRes.data ?? []);
      }
    } catch (e: any) {
      console.error("[useMatchData] loadMonth unexpected error:", e);
      setSlotsInMonth([]);
      setRequestsForMonth([]);
      setMonthError(e?.message ?? "loadMonth unexpected error");
    } finally {
      loadingMonthRef.current = false;
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

    const onFocus = () => {
      void loadBase();
      void loadMonth();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        onFocus();
      }
    });

    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, [authReady, loadBase, loadMonth]);

  useEffect(() => {
    if (!authReady) return;

    const channel = supabase
      .channel(`match-home-${currentUserId || "guest"}-${monthDate.getFullYear()}-${monthDate.getMonth() + 1}`)
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