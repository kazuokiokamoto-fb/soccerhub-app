// app/match/hooks/useMatchSlots.ts
"use client";

import { useCallback, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { DbSlot, Toast } from "../types";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function formatYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function useMatchSlots(opts: {
  monthDate: Date;
  setToast: (t: Toast | null) => void;
}) {
  const { monthDate, setToast } = opts;

  const [slotsInMonth, setSlotsInMonth] = useState<DbSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const loadMonthSlots = useCallback(async () => {
    setLoadingSlots(true);
    setToast({ type: "info", text: "カレンダー更新中…" });

    try {
      const start = formatYmd(startOfMonth(monthDate));
      const end = formatYmd(endOfMonth(monthDate));

      const { data: slotRows, error: slotErr } = await supabase
        .from("match_slots")
        .select("id,owner_id,host_team_id,date,start_time,end_time,venue_id,area,category,created_at")
        .gte("date", start)
        .lte("date", end)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (slotErr) {
        console.error(slotErr);
        setToast({ type: "error", text: `募集枠の読み込みに失敗: ${slotErr.message}` });
        setSlotsInMonth([]);
        return;
      }

      setSlotsInMonth((slotRows ?? []) as DbSlot[]);
      setToast(null);
    } finally {
      setLoadingSlots(false);
    }
  }, [monthDate, setToast]);

  const countByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of slotsInMonth) {
      m.set(s.date, (m.get(s.date) ?? 0) + 1);
    }
    return m;
  }, [slotsInMonth]);

  return {
    slotsInMonth,
    setSlotsInMonth,
    loadingSlots,
    loadMonthSlots,
    countByDate,
  };
}