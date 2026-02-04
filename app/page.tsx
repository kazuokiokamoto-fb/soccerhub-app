// app/page.tsx
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
  thread_type?: string | null; // ある環境だけ
};

type RecentThread = {
  id: string;
  created_at: string;
  updated_at: string | null;
  thread_type: string | null;

  last_message: MessageRow | null;
  unread: boolean;

  // 相手チーム表示用
  other_team_id: string | null;
  other_team_name: string | null;
  other_team_category: string | null;
};

type TeamMini = { id: string; name: string | null; category?: string | null };

export default function HomePage() {
  const [meId, setMeId] = useState<string>("");

  // ✅ 自分のチーム（最新1件）→ edit へ直行するため
  const [myTeamId, setMyTeamId] = useState<string>("");
  const myTeamHref = myTeamId ? `/teams/${myTeamId}/edit` : "/teams/new";

  const [loadingChat, setLoadingChat] = useState<boolean>(true);
  const [chatError, setChatError] = useState<string>("");

  const [recentThreads, setRecentThreads] = useState<RecentThread[]>([]);

  const unreadTotal = useMemo(() => {
    return recentThreads.reduce((sum, t) => sum + (t.unread ? 1 : 0), 0);
  }, [recentThreads]);

  // auth
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMeId(data?.user?.id ?? "");
    })();
  }, []);

  // ✅ 自分の最新チームを取得して、TOPの「自分のチーム」→ edit に飛ばす
  useEffect(() => {
    if (!meId) {
      setMyTeamId("");
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id")
        .eq("owner_id", meId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("load myTeamId error:", error);
        setMyTeamId("");
        return;
      }
      setMyTeamId((data as any)?.id ?? "");
    })();
  }, [meId]);

  // チャット一覧（最近3件表示）
  useEffect(() => {
    if (!meId) {
      setLoadingChat(false);
      setChatError("");
      setRecentThreads([]);
      return;
    }

    (async () => {
      setLoadingChat(true);
      setChatError("");

      try {
        // 0) 自分のチームID（相手判定用）
        const { data: myTeamsRows } = await supabase.from("teams").select("id").eq("owner_id", meId);
        const myTeamIds = new Set<string>((myTeamsRows ?? []).map((r: any) => r.id).filter(Boolean));

        // 1) chat_members から thread_id を取得
        const { data: myMembers, error: memErr } = await supabase
          .from("chat_members")
          .select("thread_id,last_read_at,created_at")
          .eq("user_id", meId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (memErr) {
          console.error(memErr);
          setChatError(`チャット一覧の取得に失敗: ${memErr.message}`);
          setRecentThreads([]);
          setLoadingChat(false);
          return;
        }

        const memberRows = (myMembers ?? []) as any[];
        const threadIds = Array.from(new Set(memberRows.map((r) => r.thread_id).filter(Boolean)));

        if (threadIds.length === 0) {
          setRecentThreads([]);
          setLoadingChat(false);
          return;
        }

        // thread_id -> last_read_at
        const lastReadMap = new Map<string, string | null>();
        for (const r of memberRows) {
          if (!r.thread_id) continue;
          if (!lastReadMap.has(r.thread_id)) lastReadMap.set(r.thread_id, r.last_read_at ?? null);
        }

        // 2) chat_threads（thread_type あるなら使う、無ければフォールバック）
        let thRows: ThreadDbRow[] = [];
        {
          const threadsRes = await supabase
            .from("chat_threads")
            .select("id,created_at,updated_at,thread_type")
            .in("id", threadIds);

          if (threadsRes.error) {
            const fallback = await supabase.from("chat_threads").select("id,created_at,updated_at").in("id", threadIds);

            if (fallback.error) {
              console.error(fallback.error);
              setChatError(`チャットスレッドの取得に失敗: ${fallback.error.message}`);
              setRecentThreads([]);
              setLoadingChat(false);
              return;
            }
            thRows = (fallback.data ?? []) as any;
          } else {
            thRows = (threadsRes.data ?? []) as any;
          }
        }

        // 3) 最終メッセージ
        const last = await fetchLastMessages_(threadIds);

        // 4) 参加チーム（相手チーム名表示用）
        const { data: cmTeams, error: cmTeamsErr } = await supabase
          .from("chat_members")
          .select("thread_id,team_id")
          .in("thread_id", threadIds);

        if (cmTeamsErr) console.error(cmTeamsErr);

        const memberTeamsByThread = new Map<string, string[]>();
        const allTeamIds: string[] = [];
        for (const r of (cmTeams ?? []) as any[]) {
          const tid = r.thread_id as string;
          const teamId = r.team_id as string;
          if (!tid || !teamId) continue;
          if (!memberTeamsByThread.has(tid)) memberTeamsByThread.set(tid, []);
          memberTeamsByThread.get(tid)!.push(teamId);
          allTeamIds.push(teamId);
        }
        const uniqTeamIds = Array.from(new Set(allTeamIds));

        // 5) teams からチーム名（旧 category）
        const teamMap = new Map<string, TeamMini>();
        if (uniqTeamIds.length > 0) {
          const { data: teamRows, error: teamErr } = await supabase.from("teams").select("id,name,category").in("id", uniqTeamIds);
          if (teamErr) console.error(teamErr);
          for (const t of (teamRows ?? []) as any[]) {
            teamMap.set(t.id, { id: t.id, name: t.name ?? null, category: t.category ?? null });
          }
        }

        // 6) merge
        const merged: RecentThread[] = (thRows ?? []).map((t: any) => {
          const tid = t.id as string;
          const lm = last.get(tid) ?? null;
          const lr = lastReadMap.get(tid) ?? null;

          let unread = false;
          if (lm?.created_at) {
            if (!lr) unread = true;
            else unread = new Date(lm.created_at).getTime() > new Date(lr).getTime();
          }

          const memberTeamIds = memberTeamsByThread.get(tid) ?? [];
          const otherTeamId = memberTeamIds.find((id) => !myTeamIds.has(id)) ?? memberTeamIds[0] ?? null;
          const other = otherTeamId ? teamMap.get(otherTeamId) : undefined;

          return {
            id: tid,
            created_at: t.created_at,
            updated_at: t.updated_at ?? null,
            thread_type: t.thread_type ?? null,
            last_message: lm,
            unread,

            other_team_id: otherTeamId,
            other_team_name: other?.name ?? null,
            other_team_category: other?.category ?? null,
          };
        });

        const sorted = sortRecent_(merged).slice(0, 5);
        setRecentThreads(sorted);
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

      <section style={grid} className="sh-home-grid">
        {/* 1) マッチング */}
        <Link href="/match" style={{ ...card, textDecoration: "none" }} className="sh-card">
          <div style={cardIcon}>🗓️</div>
          <div style={cardTitle}>マッチング（探す / 募集する）</div>
          <div style={cardDesc}>カレンダーから募集を探して申込み／自分の募集も作れます（ここに集約）。</div>
          <div style={cardCta}>開く →</div>
        </Link>

        {/* 2) チャット */}
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
                {recentThreads.slice(0, 3).map((t) => {
                  const titleText =
                    t.other_team_name
                      ? `${t.other_team_name}${t.other_team_category ? `（${t.other_team_category}）` : ""}`
                      : `#${t.id.slice(0, 6)}`;

                  const body = t.last_message?.body ?? "（メッセージなし）";

                  return (
                    <Link
                      key={t.id}
                      href={`/chat/${t.id}`}
                      style={{ ...threadRow, textDecoration: "none", cursor: "pointer" }}
                      aria-label={`チャットを開く: ${titleText}`}
                      onClick={(e) => {
                        // ✅ カード全体リンク（/chat）との競合を避ける
                        e.stopPropagation();
                      }}
                    >
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: "#111827" }}>{titleText}</span>
                        {t.unread ? <span style={dot} /> : null}
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
                        {body}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div style={cardCta}>開く →</div>
        </Link>

        {/* 3) 自分のチーム（✅ editへ直行 / なければ new） */}
        <Link href={myTeamHref} style={{ ...card, textDecoration: "none" }} className="sh-card">
          <div style={cardIcon}>⚙️</div>
          <div style={cardTitle}>自分のチーム</div>
          <div style={cardDesc}>
            {meId
              ? myTeamId
                ? "自分のチーム情報を編集します。"
                : "まだチームがありません。まずはチーム登録へ。"
              : "ログインするとチームを作成/編集できます。"}
          </div>
          <div style={cardCta}>{myTeamId ? "編集する →" : "登録する →"}</div>
        </Link>

        {/* 4) チーム検索（✅ 追加：他チームを探す導線） */}
        <Link href="/teams" style={{ ...card, textDecoration: "none" }} className="sh-card">
          <div style={cardIcon}>🔎</div>
          <div style={cardTitle}>チーム検索</div>
          <div style={cardDesc}>エリア・カテゴリ・キーワードでチームを検索できます。</div>
          <div style={cardCta}>開く →</div>
        </Link>
      </section>

      <section style={noteBox}>
        <div style={noteTitle}>使い方（最短）</div>
        <ol style={noteList}>
          <li>「自分のチーム」でチームを1つ作る（または編集）</li>
          <li>「マッチング（探す / 募集する）」で募集枠を作る／相手の募集に申込みする</li>
          <li>承認後は「チャット」から連絡（/chat に一本化）</li>
        </ol>
      </section>
    </main>
  );
}

/** threadIds の最新メッセージを取得（JSで thread_id ごとに先頭を採用） */
async function fetchLastMessages_(threadIds: string[]) {
  const lastByThread = new Map<string, MessageRow>();
  const limit = Math.min(2000, Math.max(200, threadIds.length * 30));

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id,thread_id,sender_id,body,created_at")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error(error);
    return lastByThread;
  }

  for (const m of (data ?? []) as any[]) {
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
  return lastByThread;
}

/** 未読優先→新しい順 */
function sortRecent_(rows: RecentThread[]) {
  return rows.sort((a, b) => {
    const au = a.unread ? 1 : 0;
    const bu = b.unread ? 1 : 0;
    if (au !== bu) return bu - au;

    const at = a.last_message?.created_at ?? a.updated_at ?? a.created_at ?? "";
    const bt = b.last_message?.created_at ?? b.updated_at ?? b.created_at ?? "";
    return at > bt ? -1 : 1;
  });
}

/** ===== styles ===== */
const wrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
};

const header: React.CSSProperties = { marginTop: 10 };

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
  //gridTemplateColumns: "repeat(3, 1fr)",
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