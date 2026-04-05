// app/match/hooks/useMatchData.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import type { DbVenue, DbSlot, DbRequest, DbTeam } from "../types";
import { formatYmd, startOfMonth, endOfMonth } from "../utils/date";

export function useMatchData(monthDate: Date) {
  const { user, loading: authLoading } = useAuth();
  const meId = user?.id ?? "";

  const [loadingBase, setLoadingBase] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);

  const [allTeams, setAllTeams] = useState<DbTeam[]>([]);
  const [myTeams, setMyTeams] = useState<DbTeam[]>([]);
  const [venues, setVenues] = useState<DbVenue[]>([]);

  const [slotsInMonth, setSlotsInMonth] = useState<DbSlot[]>([]);
  const [requestsForMonth, setRequestsForMonth] = useState<DbRequest[]>([]);

  const loadBase = useCallback(async () => {
    if (authLoading) return;

    setLoadingBase(true);

    try {
      const { data: teamRows, error: teamErr } = await supabase
        .from("teams")
        .select(
          "id,owner_id,name,area,category,categories,prefecture,city,town,level,strength_rank,has_ground,bike_parking,bike_parking_capacity,member_count,uniform_main,uniform_sub,roster_by_grade,desired_dates,note,updated_at"
        );

      if (teamErr) {
        console.error("loadBase teams error:", teamErr);
        setAllTeams([]);
        setMyTeams([]);
      } else {
        const teams = (teamRows ?? []) as DbTeam[];
        setAllTeams(teams);
        setMyTeams(teams.filter((t) => t.owner_id === meId));
      }

      const { data: venueRows, error: venueErr } = await supabase
        .from("venues")
        .select("id,name,area,address,has_parking,has_bike_parking,note")
        .order("name", { ascending: true });

      if (venueErr) {
        console.error("loadBase venues error:", venueErr);
        setVenues([]);
      } else {
        setVenues((venueRows ?? []) as DbVenue[]);
      }
    } finally {
      setLoadingBase(false);
    }
  }, [authLoading, meId]);

  const loadMonth = useCallback(async () => {
    setLoadingMonth(true);

    try {
      const start = formatYmd(startOfMonth(monthDate));
      const end = formatYmd(endOfMonth(monthDate));

      const { data: slotRows, error: slotErr } = await supabase
        .from("match_slots")
        .select(
          "id,owner_id,host_team_id,date,start_time,end_time,venue_id,area,area_text,area_detail,category,level_min,level_max,status,prefecture,city,town,neighborhood,city_group,is_closed,created_at,updated_at"
        )
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (slotErr) {
        console.error("loadMonth slots error:", slotErr);
        setSlotsInMonth([]);
        setRequestsForMonth([]);
        return;
      }

      const slots = (slotRows ?? []) as DbSlot[];
      setSlotsInMonth(slots);

      const slotIds = slots.map((s) => s.id).filter(Boolean);

      if (slotIds.length === 0) {
        setRequestsForMonth([]);
        return;
      }

      const { data: reqRows, error: reqErr } = await supabase
        .from("match_requests")
        .select(
          "id,slot_id,requester_team_id,requester_user_id,status,comment,created_at"
        )
        .in("slot_id", slotIds)
        .order("created_at", { ascending: false });

      if (reqErr) {
        console.error("loadMonth requests error:", reqErr);
        setRequestsForMonth([]);
        return;
      }

      setRequestsForMonth((reqRows ?? []) as DbRequest[]);
    } finally {
      setLoadingMonth(false);
    }
  }, [monthDate]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    loadBase();
  }, [loadBase]);

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