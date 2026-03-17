"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import AppTabNav from "@/app/components/AppTabNav";

type TeamRow = {
  id: string;
  owner_id: string | null;
  name: string | null;
  category: string | null;
};

type SlotRow = {
  id: string;
  host_team_id: string;
  date: string;
  start_time: string;
  end_time: string;
  area: string | null;
  area_text?: string | null;
  category: string | null;
  is_closed: boolean | null;
  created_at: string;
};

type RequestRow = {
  id: string;
  slot_id: string;
  requester_team_id: string;
  requester_user_id: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  comment: string | null;
  created_at: string;
};

type NextMatchDetail = {
  slot: SlotRow;
  request: RequestRow;
  myTeam: TeamRow | null;
  hostTeam: TeamRow | null;
};

function fmtDate(ymd?: string | null) {
  if (!ymd) return "";
  return ymd;
}

function fmtTime(v?: string | null) {
  if (!v) return "";
  return String(v).slice(0, 5);
}

function formatDateTime(date?: string | null, start?: string | null, end?: string | null) {
  if (!date) return "未設定";
  const s = fmtTime(start);
  const e = fmtTime(end);
  return `${date}${s ? ` ${s}` : ""}${e ? `–${e}` : ""}`;
}

export default function NextMatchPage() {
  const [meId, setMeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<NextMatchDetail | null>(null);

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

      const { data: myTeamsRows, error: myTeamsErr } = await supabase
        .from("teams")
        .select("id, owner_id, name, category")
        .eq("owner_id", meId);

      if (myTeamsErr) {
        console.error(myTeamsErr);
        setDetail(null);
        setLoading(false);
        return;
      }

      const myTeams = (myTeamsRows ?? []) as TeamRow[];
      const myTeamIds = myTeams.map((t) => t.id).filter(Boolean);

      if (myTeamIds.length === 0) {
        setDetail(null);
        setLoading(false);
        return;
      }

      const { data: acceptedRequestsRows, error: reqErr } = await supabase
        .from("match_requests")
        .select("id, slot_id, requester_team_id, requester_user_id, status, comment, created_at")
        .in("requester_team_id", myTeamIds)
        .eq("status", "accepted")
        .order("created_at", { ascending: false });

      if (reqErr) {
        console.error(reqErr);
        setDetail(null);
        setLoading(false);
        return;
      }

      const acceptedRequests = (acceptedRequestsRows ?? []) as RequestRow[];
      const slotIds = Array.from(new Set(acceptedRequests.map((r) => r.slot_id).filter(Boolean)));

      if (slotIds.length === 0) {
        setDetail(null);
        setLoading(false);
        return;
      }

      const { data: slotRows, error: slotErr } = await supabase
        .from("match_slots")
        .select("id, host_team_id, date, start_time, end_time, area, area_text, category, is_closed, created_at")
        .in("id", slotIds)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (slotErr) {
        console.error(slotErr);
        setDetail(null);
        setLoading(false);
        return;
      }

      const slots = (slotRows ?? []) as SlotRow[];
      const now = new Date();

      const futurePairs = acceptedRequests
        .map((req) => {
          const slot = slots.find((s) => s.id === req.slot_id);
          if (!slot) return null;
          return { req, slot };
        })
        .filter(Boolean)
        .filter((x: any) => {
          const dt = new Date(`${x.slot.date}T${x.slot.start_time}`);
          return dt.getTime() >= now.getTime();
        }) as Array<{ req: RequestRow; slot: SlotRow }>;

      futurePairs.sort((a, b) => {
        const ad = new Date(`${a.slot.date}T${a.slot.start_time}`).getTime();
        const bd = new Date(`${b.slot.date}T${b.slot.start_time}`).getTime();
        return ad - bd;
      });

      if (futurePairs.length === 0) {
        setDetail(null);
        setLoading(false);
        return;
      }

      const target = futurePairs[0];
      const teamIds = Array.from(
        new Set([target.req.requester_team_id, target.slot.host_team_id].filter(Boolean))
      );

      const { data: teamRows, error: teamErr } = await supabase
        .from("teams")
        .select("id, owner_id, name, category")
        .in("id", teamIds);

      if (teamErr) {
        console.error(teamErr);
      }

      const teamMap = new Map<string, TeamRow>();
      for (const t of ((teamRows ?? []) as TeamRow[])) {
        teamMap.set(t.id, t);
      }

      setDetail({
        slot: target.slot,
        request: target.req,
        myTeam: teamMap.get(target.req.requester_team_id) ?? null,
        hostTeam: teamMap.get(target.slot.host_team_id) ?? null,
      });

      setLoading(false);
    })();
  }, [meId]);

  const titleText = useMemo(() => {
    if (!detail) return "次の試合";
    return `${fmtDate(detail.slot.date)} ${fmtTime(detail.slot.start_time)}`;
  }, [detail]);

  return (
    <main style={wrap}>
      <AppTabNav />

      <div style={topRow}>
        <Link href="/" className="sh-btn">
          ← 戻る
        </Link>
      </div>

      <section style={hero}>
        <div style={heroTitle}>次の試合</div>
        <div style={heroDesc}>
          直近で成立している試合予定を確認できます。
        </div>
      </section>

      {loading ? <div style={loadingText}>読み込み中…</div> : null}

      {!loading && !detail ? (
        <div style={emptyBox}>
          予定されている次の試合はまだありません。
        </div>
      ) : null}

      {!loading && detail ? (
        <section style={card}>
          <div style={mainTitle}>{titleText}</div>

          <div style={infoGrid}>
            <InfoItem
              label="日時"
              value={formatDateTime(
                detail.slot.date,
                detail.slot.start_time,
                detail.slot.end_time
              )}
            />
            <InfoItem
              label="カテゴリ"
              value={detail.slot.category ?? "未設定"}
            />
            <InfoItem
              label="場所"
              value={detail.slot.area_text ?? detail.slot.area ?? "未設定"}
            />
            <InfoItem
              label="自分のチーム"
              value={
                detail.myTeam
                  ? `${detail.myTeam.name ?? "未設定"}${detail.myTeam.category ? `（${detail.myTeam.category}）` : ""}`
                  : "未設定"
              }
            />
            <InfoItem
              label="相手チーム"
              value={
                detail.hostTeam
                  ? `${detail.hostTeam.name ?? "未設定"}${detail.hostTeam.category ? `（${detail.hostTeam.category}）` : ""}`
                  : "未設定"
              }
            />
            <InfoItem
              label="状態"
              value="成立済み"
            />
          </div>

          <div style={commentBox}>
            <div style={commentLabel}>申込コメント</div>
            <div style={commentText}>
              {detail.request.comment?.trim() || "コメントはありません"}
            </div>
          </div>

          <div style={buttonRow}>
            <Link href="/chat" className="sh-btn sh-btn--primary">
              チャットへ
            </Link>

            <Link href="/match/status/applying" className="sh-btn">
              申込一覧を見る
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function InfoItem(props: { label: string; value: string }) {
  return (
    <div style={infoBox}>
      <div style={infoLabel}>{props.label}</div>
      <div style={infoValue}>{props.value}</div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
};

const topRow: React.CSSProperties = {
  marginTop: 8,
  marginBottom: 10,
};

const hero: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 16,
  background: "#fff",
  padding: 16,
};

const heroTitle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#16391f",
};

const heroDesc: React.CSSProperties = {
  marginTop: 8,
  color: "#55635a",
  lineHeight: 1.7,
};

const loadingText: React.CSSProperties = {
  marginTop: 14,
  color: "#666",
};

const emptyBox: React.CSSProperties = {
  marginTop: 14,
  padding: 20,
  borderRadius: 16,
  border: "1px solid #eee",
  background: "#fff",
  color: "#777",
  textAlign: "center" as const,
};

const card: React.CSSProperties = {
  marginTop: 14,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
};

const mainTitle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#16391f",
};

const infoGrid: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gap: 10,
};

const infoBox: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
  padding: "10px 12px",
};

const infoLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
  marginBottom: 4,
};

const infoValue: React.CSSProperties = {
  fontSize: 14,
  color: "#2d3b31",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap" as const,
};

const commentBox: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
  padding: "10px 12px",
};

const commentLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
  marginBottom: 4,
};

const commentText: React.CSSProperties = {
  fontSize: 14,
  color: "#2d3b31",
  lineHeight: 1.8,
  whiteSpace: "pre-wrap" as const,
};

const buttonRow: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  gap: 8,
  flexWrap: "wrap" as const,
};