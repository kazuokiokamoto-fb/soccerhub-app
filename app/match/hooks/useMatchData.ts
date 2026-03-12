// app/match/hooks/useMatchData.ts
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import type { DbVenue, DbSlot, DbRequest, DbTeam } from "../types";
import { formatYmd, startOfMonth, endOfMonth } from "../utils/date";

export function useMatchData(monthDate: Date) {
  const [loadingBase, setLoadingBase] = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);

  const [meId, setMeId] = useState("");

  const [allTeams, setAllTeams] = useState<DbTeam[]>([]);
  const [myTeams, setMyTeams] = useState<DbTeam[]>([]);
  const [venues, setVenues] = useState<DbVenue[]>([]);

  const [slotsInMonth, setSlotsInMonth] = useState<DbSlot[]>([]);
  const [requestsForMonth, setRequestsForMonth] = useState<DbRequest[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setMeId(data?.user?.id || "");
    });
  }, []);

  async function loadBase() {
    setLoadingBase(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id || "";

      const { data: teamRows } = await supabase
        .from("teams")
        .select(
          "id,owner_id,name,area,category,categories,prefecture,city,town,level,strength_rank,has_ground,bike_parking,bike_parking_capacity,member_count,uniform_main,uniform_sub,roster_by_grade,desired_dates,note,updated_at"
        );

      const teams = (teamRows ?? []) as DbTeam[];
      setAllTeams(teams);
      setMyTeams(teams.filter((t) => t.owner_id === uid));

      const { data: venueRows } = await supabase
        .from("venues")
        .select("id,name,area,address,has_parking,has_bike_parking,note")
        .order("name", { ascending: true });

      setVenues((venueRows ?? []) as DbVenue[]);
    } finally {
      setLoadingBase(false);
    }
  }

  async function loadMonth() {
    setLoadingMonth(true);

    try {
      const start = formatYmd(startOfMonth(monthDate));
      const end = formatYmd(endOfMonth(monthDate));

      const { data: slotRows } = await supabase
        .from("match_slots")
        .select(
          "id,owner_id,host_team_id,date,start_time,end_time,venue_id,area,category,prefecture,city,town,is_closed,created_at"
        )
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      const slots = (slotRows ?? []) as DbSlot[];
      setSlotsInMonth(slots);

      const slotIds = slots.map((s) => s.id).filter(Boolean);

      if (slotIds.length === 0) {
        setRequestsForMonth([]);
        return;
      }

      const { data: reqRows } = await supabase
        .from("match_requests")
        .select("id,slot_id,requester_team_id,requester_user_id,status,comment,created_at")
        .in("slot_id", slotIds)
        .order("created_at", { ascending: false });

      setRequestsForMonth((reqRows ?? []) as DbRequest[]);
    } finally {
      setLoadingMonth(false);
    }
  }

  useEffect(() => {
    loadMonth();
  }, [monthDate]);

  useEffect(() => {
    loadBase();
  }, []);

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