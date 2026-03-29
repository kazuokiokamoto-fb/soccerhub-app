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

type OfferRow = {
  id: string;
  slot_id: string | null;
  from_team_id: string;
  to_team_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  message: string | null;
  created_at: string;
};

type ConfirmedMatchDetail = {
  key: string;
  kind: "request" | "offer";
  relation:
    | "my_request_accepted"
    | "my_slot_request_accepted"
    | "my_offer_accepted"
    | "received_offer_accepted";
  slot: SlotRow;
  myTeam: TeamRow | null;
  opponentTeam: TeamRow | null;
  request: RequestRow | null;
  offer: OfferRow | null;
  noteText: string;
};

function fmtDate(ymd?: string | null) {
  if (!ymd) return "";
  return ymd;
}

function fmtTime(v?: string | null) {
  if (!v) return "";
  return String(v).slice(0, 5);
}

function formatDateTime(
  date?: string | null,
  start?: string | null,
  end?: string | null
) {
  if (!date) return "未設定";
  const s = fmtTime(start);
  const e = fmtTime(end);
  return `${date}${s ? ` ${s}` : ""}${e ? `–${e}` : ""}`;
}

function toDateTimeMs(date?: string | null, time?: string | null) {
  if (!date || !time) return 0;
  return new Date(`${date}T${time}`).getTime();
}

function relationLabel(relation: ConfirmedMatchDetail["relation"]) {
  switch (relation) {
    case "my_request_accepted":
      return "自分の申込が承認";
    case "my_slot_request_accepted":
      return "自分の募集で成立";
    case "my_offer_accepted":
      return "自分のオファーが承認";
    case "received_offer_accepted":
      return "届いたオファーを承認";
    default:
      return "成立済み";
  }
}

function categoryText(v?: string | null) {
  return v || "未設定";
}

export default function NextMatchPage() {
  const [meId, setMeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<ConfirmedMatchDetail[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMeId(data?.user?.id ?? "");
    })();
  }, []);

  useEffect(() => {
    if (!meId) {
      setLoading(false);
      setMatches([]);
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
        setMatches([]);
        setLoading(false);
        return;
      }

      const myTeams = (myTeamsRows ?? []) as TeamRow[];
      const myTeamIds = myTeams.map((t) => t.id).filter(Boolean);

      if (myTeamIds.length === 0) {
        setMatches([]);
        setLoading(false);
        return;
      }

      const { data: myHostedSlotsRows, error: myHostedSlotsErr } = await supabase
        .from("match_slots")
        .select(
          "id, host_team_id, date, start_time, end_time, area, area_text, category, is_closed, created_at"
        )
        .in("host_team_id", myTeamIds);

      if (myHostedSlotsErr) {
        console.error(myHostedSlotsErr);
        setMatches([]);
        setLoading(false);
        return;
      }

      const myHostedSlots = (myHostedSlotsRows ?? []) as SlotRow[];
      const myHostedSlotIds = myHostedSlots.map((s) => s.id).filter(Boolean);

      const [
        acceptedOutgoingRequestsRes,
        acceptedIncomingRequestsRes,
        acceptedSentOffersRes,
        acceptedReceivedOffersRes,
      ] = await Promise.all([
        supabase
          .from("match_requests")
          .select(
            "id, slot_id, requester_team_id, requester_user_id, status, comment, created_at"
          )
          .in("requester_team_id", myTeamIds)
          .eq("status", "accepted"),
        myHostedSlotIds.length > 0
          ? supabase
              .from("match_requests")
              .select(
                "id, slot_id, requester_team_id, requester_user_id, status, comment, created_at"
              )
              .in("slot_id", myHostedSlotIds)
              .eq("status", "accepted")
          : Promise.resolve({ data: [], error: null } as any),
        supabase
          .from("match_offers")
          .select(
            "id, slot_id, from_team_id, to_team_id, status, message, created_at"
          )
          .in("from_team_id", myTeamIds)
          .eq("status", "accepted"),
        supabase
          .from("match_offers")
          .select(
            "id, slot_id, from_team_id, to_team_id, status, message, created_at"
          )
          .in("to_team_id", myTeamIds)
          .eq("status", "accepted"),
      ]);

      if (acceptedOutgoingRequestsRes.error) {
        console.error(acceptedOutgoingRequestsRes.error);
      }
      if (acceptedIncomingRequestsRes.error) {
        console.error(acceptedIncomingRequestsRes.error);
      }
      if (acceptedSentOffersRes.error) {
        console.error(acceptedSentOffersRes.error);
      }
      if (acceptedReceivedOffersRes.error) {
        console.error(acceptedReceivedOffersRes.error);
      }

      const acceptedOutgoingRequests = (acceptedOutgoingRequestsRes.data ??
        []) as RequestRow[];
      const acceptedIncomingRequests = (acceptedIncomingRequestsRes.data ??
        []) as RequestRow[];
      const acceptedSentOffers = (acceptedSentOffersRes.data ?? []) as OfferRow[];
      const acceptedReceivedOffers = (acceptedReceivedOffersRes.data ??
        []) as OfferRow[];

      const slotIds = Array.from(
        new Set(
          [
            ...acceptedOutgoingRequests.map((r) => r.slot_id),
            ...acceptedIncomingRequests.map((r) => r.slot_id),
            ...acceptedSentOffers.map((o) => o.slot_id).filter(Boolean),
            ...acceptedReceivedOffers.map((o) => o.slot_id).filter(Boolean),
          ].filter(Boolean)
        )
      ) as string[];

      if (slotIds.length === 0) {
        setMatches([]);
        setLoading(false);
        return;
      }

      const { data: slotRows, error: slotErr } = await supabase
        .from("match_slots")
        .select(
          "id, host_team_id, date, start_time, end_time, area, area_text, category, is_closed, created_at"
        )
        .in("id", slotIds)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (slotErr) {
        console.error(slotErr);
        setMatches([]);
        setLoading(false);
        return;
      }

      const slots = (slotRows ?? []) as SlotRow[];
      const slotMap = new Map<string, SlotRow>();
      slots.forEach((s) => slotMap.set(s.id, s));

      const allRelatedTeamIds = Array.from(
        new Set(
          [
            ...myTeamIds,
            ...slots.map((s) => s.host_team_id),
            ...acceptedOutgoingRequests.map((r) => r.requester_team_id),
            ...acceptedIncomingRequests.map((r) => r.requester_team_id),
            ...acceptedSentOffers.map((o) => o.from_team_id),
            ...acceptedSentOffers.map((o) => o.to_team_id),
            ...acceptedReceivedOffers.map((o) => o.from_team_id),
            ...acceptedReceivedOffers.map((o) => o.to_team_id),
          ].filter(Boolean)
        )
      );

      const { data: teamRows, error: teamErr } = await supabase
        .from("teams")
        .select("id, owner_id, name, category")
        .in("id", allRelatedTeamIds);

      if (teamErr) {
        console.error(teamErr);
      }

      const teamMap = new Map<string, TeamRow>();
      ((teamRows ?? []) as TeamRow[]).forEach((t) => teamMap.set(t.id, t));

      const nowMs = Date.now();
      const collected: ConfirmedMatchDetail[] = [];

      for (const req of acceptedOutgoingRequests) {
        const slot = slotMap.get(req.slot_id);
        if (!slot) continue;
        if (toDateTimeMs(slot.date, slot.start_time) < nowMs) continue;

        collected.push({
          key: `request:outgoing:${req.id}`,
          kind: "request",
          relation: "my_request_accepted",
          slot,
          request: req,
          offer: null,
          myTeam: teamMap.get(req.requester_team_id) ?? null,
          opponentTeam: teamMap.get(slot.host_team_id) ?? null,
          noteText: req.comment?.trim() || "",
        });
      }

      for (const req of acceptedIncomingRequests) {
        const slot = slotMap.get(req.slot_id);
        if (!slot) continue;
        if (toDateTimeMs(slot.date, slot.start_time) < nowMs) continue;

        collected.push({
          key: `request:incoming:${req.id}`,
          kind: "request",
          relation: "my_slot_request_accepted",
          slot,
          request: req,
          offer: null,
          myTeam: teamMap.get(slot.host_team_id) ?? null,
          opponentTeam: teamMap.get(req.requester_team_id) ?? null,
          noteText: req.comment?.trim() || "",
        });
      }

      for (const offer of acceptedSentOffers) {
        if (!offer.slot_id) continue;
        const slot = slotMap.get(offer.slot_id);
        if (!slot) continue;
        if (toDateTimeMs(slot.date, slot.start_time) < nowMs) continue;

        collected.push({
          key: `offer:sent:${offer.id}`,
          kind: "offer",
          relation: "my_offer_accepted",
          slot,
          request: null,
          offer,
          myTeam: teamMap.get(offer.from_team_id) ?? null,
          opponentTeam: teamMap.get(offer.to_team_id) ?? null,
          noteText: offer.message?.trim() || "",
        });
      }

      for (const offer of acceptedReceivedOffers) {
        if (!offer.slot_id) continue;
        const slot = slotMap.get(offer.slot_id);
        if (!slot) continue;
        if (toDateTimeMs(slot.date, slot.start_time) < nowMs) continue;

        collected.push({
          key: `offer:received:${offer.id}`,
          kind: "offer",
          relation: "received_offer_accepted",
          slot,
          request: null,
          offer,
          myTeam: teamMap.get(offer.to_team_id) ?? null,
          opponentTeam: teamMap.get(offer.from_team_id) ?? null,
          noteText: offer.message?.trim() || "",
        });
      }

      collected.sort((a, b) => {
        const aMs = toDateTimeMs(a.slot.date, a.slot.start_time);
        const bMs = toDateTimeMs(b.slot.date, b.slot.start_time);
        if (aMs !== bMs) return aMs - bMs;
        return a.key.localeCompare(b.key);
      });

      setMatches(collected);
      setLoading(false);
    })();
  }, [meId]);

  const nextMatch = useMemo(() => {
    return matches.length > 0 ? matches[0] : null;
  }, [matches]);

  return (
    <main style={wrap}>
      <AppTabNav />

      <div style={topRow}>
        <Link href="/" className="sh-btn">
          ← 戻る
        </Link>
      </div>

      <section style={hero}>
        <div style={heroTitle}>成立した試合一覧</div>
        <div style={heroDesc}>
          これから予定されている成立済みの試合を確認できます。
        </div>
      </section>

      {loading ? <div style={loadingText}>読み込み中…</div> : null}

      {!loading && matches.length === 0 ? (
        <div style={emptyBox}>予定されている成立試合はまだありません。</div>
      ) : null}

      {!loading && nextMatch ? (
        <section style={highlightCard}>
          <div style={highlightBadge}>最も近い次の試合</div>
          <div style={highlightTitle}>
            {fmtDate(nextMatch.slot.date)} {fmtTime(nextMatch.slot.start_time)}
          </div>

          <div style={infoGrid}>
            <InfoItem
              label="日時"
              value={formatDateTime(
                nextMatch.slot.date,
                nextMatch.slot.start_time,
                nextMatch.slot.end_time
              )}
            />
            <InfoItem
              label="カテゴリ"
              value={categoryText(nextMatch.slot.category)}
            />
            <InfoItem
              label="場所"
              value={nextMatch.slot.area_text ?? nextMatch.slot.area ?? "未設定"}
            />
            <InfoItem
              label="自分のチーム"
              value={
                nextMatch.myTeam
                  ? `${nextMatch.myTeam.name ?? "未設定"}${
                      nextMatch.myTeam.category
                        ? `（${nextMatch.myTeam.category}）`
                        : ""
                    }`
                  : "未設定"
              }
            />
            <InfoItem
              label="相手チーム"
              value={
                nextMatch.opponentTeam
                  ? `${nextMatch.opponentTeam.name ?? "未設定"}${
                      nextMatch.opponentTeam.category
                        ? `（${nextMatch.opponentTeam.category}）`
                        : ""
                    }`
                  : "未設定"
              }
            />
            <InfoItem label="成立経路" value={relationLabel(nextMatch.relation)} />
          </div>

          <div style={commentBox}>
            <div style={commentLabel}>
              {nextMatch.kind === "request" ? "申込コメント" : "オファーメッセージ"}
            </div>
            <div style={commentText}>
              {nextMatch.noteText || "コメントはありません"}
            </div>
          </div>

          <div style={buttonRow}>
            <Link href="/chat" className="sh-btn sh-btn--primary">
              チャットへ
            </Link>
            <Link href="/match/status/offers" className="sh-btn">
              オファー一覧へ
            </Link>
          </div>
        </section>
      ) : null}

      {!loading && matches.length > 0 ? (
        <section style={listCard}>
          <div style={listTitle}>成立している試合一覧</div>

          <div style={matchList}>
            {matches.map((item, index) => (
              <div key={item.key} style={matchRow}>
                <div style={matchRowTop}>
                  <div>
                    <div style={matchDateTime}>
                      {formatDateTime(
                        item.slot.date,
                        item.slot.start_time,
                        item.slot.end_time
                      )}
                    </div>
                    <div style={matchMeta}>
                      {item.slot.area_text ?? item.slot.area ?? "未設定"} /{" "}
                      {categoryText(item.slot.category)}
                    </div>
                  </div>

                  {index === 0 ? (
                    <span style={smallSuccessBadge}>次の試合</span>
                  ) : (
                    <span style={smallBadge}>{relationLabel(item.relation)}</span>
                  )}
                </div>

                <div style={teamsGrid}>
                  <InfoItem
                    label="自分のチーム"
                    value={
                      item.myTeam
                        ? `${item.myTeam.name ?? "未設定"}${
                            item.myTeam.category
                              ? `（${item.myTeam.category}）`
                              : ""
                          }`
                        : "未設定"
                    }
                  />
                  <InfoItem
                    label="相手チーム"
                    value={
                      item.opponentTeam
                        ? `${item.opponentTeam.name ?? "未設定"}${
                            item.opponentTeam.category
                              ? `（${item.opponentTeam.category}）`
                              : ""
                          }`
                        : "未設定"
                    }
                  />
                </div>

                <div style={miniNoteBox}>
                  <div style={miniNoteLabel}>
                    {item.kind === "request"
                      ? "申込コメント"
                      : "オファーメッセージ"}
                  </div>
                  <div style={miniNoteText}>
                    {item.noteText || "コメントはありません"}
                  </div>
                </div>
              </div>
            ))}
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
  textAlign: "center",
};

const highlightCard: React.CSSProperties = {
  marginTop: 14,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #d7ebdc",
  background: "#fff",
};

const highlightBadge: React.CSSProperties = {
  display: "inline-block",
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 900,
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
};

const highlightTitle: React.CSSProperties = {
  marginTop: 10,
  fontSize: 24,
  fontWeight: 900,
  color: "#16391f",
};

const listCard: React.CSSProperties = {
  marginTop: 14,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
};

const listTitle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#16391f",
};

const matchList: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gap: 12,
};

const matchRow: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 14,
  background: "#fafcfb",
  padding: 14,
};

const matchRowTop: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  alignItems: "flex-start",
  flexWrap: "wrap",
};

const matchDateTime: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
};

const matchMeta: React.CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  color: "#666",
  lineHeight: 1.6,
};

const teamsGrid: React.CSSProperties = {
  marginTop: 12,
  display: "grid",
  gap: 10,
};

const smallBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 999,
  background: "#eef2ff",
  color: "#4338ca",
  fontSize: 12,
  fontWeight: 900,
};

const smallSuccessBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 28,
  padding: "0 10px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontSize: 12,
  fontWeight: 900,
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
  whiteSpace: "pre-wrap",
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
  whiteSpace: "pre-wrap",
};

const miniNoteBox: React.CSSProperties = {
  marginTop: 12,
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fff",
  padding: "10px 12px",
};

const miniNoteLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#5b6d61",
  marginBottom: 4,
};

const miniNoteText: React.CSSProperties = {
  fontSize: 14,
  color: "#2d3b31",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap",
};

const buttonRow: React.CSSProperties = {
  marginTop: 14,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};