"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "./lib/supabase";

type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  body: string | null;
  created_at: string;
};

type RecentThread = {
  id: string;
  created_at: string;
  updated_at: string | null;
  thread_type: string | null;
  last_message: MessageRow | null;
  unread: boolean;
  other_team_id: string | null;
  other_team_name: string | null;
  other_team_category: string | null;
};

type MatchSlotRow = {
  id: string;
  owner_id: string | null;
  host_team_id: string | null;
  date: string;
  start_time: string | null;
  end_time: string | null;
  is_closed: boolean | null;
  created_at?: string | null;
};

type MatchRequestRow = {
  id: string;
  slot_id: string;
  requester_user_id: string | null;
  requester_team_id: string | null;
  status: string | null;
  created_at?: string | null;
};

type TeamRow = {
  id: string;
  owner_id: string | null;
  name: string | null;
};

type MatchStats = {
  recruitingCount: number;
  applyingCount: number;
  offerSentCount: number;
  offerReceivedCount: number;
  nextMatchLabel: string;
};

function startOfTodayLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function combineDateTime(date: string, time?: string | null) {
  if (!date) return null;
  const safeTime = (time ?? "00:00").slice(0, 5);
  const dt = new Date(`${date}T${safeTime}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatMatchDateLabel(date: string, time?: string | null) {
  if (!date) return "未定";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return time ? `${date} ${String(time).slice(0, 5)}` : date;

  const mm = String(Number(m[2]));
  const dd = String(Number(m[3]));
  const hhmm = time ? ` ${String(time).slice(0, 5)}` : "";
  return `${mm}/${dd}${hhmm}`;
}

export default function HomePage() {
  const [meId, setMeId] = useState<string>("");
  const [recentThreads, setRecentThreads] = useState<RecentThread[]>([]);
  const [loadingChat, setLoadingChat] = useState(true);

  const [matchStats, setMatchStats] = useState<MatchStats>({
    recruitingCount: 0,
    applyingCount: 0,
    offerSentCount: 0,
    offerReceivedCount: 0,
    nextMatchLabel: "未定",
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const unreadTotal = useMemo(() => {
    return recentThreads.reduce((sum, t) => sum + (t.unread ? 1 : 0), 0);
  }, [recentThreads]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMeId(data?.user?.id ?? "");
    })();
  }, []);

  useEffect(() => {
    if (!meId) {
      setLoadingChat(false);
      return;
    }

    (async () => {
      setLoadingChat(true);

      const { data: myMembers } = await supabase
        .from("chat_members")
        .select("thread_id,last_read_at")
        .eq("user_id", meId)
        .limit(20);

      const threadIds = (myMembers ?? []).map((r: any) => r.thread_id);

      if (threadIds.length === 0) {
        setRecentThreads([]);
        setLoadingChat(false);
        return;
      }

      const { data: threads } = await supabase
        .from("chat_threads")
        .select("id,created_at,updated_at,thread_type")
        .in("id", threadIds);

      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id,thread_id,body,created_at,sender_id")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false })
        .limit(100);

      const lastMap = new Map<string, MessageRow>();
      (msgs ?? []).forEach((m: any) => {
        if (!lastMap.has(m.thread_id)) {
          lastMap.set(m.thread_id, m);
        }
      });

      const memberMap = new Map<string, any>();
      (myMembers ?? []).forEach((m: any) => {
        memberMap.set(m.thread_id, m);
      });

      const merged: RecentThread[] = (threads ?? []).map((t: any) => {
        const lm = lastMap.get(t.id) ?? null;
        const member = memberMap.get(t.id);
        const lastReadAt = member?.last_read_at ? new Date(member.last_read_at).getTime() : 0;
        const lastMsgAt = lm?.created_at ? new Date(lm.created_at).getTime() : 0;

        return {
          id: t.id,
          created_at: t.created_at,
          updated_at: t.updated_at ?? null,
          thread_type: t.thread_type ?? null,
          last_message: lm,
          unread: !!lm && lastMsgAt > lastReadAt,
          other_team_id: null,
          other_team_name: null,
          other_team_category: null,
        };
      });

      merged.sort((a, b) => {
        const at = new Date(a.updated_at ?? a.created_at).getTime();
        const bt = new Date(b.updated_at ?? b.created_at).getTime();
        return bt - at;
      });

      setRecentThreads(merged.slice(0, 3));
      setLoadingChat(false);
    })();
  }, [meId]);

  useEffect(() => {
    if (!meId) {
      setLoadingStats(false);
      return;
    }

    (async () => {
      setLoadingStats(true);

      try {
        const today = startOfTodayLocal();

        const { data: myTeamsData } = await supabase
          .from("teams")
          .select("id,owner_id,name")
          .eq("owner_id", meId);

        const myTeams = (myTeamsData ?? []) as TeamRow[];
        const myTeamIds = myTeams.map((t) => t.id);

        if (myTeamIds.length === 0) {
          setMatchStats({
            recruitingCount: 0,
            applyingCount: 0,
            offerSentCount: 0,
            offerReceivedCount: 0,
            nextMatchLabel: "未定",
          });
          setLoadingStats(false);
          return;
        }

        const { data: mySlotsData } = await supabase
          .from("match_slots")
          .select("id,owner_id,host_team_id,date,start_time,end_time,is_closed,created_at")
          .in("host_team_id", myTeamIds)
          .order("date", { ascending: true });

        const mySlots = (mySlotsData ?? []) as MatchSlotRow[];
        const mySlotIds = mySlots.map((s) => s.id);

        let requestsForMySlots: MatchRequestRow[] = [];
        if (mySlotIds.length > 0) {
          const { data } = await supabase
            .from("match_requests")
            .select("id,slot_id,requester_user_id,requester_team_id,status,created_at")
            .in("slot_id", mySlotIds);
          requestsForMySlots = (data ?? []) as MatchRequestRow[];
        }

        const { data: myRequestsData } = await supabase
          .from("match_requests")
          .select("id,slot_id,requester_user_id,requester_team_id,status,created_at")
          .eq("requester_user_id", meId);

        const myRequests = (myRequestsData ?? []) as MatchRequestRow[];

        const recruitingCount = mySlots.filter((slot) => {
          const dt = combineDateTime(slot.date, slot.start_time);
          if (!dt) return false;
          return dt >= today && !slot.is_closed;
        }).length;

        const applyingCount = myRequests.filter((r) => r.status === "pending").length;

        const offerSentCount = myRequests.filter((r) => r.status === "accepted").length;

        const offerReceivedCount = requestsForMySlots.filter((r) => r.status === "pending").length;

        const acceptedRequestedSlotIds = new Set(
          myRequests.filter((r) => r.status === "accepted").map((r) => r.slot_id)
        );

        const acceptedMySlotIds = new Set(
          requestsForMySlots.filter((r) => r.status === "accepted").map((r) => r.slot_id)
        );

        const candidateSlots = mySlots.filter((slot) => {
          const dt = combineDateTime(slot.date, slot.start_time);
          if (!dt || dt < today) return false;
          return acceptedMySlotIds.has(slot.id) || acceptedRequestedSlotIds.has(slot.id);
        });

        candidateSlots.sort((a, b) => {
          const at = combineDateTime(a.date, a.start_time)?.getTime() ?? Infinity;
          const bt = combineDateTime(b.date, b.start_time)?.getTime() ?? Infinity;
          return at - bt;
        });

        const nextMatchLabel =
          candidateSlots.length > 0
            ? formatMatchDateLabel(candidateSlots[0].date, candidateSlots[0].start_time)
            : "未定";

        setMatchStats({
          recruitingCount,
          applyingCount,
          offerSentCount,
          offerReceivedCount,
          nextMatchLabel,
        });
      } catch (e) {
        console.error("home stats load error:", e);
        setMatchStats({
          recruitingCount: 0,
          applyingCount: 0,
          offerSentCount: 0,
          offerReceivedCount: 0,
          nextMatchLabel: "未定",
        });
      } finally {
        setLoadingStats(false);
      }
    })();
  }, [meId]);

  return (
    <main style={wrap}>
      <header style={hero}>
        <div style={heroInner}>
          <p style={heroDesc}>
            サッカー練習試合をもっと簡単に。
            <br />
            チーム同士をつなぐマッチングサービス。
          </p>
        </div>
      </header>

      <section style={dashboardGrid}>
        <Link href="/match" style={statusCard}>
          <div style={statusHead}>
            <div style={statusIcon}>⚽</div>
            <div style={statusTitle}>試合マッチング状況</div>
          </div>

          {loadingStats ? (
            <div style={statusLoading}>読み込み中…</div>
          ) : (
            <div style={statusList}>
              <div style={statusRow}>
                <span style={statusLabel}>募集中</span>
                <span style={statusValue}>{matchStats.recruitingCount}</span>
              </div>
              <div style={statusRow}>
                <span style={statusLabel}>申込中</span>
                <span style={statusValue}>{matchStats.applyingCount}</span>
              </div>
              <div style={statusRow}>
                <span style={statusLabel}>オファー送信</span>
                <span style={statusValue}>{matchStats.offerSentCount}</span>
              </div>
              <div style={statusRow}>
                <span style={statusLabel}>オファー受信</span>
                <span style={statusValue}>{matchStats.offerReceivedCount}</span>
              </div>
            </div>
          )}
        </Link>

        <Link href="/chat" style={statusCard}>
          <div style={statusHead}>
            <div style={statusIcon}>💬</div>
            <div style={statusTitle}>チャット</div>
          </div>

          <div style={statusList}>
            <div style={statusRow}>
              <span style={statusLabel}>未読メッセージ</span>
              <span style={statusValue}>{loadingChat ? "…" : unreadTotal}</span>
            </div>
          </div>

          {loadingChat ? (
            <div style={miniListText}>読み込み中…</div>
          ) : recentThreads.length === 0 ? (
            <div style={miniListText}>チャットはまだありません</div>
          ) : (
            <div style={miniListWrap}>
              {recentThreads.map((t) => (
                <div key={t.id} style={threadRow}>
                  {t.last_message?.body ?? "メッセージなし"}
                </div>
              ))}
            </div>
          )}
        </Link>

        <Link href="/match" style={statusCard}>
          <div style={statusHead}>
            <div style={statusIcon}>📅</div>
            <div style={statusTitle}>次の試合</div>
          </div>

          <div style={nextMatchBox}>
            <div style={nextMatchDate}>{loadingStats ? "読み込み中…" : matchStats.nextMatchLabel}</div>
            <div style={nextMatchSub}>直近の成立済み試合</div>
          </div>
        </Link>
      </section>

      <section style={grid} className="sh-home-grid">
        <Link href="/match" style={card}>
          <div style={titleRow}>
            <div style={icon}>⚽</div>
            <div style={cardTitle}>試合を探す / 募集する</div>
          </div>
          <div style={desc}>
            条件で絞り込みながら、カレンダー上で募集枠を探したり自分で募集できます。
          </div>
        </Link>

        <Link href="/teams/search" style={card}>
          <div style={titleRow}>
            <div style={icon}>🔎</div>
            <div style={cardTitle}>チーム検索</div>
          </div>
          <div style={desc}>地域・カテゴリ・強さ・人数・駐輪場などの条件からチームを探せます。</div>
        </Link>

        <Link href="/chat" style={card}>
          <div style={titleRow}>
            <div style={icon}>💬</div>
            <div style={cardTitle}>
              チャット
              {meId ? (
                <span style={badge(unreadTotal)}>
                  {unreadTotal > 0 ? "未読あり" : "未読なし"}
                </span>
              ) : null}
            </div>
          </div>

          {loadingChat ? (
            <div style={{ fontSize: 12 }}>読み込み中…</div>
          ) : recentThreads.length === 0 ? (
            <div style={{ fontSize: 12 }}>チャットはまだありません</div>
          ) : (
            <div style={{ marginTop: 6 }}>
              {recentThreads.map((t) => (
                <div key={t.id} style={threadRow}>
                  {t.last_message?.body ?? "メッセージなし"}
                </div>
              ))}
            </div>
          )}
        </Link>

        <Link href="/teams" style={card}>
          <div style={titleRow}>
            <div style={icon}>⚙️</div>
            <div style={cardTitle}>マイページ</div>
          </div>
          <div style={desc}>アカウント設定、自分のチーム情報の確認・編集、登録内容の見直しができます。</div>
        </Link>
      </section>

      <section style={guide}>
        <div style={guideTitle}>使い方</div>

        <div style={guideBlock}>
          <div style={guideStep}>1. チームを登録する</div>
          <div style={guideText}>
            まずはチーム名、エリア、カテゴリ、強さ、グラウンド提供可否、駐輪場、人数などを登録します。
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
            エリア、カテゴリ、強さ、グラウンド提供、駐輪場、所属人数などを使うと、
            より希望に近い相手を探しやすくなります。
          </div>
        </div>
      </section>

      <section style={qa}>
        <div style={qaTitle}>Q&amp;A</div>

        <div style={qaItem}>
          <div style={qaQ}>Q. まず何をすればいいですか？</div>
          <div style={qaA}>A. まずはチーム登録です。登録情報があると、検索にも募集にもチャットにも進みやすくなります。</div>
        </div>

        <div style={qaItem}>
          <div style={qaQ}>Q. 相手チームにいきなり連絡できますか？</div>
          <div style={qaA}>A. はい。募集枠や詳細画面からチャットに進んで連絡できます。</div>
        </div>

        <div style={qaItem}>
          <div style={qaQ}>Q. 募集するだけでなく、探すこともできますか？</div>
          <div style={qaA}>A. できます。カレンダー上で既存の募集枠を見ながら、条件で絞り込んで探せます。</div>
        </div>

        <div style={qaItem}>
          <div style={qaQ}>Q. チーム検索では何で絞り込めますか？</div>
          <div style={qaA}>
            A. エリア、カテゴリ、強さ、グラウンド提供、駐輪場、所属人数、キーワードなどで絞り込みできます。
          </div>
        </div>

        <div style={qaItem}>
          <div style={qaQ}>Q. まだ相手が少ない場合は？</div>
          <div style={qaA}>A. 先に自分で募集枠を出しておくと、相手から見つけてもらいやすくなります。</div>
        </div>
      </section>
    </main>
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

const dashboardGrid: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const statusCard: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "white",
  padding: 16,
  textDecoration: "none",
  color: "#111",
  display: "grid",
  gap: 10,
  boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
};

const statusHead: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const statusIcon: React.CSSProperties = {
  fontSize: 24,
};

const statusTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  color: "#16391f",
};

const statusLoading: React.CSSProperties = {
  fontSize: 13,
  color: "#66756d",
};

const statusList: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const statusRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  borderBottom: "1px solid #f2f4f3",
  paddingBottom: 6,
};

const statusLabel: React.CSSProperties = {
  fontSize: 14,
  color: "#47564d",
  fontWeight: 700,
};

const statusValue: React.CSSProperties = {
  fontSize: 18,
  color: "#145c2a",
  fontWeight: 900,
};

const miniListWrap: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const miniListText: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
};

const nextMatchBox: React.CSSProperties = {
  display: "grid",
  gap: 4,
};

const nextMatchDate: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#145c2a",
  lineHeight: 1.2,
};

const nextMatchSub: React.CSSProperties = {
  fontSize: 12,
  color: "#66756d",
};

const grid: React.CSSProperties = {
  marginTop: 20,
  display: "grid",
  gap: 12,
};

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "white",
  padding: 16,
  textDecoration: "none",
  color: "#111",
  display: "grid",
  gap: 6,
};

const icon: React.CSSProperties = {
  fontSize: 26,
};

const cardTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
};

const desc: React.CSSProperties = {
  fontSize: 13,
  color: "#666",
  lineHeight: 1.6,
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

const threadRow: React.CSSProperties = {
  fontSize: 12,
  padding: "4px 0",
  borderBottom: "1px solid #eee",
  color: "#444",
};

function badge(n: number): React.CSSProperties {
  return {
    marginLeft: 6,
    fontSize: 11,
    background: n > 0 ? "#dcfce7" : "#eee",
    padding: "2px 6px",
    borderRadius: 999,
  };
}

const titleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "nowrap",
};