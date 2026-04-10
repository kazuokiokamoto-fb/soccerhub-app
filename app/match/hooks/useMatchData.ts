"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";

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
    if (!authReady) {
      setLoadingBase(false);
      return;
    }

    setLoadingBase(true);
    setBaseError("");

    const uid = currentUserId ?? "";
    setMeId(uid);

    try {
      const [teamsRes, venuesRes] = await Promise.all([
        supabase
          .from("teams")
          .select(
            [
              "id",
              "owner_id",
              "name",
              "category",
              "categories",
              "level",
              "strength_rank",
              "area",
              "prefecture",
              "city",
              "town",
              "has_ground",
              "bike_parking",
              "bike_parking_capacity",
              "member_count",
              "uniform_main",
              "uniform_sub",
              "note",
            ].join(",")
          )
          .order("updated_at", { ascending: false }),

        supabase
          .from("venues")
          .select(
            [
              "id",
              "name",
              "area",
              "area_text",
              "prefecture",
              "city",
              "town",
              "address",
              "note",
            ].join(",")
          )
          .order("updated_at", { ascending: false }),
      ]);

      const errors: string[] = [];

      if (teamsRes.error) {
        console.error("[useMatchData] teams load error:", teamsRes.error);
        errors.push(`teams: ${teamsRes.error.message}`);
        setAllTeams([]);
        setMyTeams([]);
      } else {
        const teams = teamsRes.data ?? [];
        setAllTeams(teams);
        setMyTeams(uid ? teams.filter((t: any) => t.owner_id === uid) : []);
      }

      if (venuesRes.error) {
        console.error("[useMatchData] venues load error:", venuesRes.error);
        setVenues([]);
      } else {
        setVenues(venuesRes.data ?? []);
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
    if (!authReady) {
      setLoadingMonth(false);
      return;
    }

    setLoadingMonth(true);
    setMonthError("");

    try {
      const y = monthDate.getFullYear();
      const m = monthDate.getMonth();

      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 1);

      const startStr = ymd(start);
      const endStr = ymd(end);

      const [slotsRes, reqsRes] = await Promise.all([
        supabase
          .from("match_slots")
          .select(
            [
              "id",
              "owner_id",
              "host_team_id",
              "venue_id",
              "date",
              "start_time",
              "end_time",
              "area",
              "area_text",
              "category",
              "is_closed",
              "note",
              "created_at",
            ].join(",")
          )
          .gte("date", startStr)
          .lt("date", endStr)
          .order("date", { ascending: true })
          .order("start_time", { ascending: true }),

        currentUserId
          ? supabase
              .from("match_requests")
              .select(
                [
                  "id",
                  "slot_id",
                  "requester_team_id",
                  "requester_user_id",
                  "status",
                  "comment",
                  "created_at",
                ].join(",")
              )
              .gte("created_at", `${startStr}T00:00:00`)
              .lt("created_at", `${endStr}T00:00:00`)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const errors: string[] = [];

      if (slotsRes.error) {
        console.error("[useMatchData] match_slots load error:", slotsRes.error);
        errors.push(`match_slots: ${slotsRes.error.message}`);
        setSlotsInMonth([]);
      } else {
        setSlotsInMonth(slotsRes.data ?? []);
      }

      if (reqsRes.error) {
        console.error(
          "[useMatchData] match_requests load error:",
          reqsRes.error
        );
        setRequestsForMonth([]);
      } else {
        setRequestsForMonth(reqsRes.data ?? []);
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