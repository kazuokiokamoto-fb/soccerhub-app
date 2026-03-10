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
        <div style={heroInner}>
          <p style={heroDesc}>
            サッカー練習試合をもっと簡単に。
            <br />
            チーム同士をつなぐマッチングサービス。
          </p>
        </div>
      </header>

      <section style={grid} className="sh-home-grid">
        <Link href="/match" style={card}>
          <div style={icon}>⚽</div>
          <div style={cardTitle}>試合を探す / 募集する</div>
          <div style={desc}>条件で絞り込みながら、カレンダー上で募集枠を探したり自分で募集できます。</div>
        </Link>

        <Link href="/teams/search" style={card}>
          <div style={icon}>🔎</div>
          <div style={cardTitle}>チーム検索</div>
          <div style={desc}>地域・カテゴリ・強さ・人数・駐輪場などの条件からチームを探せます。</div>
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
          <div style={desc}>自分のチーム情報の確認・編集、登録内容の見直しができます。</div>
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

const heroMini: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.9,
  letterSpacing: 0.5,
};

const title: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 900,
  fontStyle: "italic",
  margin: 0,
  lineHeight: 1.05,
};

const heroEn: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.95,
  textAlign: "center",
  width: 120,
};

const subTitle: React.CSSProperties = {
  marginTop: 4,
  marginBottom: 0,
  lineHeight: 1.5,
  fontSize: 13,
};

const heroDesc: React.CSSProperties = {
  margin: "8px 0 0",
  color: "rgba(255,255,255,0.92)",
  lineHeight: 1.7,
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