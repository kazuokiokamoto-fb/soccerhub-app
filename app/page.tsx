// app/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "./lib/supabase";

type TeamMini = { id: string; name: string | null; category: string | null };

type ThreadMini = {
  id: string;
  kind: string | null;
  created_at: string;
  updated_at: string | null;
};

type MemberMini = { thread_id: string; team_id: string; last_read_at: string | null; created_at: string };

type LastMsgMini = { thread_id: string; body: string | null; created_at: string };

type RecentThreadView = {
  id: string;
  otherTeamName: string;
  otherTeamCategory: string | null;
  lastBody: string;
  lastAt: string | null;
  isUnread: boolean;
};

function clip(s?: string | null, n = 42) {
  const v = (s ?? "").trim();
  if (!v) return "";
  return v.length > n ? v.slice(0, n) + "…" : v;
}

export default function HomePage() {
  const [meId, setMeId] = useState<string>("");

  const [loadingChat, setLoadingChat] = useState<boolean>(true);
  const [chatError, setChatError] = useState<string>("");

  const [recentViews, setRecentViews] = useState<RecentThreadView[]>([]);

  const unreadTotal = useMemo(() => {
    return recentViews.reduce((sum, t) => sum + (t.isUnread ? 1 : 0), 0);
  }, [recentViews]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMeId(data?.user?.id || "");
    })();
  }, []);

  useEffect(() => {
    if (!meId) {
      setLoadingChat(false);
      setRecentViews([]);
      return;
    }

    (async () => {
      setLoadingChat(true);
      setChatError("");
      setRecentViews([]);

      try {
        // 0) 自分のチーム（「相手」を判定するため）
        const { data: myTeamsRows } = await supabase.from("teams").select("id").eq("owner_id", meId);
        const myTeamIds = new Set<string>((myTeamsRows ?? []).map((r: any) => r.id).filter(Boolean));

        // 1) 自分の chat_members（thread_id & last_read_at）
        // ※ ここが “infinite recursion” になるなら、DB側の policy が再帰してる（上のSQLで直す）
        const { data: myMemberRows, error: cmErr } = await supabase
          .from("chat_members")
          .select("thread_id, team_id, last_read_at, created_at")
          .eq("user_id", meId)
          .order("created_at", { ascending: false })
          .limit(30);

        if (cmErr) {
          console.error(cmErr);
          setChatError(`チャット一覧の取得に失敗: ${cmErr.message}`);
          return;
        }

        const members = (myMemberRows ?? []) as any as MemberMini[];
        const threadIds = Array.from(new Set(members.map((m) => m.thread_id).filter(Boolean)));

        if (threadIds.length === 0) return;

        // 2) thread 本体（directだけに絞る：kind = 'direct' を想定）
        const { data: thRows, error: thErr } = await supabase
          .from("chat_threads")
          .select("id, kind, created_at, updated_at")
          .in("id", threadIds)
          .eq("kind", "direct");

        if (thErr) {
          console.error(thErr);
          setChatError(`チャットスレッドの取得に失敗: ${thErr.message}`);
          return;
        }

        const threads = (thRows ?? []) as any as ThreadMini[];
        const directIds = threads.map((t) => t.id);

        if (directIds.length === 0) return;

        // 3) 参加チーム（相手名表示用）
        const { data: allMembersRows, error: memErr } = await supabase
          .from("chat_members")
          .select("thread_id, team_id")
          .in("thread_id", directIds);

        if (memErr) {
          console.error(memErr);
          setChatError(`参加チームの取得に失敗: ${memErr.message}`);
          return;
        }

        const memberTeamsByThread = new Map<string, string[]>();
        const allTeamIds: string[] = [];

        for (const r of (allMembersRows ?? []) as any[]) {
          const tid = r.thread_id as string;
          const teamId = r.team_id as string;
          if (!tid || !teamId) continue;
          if (!memberTeamsByThread.has(tid)) memberTeamsByThread.set(tid, []);
          memberTeamsByThread.get(tid)!.push(teamId);
          allTeamIds.push(teamId);
        }

        const uniqTeamIds = Array.from(new Set(allTeamIds));

        // 4) チーム名
        const teamMap = new Map<string, TeamMini>();
        if (uniqTeamIds.length > 0) {
          const { data: teamRows } = await supabase
            .from("teams")
            .select("id, name, category")
            .in("id", uniqTeamIds);

          for (const t of (teamRows ?? []) as any[]) {
            teamMap.set(t.id, { id: t.id, name: t.name ?? null, category: t.category ?? null });
          }
        }

        // 5) 最後のメッセージ（まとめて取って先頭を採用）
        const lastMsgByThread = new Map<string, LastMsgMini>();
        {
          const { data: msgRows, error: msgErr } = await supabase
            .from("chat_messages")
            .select("thread_id, body, created_at")
            .in("thread_id", directIds)
            .order("created_at", { ascending: false })
            .limit(200);

          if (msgErr) {
            console.error(msgErr);
          } else {
            for (const m of (msgRows ?? []) as any[]) {
              const tid = m.thread_id as string;
              if (!tid) continue;
              if (!lastMsgByThread.has(tid)) {
                lastMsgByThread.set(tid, { thread_id: tid, body: m.body ?? null, created_at: m.created_at });
              }
            }
          }
        }

        // 6) 自分の last_read_at（thread_id -> last_read_at）
        const myLastReadMap = new Map<string, string | null>();
        for (const r of members) {
          if (!r.thread_id) continue;
          if (!myLastReadMap.has(r.thread_id)) myLastReadMap.set(r.thread_id, r.last_read_at ?? null);
        }

        // 7) TOP表示用に整形（最大3件）
        const views: RecentThreadView[] = directIds
          .map((tid) => {
            const memberTeamIds = memberTeamsByThread.get(tid) ?? [];
            const otherTeamId =
              memberTeamIds.find((id) => id && !myTeamIds.has(id)) ??
              memberTeamIds[0] ??
              null;

            const other = otherTeamId ? teamMap.get(otherTeamId) : undefined;

            const last = lastMsgByThread.get(tid) ?? null;
            const myLastReadAt = myLastReadMap.get(tid) ?? null;

            let isUnread = false;
            if (last?.created_at) {
              if (!myLastReadAt) isUnread = true;
              else isUnread = new Date(last.created_at).getTime() > new Date(myLastReadAt).getTime();
            }

            return {
              id: tid,
              otherTeamName: other?.name ?? "相手チーム（未設定）",
              otherTeamCategory: other?.category ?? null,
              lastBody: last?.body ?? null,
              lastAt: last?.created_at ?? null,
              isUnread,
            } as any;
          })
          // 並び：未読優先 → 最終メッセージ新しい順
          .sort((a, b) => {
            const au = a.isUnread ? 1 : 0;
            const bu = b.isUnread ? 1 : 0;
            if (au !== bu) return bu - au;
            const at = a.lastAt ?? "";
            const bt = b.lastAt ?? "";
            return at > bt ? -1 : 1;
          })
          .slice(0, 3)
          .map((v) => ({
            ...v,
            lastBody: v.lastBody ? clip(v.lastBody, 40) : "（メッセージなし）",
          }));

        setRecentViews(views);
      } catch (e: any) {
        console.error(e);
        setChatError(`チャット情報の取得に失敗: ${e?.message ?? "unknown error"}`);
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
        {/* ✅ 1) マッチング */}
        <Link href="/match" style={{ ...card, textDecoration: "none" }} className="sh-card">
          <div style={cardIcon}>🗓️</div>
          <div style={cardTitle}>マッチング（探す / 募集する）</div>
          <div style={cardDesc}>カレンダーから募集を探して申込み／自分の募集も作れます（ここに集約）。</div>
          <div style={cardCta}>開く →</div>
        </Link>

        {/* ✅ 2) チャット導線（TOP簡易表示） */}
        <Link href="/chat" style={{ ...card, textDecoration: "none" }} className="sh-card">
          <div style={cardIcon}>💬</div>

          <div style={cardTitle}>
            チャット
            {meId ? (
              <span style={badge(unreadTotal)} title="未読（簡易）">
                {unreadTotal > 0 ? "未読あり" : "未読なし"}
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
            ) : recentViews.length === 0 ? (
              <div style={{ color: "#777", fontSize: 12 }}>最近のチャットはまだありません。</div>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {recentViews.map((t) => (
                  <div key={t.id} style={threadRow}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {t.isUnread ? <span style={dotGreen} aria-label="未読" /> : <span style={{ width: 8 }} />}
                      <span style={{ fontSize: 12, fontWeight: 900 }}>
                        {t.otherTeamName}
                        {t.otherTeamCategory ? `（${t.otherTeamCategory}）` : ""}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.lastBody}
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
          <li>「マッチング（探す / 募集する）」で募集枠を作る／相手の募集に申込みする</li>
          <li>承認後は「チャット」から連絡（/chat に一本化）</li>
        </ol>
      </section>
    </main>
  );
}

/** ===== styles ===== */
const wrap: React.CSSProperties = { padding: 16, maxWidth: 980, margin: "0 auto" };
const header: React.CSSProperties = { marginTop: 10 };
const title: React.CSSProperties = { margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: 0.2 };
const subTitle: React.CSSProperties = { margin: "8px 0 0", color: "#555", lineHeight: 1.6 };

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

const cardIcon: React.CSSProperties = { fontSize: 26, lineHeight: 1 };

const cardTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#111827",
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const cardDesc: React.CSSProperties = { fontSize: 13, color: "#555", lineHeight: 1.6 };
const cardCta: React.CSSProperties = { marginTop: 4, fontSize: 13, fontWeight: 800, color: "#111827" };

const noteBox: React.CSSProperties = {
  marginTop: 14,
  border: "1px solid #eee",
  borderRadius: 16,
  background: "#fafafa",
  padding: 14,
};

const noteTitle: React.CSSProperties = { fontWeight: 900, marginBottom: 6 };
const noteList: React.CSSProperties = { margin: 0, paddingLeft: 18, color: "#555", lineHeight: 1.8 };

const threadRow: React.CSSProperties = {
  border: "1px solid #f3f4f6",
  borderRadius: 10,
  padding: "8px 10px",
  background: "#fafafa",
  display: "grid",
  gap: 4,
};

const dotGreen: React.CSSProperties = {
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