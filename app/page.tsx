"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "./lib/supabase";
import AppTabNav from "@/app/components/AppTabNav";

type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  body: string | null;
  created_at: string;
};

type ThreadRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
};

type MatchSlotRow = {
  id: string;
  owner_id: string | null;
  host_team_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_closed: boolean | null;
  created_at?: string;
};

type MatchRequestRow = {
  id: string;
  slot_id: string;
  requester_team_id: string;
  requester_user_id: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled" | string;
  created_at?: string;
};

type TeamRow = {
  id: string;
  owner_id: string | null;
  name: string | null;
};

type OfferSummary = {
  sent: number;
  received: number;
};

type NextMatchCard = {
  date: string;
  start_time: string;
  slot_id: string;
};

export default function HomePage() {
  const [meId, setMeId] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [loadingChat, setLoadingChat] = useState(true);

  const [recruitingCount, setRecruitingCount] = useState(0);
  const [applyingCount, setApplyingCount] = useState(0);
  const [offerSummary, setOfferSummary] = useState<OfferSummary>({
    sent: 0,
    received: 0,
  });

  const [nextMatch, setNextMatch] = useState<NextMatchCard | null>(null);

  const [recentThreads, setRecentThreads] = useState<
    Array<{
      id: string;
      last_message: MessageRow | null;
      unread: boolean;
    }>
  >([]);

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
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);

      try {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        const todayYmd = `${yyyy}-${mm}-${dd}`;

        const { data: myTeamsData, error: myTeamsError } = await supabase
          .from("teams")
          .select("id,owner_id,name")
          .eq("owner_id", meId);

        if (myTeamsError) {
          console.error(myTeamsError);
          setLoading(false);
          return;
        }

        const myTeams = (myTeamsData ?? []) as TeamRow[];
        const myTeamIds = myTeams.map((t) => t.id);

        if (myTeamIds.length === 0) {
          setRecruitingCount(0);
          setApplyingCount(0);
          setOfferSummary({ sent: 0, received: 0 });
          setNextMatch(null);
          setLoading(false);
          return;
        }

        const { data: mySlotsData, error: mySlotsError } = await supabase
          .from("match_slots")
          .select("id,owner_id,host_team_id,date,start_time,end_time,is_closed,created_at")
          .in("host_team_id", myTeamIds)
          .order("date", { ascending: true });

        if (mySlotsError) {
          console.error(mySlotsError);
        }

        const mySlots = (mySlotsData ?? []) as MatchSlotRow[];
        const mySlotIds = mySlots.map((s) => s.id);

        const recruiting = mySlots.filter((s) => !s.is_closed);
        setRecruitingCount(recruiting.length);

        const { data: myRequestsData, error: myRequestsError } = await supabase
          .from("match_requests")
          .select("id,slot_id,requester_team_id,requester_user_id,status,created_at")
          .in("requester_team_id", myTeamIds)
          .order("created_at", { ascending: false });

        if (myRequestsError) {
          console.error(myRequestsError);
        }

        const myRequests = (myRequestsData ?? []) as MatchRequestRow[];

        const applying = myRequests.filter(
          (r) => r.status === "pending" || r.status === "accepted"
        );
        setApplyingCount(applying.length);

        let incomingOnMySlots: MatchRequestRow[] = [];
        if (mySlotIds.length > 0) {
          const { data: incomingReqData, error: incomingReqError } = await supabase
            .from("match_requests")
            .select("id,slot_id,requester_team_id,requester_user_id,status,created_at")
            .in("slot_id", mySlotIds)
            .order("created_at", { ascending: false });

          if (incomingReqError) {
            console.error(incomingReqError);
          } else {
            incomingOnMySlots = (incomingReqData ?? []) as MatchRequestRow[];
          }
        }

        const offerSent = myRequests.filter((r) => r.status === "pending").length;
        const offerReceived = incomingOnMySlots.filter((r) => r.status === "pending").length;

        setOfferSummary({
          sent: offerSent,
          received: offerReceived,
        });

        const acceptedSentSlotIds = myRequests
          .filter((r) => r.status === "accepted")
          .map((r) => r.slot_id);

        const acceptedReceivedSlotIds = incomingOnMySlots
          .filter((r) => r.status === "accepted")
          .map((r) => r.slot_id);

        const nextCandidateIds = Array.from(
          new Set([...acceptedSentSlotIds, ...acceptedReceivedSlotIds])
        );

        if (nextCandidateIds.length > 0) {
          const { data: nextSlotsData, error: nextSlotsError } = await supabase
            .from("match_slots")
            .select("id,owner_id,host_team_id,date,start_time,end_time,is_closed,created_at")
            .in("id", nextCandidateIds)
            .gte("date", todayYmd)
            .order("date", { ascending: true })
            .order("start_time", { ascending: true })
            .limit(1);

          if (nextSlotsError) {
            console.error(nextSlotsError);
          } else {
            const nextSlot = (nextSlotsData?.[0] ?? null) as MatchSlotRow | null;

            if (nextSlot) {
              setNextMatch({
                date: nextSlot.date,
                start_time: nextSlot.start_time,
                slot_id: nextSlot.id,
              });
            } else {
              setNextMatch(null);
            }
          }
        } else {
          setNextMatch(null);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [meId]);

  useEffect(() => {
    if (!meId) {
      setLoadingChat(false);
      return;
    }

    (async () => {
      setLoadingChat(true);

      try {
        const { data: myMembers, error: memberError } = await supabase
          .from("chat_members")
          .select("thread_id,last_read_at")
          .eq("user_id", meId)
          .limit(50);

        if (memberError) {
          console.error(memberError);
          setRecentThreads([]);
          setLoadingChat(false);
          return;
        }

        const threadIds = (myMembers ?? []).map((r: any) => r.thread_id);

        if (threadIds.length === 0) {
          setRecentThreads([]);
          setLoadingChat(false);
          return;
        }

        const { data: threads, error: threadsError } = await supabase
          .from("chat_threads")
          .select("id,created_at,updated_at")
          .in("id", threadIds);

        if (threadsError) {
          console.error(threadsError);
          setRecentThreads([]);
          setLoadingChat(false);
          return;
        }

        const { data: msgs, error: msgsError } = await supabase
          .from("chat_messages")
          .select("id,thread_id,sender_id,body,created_at")
          .in("thread_id", threadIds)
          .order("created_at", { ascending: false })
          .limit(200);

        if (msgsError) {
          console.error(msgsError);
          setRecentThreads([]);
          setLoadingChat(false);
          return;
        }

        const lastMap = new Map<string, MessageRow>();
        (msgs ?? []).forEach((m: any) => {
          if (!lastMap.has(m.thread_id)) {
            lastMap.set(m.thread_id, m as MessageRow);
          }
        });

        const memberMap = new Map<string, any>();
        (myMembers ?? []).forEach((m: any) => {
          memberMap.set(m.thread_id, m);
        });

        const merged = ((threads ?? []) as ThreadRow[]).map((t) => {
          const lm = lastMap.get(t.id) ?? null;
          const myMember = memberMap.get(t.id);
          const lastReadAt = myMember?.last_read_at ?? null;
          const unread =
            !!lm &&
            !!lm.created_at &&
            (!lastReadAt || new Date(lm.created_at).getTime() > new Date(lastReadAt).getTime());

          return {
            id: t.id,
            last_message: lm,
            unread,
          };
        });

        setRecentThreads(merged.slice(0, 5));
      } catch (e) {
        console.error(e);
        setRecentThreads([]);
      } finally {
        setLoadingChat(false);
      }
    })();
  }, [meId]);

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

      <section style={dashboardGrid}>
        <div style={dashboardCard}>
          <div style={dashboardTitleRow}>
            <div style={dashboardIcon}>⚽</div>
            <div style={dashboardTitle}>試合マッチング状況</div>
          </div>

          {loading ? (
            <div style={dashboardLoading}>読み込み中…</div>
          ) : (
            <div style={statusList}>
              <Link href="/match/recruiting" style={statusRowLink}>
                <span style={statusLabel}>募集中</span>
                <span style={statusValue}>{recruitingCount}</span>
              </Link>

              <Link href="/match/applying" style={statusRowLink}>
                <span style={statusLabel}>申込中</span>
                <span style={statusValue}>{applyingCount}</span>
              </Link>

              <Link href="/match/offers/sent" style={statusRowLink}>
                <span style={statusLabel}>オファー送信</span>
                <span style={statusValue}>{offerSummary.sent}</span>
              </Link>

              <Link href="/match/offers/received" style={statusRowLink}>
                <span style={statusLabel}>オファー受信</span>
                <span style={statusValue}>{offerSummary.received}</span>
              </Link>
            </div>
          )}
        </div>

        <div style={dashboardCard}>
          <div style={dashboardTitleRow}>
            <div style={dashboardIcon}>💬</div>
            <div style={dashboardTitle}>チャット</div>
          </div>

          {loadingChat ? (
            <div style={dashboardLoading}>読み込み中…</div>
          ) : (
            <div style={statusList}>
              <Link href="/chat" style={statusRowLink}>
                <span style={statusLabel}>未読メッセージ</span>
                <span style={statusValue}>{unreadTotal}</span>
              </Link>

              {recentThreads.length > 0 ? (
                <div style={recentMiniList}>
                  {recentThreads.slice(0, 3).map((t) => (
                    <div key={t.id} style={recentMiniRow}>
                      {t.last_message?.body ?? "メッセージなし"}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={emptyMiniText}>チャットはまだありません</div>
              )}
            </div>
          )}
        </div>

        <div style={dashboardCard}>
          <div style={dashboardTitleRow}>
            <div style={dashboardIcon}>📅</div>
            <div style={dashboardTitle}>次の試合</div>
          </div>

          {loading ? (
            <div style={dashboardLoading}>読み込み中…</div>
          ) : nextMatch ? (
            <div style={statusList}>
              <Link href={`/match/slot/${nextMatch.slot_id}`} style={statusRowLink}>
                <span style={statusLabel}>
                  {formatDate(nextMatch.date)} {formatTime(nextMatch.start_time)}
                </span>
                <span style={statusValue}>詳細</span>
              </Link>
            </div>
          ) : (
            <div style={emptyMiniText}>予定されている次の試合はありません</div>
          )}
        </div>
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
    </main>
  );
}

function formatDate(ymd: string) {
  const [y, m, d] = ymd.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function formatTime(hhmmss?: string | null) {
  if (!hhmmss) return "";
  return hhmmss.slice(0, 5);
}

const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
};

const hero: React.CSSProperties = {
  marginTop: 12,
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
  marginTop: 20,
  display: "grid",
  gap: 12,
};

const dashboardCard: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#fff",
  padding: 16,
};

const dashboardTitleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 12,
};

const dashboardIcon: React.CSSProperties = {
  fontSize: 24,
};

const dashboardTitle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  color: "#16391f",
};

const dashboardLoading: React.CSSProperties = {
  fontSize: 13,
  color: "#666",
};

const statusList: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const statusRowLink: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #edf1ee",
  background: "#fafcfb",
  textDecoration: "none",
};

const statusLabel: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#2d3b31",
};

const statusValue: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#145c2a",
  flexShrink: 0,
};

const recentMiniList: React.CSSProperties = {
  marginTop: 4,
  display: "grid",
  gap: 6,
};

const recentMiniRow: React.CSSProperties = {
  fontSize: 12,
  color: "#666",
  lineHeight: 1.6,
  padding: "0 2px",
  wordBreak: "break-word",
};

const emptyMiniText: React.CSSProperties = {
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