"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import { useAuth } from "@/app/lib/auth";
import AppHero from "@/app/components/AppHero";
import AppTabNav from "@/app/components/AppTabNav";

type ChatTab = "team" | "battle";

type TeamMini = {
  id: string;
  name: string | null;
  category?: string | null;
};

type TeamChatRow = TeamMini & {
  threadId?: string | null;
  lastMessageBody?: string | null;
  lastMessageAt?: string | null;
  isUnread?: boolean;
};

type ThreadSummary = {
  id: string;
  created_at: string;
  updated_at: string | null;
};

type ChatMemberRow = {
  thread_id: string;
  team_id: string | null;
  last_read_at?: string | null;
  created_at?: string | null;
};

type ChatMessageRow = {
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function toArray<T>(value: unknown, mapper: (v: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.map(mapper).filter((v): v is T => v !== null);
}

function toTeamMini(value: unknown): TeamMini | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  if (!id) return null;

  return {
    id,
    name: asNullableString(r.name),
    category: asNullableString(r.category),
  };
}

function toThreadSummary(value: unknown): ThreadSummary | null {
  const r = asRecord(value);
  if (!r) return null;

  const id = asString(r.id);
  const created_at = asString(r.created_at);

  if (!id || !created_at) return null;

  return {
    id,
    created_at,
    updated_at: asNullableString(r.updated_at),
  };
}

function toChatMemberRow(value: unknown): ChatMemberRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const thread_id = asString(r.thread_id);
  if (!thread_id) return null;

  return {
    thread_id,
    team_id: asNullableString(r.team_id),
    last_read_at: asNullableString(r.last_read_at),
    created_at: asNullableString(r.created_at),
  };
}

function toChatMessageRow(value: unknown): ChatMessageRow | null {
  const r = asRecord(value);
  if (!r) return null;

  const thread_id = asString(r.thread_id);
  const created_at = asString(r.created_at);

  if (!thread_id || !created_at) return null;

  return {
    thread_id,
    body: asNullableString(r.body),
    created_at,
  };
}

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

  const [loading, setLoading] = useState(true);
  const [teamChats, setTeamChats] = useState<TeamChatRow[]>([]);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [activeTab, setActiveTab] = useState<ChatTab>("team");

  const mountedRef = useRef(true);
  const loadingRef = useRef(false);

  const meId = user?.id ?? "";

  const loadThreads = useCallback(async () => {
    if (authLoading) return;
    if (loadingRef.current) return;

    if (!meId) {
      if (!mountedRef.current) return;
      setTeamChats([]);
      setThreads([]);
      setLoadError("");
      setLoading(false);
      return;
    }

    loadingRef.current = true;

    if (mountedRef.current) {
      setLoading(true);
      setLoadError("");
    }

    try {
      const ownerTeamsRes = await supabase
        .from("teams")
        .select("id")
        .eq("owner_id", meId);

      if (ownerTeamsRes.error) throw ownerTeamsRes.error;

      const memberTeamsRes = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", meId);

      if (memberTeamsRes.error) throw memberTeamsRes.error;

      const ownerTeamIds = toArray(ownerTeamsRes.data, (v) => {
        const r = asRecord(v);
        const id = r ? asString(r.id) : "";
        return id || null;
      });

      const memberTeamIds = toArray(memberTeamsRes.data, (v) => {
        const r = asRecord(v);
        const id = r ? asString(r.team_id) : "";
        return id || null;
      });

      const myTeamIdList = Array.from(new Set([...ownerTeamIds, ...memberTeamIds]));
      const myTeamIds = new Set<string>(myTeamIdList);

      const myMemberRes = await supabase
        .from("chat_members")
        .select("thread_id,last_read_at,created_at")
        .eq("user_id", meId)
        .order("created_at", { ascending: false })
        .limit(300);

      if (myMemberRes.error) throw myMemberRes.error;

      const myMemberRows = toArray(myMemberRes.data, toChatMemberRow);

      const threadIds = Array.from(
        new Set(myMemberRows.map((r) => r.thread_id).filter(Boolean))
      );

      const myLastReadMap = new Map<string, string | null>();
      for (const r of myMemberRows) {
        if (!myLastReadMap.has(r.thread_id)) {
          myLastReadMap.set(r.thread_id, r.last_read_at ?? null);
        }
      }

      let threadRows: ThreadSummary[] = [];
      let memberRows: ChatMemberRow[] = [];
      let messageRows: ChatMessageRow[] = [];

      if (threadIds.length > 0) {
        const thRes = await supabase
          .from("chat_threads")
          .select("id,created_at,updated_at")
          .in("id", threadIds);

        if (thRes.error) throw thRes.error;

        const membersRes = await supabase
          .from("chat_members")
          .select("thread_id,team_id")
          .in("thread_id", threadIds);

        if (membersRes.error) throw membersRes.error;

        const msgRes = await supabase
          .from("chat_messages")
          .select("thread_id,body,created_at")
          .in("thread_id", threadIds)
          .order("created_at", { ascending: false })
          .limit(1500);

        if (msgRes.error) throw msgRes.error;

        threadRows = toArray(thRes.data, toThreadSummary);
        memberRows = toArray(membersRes.data, toChatMemberRow);
        messageRows = toArray(msgRes.data, toChatMessageRow);
      }

      const memberTeamsByThread = new Map<string, string[]>();
      const allTeamIds: string[] = [...myTeamIdList];

      for (const r of memberRows) {
        const tid = r.thread_id;
        const teamId = r.team_id ?? "";
        if (!tid || !teamId) continue;

        if (!memberTeamsByThread.has(tid)) {
          memberTeamsByThread.set(tid, []);
        }

        memberTeamsByThread.get(tid)!.push(teamId);
        allTeamIds.push(teamId);
      }

      const uniqTeamIds = Array.from(new Set(allTeamIds));
      const teamMap = new Map<string, TeamMini>();

      if (uniqTeamIds.length > 0) {
        const teamRes = await supabase
          .from("teams")
          .select("id,name,category")
          .in("id", uniqTeamIds);

        if (teamRes.error) throw teamRes.error;

        for (const t of toArray(teamRes.data, toTeamMini)) {
          teamMap.set(t.id, t);
        }
      }

      const lastMsgByThread = new Map<string, ChatMessageRow>();
      for (const m of messageRows) {
        if (!lastMsgByThread.has(m.thread_id)) {
          lastMsgByThread.set(m.thread_id, m);
        }
      }

      const internalThreadByTeamId = new Map<string, ThreadRow>();
      const battleThreads: ThreadRow[] = [];

      for (const t of threadRows) {
        const tid = t.id;
        const memberTeamIds = Array.from(
          new Set((memberTeamsByThread.get(tid) ?? []).filter(Boolean))
        );

        const otherTeamId =
          memberTeamIds.find((id) => !myTeamIds.has(id)) ?? null;

        const last = lastMsgByThread.get(tid);
        const myLastReadAt = myLastReadMap.get(tid) ?? null;

        let isUnread = false;
        if (last?.created_at) {
          isUnread = !myLastReadAt
            ? true
            : new Date(last.created_at).getTime() >
              new Date(myLastReadAt).getTime();
        }

        const base: ThreadRow = {
          id: t.id,
          created_at: t.created_at,
          updated_at: t.updated_at ?? null,
          memberTeamIds,
          myLastReadAt,
          lastMessageBody: last?.body ?? null,
          lastMessageAt: last?.created_at ?? null,
          isUnread,
        };

        if (otherTeamId) {
          const otherTeam = teamMap.get(otherTeamId);

          battleThreads.push({
            ...base,
            otherTeamId,
            otherTeamName: otherTeam?.name ?? null,
            otherTeamCategory: otherTeam?.category ?? null,
          });
        } else {
          const internalTeamId =
            memberTeamIds.find((id) => myTeamIds.has(id)) ?? "";

          if (internalTeamId) {
            const current = internalThreadByTeamId.get(internalTeamId);
            const currentTime =
              current?.lastMessageAt ?? current?.updated_at ?? current?.created_at ?? "";
            const nextTime =
              base.lastMessageAt ?? base.updated_at ?? base.created_at ?? "";

            if (!current || nextTime > currentTime) {
              internalThreadByTeamId.set(internalTeamId, base);
            }
          }
        }
      }

      battleThreads.sort((a, b) => {
        const au = a.isUnread ? 1 : 0;
        const bu = b.isUnread ? 1 : 0;
        if (au !== bu) return bu - au;

        const at = a.lastMessageAt ?? a.updated_at ?? a.created_at ?? "";
        const bt = b.lastMessageAt ?? b.updated_at ?? b.created_at ?? "";
        return at > bt ? -1 : 1;
      });

      const nextTeamChats: TeamChatRow[] = myTeamIdList
        .map((id) => {
          const team = teamMap.get(id) ?? {
            id,
            name: "チーム未設定",
            category: null,
          };

          const internal = internalThreadByTeamId.get(id);

          return {
            ...team,
            threadId: internal?.id ?? null,
            lastMessageBody: internal?.lastMessageBody ?? null,
            lastMessageAt: internal?.lastMessageAt ?? null,
            isUnread: !!internal?.isUnread,
          };
        })
        .sort((a, b) => {
          const au = a.isUnread ? 1 : 0;
          const bu = b.isUnread ? 1 : 0;
          if (au !== bu) return bu - au;

          const at = a.lastMessageAt ?? "";
          const bt = b.lastMessageAt ?? "";
          if (at || bt) return at > bt ? -1 : 1;

          return String(a.name ?? "").localeCompare(String(b.name ?? ""));
        });

      if (!mountedRef.current) return;

      setTeamChats(nextTeamChats);
      setThreads(battleThreads);
    } catch (e: any) {
      console.error("chat page load error:", e);
      if (!mountedRef.current) return;

      setTeamChats([]);
      setThreads([]);
      setLoadError(e?.message ?? "チャット一覧の取得に失敗しました");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
      loadingRef.current = false;
    }
  }, [authLoading, meId]);

  useEffect(() => {
    mountedRef.current = true;
    void loadThreads();

    return () => {
      mountedRef.current = false;
    };
  }, [loadThreads]);

  const battleUnreadTotal = useMemo(() => {
    return threads.reduce((sum, t) => sum + (t.isUnread ? 1 : 0), 0);
  }, [threads]);

  const teamUnreadTotal = useMemo(() => {
    return teamChats.reduce((sum, t) => sum + (t.isUnread ? 1 : 0), 0);
  }, [teamChats]);

  return (
    <main style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <AppTabNav />

      <AppHero
        icon="💬"
        title="チャット"
        desc="チーム内連絡と、対戦チームとの日程調整・会場確認ができます。"
      />

      {loadError ? (
        <div style={errorBox}>
          <div style={errorTitle}>読み込みエラー</div>
          <div>{loadError}</div>
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              className="sh-btn sh-btn--primary"
              onClick={() => void loadThreads()}
            >
              再読み込み
            </button>
          </div>
        </div>
      ) : null}

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
      ) : teamChats.length === 0 && threads.length === 0 ? (
        <div style={emptyBox}>
          まだチャットはありません。
          <br />
          チーム登録、試合申込、招待送信後にここへ表示されます。
        </div>
      ) : (
        <>
          <div style={tabWrap}>
            <button
              type="button"
              style={{
                ...tabButton,
                ...(activeTab === "team" ? tabButtonActive : null),
              }}
              onClick={() => setActiveTab("team")}
            >
              <span style={tabInner}>
                自チーム
                {teamUnreadTotal > 0 ? (
                  <span
                    style={
                      activeTab === "team"
                        ? tabUnreadBadgeActive
                        : tabUnreadBadge
                    }
                  >
                    {teamUnreadTotal}
                  </span>
                ) : null}
              </span>
            </button>

            <button
              type="button"
              style={{
                ...tabButton,
                ...(activeTab === "battle" ? tabButtonActive : null),
              }}
              onClick={() => setActiveTab("battle")}
            >
              <span style={tabInner}>
                他チーム
                {battleUnreadTotal > 0 ? (
                  <span
                    style={
                      activeTab === "battle"
                        ? tabUnreadBadgeActive
                        : tabUnreadBadge
                    }
                  >
                    {battleUnreadTotal}
                  </span>
                ) : null}
              </span>
            </button>
          </div>

          {activeTab === "team" ? (
            <section style={sectionBox}>
              {teamChats.length === 0 ? (
                <div style={miniEmptyBox}>所属チームがありません。</div>
              ) : (
                <div style={listWrap}>
                  {teamChats.map((team, index) => {
                    const body = team.lastMessageBody
                      ? clip(team.lastMessageBody, 46)
                      : "チームメンバーへの連絡";
                    const time = formatLineTime(team.lastMessageAt);

                    return (
                      <Link
                        key={team.id}
                        href={
                          team.threadId
                            ? `/chat/${team.threadId}?from=team-message&teamId=${team.id}`
                            : `/teams/${team.id}/message`
                        }
                        style={{
                          ...threadCard,
                          borderBottom:
                            index === teamChats.length - 1
                              ? "none"
                              : "1px solid #edf1ee",
                        }}
                      >
                        <div style={avatar}>{buildInitial(team.name)}</div>

                        <div style={threadMain}>
                          <div style={threadTopRow}>
                            <div style={threadNameRow}>
                              <div style={threadName}>
                                {team.name || "チーム未設定"}
                              </div>
                              {team.category ? (
                                <div style={threadCategory}>{team.category}</div>
                              ) : null}
                            </div>

                            <div style={threadMeta}>
                              <span style={threadTime}>{time}</span>
                              {team.isUnread ? <span style={unreadDot} /> : null}
                            </div>
                          </div>

                          <div
                            style={{
                              ...threadBody,
                              ...(team.isUnread ? threadBodyUnread : null),
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
            </section>
          ) : (
            <section style={sectionBox}>
              {threads.length === 0 ? (
                <div style={miniEmptyBox}>他チームとのチャットはまだありません。</div>
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
            </section>
          )}
        </>
      )}
    </main>
  );
}

const errorBox: React.CSSProperties = {
  marginTop: 12,
  marginBottom: 12,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#991b1b",
  lineHeight: 1.7,
};

const errorTitle: React.CSSProperties = {
  fontWeight: 900,
  marginBottom: 4,
};

const tabWrap: React.CSSProperties = {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  padding: 4,
  borderRadius: 999,
  border: "1px solid #dce9df",
  background: "#edf5ef",
};

const tabButton: React.CSSProperties = {
  minHeight: 52,
  borderRadius: 999,
  border: "none",
  background: "#edf5ef",
  color: "#145c2a",
  fontSize: 15,
  fontWeight: 900,
  cursor: "pointer",
};

const tabButtonActive: React.CSSProperties = {
  background: "#145c2a",
  color: "#fff",
  boxShadow: "0 4px 12px rgba(20,92,42,0.25)",
};

const tabInner: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

const tabUnreadBadge: React.CSSProperties = {
  minWidth: 20,
  height: 20,
  padding: "0 6px",
  borderRadius: 999,
  background: "#ef4444",
  color: "#fff",
  fontSize: 11,
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const tabUnreadBadgeActive: React.CSSProperties = {
  ...tabUnreadBadge,
  background: "#fff",
  color: "#145c2a",
};

const sectionBox: React.CSSProperties = {
  marginTop: 14,
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

const miniEmptyBox: React.CSSProperties = {
  marginTop: 8,
  padding: 16,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
  color: "#66756d",
  lineHeight: 1.7,
};