"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import AppTabNav from "@/app/components/AppTabNav";
import AppHero from "@/app/components/AppHero";
import PageBackNav from "@/app/components/PageBackNav";

type TeamRow = {
  id: string;
  owner_id: string | null;
  name: string | null;
  category: string | null;
};

type MatchSlotRow = {
  id: string;
  owner_id: string | null;
  host_team_id: string;
  date: string;
  start_time: string;
  end_time: string;
  area: string | null;
  area_text?: string | null;
  category: string | null;
  note: string | null;
  is_closed: boolean | null;
  created_at: string;
};

type MatchRequestRow = {
  id: string;
  slot_id: string;
  requester_team_id: string;
  requester_user_id: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  comment: string | null;
  created_at: string;
};

function fmtDate(ymd?: string | null) {
  if (!ymd) return "";
  return ymd;
}

function fmtTime(v?: string | null) {
  if (!v) return "";
  return String(v).slice(0, 5);
}

function toJst(dt?: string | null) {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleString("ja-JP");
  } catch {
    return "";
  }
}

function countByStatus(rows: MatchRequestRow[], status: MatchRequestRow["status"]) {
  return rows.filter((r) => r.status === status).length;
}

export default function OpenMatchesPage() {
  const [meId, setMeId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [myTeams, setMyTeams] = useState<TeamRow[]>([]);
  const [slots, setSlots] = useState<MatchSlotRow[]>([]);
  const [requests, setRequests] = useState<MatchRequestRow[]>([]);
  const [teamMap, setTeamMap] = useState<Map<string, TeamRow>>(new Map());

  const [openCount, setOpenCount] = useState(0);
  const [closedCount, setClosedCount] = useState(0);

  const [openDetailId, setOpenDetailId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMeId(data?.user?.id ?? "");
    })();
  }, []);

  useEffect(() => {
    if (!meId) {
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);

      const { data: teamRows, error: teamErr } = await supabase
        .from("teams")
        .select("id, owner_id, name, category")
        .eq("owner_id", meId)
        .order("created_at", { ascending: false });

      if (teamErr) {
        console.error(teamErr);
        setMyTeams([]);
        setSlots([]);
        setRequests([]);
        setTeamMap(new Map());
        setOpenCount(0);
        setClosedCount(0);
        setLoading(false);
        return;
      }

      const myTeamRows = (teamRows ?? []) as TeamRow[];
      setMyTeams(myTeamRows);

      const myTeamIds = myTeamRows.map((t) => t.id).filter(Boolean);

      if (myTeamIds.length === 0) {
        setSlots([]);
        setRequests([]);
        setTeamMap(new Map());
        setOpenCount(0);
        setClosedCount(0);
        setLoading(false);
        return;
      }

      const { data: slotRows, error: slotErr } = await supabase
        .from("match_slots")
        .select(
          "id, owner_id, host_team_id, date, start_time, end_time, area, area_text, category, note, is_closed, created_at"
        )
        .in("host_team_id", myTeamIds)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (slotErr) {
        console.error(slotErr);
        setSlots([]);
        setRequests([]);
        setTeamMap(new Map());
        setOpenCount(0);
        setClosedCount(0);
        setLoading(false);
        return;
      }

      const slotData = (slotRows ?? []) as MatchSlotRow[];
      setSlots(slotData);

      // ホームと同じ考え方で件数を確定
      setOpenCount(slotData.filter((s) => !s.is_closed).length);
      setClosedCount(slotData.filter((s) => !!s.is_closed).length);

      const slotIds = slotData.map((s) => s.id);

      if (slotIds.length === 0) {
        setRequests([]);
        const baseTeamMap = new Map<string, TeamRow>();
        myTeamRows.forEach((t) => baseTeamMap.set(t.id, t));
        setTeamMap(baseTeamMap);
        setLoading(false);
        return;
      }

      const { data: reqRows, error: reqErr } = await supabase
        .from("match_requests")
        .select("id, slot_id, requester_team_id, requester_user_id, status, comment, created_at")
        .in("slot_id", slotIds)
        .order("created_at", { ascending: false });

      if (reqErr) {
        console.error(reqErr);
        setRequests([]);
      } else {
        setRequests((reqRows ?? []) as MatchRequestRow[]);
      }

      const requesterTeamIds = Array.from(
        new Set(
          ((reqRows ?? []) as MatchRequestRow[])
            .map((r) => r.requester_team_id)
            .filter(Boolean)
        )
      );

      const allNeedTeamIds = Array.from(new Set([...myTeamIds, ...requesterTeamIds]));

      if (allNeedTeamIds.length > 0) {
        const { data: allTeamsRows, error: allTeamsErr } = await supabase
          .from("teams")
          .select("id, owner_id, name, category")
          .in("id", allNeedTeamIds);

        if (allTeamsErr) {
          console.error(allTeamsErr);
          const fallbackMap = new Map<string, TeamRow>();
          myTeamRows.forEach((t) => fallbackMap.set(t.id, t));
          setTeamMap(fallbackMap);
        } else {
          const m = new Map<string, TeamRow>();
          ((allTeamsRows ?? []) as TeamRow[]).forEach((t) => m.set(t.id, t));
          setTeamMap(m);
        }
      } else {
        const fallbackMap = new Map<string, TeamRow>();
        myTeamRows.forEach((t) => fallbackMap.set(t.id, t));
        setTeamMap(fallbackMap);
      }

      setLoading(false);
    })();
  }, [meId]);

  const requestsBySlot = useMemo(() => {
    const m = new Map<string, MatchRequestRow[]>();
    for (const r of requests) {
      if (!m.has(r.slot_id)) m.set(r.slot_id, []);
      m.get(r.slot_id)!.push(r);
    }
    return m;
  }, [requests]);

  const openSlots = useMemo(() => {
    return slots.filter((s) => !s.is_closed);
  }, [slots]);

  const closedSlots = useMemo(() => {
    return slots.filter((s) => !!s.is_closed);
  }, [slots]);

  const toggleClosed = async (slotId: string, nextClosed: boolean) => {
    const { error } = await supabase
      .from("match_slots")
      .update({ is_closed: nextClosed })
      .eq("id", slotId);

    if (error) {
      console.error(error);
      alert(`更新に失敗しました: ${error.message}`);
      return;
    }

    setSlots((prev) => {
      const updated = prev.map((s) =>
        s.id === slotId ? { ...s, is_closed: nextClosed } : s
      );
      setOpenCount(updated.filter((s) => !s.is_closed).length);
      setClosedCount(updated.filter((s) => !!s.is_closed).length);
      return updated;
    });
  };

  return (
    <main style={wrap}>
      <AppTabNav />
      <PageBackNav current="募集中の試合" />

      <AppHero
        icon="📣"
        title="募集中の試合"
        desc="現在あなたが公開している募集一覧です。申込状況や詳細を確認できます。"
      />

      <div style={{ fontSize: 14, color: "red", marginTop: 8, fontWeight: 700 }}>
        OPEN PAGE DEBUG 20260324
      </div>

      <div style={summaryBox}>
        <div style={summaryItem}>
          <div style={summaryLabel}>公開中</div>
          <div style={summaryValue}>{openCount}</div>
        </div>
        <div style={summaryItem}>
          <div style={summaryLabel}>停止中</div>
          <div style={summaryValue}>{closedCount}</div>
        </div>
        <div style={summaryItem}>
          <div style={summaryLabel}>総申込数</div>
          <div style={summaryValue}>{requests.length}</div>
        </div>
      </div>

      <div style={topActionRow}>
        <Link href="/match" className="sh-btn">
          募集一覧へ
        </Link>
        <Link href="/match/new" className="sh-btn sh-btn--primary">
          ＋募集を作る
        </Link>
      </div>

      {loading ? <div style={infoText}>読み込み中…</div> : null}

      {!loading && myTeams.length === 0 ? (
        <div style={emptyBox}>自分のチームがまだ登録されていません。</div>
      ) : null}

      {!loading && myTeams.length > 0 && slots.length === 0 ? (
        <div style={emptyBox}>現在、募集している試合はありません。</div>
      ) : null}

      {!loading && slots.length > 0 ? (
        <div style={listWrap}>
          {slots.map((slot) => {
            const hostTeam = teamMap.get(slot.host_team_id);
            const slotRequests = requestsBySlot.get(slot.id) ?? [];
            const pendingCount = countByStatus(slotRequests, "pending");
            const acceptedCount = countByStatus(slotRequests, "accepted");
            const rejectedCount = countByStatus(slotRequests, "rejected");
            const cancelledCount = countByStatus(slotRequests, "cancelled");

            const expanded = openDetailId === slot.id;

            return (
              <div key={slot.id} style={card}>
                <div style={cardHead}>
                  <div style={{ minWidth: 0 }}>
                    <div style={cardTitleRow}>
                      <div style={teamName}>{hostTeam?.name ?? "チーム未設定"}</div>

                      <span
                        style={{
                          ...statusBadge,
                          ...(slot.is_closed ? statusClosed : statusOpen),
                        }}
                      >
                        {slot.is_closed ? "停止中" : "公開中"}
                      </span>
                    </div>

                    <div style={metaText}>
                      📅 {fmtDate(slot.date)} {fmtTime(slot.start_time)}–{fmtTime(slot.end_time)}
                    </div>
                    <div style={metaText}>
                      📍 {slot.area_text ?? slot.area ?? "未設定"}
                    </div>
                    <div style={metaText}>
                      🏷 {slot.category ?? hostTeam?.category ?? "未設定"}
                    </div>
                  </div>
                </div>

                <div style={statsRow}>
                  <div style={miniStat}>
                    <div style={miniStatLabel}>申込待ち</div>
                    <div style={miniStatValue}>{pendingCount}</div>
                  </div>
                  <div style={miniStat}>
                    <div style={miniStatLabel}>成立</div>
                    <div style={miniStatValue}>{acceptedCount}</div>
                  </div>
                  <div style={miniStat}>
                    <div style={miniStatLabel}>見送り</div>
                    <div style={miniStatValue}>{rejectedCount}</div>
                  </div>
                  <div style={miniStat}>
                    <div style={miniStatLabel}>取消</div>
                    <div style={miniStatValue}>{cancelledCount}</div>
                  </div>
                </div>

                <div style={buttonRow}>
                  <button
                    type="button"
                    className="sh-btn"
                    onClick={() => setOpenDetailId(expanded ? "" : slot.id)}
                  >
                    {expanded ? "詳細を閉じる" : "詳細"}
                  </button>

                  <Link href={`/match/new?slotId=${slot.id}`} className="sh-btn">
                    募集を編集
                  </Link>

                  <button
                    type="button"
                    className="sh-btn"
                    onClick={() => toggleClosed(slot.id, !slot.is_closed)}
                  >
                    {slot.is_closed ? "公開に戻す" : "募集停止"}
                  </button>
                </div>

                {expanded ? (
                  <div style={detailBox}>
                    <div style={detailSection}>
                      <div style={detailTitle}>募集メモ</div>
                      <div style={detailText}>
                        {slot.note?.trim() ? slot.note : "未入力"}
                      </div>
                    </div>

                    <div style={detailSection}>
                      <div style={detailTitle}>作成日時</div>
                      <div style={detailText}>{toJst(slot.created_at)}</div>
                    </div>

                    <div style={detailSection}>
                      <div style={detailTitle}>申込一覧</div>

                      {slotRequests.length === 0 ? (
                        <div style={detailText}>まだ申込はありません。</div>
                      ) : (
                        <div style={requestList}>
                          {slotRequests.map((req) => {
                            const requesterTeam = teamMap.get(req.requester_team_id);

                            return (
                              <div key={req.id} style={requestCard}>
                                <div style={requestTop}>
                                  <div>
                                    <div style={requestTeamName}>
                                      {requesterTeam?.name ?? "相手チーム未設定"}
                                    </div>
                                    <div style={requestMeta}>
                                      ステータス：{labelStatus(req.status)}
                                    </div>
                                    <div style={requestMeta}>
                                      申込日時：{toJst(req.created_at)}
                                    </div>
                                  </div>

                                  <Link href="/chat" className="sh-btn sh-btn--primary">
                                    チャット
                                  </Link>
                                </div>

                                {req.comment ? (
                                  <div style={requestComment}>
                                    コメント：{req.comment}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </main>
  );
}

function labelStatus(status: MatchRequestRow["status"]) {
  switch (status) {
    case "pending":
      return "申込待ち";
    case "accepted":
      return "成立";
    case "rejected":
      return "見送り";
    case "cancelled":
      return "取消";
    default:
      return status;
  }
}

const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
};

const summaryBox: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
};

const summaryItem: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 16,
  background: "#fff",
  padding: "14px 12px",
};

const summaryLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
};

const summaryValue: React.CSSProperties = {
  marginTop: 6,
  fontSize: 26,
  fontWeight: 900,
  color: "#145c2a",
  lineHeight: 1.1,
};

const topActionRow: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const infoText: React.CSSProperties = {
  marginTop: 16,
  color: "#666",
};

const emptyBox: React.CSSProperties = {
  marginTop: 16,
  padding: 20,
  borderRadius: 16,
  border: "1px solid #eee",
  background: "#fff",
  color: "#777",
};

const listWrap: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gap: 12,
};

const card: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 18,
  background: "#fff",
  padding: 16,
  boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
  display: "grid",
  gap: 12,
};

const cardHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const cardTitleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const teamName: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#16391f",
};

const statusBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 28,
  padding: "0 12px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
};

const statusOpen: React.CSSProperties = {
  background: "#dcfce7",
  color: "#166534",
};

const statusClosed: React.CSSProperties = {
  background: "#f3f4f6",
  color: "#4b5563",
};

const metaText: React.CSSProperties = {
  marginTop: 6,
  color: "#666",
  lineHeight: 1.7,
  fontSize: 14,
};

const statsRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 8,
};

const miniStat: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
  padding: "10px 8px",
  textAlign: "center",
};

const miniStatLabel: React.CSSProperties = {
  fontSize: 11,
  color: "#6b7280",
  fontWeight: 800,
};

const miniStatValue: React.CSSProperties = {
  marginTop: 4,
  fontSize: 20,
  color: "#145c2a",
  fontWeight: 900,
};

const buttonRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const detailBox: React.CSSProperties = {
  borderTop: "1px solid #edf1ee",
  paddingTop: 12,
  display: "grid",
  gap: 14,
};

const detailSection: React.CSSProperties = {
  display: "grid",
  gap: 6,
};

const detailTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#5b6d61",
};

const detailText: React.CSSProperties = {
  fontSize: 14,
  color: "#374151",
  lineHeight: 1.7,
};

const requestList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const requestCard: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 14,
  background: "#fafcfb",
  padding: 12,
  display: "grid",
  gap: 8,
};

const requestTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const requestTeamName: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#16391f",
};

const requestMeta: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#6b7280",
};

const requestComment: React.CSSProperties = {
  fontSize: 13,
  color: "#374151",
  lineHeight: 1.7,
  padding: "8px 10px",
  borderRadius: 10,
  background: "#fff",
  border: "1px solid #ececec",
};