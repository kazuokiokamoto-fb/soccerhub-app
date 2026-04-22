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
              "owner_id",
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
        console.error("[useMatchData] teams load error raw:", teamsRes.error);
        console.error("[useMatchData] teams load error message:", teamsRes.error.message);
        console.error("[useMatchData] teams load error details:", teamsRes.error.details);
        console.error("[useMatchData] teams load error hint:", teamsRes.error.hint);
        console.error("[useMatchData] teams load error code:", teamsRes.error.code);

        errors.push(`teams: ${teamsRes.error.message ?? "unknown error"}`);
        setAllTeams([]);
        setMyTeams([]);
      } else {
        const teams = teamsRes.data ?? [];
        setAllTeams(teams);
        setMyTeams(uid ? teams.filter((t: any) => t.owner_id === uid) : []);
      }

      if (venuesRes.error) {
        console.error("[useMatchData] venues load error raw:", venuesRes.error);
        console.error("[useMatchData] venues load error message:", venuesRes.error.message);
        console.error("[useMatchData] venues load error details:", venuesRes.error.details);
        console.error("[useMatchData] venues load error hint:", venuesRes.error.hint);
        console.error("[useMatchData] venues load error code:", venuesRes.error.code);

        errors.push(`venues: ${venuesRes.error.message ?? "unknown error"}`);
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

      const errors: string[] = [];

      const slotsRes = await supabase
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
        .order("start_time", { ascending: true });

      let monthSlots: any[] = [];

      if (slotsRes.error) {
        console.error("[useMatchData] match_slots load error raw:", slotsRes.error);
        console.error("[useMatchData] match_slots load error message:", slotsRes.error.message);
        console.error("[useMatchData] match_slots load error details:", slotsRes.error.details);
        console.error("[useMatchData] match_slots load error hint:", slotsRes.error.hint);
        console.error("[useMatchData] match_slots load error code:", slotsRes.error.code);

        errors.push(`match_slots: ${slotsRes.error.message ?? "unknown error"}`);
        setSlotsInMonth([]);
        setRequestsForMonth([]);
      } else {
        monthSlots = slotsRes.data ?? [];
        setSlotsInMonth(monthSlots);
      }

      if (monthSlots.length > 0 && currentUserId) {
        const slotIds = monthSlots.map((s: any) => s.id).filter(Boolean);

        const reqsRes = await supabase
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
          .in("slot_id", slotIds);

        if (reqsRes.error) {
          console.error("[useMatchData] match_requests load error raw:", reqsRes.error);
          console.error("[useMatchData] match_requests load error message:", reqsRes.error.message);
          console.error("[useMatchData] match_requests load error details:", reqsRes.error.details);
          console.error("[useMatchData] match_requests load error hint:", reqsRes.error.hint);
          console.error("[useMatchData] match_requests load error code:", reqsRes.error.code);

          errors.push(`match_requests: ${reqsRes.error.message ?? "unknown error"}`);
          setRequestsForMonth([]);
        } else {
          setRequestsForMonth(reqsRes.data ?? []);
        }
      } else {
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