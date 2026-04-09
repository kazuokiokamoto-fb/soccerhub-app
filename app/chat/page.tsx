// app/chat/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";

type TeamMini = {
  id: string;
  name: string | null;
  category?: string | null;
};

type LastMsgMini = {
  thread_id: string;
  body: string | null;
  created_at: string;
};

type ThreadRow = {
  id: string;
  created_at: string;
  updated_at: string | null;

  memberTeamIds: string[];
  myLastReadAt?: string | null;

  otherTeamId?: string | null;
  otherTeamName?: string | null;
  otherTeamCategory?: string | null;

  lastMessageBody?: string | null;
  lastMessageAt?: string | null;

  isUnread?: boolean;
};

function clip(s?: string | null, n = 42) {
  const v = (s ?? "").trim();
  if (!v) return "";
  return v.length > n ? `${v.slice(0, n)}…` : v;
}

function formatLineTime(dt?: string | null) {
  if (!dt) return "";

  try {
    const d = new Date(dt);
    const now = new Date();

    const sameYear = d.getFullYear() === now.getFullYear();
    const sameDate =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    if (sameDate) {
      return d.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    if (sameYear) {
      return d.toLocaleDateString("ja-JP", {
        month: "numeric",
        day: "numeric",
      });
    }

    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function buildInitial(name?: string | null) {
  const v = (name ?? "").trim();
  if (!v) return "？";
  return v.slice(0, 1);
}

export default function ChatListPage() {
  const { user, loading: authLoading } = useAuth();
  const meId = user?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loadError, setLoadError] = useState<string>("");

  const loadThreads = useCallback(async () => {
    if (authLoading) return;

    if (!meId) {
      setThreads([]);
      setLoadError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError("");

    try {
      const { data: myTeamsRows, error: myTeamsErr } = await supabase
        .from("teams")
        .select("id")
        .eq("owner_id", meId);

      if (myTeamsErr) {
        throw myTeamsErr;
      }

      const myTeamIds = new Set<string>(
        ((myTeamsRows ?? []) as Array<{ id: string }>)
          .map((r) => r.id)
          .filter(Boolean)
      );

      const { data: myMemberRows, error: cmErr } = await supabase
        .from("chat_members")
        .select("thread_id,last_read_at,created_at")
        .eq("user_id", meId)
        .order("created_at", { ascending: false })
        .limit(200);

      if (cmErr) {
        throw cmErr;
      }

      const typedMemberRows = (myMemberRows ?? []) as Array<{
        thread_id: string;
        last_read_at?: string | null;
        created_at?: string | null;
      }>;

      const threadIds = Array.from(
        new Set(typedMemberRows.map((r) => r.thread_id).filter(Boolean))
      );

      const myLastReadMap = new Map<string, string | null>();
      for (const r of typedMemberRows) {
        if (!r.thread_id) continue;
        if (!myLastReadMap.has(r.thread_id)) {
          myLastReadMap.set(r.thread_id, r.last_read_at ?? null);
        }
      }

      if (threadIds.length === 0) {
        setThreads([]);
        setLoading(false);
        return;
      }

      const [
        { data: thRows, error: thErr },
        { data: membersRows, error: membersErr },
      ] = await Promise.all([
        supabase
          .from("chat_threads")
          .select("id,created_at,updated_at")
          .in("id", threadIds),
        supabase
          .from("chat_members")
          .select("thread_id,team_id,user_id,last_read_at")
          .in("thread_id", threadIds),
      ]);

      if (thErr) throw thErr;
      if (membersErr) throw membersErr;

      const typedThreads = (thRows ?? []) as Array<{
        id: string;
        created_at: string;
        updated_at: string | null;
      }>;

      const typedMembers = (membersRows ?? []) as Array<{
        thread_id: string;
        team_id: string | null;
        user_id?: string | null;
        last_read_at?: string | null;
      }>;

      const memberTeamsByThread = new Map<string, string[]>();
      const allTeamIds: string[] = [];

      for (const r of typedMembers) {
        const tid = r.thread_id;
        const teamId = r.team_id ?? "";
        if (!tid || !teamId) continue;

        if (!memberTeamsByThread.has(tid)) {
          memberTeamsByThread.set(tid, []);
        }

        const arr = memberTeamsByThread.get(tid)!;
        if (!arr.includes(teamId)) {
          arr.push(teamId);
          allTeamIds.push(teamId);
        }
      }

      const uniqTeamIds = Array.from(new Set(allTeamIds));
      const teamMap = new Map<string, TeamMini>();

      if (uniqTeamIds.length > 0) {
        const { data: teamRows, error: teamErr } = await supabase
          .from("teams")
          .select("id,name,category")
          .in("id", uniqTeamIds);

        if (teamErr) {
          throw teamErr;
        }

        for (const t of ((teamRows ?? []) as Array<{
          id: string;
          name: string | null;
          category?: string | null;
        }>)) {
          teamMap.set(t.id, {
            id: t.id,
            name: t.name ?? null,
            category: t.category ?? null,
          });
        }
      }

      const lastMsgByThread = new Map<string, LastMsgMini>();

      const { data: msgRows, error: msgErr } = await supabase
        .from("chat_messages")
        .select("thread_id,body,created_at")
        .in("thread_id", threadIds)
        .order("created_at", { ascending: false })
        .limit(Math.min(5000, Math.max(500, threadIds.length * 50)));

      if (msgErr) {
        throw msgErr;
      }

      for (const m of ((msgRows ?? []) as Array<{
        thread_id: string;
        body: string | null;
        created_at: string;
      }>)) {
        if (!m.thread_id) continue;
        if (!lastMsgByThread.has(m.thread_id)) {
          lastMsgByThread.set(m.thread_id, {
            thread_id: m.thread_id,
            body: m.body ?? null,
            created_at: m.created_at,
          });
        }
      }

      const merged: ThreadRow[] = typedThreads.map((t) => {
        const tid = t.id;
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
          if (!myLastReadAt) {
            isUnread = true;
          } else {
            isUnread =
              new Date(last.created_at).getTime() >
              new Date(myLastReadAt).getTime();
          }
        }

        return {
          id: t.id,
          created_at: t.created_at,
          updated_at: t.updated_at ?? null,
          memberTeamIds,
          myLastReadAt,
          otherTeamId,
          otherTeamName: otherTeam?.name ?? null,
          otherTeamCategory: otherTeam?.category ?? null,
          lastMessageBody: last?.body ?? null,
          lastMessageAt: last?.created_at ?? null,
          isUnread,
        };
      });

      merged.sort((a, b) => {
        const au = a.isUnread ? 1 : 0;
        const bu = b.isUnread ? 1 : 0;
        if (au !== bu) return bu - au;

        const at = a.lastMessageAt ?? a.updated_at ?? a.created_at ?? "";
        const bt = b.lastMessageAt ?? b.updated_at ?? b.created_at ?? "";
        return bt.localeCompare(at);
      });

      setThreads(merged);
    } catch (e: any) {
      console.error("[chat list] load error:", e);
      setThreads([]);
      setLoadError(e?.message ?? "チャット一覧の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [authLoading, meId]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!meId) return;

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadThreads();
      }
    };

    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [meId, loadThreads]);

  useEffect(() => {
    if (!meId) return;

    const channel = supabase
      .channel(`chat-list-${meId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_messages" },
        () => {
          void loadThreads();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_members" },
        () => {
          void loadThreads();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_threads" },
        () => {
          void loadThreads();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [meId, loadThreads]);

  const unreadTotal = useMemo(() => {
    return threads.reduce((sum, t) => sum + (t.isUnread ? 1 : 0), 0);
  }, [threads]);

  return (
    <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <AppTabNav />

      <AppHero
        icon="💬"
        title="チャット"
        desc="相手チームとの連絡、日程調整、会場確認などをここでやり取りできます。"
      />

      <div style={summaryBox}>
        <div style={summaryTitle}>チャット一覧</div>
        <div style={summaryText}>
          {authLoading || loading
            ? "読み込み中…"
            : `スレッド ${threads.length}件 / 未読 ${unreadTotal}件`}
        </div>
      </div>

      {authLoading || loading ? (
        <div style={emptyBox}>読み込み中…</div>
      ) : !meId ? (
        <div style={emptyBox}>
          ログインが必要です。
          <br />
          <div style={{ marginTop: 12 }}>
            <Link href="/login?redirect=/chat" className="sh-btn sh-btn--primary">
              ログインする
            </Link>
          </div>
        </div>
      ) : loadError ? (
        <div style={emptyBox}>
          {loadError}
          <br />
          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={() => void loadThreads()}
            >
              再読み込み
            </button>
          </div>
        </div>
      ) : threads.length === 0 ? (
        <div style={emptyBox}>
          まだチャットはありません。
          <br />
          試合申込や招待送信後に、ここへスレッドが表示されます。
        </div>
      ) : (
        <div style={listWrap}>
          {threads.map((t, index) => {
            const title = t.otherTeamName || "相手チーム";
            const category = t.otherTeamCategory || "";
            const body = t.lastMessageBody
              ? clip(t.lastMessageBody, 46)
              : "まだメッセージがありません";
            const time = formatLineTime(
              t.lastMessageAt ?? t.updated_at ?? t.created_at
            );

            return (
              <Link
                key={t.id}
                href={`/chat/${t.id}?from=chat-list`}
                style={{
                  ...threadCard,
                  borderBottom:
                    index === threads.length - 1
                      ? "none"
                      : "1px solid #edf1ee",
                }}
              >
                <div style={avatar}>{buildInitial(title)}</div>

                <div style={threadMain}>
                  <div style={threadTopRow}>
                    <div style={threadNameRow}>
                      <div style={threadName}>{title}</div>
                      {category ? (
                        <div style={threadCategory}>{category}</div>
                      ) : null}
                    </div>

                    <div style={threadMeta}>
                      <span style={threadTime}>{time}</span>
                      {t.isUnread ? <span style={unreadDot} /> : null}
                    </div>
                  </div>

                  <div
                    style={{
                      ...threadBody,
                      ...(t.isUnread ? threadBodyUnread : null),
                    }}
                  >
                    {body}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

const summaryBox: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #e5ece7",
  background: "#fff",
};

const summaryTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#1f5d30",
};

const summaryText: React.CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#66756d",
};

const listWrap: React.CSSProperties = {
  display: "grid",
  gap: 0,
  marginTop: 8,
  borderRadius: 18,
  overflow: "hidden",
  border: "1px solid #e5ece7",
  background: "#fff",
};

const threadCard: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "56px 1fr",
  gap: 12,
  alignItems: "center",
  padding: "14px 14px",
  textDecoration: "none",
  color: "#111",
  background: "#fff",
};

const avatar: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 999,
  background: "#e8f5eb",
  color: "#145c2a",
  fontWeight: 900,
  fontSize: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const threadMain: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 6,
};

const threadTopRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 10,
};

const threadNameRow: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 2,
};

const threadName: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "#1f2937",
  lineHeight: 1.3,
};

const threadCategory: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.3,
};

const threadMeta: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  flexShrink: 0,
};

const threadTime: React.CSSProperties = {
  fontSize: 11,
  color: "#6b7280",
  whiteSpace: "nowrap",
};

const unreadDot: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: 999,
  background: "#22c55e",
  display: "inline-block",
  flexShrink: 0,
};

const threadBody: React.CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  lineHeight: 1.5,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const threadBodyUnread: React.CSSProperties = {
  color: "#374151",
  fontWeight: 700,
};

const emptyBox: React.CSSProperties = {
  marginTop: 12,
  padding: 20,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
  color: "#666",
  lineHeight: 1.8,
  textAlign: "center",
};