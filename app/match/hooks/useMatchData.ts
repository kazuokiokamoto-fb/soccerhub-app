"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/lib/supabase";

export function useMatchData(monthDate: Date) {
  const [loadingBase, setLoadingBase] = useState(true);
  const [loadingMonth, setLoadingMonth] = useState(true);

  const [meId, setMeId] = useState<string>("");

  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [myTeams, setMyTeams] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);

  const [slotsInMonth, setSlotsInMonth] = useState<any[]>([]);
  const [requestsForMonth, setRequestsForMonth] = useState<any[]>([]);

  // =========================
  // 初期データ（チームなど）
  // =========================
  useEffect(() => {
    const init = async () => {
      setLoadingBase(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const uid = user?.id ?? "";
      setMeId(uid);

      // チーム一覧
      const { data: teams } = await supabase.from("teams").select("*");
      setAllTeams(teams ?? []);

      // 自分のチーム
      if (uid) {
        const { data: my } = await supabase
          .from("teams")
          .select("*")
          .eq("owner_id", uid);

        setMyTeams(my ?? []);
      }

      // 会場
      const { data: v } = await supabase.from("venues").select("*");
      setVenues(v ?? []);

      setLoadingBase(false);
    };

    init();
  }, []);

  // =========================
  // 月データ
  // =========================
  const loadMonth = async () => {
    setLoadingMonth(true);

    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();

    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 1);

    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    // 試合枠
    const { data: slots } = await supabase
      .from("match_slots")
      .select("*")
      .gte("date", startStr)
      .lt("date", endStr)
      .order("date", { ascending: true });

    setSlotsInMonth(slots ?? []);

    // 申込
    const { data: reqs } = await supabase
      .from("match_requests")
      .select("*")
      .gte("created_at", startStr)
      .lt("created_at", endStr);

    setRequestsForMonth(reqs ?? []);

    setLoadingMonth(false);
  };

  useEffect(() => {
    loadMonth();
  }, [monthDate]);

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