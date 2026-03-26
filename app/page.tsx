"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "./lib/supabase";
import AppTabNav from "@/app/components/AppTabNav";

type TeamRow = {
  id: string;
  owner_id: string | null;
  name: string | null;
  category: string | null;
};

type MatchSlotRow = {
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

type MatchRequestRow = {
  id: string;
  slot_id: string;
  requester_team_id: string;
  requester_user_id: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  comment: string | null;
  created_at: string;
};

type MatchOfferRow = {
  id: string;
  slot_id: string | null;
  from_user_id?: string | null;
  from_team_id: string;
  to_team_id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  message: string | null;
  created_at: string;
};

type ChatMemberRow = {
  thread_id: string;
  last_read_at: string | null;
};

type ChatMessageRow = {
  id: string;
  thread_id: string;
  body: string | null;
  created_at: string;
};

type NextMatchCard = {
  date: string;
  start_time: string;
  end_time: string;
  area: string | null;
  area_text?: string | null;
  category: string | null;
  slot_id: string;
};

function fmtDate(ymd?: string | null) {
  if (!ymd) return "";
  return ymd;
}

function fmtTime(v?: string | null) {
  if (!v) return "";
  return String(v).slice(0, 5);
}

function toDateTimeMs(date?: string | null, time?: string | null) {
  if (!date || !time) return 0;
  const dt = new Date(`${date}T${time}`);
  return dt.getTime();
}

export default function HomePage() {
  const [meId, setMeId] = useState("");
  const [loading, setLoading] = useState(true);

  const [myTeams, setMyTeams] = useState<TeamRow[]>([]);

  const [openCount, setOpenCount] = useState(0);
  const [receivedOfferCount, setReceivedOfferCount] = useState(0);
  const [sentOfferCount, setSentOfferCount] = useState(0);

  const [unreadTotal, setUnreadTotal] = useState(0);
  const [nextMatch, setNextMatch] = useState<NextMatchCard | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMeId(data?.user?.id ?? "");
    })();
  }, []);

  const loadHome = useCallback(async () => {
    if (!meId) {
      setLoading(false);
      setMyTeams([]);
      setOpenCount(0);
      setReceivedOfferCount(0);
      setSentOfferCount(0);
      setUnreadTotal(0);
      setNextMatch(null);
      return;
    }

    setLoading(true);

    const { data: teamRows, error: teamErr } = await supabase
      .from("teams")
      .select("id, owner_id, name, category")
      .eq("owner_id", meId);

    if (teamErr) {
      console.error(teamErr);
      setLoading(false);
      return;
    }

    const myTeamData = (teamRows ?? []) as TeamRow[];
    setMyTeams(myTeamData);

    const myTeamIds = myTeamData.map((t) => t.id).filter(Boolean);

    if (myTeamIds.length === 0) {
      setOpenCount(0);
      setReceivedOfferCount(0);
      setSentOfferCount(0);
      setUnreadTotal(0);
      setNextMatch(null);
      setLoading(false);
      return;
    }

    const { data: mySlots, error: slotErr } = await supabase
      .from("match_slots")
      .select(
        "id, host_team_id, date, start_time, end_time, area, area_text, category, is_closed, created_at"
      )
      .in("host_team_id", myTeamIds);

    if (slotErr) {
      console.error(slotErr);
    }

    const mySlotRows = (mySlots ?? []) as MatchSlotRow[];
    const mySlotIds = mySlotRows.map((s) => s.id).filter(Boolean);

    setOpenCount(mySlotRows.filter((s) => !s.is_closed).length);

    const { data: outgoingRequests, error: outgoingReqErr } = await supabase
      .from("match_requests")
      .select(
        "id, slot_id, requester_team_id, requester_user_id, status, comment, created_at"
      )
      .in("requester_team_id", myTeamIds);

    if (outgoingReqErr) {
      console.error(outgoingReqErr);
    }

    const outgoingRequestRows = (outgoingRequests ?? []) as MatchRequestRow[];

    let incomingRequestRows: MatchRequestRow[] = [];
    if (mySlotIds.length > 0) {
      const { data: incomingRequests, error: incomingReqErr } = await supabase
        .from("match_requests")
        .select(
          "id, slot_id, requester_team_id, requester_user_id, status, comment, created_at"
        )
        .in("slot_id", mySlotIds);

      if (incomingReqErr) {
        console.error(incomingReqErr);
      } else {
        incomingRequestRows = (incomingRequests ?? []) as MatchRequestRow[];
      }
    }

    const { data: sentOffers, error: sentOffersErr } = await supabase
      .from("match_offers")
      .select(
        "id, slot_id, from_user_id, from_team_id, to_team_id, status, message, created_at"
      )
      .in("from_team_id", myTeamIds);

    if (sentOffersErr) {
      console.error("sentOffers error:", sentOffersErr);
    }

    const sentOfferRows = (sentOffers ?? []) as MatchOfferRow[];

    const { data: receivedOffers, error: receivedOffersErr } = await supabase
      .from("match_offers")
      .select(
        "id, slot_id, from_user_id, from_team_id, to_team_id, status, message, created_at"
      )
      .in("to_team_id", myTeamIds);

    if (receivedOffersErr) {
      console.error("receivedOffers error:", receivedOffersErr);
    }

    const receivedOfferRows = (receivedOffers ?? []) as MatchOfferRow[];

    const pendingReceivedOffers =
      receivedOfferRows.filter((o) => o.status === "pending").length +
      incomingRequestRows.filter(
        (r) =>
          r.status === "pending" &&
          !myTeamIds.includes(r.requester_team_id)
      ).length;

    const pendingSentOffers =
      sentOfferRows.filter((o) => o.status === "pending").length +
      outgoingRequestRows.filter((r) => r.status === "pending").length;

    setReceivedOfferCount(pendingReceivedOffers);
    setSentOfferCount(pendingSentOffers);

    const { data: memberRows, error: memberErr } = await supabase
      .from("chat_members")
      .select("thread_id,last_read_at")
      .eq("user_id", meId);

    if (memberErr) {
      console.error(memberErr);
    }

    const myMemberRows = (memberRows ?? []) as ChatMemberRow[];
    const threadIds = myMemberRows.map((r) => r.thread_id).filter(Boolean);

    if (threadIds.length > 0) {
      const { data: msgRows, error: msgErr } = await supabase
        .from("chat_messages")
        .select("id,thread_id,body,created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false })
        .limit(2000);

      if (msgErr) {
        console.error(msgErr);
      }

      const messages = (msgRows ?? []) as ChatMessageRow[];
      const latestByThread = new Map<string, ChatMessageRow>();

      for (const m of messages) {
        if (!latestByThread.has(m.thread_id)) {
          latestByThread.set(m.thread_id, m);
        }
      }

      let unread = 0;
      for (const member of myMemberRows) {
        const last = latestByThread.get(member.thread_id);
        if (!last?.created_at) continue;

        if (!member.last_read_at) {
          unread += 1;
          continue;
        }

        if (
          new Date(last.created_at).getTime() >
          new Date(member.last_read_at).getTime()
        ) {
          unread += 1;
        }
      }

      setUnreadTotal(unread);
    } else {
      setUnreadTotal(0);
    }

    const acceptedOutgoingRequestSlotIds = outgoingRequestRows
      .filter((r) => r.status === "accepted")
      .map((r) => r.slot_id);

    const acceptedIncomingRequestSlotIds = incomingRequestRows
      .filter((r) => r.status === "accepted")
      .map((r) => r.slot_id);

    const acceptedReceivedOfferSlotIds = receivedOfferRows
      .filter((o) => o.status === "accepted" && o.slot_id)
      .map((o) => o.slot_id as string);

    const acceptedSentOfferSlotIds = sentOfferRows
      .filter((o) => o.status === "accepted" && o.slot_id)
      .map((o) => o.slot_id as string);

    const mergedAcceptedSlotIds = Array.from(
      new Set([
        ...acceptedOutgoingRequestSlotIds,
        ...acceptedIncomingRequestSlotIds,
        ...acceptedReceivedOfferSlotIds,
        ...acceptedSentOfferSlotIds,
      ].filter(Boolean))
    );

    if (mergedAcceptedSlotIds.length > 0) {
      const { data: acceptedSlots, error: acceptedSlotsErr } = await supabase
        .from("match_slots")
        .select(
          "id, host_team_id, date, start_time, end_time, area, area_text, category, is_closed, created_at"
        )
        .in("id", mergedAcceptedSlotIds)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (acceptedSlotsErr) {
        console.error(acceptedSlotsErr);
      }

      const now = Date.now();
      const futureSlots = ((acceptedSlots ?? []) as MatchSlotRow[])
        .filter((s) => toDateTimeMs(s.date, s.start_time) >= now)
        .sort((a, b) => {
          const aMs = toDateTimeMs(a.date, a.start_time);
          const bMs = toDateTimeMs(b.date, b.start_time);
          return aMs - bMs;
        });

      if (futureSlots.length > 0) {
        const s = futureSlots[0];
        setNextMatch({
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time,
          area: s.area,
          area_text: s.area_text,
          category: s.category,
          slot_id: s.id,
        });
      } else {
        setNextMatch(null);
      }
    } else {
      setNextMatch(null);
    }

    setLoading(false);
  }, [meId]);

  useEffect(() => {
    if (!meId) {
      setLoading(false);
      return;
    }
    loadHome();
  }, [meId, loadHome]);

  useEffect(() => {
    if (!meId) return;

    const channels = [
      supabase
        .channel(`home-match-requests:${meId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "match_requests" },
          () => {
            loadHome();
          }
        )
        .subscribe(),

      supabase
        .channel(`home-match-offers:${meId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "match_offers" },
          () => {
            loadHome();
          }
        )
        .subscribe(),

      supabase
        .channel(`home-match-slots:${meId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "match_slots" },
          () => {
            loadHome();
          }
        )
        .subscribe(),

      supabase
        .channel(`home-chat-messages:${meId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "chat_messages" },
          () => {
            loadHome();
          }
        )
        .subscribe(),

      supabase
        .channel(`home-chat-members:${meId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "chat_members" },
          () => {
            loadHome();
          }
        )
        .subscribe(),
    ];

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [meId, loadHome]);

  const hasTeam = useMemo(() => myTeams.length > 0, [myTeams.length]);

  return (
    <main style={wrap}>
      <AppTabNav />

      <header style={hero}>
        <div style={heroInner}>
          <p style={heroDesc}>
            サッカー練習試合をもっと簡単に。
            <br />
            チーム同士をつなぐマッチングサービス。
          </p>
        </div>
      </header>

      {!hasTeam ? (
        <div style={ctaBox}>
          <div style={ctaTitle}>まずはチーム登録から始めましょう</div>
          <div style={ctaText}>
            チームを登録すると、試合の募集・申込・招待・チャットが使えるようになります。
          </div>
          <div style={ctaActions}>
            <Link href="/teams/new" className="sh-btn sh-btn--primary">
              チームを登録する
            </Link>
            <Link href="/mypage" className="sh-btn">
              設定を見る
            </Link>
          </div>
        </div>
      ) : (
        <div style={ctaBox}>
          <div style={ctaTitle}>次のアクション</div>
          <div style={ctaText}>
            試合を探すか、自分で募集を出して相手チームとつながりましょう。
          </div>
          <div style={ctaActions}>
            <Link href="/match" className="sh-btn">
              試合を探す
            </Link>
            <Link href="/match/new" className="sh-btn sh-btn--primary">
              募集枠を作る
            </Link>
          </div>
        </div>
      )}

      <section style={dashboardGrid}>
        <div style={dashboardCard}>
          <div style={dashboardTitle}>⚽ あなたの試合状況</div>

          <div style={statusList}>
            <DashboardLinkRow
              href="/match/status/open"
              label="募集中の試合"
              value={openCount}
              helper={openCount === 0 ? "まだ募集していません" : "現在公開中の募集です"}
            />
            <DashboardLinkRow
              href="/match/status/offers-received"
              label="届いたオファー"
              value={receivedOfferCount}
              helper={receivedOfferCount === 0 ? "新しいオファーはありません" : "確認待ちのオファーがあります"}
            />
            <DashboardLinkRow
              href="/match/status/offers"
              label="送ったオファー"
              value={sentOfferCount}
              helper={sentOfferCount === 0 ? "まだオファーを送っていません" : "返答待ちのオファーがあります"}
            />
          </div>
        </div>

        <div style={dashboardCard}>
          <div style={dashboardTitle}>💬 チャット</div>

          <div style={statusList}>
            <DashboardLinkRow
              href="/chat"
              label="未読メッセージ"
              value={unreadTotal}
              helper={unreadTotal === 0 ? "新しいメッセージはありません" : "未読があります"}
            />
          </div>
        </div>

        <div style={dashboardCard}>
          <div style={dashboardTitle}>📅 次の試合</div>

          {loading ? (
            <div style={mutedText}>読み込み中…</div>
          ) : nextMatch ? (
            <>
              <div style={successBadge}>✅ 試合成立</div>
              <Link href="/match/next" style={nextMatchLink}>
                <div style={nextMatchDate}>
                  {fmtDate(nextMatch.date)} {fmtTime(nextMatch.start_time)}
                </div>
                <div style={nextMatchMeta}>
                  {nextMatch.area_text ?? nextMatch.area ?? "エリア未設定"}
                </div>
                <div style={nextMatchMeta}>
                  {nextMatch.category ?? "カテゴリ未設定"}
                </div>
              </Link>
            </>
          ) : (
            <div style={emptyActionBox}>
              <div style={mutedText}>まだ試合は成立していません</div>
              <div style={emptyActionRow}>
                <Link href="/match" className="sh-btn">
                  試合を探す
                </Link>
                <Link href="/match/new" className="sh-btn sh-btn--primary">
                  募集枠を作る
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <section style={guide}>
        <div style={guideTitle}>使い方</div>

        <div style={guideBlock}>
          <div style={guideStep}>1. チームを登録する</div>
          <div style={guideText}>
            まずはチーム名、エリア、カテゴリ、強さ、グラウンド提供可否、人数などを登録します。
            相手に見てもらう前提で、なるべく分かりやすく入力しておくとマッチしやすくなります。
          </div>
        </div>

        <div style={guideBlock}>
          <div style={guideStep}>2. 試合を探す / 募集する</div>
          <div style={guideText}>
            カレンダーから日付ごとの募集枠を確認できます。
            条件を絞って相手を探すことも、自分のチームで新しく募集枠を作ることもできます。
          </div>
        </div>

        <div style={guideBlock}>
          <div style={guideStep}>3. チャットで連絡する</div>
          <div style={guideText}>
            気になる相手が見つかったら、そのままチャットで連絡できます。
            日程の細かい調整や持ち物確認、会場詳細のやり取りに使えます。
          </div>
        </div>

        <div style={guideBlock}>
          <div style={guideStep}>4. 条件を細かく活用する</div>
          <div style={guideText}>
            エリア、カテゴリ、強さ、グラウンド提供、所属人数などを使うと、
            より希望に近い相手を探しやすくなります。
          </div>
        </div>
      </section>

      <section style={qa}>
        <div style={qaTitle}>Q&amp;A</div>

        <div style={qaItem}>
          <div style={qaQ}>Q. まず何をすればいいですか？</div>
          <div style={qaA}>
            A. まずはチーム登録です。登録情報があると、検索にも募集にもチャットにも進みやすくなります。
          </div>
        </div>

        <div style={qaItem}>
          <div style={qaQ}>Q. 相手チームにいきなり連絡できますか？</div>
          <div style={qaA}>
            A. はい。チーム検索や募集詳細からチャットで連絡できます。
          </div>
        </div>

        <div style={qaItem}>
          <div style={qaQ}>Q. 募集するだけでなく、探すこともできますか？</div>
          <div style={qaA}>
            A. できます。カレンダー上で既存の募集枠を見ながら、条件で絞り込んで探せます。
          </div>
        </div>

        <div style={qaItem}>
          <div style={qaQ}>Q. チーム検索では何で絞り込めますか？</div>
          <div style={qaA}>
            A. エリア、カテゴリ、強さ、グラウンド提供、所属人数、キーワードなどで絞り込みできます。
          </div>
        </div>

        <div style={qaItem}>
          <div style={qaQ}>Q. まだ相手が少ない場合は？</div>
          <div style={qaA}>
            A. 先に自分で募集枠を出しておくと、相手から見つけてもらいやすくなります。
          </div>
        </div>

        {!hasTeam ? (
          <div style={startBox}>
            <div style={startTitle}>まだチーム登録がありません</div>
            <div style={startText}>
              まずは設定ページからチーム情報を登録すると、試合検索・募集・チャットが使いやすくなります。
            </div>
            <div style={{ marginTop: 10 }}>
              <Link href="/mypage" className="sh-btn sh-btn--primary">
                設定ページへ
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function DashboardLinkRow(props: {
  href: string;
  label: string;
  value: number;
  helper?: string;
}) {
  const { href, label, value, helper } = props;

  return (
    <Link href={href} style={dashboardLinkRow}>
      <div style={{ minWidth: 0 }}>
        <div style={dashboardLinkLabel}>{label}</div>
        {helper ? <div style={dashboardLinkHelper}>{helper}</div> : null}
      </div>
      <span style={dashboardLinkValue}>{value}</span>
    </Link>
  );
}

const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
};

const hero: React.CSSProperties = {
  marginTop: 4,
};

const heroInner: React.CSSProperties = {
  padding: "14px 16px",
  background: "linear-gradient(135deg,#1e7f3c,#145c2a)",
  borderRadius: 16,
  color: "white",
  display: "grid",
  gap: 4,
};

const heroDesc: React.CSSProperties = {
  margin: "8px 0 0",
  color: "rgba(255,255,255,0.92)",
  lineHeight: 1.7,
};

const ctaBox: React.CSSProperties = {
  marginTop: 16,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#f5fbf6",
};

const ctaTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 16,
  color: "#16391f",
};

const ctaText: React.CSSProperties = {
  marginTop: 6,
  fontSize: 14,
  color: "#444",
  lineHeight: 1.7,
};

const ctaActions: React.CSSProperties = {
  marginTop: 12,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const dashboardGrid: React.CSSProperties = {
  marginTop: 20,
  display: "grid",
  gap: 12,
};

const dashboardCard: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#fff",
  padding: 16,
  display: "grid",
  gap: 10,
};

const dashboardTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  color: "#16391f",
};

const statusList: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const dashboardLinkRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  textDecoration: "none",
  color: "#111",
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
  padding: "12px 14px",
};

const dashboardLinkLabel: React.CSSProperties = {
  fontWeight: 800,
  color: "#2d3b31",
};

const dashboardLinkHelper: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.6,
};

const dashboardLinkValue: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 20,
  color: "#145c2a",
  whiteSpace: "nowrap",
};

const successBadge: React.CSSProperties = {
  display: "inline-block",
  background: "#dcfce7",
  color: "#166534",
  fontWeight: 900,
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  marginBottom: 6,
};

const nextMatchLink: React.CSSProperties = {
  display: "block",
  textDecoration: "none",
  color: "#111",
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
  padding: "12px 14px",
};

const nextMatchDate: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 20,
  color: "#145c2a",
};

const nextMatchMeta: React.CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  color: "#666",
  lineHeight: 1.6,
};

const emptyActionBox: React.CSSProperties = {
  border: "1px solid #edf1ee",
  borderRadius: 12,
  background: "#fafcfb",
  padding: "12px 14px",
};

const emptyActionRow: React.CSSProperties = {
  marginTop: 10,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const mutedText: React.CSSProperties = {
  fontSize: 13,
  color: "#666",
  lineHeight: 1.7,
};

const guide: React.CSSProperties = {
  marginTop: 20,
  border: "1px solid #eee",
  borderRadius: 16,
  padding: 16,
  background: "#fff",
};

const guideTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  marginBottom: 12,
};

const guideBlock: React.CSSProperties = {
  padding: "10px 0",
  borderBottom: "1px solid #f0f0f0",
};

const guideStep: React.CSSProperties = {
  fontWeight: 800,
  color: "#145c2a",
  marginBottom: 6,
};

const guideText: React.CSSProperties = {
  fontSize: 14,
  color: "#444",
  lineHeight: 1.8,
};

const qa: React.CSSProperties = {
  marginTop: 20,
  border: "1px solid #eee",
  borderRadius: 16,
  padding: 16,
  background: "#fff",
};

const qaTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  marginBottom: 12,
};

const qaItem: React.CSSProperties = {
  padding: "10px 0",
  borderBottom: "1px solid #f0f0f0",
};

const qaQ: React.CSSProperties = {
  fontWeight: 800,
  color: "#145c2a",
  marginBottom: 4,
};

const qaA: React.CSSProperties = {
  fontSize: 14,
  color: "#444",
  lineHeight: 1.8,
};

const startBox: React.CSSProperties = {
  marginTop: 14,
  padding: 14,
  borderRadius: 14,
  border: "1px solid #e5ece7",
  background: "#fafcfb",
};

const startTitle: React.CSSProperties = {
  fontWeight: 900,
  color: "#16391f",
};

const startText: React.CSSProperties = {
  marginTop: 6,
  fontSize: 14,
  color: "#444",
  lineHeight: 1.7,
};