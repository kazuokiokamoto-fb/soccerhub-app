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

type ThreadDbRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
  thread_type?: string | null;
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

export default function HomePage() {
  const [meId, setMeId] = useState<string>("");
  const [recentThreads, setRecentThreads] = useState<RecentThread[]>([]);
  const [loadingChat, setLoadingChat] = useState(true);

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
        .select("id,created_at,updated_at")
        .in("id", threadIds);

      const { data: msgs } = await supabase
        .from("chat_messages")
        .select("id,thread_id,body,created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false })
        .limit(100);

      const lastMap = new Map<string, MessageRow>();

      (msgs ?? []).forEach((m: any) => {
        if (!lastMap.has(m.thread_id)) {
          lastMap.set(m.thread_id, m);
        }
      });

      const merged: RecentThread[] = (threads ?? []).map((t: any) => {
        const lm = lastMap.get(t.id) ?? null;
        return {
          id: t.id,
          created_at: t.created_at,
          updated_at: t.updated_at ?? null,
          thread_type: null,
          last_message: lm,
          unread: false,
          other_team_id: null,
          other_team_name: null,
          other_team_category: null,
        };
      });

      setRecentThreads(merged.slice(0, 3));
      setLoadingChat(false);
    })();
  }, [meId]);

  return (
    <main style={wrap}>
      <header style={hero}>
        <h1 style={title}>サカまち</h1>
        <p style={subTitle}>
          サッカー練習試合をもっと簡単に。
          <br />
          チーム同士をつなぐマッチングサービス。
        </p>
      </header>

      <section style={grid} className="sh-home-grid">

        <Link href="/match" style={card}>
          <div style={icon}>⚽</div>
          <div style={cardTitle}>試合を探す / 募集する</div>
          <div style={desc}>練習試合をカレンダーから探す・募集できます</div>
        </Link>

        <Link href="/teams/search" style={card}>
          <div style={icon}>🔎</div>
          <div style={cardTitle}>チーム検索</div>
          <div style={desc}>地域・カテゴリーからチームを探す</div>
        </Link>

        <Link href="/chat" style={card}>
          <div style={icon}>💬</div>
          <div style={cardTitle}>
            チャット
            {meId ? (
              <span style={badge(unreadTotal)}>
                {unreadTotal > 0 ? "未読あり" : "未読なし"}
              </span>
            ) : null}
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
          <div style={icon}>⚙️</div>
          <div style={cardTitle}>マイページ</div>
          <div style={desc}>チーム情報の編集</div>
        </Link>

      </section>

      <section style={guide}>
        <div style={guideTitle}>使い方</div>
        <ol>
          <li>チームを登録</li>
          <li>試合を探す or 募集する</li>
          <li>チャットで連絡</li>
        </ol>
      </section>
    </main>
  );
}

const wrap: React.CSSProperties = {
  padding: 16,
};

const hero: React.CSSProperties = {
  padding: 20,
  background: "linear-gradient(135deg,#1e7f3c,#145c2a)",
  borderRadius: 16,
  color: "white",
};

const title: React.CSSProperties = {
  fontSize: 34,
  fontWeight: 900,
  margin: 0,
};

const subTitle: React.CSSProperties = {
  marginTop: 8,
  lineHeight: 1.6,
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
};

const guide: React.CSSProperties = {
  marginTop: 20,
  border: "1px solid #eee",
  borderRadius: 16,
  padding: 16,
};

const guideTitle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 6,
};

const threadRow: React.CSSProperties = {
  fontSize: 12,
  padding: "4px 0",
  borderBottom: "1px solid #eee",
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