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

function labelStatus(status: MatchRequestRow["status"]) {
  switch (status) {
    case "pending":
      return "申請中";
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

export default function ApplyingMatchesPage() {
  const [meId, setMeId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const [myTeams, setMyTeams] = useState<TeamRow[]>([]);
  const [requests, setRequests] = useState<MatchRequestRow[]>([]);
  const [slotMap, setSlotMap] = useState<Map<string, MatchSlotRow>>(new Map());
  const [teamMap, setTeamMap] = useState<Map<string, TeamRow>>(new Map());

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
        .eq("owner_id", meId);

      if (teamErr) {
        console.error(teamErr);
        setMyTeams([]);
        setRequests([]);
        setSlotMap(new Map());
        setTeamMap(new Map());
        setLoading(false);
        return;
      }

      const myTeamData = (teamRows ?? []) as TeamRow[];
      setMyTeams(myTeamData);

      const myTeamIds = myTeamData.map((t) => t.id).filter(Boolean);

      if (myTeamIds.length === 0) {
        setRequests([]);
        setSlotMap(new Map());
        setTeamMap(new Map());
        setLoading(false);
        return;
      }

      const { data: reqRows, error: reqErr } = await supabase
        .from("match_requests")
        .select(
          "id, slot_id, requester_team_id, requester_user_id, status, comment, created_at"
        )
        .in("requester_team_id", myTeamIds)
        .order("created_at", { ascending: false });

      if (reqErr) {
        console.error(reqErr);
        setRequests([]);
        setSlotMap(new Map());
        setTeamMap(new Map());
        setLoading(false);
        return;
      }

      const requestData = (reqRows ?? []) as MatchRequestRow[];
      setRequests(requestData);

      const slotIds = Array.from(new Set(requestData.map((r) => r.slot_id).filter(Boolean)));

      let slots: MatchSlotRow[] = [];
      if (slotIds.length > 0) {
        const { data: slotRows, error: slotErr } = await supabase
          .from("match_slots")
          .select(
            "id, owner_id, host_team_id, date, start_time, end_time, area, area_text, category, note, is_closed, created_at"
          )
          .in("id", slotIds);

        if (slotErr) {
          console.error(slotErr);
        } else {
          slots = (slotRows ?? []) as MatchSlotRow[];
        }
      }

      const slotMapNext = new Map<string, MatchSlotRow>();
      slots.forEach((s) => slotMapNext.set(s.id, s));
      setSlotMap(slotMapNext);

      const hostTeamIds = Array.from(new Set(slots.map((s) => s.host_team_id).filter(Boolean)));
      const allNeedTeamIds = Array.from(new Set([...myTeamIds, ...hostTeamIds]));

      if (allNeedTeamIds.length > 0) {
        const { data: allTeamsRows, error: allTeamsErr } = await supabase
          .from("teams")
          .select("id, owner_id, name, category")
          .in("id", allNeedTeamIds);

        if (allTeamsErr) {
          console.error(allTeamsErr);
          const fallback = new Map<string, TeamRow>();
          myTeamData.forEach((t) => fallback.set(t.id, t));
          setTeamMap(fallback);
        } else {
          const map = new Map<string, TeamRow>();
          ((allTeamsRows ?? []) as TeamRow[]).forEach((t) => map.set(t.id, t));
          setTeamMap(map);
        }
      }

      setLoading(false);
    })();
  }, [meId]);

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => {
      const aSlot = slotMap.get(a.slot_id);
      const bSlot = slotMap.get(b.slot_id);

      const aKey = `${aSlot?.date ?? ""} ${aSlot?.start_time ?? ""}`;
      const bKey = `${bSlot?.date ?? ""} ${bSlot?.start_time ?? ""}`;

      return aKey > bKey ? 1 : -1;
    });
  }, [requests, slotMap]);

  const countPending = useMemo(
    () => requests.filter((r) => r.status === "pending").length,
    [requests]
  );
  const countAccepted = useMemo(
    () => requests.filter((r) => r.status === "accepted").length,
    [requests]
  );
  const countRejected = useMemo(
    () => requests.filter((r) => r.status === "rejected").length,
    [requests]
  );
  const countCancelled = useMemo(
    () => requests.filter((r) => r.status === "cancelled").length,
    [requests]
  );

  const cancelRequest = async (requestId: string) => {
    if (!window.confirm("この申込を取り消しますか？")) return;

    const { error } = await supabase
      .from("match_requests")
      .update({ status: "cancelled" })
      .eq("id", requestId);

    if (error) {
      console.error(error);
      alert(`取消に失敗しました: ${error.message}`);
      return;
    }

    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: "cancelled" } : r))
    );
  };

  return (
    <main style={wrap}>
      <AppTabNav />
      <PageBackNav current="申請中の試合" />

      <AppHero
        icon="📝"
        title="申請中の試合"
        desc="あなたのチームが送った申込一覧です。結果確認や取り消しができます。"
      />

      <div style={summaryBox}>
        <div style={summaryItem}>
          <div style={summaryLabel}>申請中</div>
          <div style={summaryValue}>{countPending}</div>
        </div>
        <div style={summaryItem}>
          <div style={summaryLabel}>成立</div>
          <div style={summaryValue}>{countAccepted}</div>
        </div>
        <div style={summaryItem}>
          <div style={summaryLabel}>見送り</div>
          <div style={summaryValue}>{countRejected}</div>
        </div>
        <div style={summaryItem}>
          <div style={summaryLabel}>取消</div>
          <div style={summaryValue}>{countCancelled}</div>
        </div>
      </div>

      <div style={topActionRow}>
        <Link href="/match" className="sh-btn">
          募集一覧へ
        </Link>
      </div>

      {loading ? <div style={infoText}>読み込み中…</div> : null}

      {!loading && myTeams.length === 0 ? (
        <div style={emptyBox}>自分のチームがまだ登録されていません。</div>
      ) : null}

      {!loading && myTeams.length > 0 && sortedRequests.length === 0 ? (
        <div style={emptyBox}>現在、申請中の試合はありません。</div>
      ) : null}

      {!loading && sortedRequests.length > 0 ? (
        <div style={listWrap}>
          {sortedRequests.map((req) => {
            const slot = slotMap.get(req.slot_id);
            const myTeam = teamMap.get(req.requester_team_id);
            const hostTeam = slot ? teamMap.get(slot.host_team_id) : null;
            const expanded = openDetailId === req.id;

            return (
              <div key={req.id} style={card}>
                <div style={cardHead}>
                  <div style={{ minWidth: 0 }}>
                    <div style={cardTitleRow}>
                      <div style={teamName}>
                        {hostTeam?.name ?? "相手チーム未設定"}
                      </div>

                      <span
                        style={{
                          ...statusBadge,
                          ...statusStyle(req.status),
                        }}
                      >
                        {labelStatus(req.status)}
                      </span>
                    </div>

                    <div style={metaText}>
                      📅 {fmtDate(slot?.date)} {fmtTime(slot?.start_time)}–{fmtTime(slot?.end_time)}
                    </div>
                    <div style={metaText}>
                      📍 {slot?.area_text ?? slot?.area ?? "未設定"}
                    </div>
                    <div style={metaText}>
                      🏷 {slot?.category ?? hostTeam?.category ?? "未設定"}
                    </div>
                  </div>
                </div>

                <div style={buttonRow}>
                  <button
                    type="button"
                    className="sh-btn"
                    onClick={() => setOpenDetailId(expanded ? "" : req.id)}
                  >
                    {expanded ? "詳細を閉じる" : "詳細"}
                  </button>

                  <Link href="/chat" className="sh-btn sh-btn--primary">
                    チャット
                  </Link>

                  {req.status === "pending" ? (
                    <button
                      type="button"
                      className="sh-btn"
                      onClick={() => cancelRequest(req.id)}
                    >
                      申込取消
                    </button>
                  ) : null}
                </div>

                {expanded ? (
                  <div style={detailBox}>
                    <div style={detailSection}>
                      <div style={detailTitle}>申込チーム</div>
                      <div style={detailText}>
                        {myTeam?.name ?? "自チーム未設定"}
                      </div>
                    </div>

                    <div style={detailSection}>
                      <div style={detailTitle}>申込コメント</div>
                      <div style={detailText}>
                        {req.comment?.trim() ? req.comment : "未入力"}
                      </div>
                    </div>

                    <div style={detailSection}>
                      <div style={detailTitle}>相手募集メモ</div>
                      <div style={detailText}>
                        {slot?.note?.trim() ? slot.note : "未入力"}
                      </div>
                    </div>

                    <div style={detailSection}>
                      <div style={detailTitle}>申込日時</div>
                      <div style={detailText}>{toJst(req.created_at)}</div>
                    </div>

                    {slot?.created_at ? (
                      <div style={detailSection}>
                        <div style={detailTitle}>募集作成日時</div>
                        <div style={detailText}>{toJst(slot.created_at)}</div>
                      </div>
                    ) : null}
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

function statusStyle(status: MatchRequestRow["status"]): React.CSSProperties {
  switch (status) {
    case "pending":
      return {
        background: "#dbeafe",
        color: "#1d4ed8",
      };
    case "accepted":
      return {
        background: "#dcfce7",
        color: "#166534",
      };
    case "rejected":
      return {
        background: "#fee2e2",
        color: "#991b1b",
      };
    case "cancelled":
      return {
        background: "#f3f4f6",
        color: "#4b5563",
      };
    default:
      return {
        background: "#f3f4f6",
        color: "#4b5563",
      };
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
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
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

const metaText: React.CSSProperties = {
  marginTop: 6,
  color: "#666",
  lineHeight: 1.7,
  fontSize: 14,
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