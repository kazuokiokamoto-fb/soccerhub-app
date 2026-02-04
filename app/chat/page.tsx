// app/chat/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import type { ChatThread } from "./types";

type TeamMini = { id: string; name: string | null; category?: string | null };
type LastMsgMini = { thread_id: string; body: string | null; created_at: string };

type ThreadRow = ChatThread & {
  // 👇 DBに無い可能性があるので「表示用の名前」を別で持つ
  threadType?: string | null;

  memberTeamIds: string[];
  myLastReadAt?: string | null;

  otherTeamId?: string | null;
  otherTeamName?: string | null;
  otherTeamCategory?: string | null;

  lastMessageBody?: string | null;
  lastMessageAt?: string | null;

  isUnread?: boolean;
};

function toJstLocal(dt?: string | null) {
  if (!dt) return "";
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return "";
  }
}

function clip(s?: string | null, n = 34) {
  const v = (s ?? "").trim();
  if (!v) return "";
  return v.length > n ? v.slice(0, n) + "…" : v;
}

export default function ChatListPage() {
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [meId, setMeId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMeId(data?.user?.id ?? "");
    })();
  }, []);

  useEffect(() => {
    if (!meId) return;

    (async () => {
      setLoading(true);
      try {
        // 1) 自分の所属チーム（相手判定に使う）
        const { data: myTeamsRows, error: myTeamsErr } = await supabase
          .from("teams")
          .select("id")
          .eq("owner_id", meId);

        if (myTeamsErr) console.error(myTeamsErr);
        const myTeamIds = new Set<string>((myTeamsRows ?? []).map((r: any) => r.id).filter(Boolean));

        // 2) 自分の chat_members（thread_id & last_read_at）
        const { data: myMemberRows, error: cmErr } = await supabase
          .from("chat_members")
          .select("thread_id, last_read_at, created_at")
          .eq("user_id", meId)
          .order("created_at", { ascending: false });

        if (cmErr) {
          console.error(cmErr);
          setThreads([]);
          return;
        }

        const threadIds = Array.from(new Set((myMemberRows ?? []).map((r: any) => r.thread_id).filter(Boolean)));
        const myLastReadMap = new Map<string, string | null>();
        for (const r of myMemberRows ?? []) {
          if (!r.thread_id) continue;
          if (!myLastReadMap.has(r.thread_id)) myLastReadMap.set(r.thread_id, (r as any).last_read_at ?? null);
        }

        if (threadIds.length === 0) {
          setThreads([]);
          return;
        }

        // 3) thread 本体（✅ kind は取らない）
        // thread_type がある環境だけ使う。無い環境はフォールバック。
        const thRes = await supabase
          .from("chat_threads")
          .select("id, created_at, updated_at, thread_type")
          .in("id", threadIds);

        let thRows: any[] = [];
        if (thRes.error) {
          // thread_type 列も無い場合
          const thRes2 = await supabase
            .from("chat_threads")
            .select("id, created_at, updated_at")
            .in("id", threadIds);

          if (thRes2.error) {
            console.error(thRes2.error);
            setThreads([]);
            return;
          }
          thRows = (thRes2.data ?? []) as any[];
        } else {
          thRows = (thRes.data ?? []) as any[];
        }

        // 4) 各スレッドの参加チーム
        const { data: membersRows, error: membersErr } = await supabase
          .from("chat_members")
          .select("thread_id, team_id")
          .in("thread_id", threadIds);

        if (membersErr) {
          console.error(membersErr);
          setThreads([]);
          return;
        }

        const memberTeamsByThread = new Map<string, string[]>();
        const allTeamIds: string[] = [];

        for (const r of membersRows ?? []) {
          const tid = (r as any).thread_id as string;
          const teamId = (r as any).team_id as string;
          if (!tid || !teamId) continue;
          if (!memberTeamsByThread.has(tid)) memberTeamsByThread.set(tid, []);
          memberTeamsByThread.get(tid)!.push(teamId);
          allTeamIds.push(teamId);
        }

        const uniqTeamIds = Array.from(new Set(allTeamIds));

        // 5) チーム名（表示用）
        const teamMap = new Map<string, TeamMini>();
        if (uniqTeamIds.length > 0) {
          const { data: teamRows, error: teamErr } = await supabase
            .from("teams")
            .select("id, name, category")
            .in("id", uniqTeamIds);

          if (teamErr) {
            console.error(teamErr);
          } else {
            for (const t of (teamRows ?? []) as any[]) {
              teamMap.set(t.id, { id: t.id, name: t.name ?? null, category: t.category ?? null });
            }
          }
        }

        // 6) 最後のメッセージ
        const lastMsgByThread = new Map<string, LastMsgMini>();
        {
          const limit = Math.min(2000, Math.max(400, threadIds.length * 50));
          const { data: msgRows, error: msgErr } = await supabase
            .from("chat_messages")
            .select("thread_id, body, created_at")
            .in("thread_id", threadIds)
            .order("created_at", { ascending: false })
            .limit(limit);

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

        // 7) 整形（相手チーム名 + 未読判定）
        const merged: ThreadRow[] = (thRows ?? []).map((t) => {
          const tid = t.id as string;
          const memberTeamIds = memberTeamsByThread.get(tid) ?? [];

          const otherTeamId =
            memberTeamIds.find((id) => !myTeamIds.has(id)) ??
            memberTeamIds[0] ??
            null;

          const otherTeam = otherTeamId ? teamMap.get(otherTeamId) : undefined;
          const last = lastMsgByThread.get(tid);
          const myLastReadAt = myLastReadMap.get(tid) ?? null;

          let isUnread = false;
          if (last?.created_at) {
            if (!myLastReadAt) isUnread = true;
            else isUnread = new Date(last.created_at).getTime() > new Date(myLastReadAt).getTime();
          }

          return {
            id: t.id,
            created_at: t.created_at,
            updated_at: t.updated_at ?? null,
            // ChatThread の kind は使わないので null にしておく
            kind: null,

            // 表示用
            threadType: (t as any).thread_type ?? null,

            memberTeamIds,
            myLastReadAt,

            otherTeamId,
            otherTeamName: otherTeam?.name ?? null,
            otherTeamCategory: otherTeam?.category ?? null,

            lastMessageBody: last?.body ?? null,
            lastMessageAt: last?.created_at ?? null,

            isUnread,
          } as ThreadRow;
        });

        // 並び：未読優先 → 最終更新順
        merged.sort((a, b) => {
          const au = a.isUnread ? 1 : 0;
          const bu = b.isUnread ? 1 : 0;
          if (au !== bu) return bu - au;

          const at = a.lastMessageAt ?? a.updated_at ?? a.created_at ?? "";
          const bt = b.lastMessageAt ?? b.updated_at ?? b.created_at ?? "";
          return at > bt ? -1 : 1;
        });

        setThreads(merged);
      } finally {
        setLoading(false);
      }
    })();
  }, [meId]);

  const emptyText = useMemo(() => {
    if (loading) return "";
    if (threads.length > 0) return "";
    return "スレッドがありません（マッチング詳細の「チャットを開く」から作成されます）";
  }, [loading, threads.length]);

  return (
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>チャット</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="sh-btn" href="/">トップ</Link>
          <Link className="sh-btn" href="/teams">チーム</Link>
          <Link className="sh-btn" href="/match">マッチング</Link>
        </div>
      </header>

      {loading ? <p style={{ color: "#666" }}>読み込み中…</p> : null}
      {!loading && emptyText ? <p style={{ color: "#666" }}>{emptyText}</p> : null}

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {threads.map((t) => {
          const title =
            t.otherTeamName
              ? `${t.otherTeamName}${t.otherTeamCategory ? `（${t.otherTeamCategory}）` : ""}`
              : "相手チーム（未設定）";

          const lastLine = t.lastMessageBody ? clip(t.lastMessageBody, 40) : "（まだメッセージがありません）";
          const timeLine = t.lastMessageAt
            ? `最終: ${toJstLocal(t.lastMessageAt)}`
            : t.updated_at
            ? `更新: ${toJstLocal(t.updated_at)}`
            : t.created_at
            ? `作成: ${toJstLocal(t.created_at)}`
            : "";

          return (
            <Link
              key={t.id}
              href={`/chat/${t.id}`}
              className="sh-btn"
              style={{
                display: "block",
                padding: 12,
                borderRadius: 12,
                border: "1px solid #eee",
                background: t.isUnread ? "#f0f9ff" : "#fff",
                textAlign: "left",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {t.isUnread ? <span style={dot} aria-label="未読">●</span> : <span style={{ width: 10 }} />}
                <div style={{ fontWeight: t.isUnread ? 900 : 800, fontSize: 16 }}>{title}</div>
              </div>

              <div
                style={{
                  marginTop: 6,
                  color: "#374151",
                  fontSize: 13,
                  lineHeight: 1.6,
                  fontWeight: t.isUnread ? 800 : 400,
                }}
              >
                {lastLine}
              </div>

              <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span>{timeLine}</span>
                <span>type: {t.threadType ?? "unknown"}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}

const dot: React.CSSProperties = {
  color: "#16a34a",
  fontSize: 10,
  lineHeight: 1,
};