// app/match/hooks/useMatchRequests.ts
"use client";

import { useCallback, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { DbRequest, Toast } from "../types";

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

export function useMatchRequests(opts: {
  monthDate: Date;
  setToast: (t: Toast | null) => void;
}) {
  const { monthDate, setToast } = opts;

  const [requestsForMonth, setRequestsForMonth] = useState<DbRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const loadMonthRequests = useCallback(async () => {
    setLoadingRequests(true);

    try {
      const start = formatYmd(startOfMonth(monthDate));
      const end = formatYmd(endOfMonth(monthDate));

      // MVP: created_at基準（あなたの既存通り）
      const { data: reqRows, error: reqErr } = await supabase
        .from("match_requests")
        .select("id,slot_id,requester_team_id,requester_user_id,status,created_at")
        .gte("created_at", start + "T00:00:00")
        .lte("created_at", end + "T23:59:59")
        .order("created_at", { ascending: false });

      if (reqErr) {
        console.error(reqErr);
        setRequestsForMonth([]);
        return;
      }

      setRequestsForMonth((reqRows ?? []) as DbRequest[]);
    } finally {
      setLoadingRequests(false);
      // toastはslots側で制御するのでここでは触らない
    }
  }, [monthDate]);

  const updateRequestStatus = useCallback(
    async (requestId: string, status: DbRequest["status"]) => {
      setToast({ type: "info", text: "更新中…" });
      const { error } = await supabase.from("match_requests").update({ status }).eq("id", requestId);
      if (error) {
        console.error(error);
        setToast({ type: "error", text: `更新に失敗: ${error.message}` });
        return false;
      }
      setToast({ type: "success", text: status === "accepted" ? "✅ 承認しました" : "🙇 却下しました" });
      return true;
    },
    [setToast]
  );

  return {
    requestsForMonth,
    setRequestsForMonth,
    loadingRequests,
    loadMonthRequests,
    updateRequestStatus,
  };
}