// app/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "./lib/supabase";

type ThreadRow = {
  id: string;
  thread_type: "direct" | "slot";
  team_a_id: string | null;
  team_b_id: string | null;
  slot_id: string | null;
  updated_at: string | null;
  last_message_at: string | null;
};

type MessageRow = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type ThreadWithLast = ThreadRow & {
  last_message?: MessageRow | null;
  unread_count?: number;
};

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

    // TOPでは「チャット導線」が目的なので、最初は“軽く”出す（最大5件）
    // - chat_threads（direct）だけ対象
    // - 直近メッセージを取って表示
    // - 未読は最低限（chat_reads があれば計算、なければ 0）
    (async () => {
      setLoadingChat(true);
      setChatError("");
      try {
        // 1) 自分が関係する direct スレッドの一覧（最新順）
        //    ※ スキーマが違う場合はここが最初にコケるので、エラーメッセージを表示する
        const { data: threads, error: tErr } = await supabase
          .from("chat_threads")
          .select("id,thread_type,team_a_id,team_b_id,slot_id,updated_at,last_message_at")
          .eq("thread_type", "direct")
          .or(`team_a_owner_id.eq.${meId},team_b_owner_id.eq.${meId}`) // ← もし無ければ下のフォールバックへ
          .order("last_message_at", { ascending: false })
          .limit(5);

        // ↑この `team_a_owner_id / team_b_owner_id` はプロジェクトによって存在しない可能性があるため
        // もしエラーになったら「最低限：thread_type=directだけ」取るフォールバックに落とします。
        let threadRows: ThreadRow[] = [];
        if (tErr) {
          // フォールバック（RLSで自分の分しか返らない想定）
          const { data: threads2, error: tErr2 } = await supabase
            .from("chat_threads")
            .select("id,thread_type,team_a_id,team_b_id,slot_id,updated_at,last_message_at")
            .eq("thread_type", "direct")
            .order("last_message_at", { ascending: false })
            .limit(5);

          if (tErr2) {
            console.error(tErr2);
            setChatError(`チャット一覧の取得に失敗: ${tErr2.message}`);
            setRecentThreads([]);
            setLoadingChat(false);
            return;
          }
          threadRows = (threads2 ?? []) as ThreadRow[];
        } else {
          threadRows = (threads ?? []) as ThreadRow[];
        }

        if (threadRows.length === 0) {
          setRecentThreads([]);
          setLoadingChat(false);
          return;
        }

        const threadIds = threadRows.map((t) => t.id);

        // 2) 各スレッドの最新メッセージ（まとめて取り、JS側で latest を作る）
        const { data: msgs, error: mErr } = await supabase
          .from("chat_messages")
          .select("id,thread_id,sender_id,body,created_at")
          .in("thread_id", threadIds)
          .order("created_at", { ascending: false });

        if (mErr) {
          console.error(mErr);
          // メッセージが取れなくてもTOPは動かしたいので、threadsのみで表示
        }

        const msgRows = (msgs ?? []) as MessageRow[];
        const lastByThread = new Map<string, MessageRow>();
        for (const m of msgRows) {
          if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m);
        }

        // 3) 未読（あれば）：
        // chat_reads(thread_id, user_id, last_read_at) がある前提で計算。
        // 無ければ 0 にする（“通知”は後で強化）
        let readMap = new Map<string, string>(); // thread_id -> last_read_at
        try {
          const { data: reads, error: rErr } = await supabase
            .from("chat_reads")
            .select("thread_id,last_read_at")
            .eq("user_id", meId)
            .in("thread_id", threadIds);

          if (!rErr) {
            for (const r of reads ?? []) {
              readMap.set((r as any).thread_id, (r as any).last_read_at);
            }
          }
        } catch {
          // テーブルが無い/権限が無い場合は無視
        }

        const enriched: ThreadWithLast[] = threadRows.map((t) => {
          const last = lastByThread.get(t.id) ?? null;
          const lastReadAt = readMap.get(t.id) ?? null;

          // 未読件数は厳密には count(*) すべきだが、TOPは「ある/なし」で十分。
          // ここでは「最後のメッセージが last_read_at より新しいなら 1（未読あり）」程度にする。
          let unread = 0;
          if (last && lastReadAt) {
            unread = new Date(last.created_at).getTime() > new Date(lastReadAt).getTime() ? 1 : 0;
          } else if (last && !lastReadAt) {
            // read行が無ければ未読扱い（最初だけ）
            unread = 1;
          }

          return { ...t, last_message: last, unread_count: unread };
        });

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
        <p style={subTitle}>
          まずは「マッチング（探す/募集する）」へ。チーム設定はあとでOK。
        </p>
      </header>

      <section style={grid}>
        {/* ✅ 1) 探す/募集（統一：A案） */}
        <Link href="/match" style={{ ...card, textDecoration: "none" }} className="sh-card">
          <div style={cardIcon}>🗓️</div>
          <div style={cardTitle}>マッチング（探す / 募集する）</div>
          <div style={cardDesc}>
            カレンダーから募集を探して申込み／自分の募集も作れます（ここに集約）。
          </div>
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
                      {t.unread_count ? <span style={dot} /> : null}
                    </div>
                    <div style={{ fontSize: 12, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.last_message?.body ?? "（メッセージなし）"}
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
  background: "#111827",
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