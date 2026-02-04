// app/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "./lib/supabase";

/**
 * ✅ いまのスキーマ前提
 * - chat_threads: id, created_at, updated_at, kind
 * - chat_members: thread_id, user_id, team_id, last_read_at, created_at ...
 * - chat_messages: id, thread_id, sender_id, sender_team_id, body, created_at
 *
 * ※ chat_threads.last_message_at は使わない（存在しない）
 */

type ThreadRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
  kind: string | null; // "direct" など
};

type MemberRow = {
  thread_id: string;
  last_read_at: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  body: string | null;
  created_at: string;
};

type ThreadWithLast = ThreadRow & {
  last_message?: MessageRow | null;
  unread_count?: number; // TOPは簡易で 0/1
};

function clip(s?: string | null, n = 40) {
  const v = (s ?? "").trim();
  if (!v) return "";
  return v.length > n ? v.slice(0, n) + "…" : v;
}

export default function HomePage() {
  const [meId, setMeId] = useState<string>("");
  const [loadingChat, setLoadingChat] = useState<boolean>(true);
  const [chatError, setChatError] = useState<string>("");

  // 直近のスレッド（最大5件）
  const [recentThreads, setRecentThreads] = useState<ThreadWithLast[]>([]);

  const unreadTotal = useMemo(() => {
    return recentThreads.reduce((sum, t) => sum + (t.unread_count ?? 0), 0);
  }, [recentThreads]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMeId(data?.user?.id || "");
    })();
  }, []);

  useEffect(() => {
    if (!meId) {
      setLoadingChat(false);
      setRecentThreads([]);
      return;
    }

    // TOPは「軽く」：最大5スレッド + 各スレッドの最新メッセージ + 未読(0/1)
    (async () => {
      setLoadingChat(true);
      setChatError("");
      try {
        // 1) 自分の chat_members（thread_id & last_read_at）
        const { data: myMemberRows, error: cmErr } = await supabase
          .from("chat_members")
          .select("thread_id, last_read_at, created_at")
          .eq("user_id", meId)
          .order("created_at", { ascending: false })
          .limit(40); // 念のため少し多めに拾う

        if (cmErr) {
          console.error(cmErr);
          setChatError(`チャット一覧の取得に失敗: ${cmErr.message}`);
          setRecentThreads([]);
          setLoadingChat(false);
          return;
        }

        const threadIds = Array.from(
          new Set((myMemberRows ?? []).map((r: any) => r.thread_id).filter(Boolean))
        );

        // thread_id -> last_read_at
        const myLastReadMap = new Map<string, string | null>();
        for (const r of (myMemberRows ?? []) as any[]) {
          if (!r.thread_id) continue;
          if (!myLastReadMap.has(r.thread_id)) myLastReadMap.set(r.thread_id, r.last_read_at ?? null);
        }

        if (threadIds.length === 0) {
          setRecentThreads([]);
          setLoadingChat(false);
          return;
        }

        // 2) thread 本体（kind等）
        const { data: thRows, error: thErr } = await supabase
          .from("chat_threads")
          .select("id, created_at, updated_at, kind")
          .in("id", threadIds);

        if (thErr) {
          console.error(thErr);
          setChatError(`チャットスレッドの取得に失敗: ${thErr.message}`);
          setRecentThreads([]);
          setLoadingChat(false);
          return;
        }

        const threadsBase = ((thRows ?? []) as any[]).map((t) => ({
          id: t.id as string,
          created_at: t.created_at as string,
          updated_at: (t.updated_at as string | null) ?? null,
          kind: (t.kind as string | null) ?? null,
        })) as ThreadRow[];

        // 3) 最新メッセージ（まとめて取ってJSで threadごとに先頭を採用）
        const { data: msgRows, error: msgErr } = await supabase
          .from("chat_messages")
          .select("id, thread_id, sender_id, body, created_at")
          .in("thread_id", threadIds)
          .order("created_at", { ascending: false })
          .limit(400);

        if (msgErr) {
          console.error(msgErr);
          // TOPは壊したくないので messages無しでも継続
        }

        const lastByThread = new Map<string, MessageRow>();
        for (const m of (msgRows ?? []) as any[]) {
          const tid = m.thread_id as string;
          if (!tid) continue;
          if (!lastByThread.has(tid)) {
            lastByThread.set(tid, {
              id: m.id,
              thread_id: tid,
              sender_id: m.sender_id ?? null,
              body: m.body ?? null,
              created_at: m.created_at,
            });
          }
        }

        // 4) 整形：未読判定（簡易0/1）
        const enriched: ThreadWithLast[] = threadsBase
          .map((t) => {
            const last = lastByThread.get(t.id) ?? null;
            const lastReadAt = myLastReadMap.get(t.id) ?? null;

            let unread = 0;
            if (last?.created_at) {
              if (!lastReadAt) unread = 1;
              else unread = new Date(last.created_at).getTime() > new Date(lastReadAt).getTime() ? 1 : 0;
            }

            return { ...t, last_message: last, unread_count: unread };
          })
          // 5) 並び：最新メッセージ日時 or updated_at or created_at の降順
          .sort((a, b) => {
            const at = a.last_message?.created_at ?? a.updated_at ?? a.created_at ?? "";
            const bt = b.last_message?.created_at ?? b.updated_at ?? b.created_at ?? "";
            return at > bt ? -1 : 1;
          })
          .slice(0, 5);

        setRecentThreads(enriched);
      } catch (e: any) {
        console.error(e);
        setChatError(`チャット情報の取得に失敗: ${e?.message ?? "unknown error"}`);
        setRecentThreads([]);
      } finally {
        setLoadingChat(false);
      }
    })();
  }, [meId]);

  return (
    <main style={wrap}>
      <header style={header}>
        <h1 style={title}>SoccerHub</h1>
        <p style={subTitle}>まずは「マッチング（探す/募集する）」へ。チーム設定はあとでOK。</p>
      </header>

      <section style={grid}>
        {/* ✅ 1) 探す/募集（統一：A案） */}
        <Link href="/match" style={{ ...card, textDecoration: "none" }} className="sh-card">
          <div style={cardIcon}>🗓️</div>
          <div style={cardTitle}>マッチング（探す / 募集する）</div>
          <div style={cardDesc}>カレンダーから募集を探して申込み／自分の募集も作れます（ここに集約）。</div>
          <div style={cardCta}>開く →</div>
        </Link>

        {/* ✅ 2) チャット導線（通知/過去連絡先） */}
        <Link href="/chat" style={{ ...card, textDecoration: "none" }} className="sh-card">
          <div style={cardIcon}>💬</div>
          <div style={cardTitle}>
            チャット
            {meId ? (
              <span style={badge(unreadTotal)} title="未読（簡易表示）">
                {unreadTotal > 0 ? `未読あり` : `未読なし`}
              </span>
            ) : null}
          </div>

          <div style={cardDesc}>
            {meId ? "未読・過去の連絡先をまとめて確認できます。" : "ログインすると、未読・過去の連絡先が表示されます。"}
          </div>

          <div style={{ marginTop: 6 }}>
            {loadingChat ? (
              <div style={{ color: "#777", fontSize: 12 }}>読み込み中…</div>
            ) : chatError ? (
              <div style={{ color: "#991b1b", fontSize: 12, whiteSpace: "pre-wrap" }}>{chatError}</div>
            ) : recentThreads.length === 0 ? (
              <div style={{ color: "#777", fontSize: 12 }}>最近のチャットはまだありません。</div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {recentThreads.slice(0, 3).map((t) => (
                  <div key={t.id} style={threadRow}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 900 }}>#{t.id.slice(0, 6)}</span>
                      {t.unread_count ? <span style={dot} aria-label="未読" /> : null}
                      <span style={{ fontSize: 12, color: "#6b7280" }}>{t.kind ?? "thread"}</span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#555",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.last_message?.body ? clip(t.last_message.body, 44) : "（メッセージなし）"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={cardCta}>開く →</div>
        </Link>

        {/* ✅ 3) チーム */}
        <Link href="/teams" style={{ ...card, textDecoration: "none" }} className="sh-card">
          <div style={cardIcon}>⚙️</div>
          <div style={cardTitle}>自分のチーム</div>
          <div style={cardDesc}>チーム情報・ユニフォーム・よく使うグラウンドを設定します。</div>
          <div style={cardCta}>開く →</div>
        </Link>
      </section>

      <section style={noteBox}>
        <div style={noteTitle}>使い方（最短）</div>
        <ol style={noteList}>
          <li>「自分のチーム」でチームを1つ作る</li>
          <li>「マッチング（探す / 募集する）」で日付と時間を入れて募集枠を作る／探して申込みする</li>
          <li>承認後は「チャット」から連絡（/chat に一本化）</li>
        </ol>
      </section>
    </main>
  );
}

/** ===== styles ===== */
const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
};

const header: React.CSSProperties = {
  marginTop: 10,
};

const title: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 900,
  letterSpacing: 0.2,
};

const subTitle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#555",
  lineHeight: 1.6,
};

const grid: React.CSSProperties = {
  marginTop: 16,
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(3, 1fr)",
};

const card: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 16,
  background: "white",
  padding: 14,
  minHeight: 150,
  display: "grid",
  gap: 8,
  alignContent: "start",
  cursor: "pointer",
};

const cardIcon: React.CSSProperties = {
  fontSize: 26,
  lineHeight: 1,
};

const cardTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#111827",
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const cardDesc: React.CSSProperties = {
  fontSize: 13,
  color: "#555",
  lineHeight: 1.6,
};

const cardCta: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  fontWeight: 800,
  color: "#111827",
};

const noteBox: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid #eee",
  borderRadius: 16,
  background: "#fafafa",
  padding: 14,
};

const noteTitle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 6,
};

const noteList: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
  color: "#555",
  lineHeight: 1.8,
};

const threadRow: React.CSSProperties = {
  border: "1px solid #f3f4f6",
  borderRadius: 10,
  padding: "8px 10px",
  background: "#fafafa",
  display: "grid",
  gap: 4,
};

const dot: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "#16a34a",
  display: "inline-block",
};

function badge(unreadTotal: number): React.CSSProperties {
  return {
    marginLeft: 6,
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #eee",
    fontSize: 12,
    fontWeight: 800,
    background: unreadTotal > 0 ? "#eff6ff" : "#f3f4f6",
    color: unreadTotal > 0 ? "#1e3a8a" : "#374151",
  };
}