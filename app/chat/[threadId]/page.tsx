"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { categoryLabel } from "@/app/lib/categories";
import { getUnifiedBadgeCount, syncAppBadge } from "@/app/lib/badge";

type Msg = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  sender_team_id: string | null;
  body: string | null;
  created_at: string;
};

type TeamMini = {
  id: string;
  name: string | null;
  category?: string | null;
};

type ChatMemberRow = {
  thread_id: string;
  user_id?: string | null;
  team_id?: string | null;
  last_read_at: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function formatBubbleTime(dt?: string | null) {
  if (!dt) return "";
  try {
    const d = new Date(dt);
    return d.toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatDateDivider(dt?: string | null) {
  if (!dt) return "";
  try {
    const d = new Date(dt);
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      weekday: "short",
    });
  } catch {
    return "";
  }
}

function formatReadTime(dt?: string | null) {
  if (!dt) return "";
  try {
    const d = new Date(dt);
    return d.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function sameDate(a?: string | null, b?: string | null) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function buildQueryString(params: {
  from?: string | null;
  slotId?: string | null;
  date?: string | null;
}) {
  const qs = new URLSearchParams();

  if (params.from) qs.set("from", params.from);
  if (params.slotId) qs.set("slotId", params.slotId);
  if (params.date) qs.set("date", params.date);

  return qs.toString();
}

function getBackLink(params: {
  from?: string | null;
  slotId?: string | null;
  date?: string | null;
}) {
  const { from, slotId, date } = params;

  switch (from) {
    case "match-calendar": {
      const qs = new URLSearchParams();
      if (date) qs.set("date", date);
      if (slotId) qs.set("slotId", slotId);

      return {
        href: qs.toString() ? `/match?${qs.toString()}` : "/match",
        label: "← 試合を探すに戻る",
      };
    }

    case "sent-offers":
      return {
        href: "/match/status/offers",
        label: "← 送ったオファーへ",
      };

    case "received-offers":
      return {
        href: "/match/status/offers-received",
        label: "← 届いたオファーへ",
      };

    case "chat-list":
      return {
        href: "/chat",
        label: "← 一覧",
      };

    default:
      return {
        href: "/chat",
        label: "← 一覧",
      };
  }
}

function resolveMyTeamId(params: {
  meId: string;
  memberRows: ChatMemberRow[];
  ownedTeams: TeamMini[];
}) {
  const { meId, memberRows, ownedTeams } = params;

  const ownedTeamIds = new Set(ownedTeams.map((t) => t.id).filter(Boolean));

  const myOwnMemberRow = memberRows.find(
    (r) => r.user_id === meId && r.team_id && ownedTeamIds.has(r.team_id)
  );
  if (myOwnMemberRow?.team_id) {
    return myOwnMemberRow.team_id;
  }

  const matchedMemberTeamId = memberRows.find(
    (r) => r.team_id && ownedTeamIds.has(r.team_id)
  )?.team_id;
  if (matchedMemberTeamId) {
    return matchedMemberTeamId;
  }

  if (ownedTeams.length === 1) {
    return ownedTeams[0].id;
  }

  return ownedTeams[0]?.id ?? "";
}

function isOptimisticMessageId(id?: string | null) {
  return String(id ?? "").startsWith("optimistic-");
}

function isReadByOther(params: {
  messageCreatedAt?: string | null;
  otherLastReadAt?: string | null;
}) {
  const { messageCreatedAt, otherLastReadAt } = params;
  if (!messageCreatedAt || !otherLastReadAt) return false;

  try {
    return (
      new Date(otherLastReadAt).getTime() >=
      new Date(messageCreatedAt).getTime()
    );
  } catch {
    return false;
  }
}

export default function ChatThreadPage() {
  const params = useParams<{ threadId: string }>();
  const searchParams = useSearchParams();
  const threadId = params?.threadId ?? "";

  const from = searchParams.get("from");
  const slotId = searchParams.get("slotId");
  const date = searchParams.get("date");

  const backLink = useMemo(
    () => getBackLink({ from, slotId, date }),
    [from, slotId, date]
  );

  const carriedQueryString = useMemo(
    () => buildQueryString({ from, slotId, date }),
    [from, slotId, date]
  );

  const [authLoading, setAuthLoading] = useState(true);
  const [meId, setMeId] = useState<string>("");

  const [myTeamId, setMyTeamId] = useState<string>("");
  const [myOwnedTeams, setMyOwnedTeams] = useState<TeamMini[]>([]);
  const [memberRowsState, setMemberRowsState] = useState<ChatMemberRow[]>([]);
  const [otherTeamId, setOtherTeamId] = useState<string>("");
  const [otherUserId, setOtherUserId] = useState<string>("");
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState<boolean>(false);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string>("");

  const [otherTeamName, setOtherTeamName] = useState<string>("相手チーム");
  const [otherTeamCategory, setOtherTeamCategory] = useState<string>("");

  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | "unsupported">("default");

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chatBodyRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => {
    return (
      !!meId &&
      !!threadId &&
      isMember &&
      text.trim().length > 0 &&
      !sending
    );
  }, [meId, threadId, isMember, text, sending]);

  const lastMyMessageId = useMemo(() => {
    const lastMyMessage = [...messages]
      .filter((m) => m.sender_id === meId)
      .sort((a, b) => {
        const at = new Date(a.created_at ?? 0).getTime();
        const bt = new Date(b.created_at ?? 0).getTime();
        return bt - at;
      })[0];

    return lastMyMessage?.id ?? "";
  }, [messages, meId]);

  const scrollToBottom = (smooth = true) => {
    requestAnimationFrame(() => {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({
          behavior: smooth ? "smooth" : "auto",
          block: "end",
        });
        return;
      }

      if (chatBodyRef.current) {
        chatBodyRef.current.scrollTo({
          top: chatBodyRef.current.scrollHeight,
          behavior: smooth ? "smooth" : "auto",
        });
      }
    });
  };

  async function refreshUnifiedBadge() {
    if (!meId) return;

    try {
      const total = await getUnifiedBadgeCount(meId);
      await syncAppBadge(total);
    } catch (e) {
      console.error("refreshUnifiedBadge error:", e);
    }

    window.dispatchEvent(new Event("badge-updated"));
    window.dispatchEvent(new Event("notifications-updated"));
  }

  const markRead = async () => {
    if (!threadId || !meId) return;

    try {
      const readAt = nowIso();

      const { error } = await supabase
        .from("chat_members")
        .update({ last_read_at: readAt })
        .eq("thread_id", threadId)
        .eq("user_id", meId);

      if (error) {
        console.error("markRead update error:", error);
        return;
      }

      await refreshUnifiedBadge();
    } catch (e) {
      console.error("markRead failed:", e);
    }
  };

  const requestNotificationPermission = async () => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setNotificationPermission(result);
    } catch (e) {
      console.error("Notification permission error:", e);
    }
  };

  const notifyIncomingMessage = (body?: string | null) => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (document.visibilityState === "visible") return;
    if (Notification.permission !== "granted") return;

    try {
      new Notification(otherTeamName || "新着メッセージ", {
        body: body?.trim() || "メッセージが届きました",
      });
    } catch (e) {
      console.error("Notification create error:", e);
    }
  };

  async function loadThreadMeta(currentMeId: string) {
    if (!currentMeId || !threadId) return;

    const [
      { data: memberRows, error: memberErr },
      { data: ownedTeamsRows, error: ownedTeamsErr },
    ] = await Promise.all([
      supabase
        .from("chat_members")
        .select("thread_id,user_id,team_id,last_read_at")
        .eq("thread_id", threadId),
      supabase
        .from("teams")
        .select("id,name,category")
        .eq("owner_id", currentMeId),
    ]);

    if (memberErr) {
      console.error(memberErr);
    }
    if (ownedTeamsErr) {
      console.error(ownedTeamsErr);
    }

    const typedMemberRows = ((memberRows ?? []) as ChatMemberRow[]).filter(
      Boolean
    );
    const ownedTeams = ((ownedTeamsRows ?? []) as TeamMini[]).filter(Boolean);

    setMemberRowsState(typedMemberRows);
    setMyOwnedTeams(ownedTeams);

    const resolvedMyTeamId = resolveMyTeamId({
      meId: currentMeId,
      memberRows: typedMemberRows,
      ownedTeams,
    });
    setMyTeamId(resolvedMyTeamId);

    const ownedTeamIds = new Set(ownedTeams.map((t) => t.id).filter(Boolean));

    const teamIds = typedMemberRows
      .map((r) => r.team_id as string)
      .filter(Boolean);

    const otherMemberRow =
      typedMemberRows.find((r) => r.user_id && r.user_id !== currentMeId) ??
      null;

    const otherUserIdValue = otherMemberRow?.user_id ?? "";
    setOtherUserId(otherUserIdValue);
    setOtherLastReadAt(otherMemberRow?.last_read_at ?? null);

    const resolvedOtherTeamId =
      teamIds.find((id) => !ownedTeamIds.has(id)) ??
      teamIds.find((id) => id !== resolvedMyTeamId) ??
      "";

    setOtherTeamId(resolvedOtherTeamId);

    if (resolvedOtherTeamId) {
      const { data: teamRow, error: teamErr } = await supabase
        .from("teams")
        .select("id,name,category")
        .eq("id", resolvedOtherTeamId)
        .maybeSingle();

      if (teamErr) {
        console.error(teamErr);
      }

      if (teamRow) {
        const team = teamRow as TeamMini;
        setOtherTeamName(team.name ?? "相手チーム");
        setOtherTeamCategory(
          categoryLabel(team.category) || team.category || ""
        );
      } else {
        setOtherTeamName("相手チーム");
        setOtherTeamCategory("");
      }
    } else {
      setOtherTeamName("相手チーム");
      setOtherTeamCategory("");
    }
  }

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        setMeId(session?.user?.id ?? "");
      } catch (e) {
        console.error("getSession error:", e);
        if (!mounted) return;
        setMeId("");
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setMeId(session?.user?.id ?? "");
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    setNotificationPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!meId || !threadId) {
      setLoading(false);
      setIsMember(false);
      setMessages([]);
      setMemberRowsState([]);
      return;
    }

    (async () => {
      setLoading(true);
      setIsMember(false);
      setMyTeamId("");
      setMyOwnedTeams([]);
      setMemberRowsState([]);
      setOtherTeamId("");
      setOtherUserId("");
      setOtherLastReadAt(null);
      setSendError("");
      setOtherTeamName("相手チーム");
      setOtherTeamCategory("");

      const { data: mem, error: memErr } = await supabase
        .from("chat_members")
        .select("thread_id")
        .eq("thread_id", threadId)
        .eq("user_id", meId)
        .maybeSingle();

      if (memErr) console.error(memErr);

      if (!mem) {
        setMessages([]);
        setLoading(false);
        setIsMember(false);
        return;
      }

      setIsMember(true);

      await loadThreadMeta(meId);

      const { data, error } = await supabase
        .from("chat_messages")
        .select("id,thread_id,sender_id,sender_team_id,body,created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        setMessages([]);
        setLoading(false);
        return;
      }

      setMessages(((data ?? []) as Msg[]).filter(Boolean));
      setLoading(false);

      requestAnimationFrame(() => {
        scrollToBottom(false);
      });

      await markRead();
    })();
  }, [authLoading, meId, threadId]);

  useEffect(() => {
    if (!loading) {
      requestAnimationFrame(() => {
        scrollToBottom(false);
      });
    }
  }, [loading]);

  useEffect(() => {
    if (authLoading || !meId || !threadId || !isMember) return;

    const messageChannel = supabase
      .channel(`chat-messages:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          const row = payload.new as Msg;

          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) {
              return prev.filter((m) => !String(m.id).startsWith("optimistic-"));
            }

            const withoutOptimistic = prev.filter(
              (m) =>
                !(
                  m.sender_id === row.sender_id &&
                  m.body === row.body &&
                  String(m.id).startsWith("optimistic-")
                )
            );

            return [...withoutOptimistic, row].sort((a, b) =>
              a.created_at > b.created_at ? 1 : -1
            );
          });

          requestAnimationFrame(() => {
            scrollToBottom(true);
          });

          if (row.sender_id && row.sender_id !== meId) {
            notifyIncomingMessage(row.body);
            await markRead();
          }
        }
      )
      .subscribe();

    const memberChannel = supabase
      .channel(`chat-members:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_members",
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          const row = payload.new as ChatMemberRow;

          if (row.user_id && row.user_id !== meId) {
            setOtherLastReadAt(row.last_read_at ?? null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(memberChannel);
    };
  }, [authLoading, meId, threadId, isMember, otherTeamName]);

  const send = async () => {
    setSendError("");

    const body = text.trim();
    if (!body) return;
    if (!meId) return alert("ログインが必要です");
    if (!threadId) return alert("threadId がありません");
    if (!isMember) return alert("このスレッドに参加していません");
    if (sending) return;

    const resolvedSendTeamId =
      myTeamId ||
      resolveMyTeamId({
        meId,
        memberRows: memberRowsState,
        ownedTeams: myOwnedTeams,
      });

    if (!resolvedSendTeamId) {
      setSendError(
        "送信元チームが取得できません。チーム登録または chat_members の team_id を確認してください。"
      );
      return;
    }

    setSending(true);
    setText("");

    const optimisticId = `optimistic-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;

    const optimistic: Msg = {
      id: optimisticId,
      thread_id: threadId,
      sender_id: meId,
      sender_team_id: resolvedSendTeamId,
      body,
      created_at: nowIso(),
    };

    setMessages((prev) => [...prev, optimistic]);

    requestAnimationFrame(() => {
      scrollToBottom(true);
    });

    const payload = {
      thread_id: threadId,
      sender_id: meId,
      sender_team_id: resolvedSendTeamId,
      body,
    };

    const { data, error } = await supabase
      .from("chat_messages")
      .insert(payload)
      .select("id,thread_id,sender_id,sender_team_id,body,created_at")
      .single();

    if (error) {
      console.error(error);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setText(body);
      setSendError(error.message || "送信に失敗しました");
      setSending(false);
      return;
    }

    setMyTeamId(resolvedSendTeamId);

    setMessages((prev) => {
      const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
      const real = data as Msg;
      if (withoutOptimistic.some((m) => m.id === real.id)) {
        return withoutOptimistic;
      }
      return [...withoutOptimistic, real].sort((a, b) =>
        a.created_at > b.created_at ? 1 : -1
      );
    });

    requestAnimationFrame(() => {
      scrollToBottom(true);
    });

    if (otherUserId) {
      const notificationTitle = "新着チャット";
      const notificationBody =
        body.length > 40 ? `${body.slice(0, 40)}…` : body;

      const notificationUrl = `/chat/${threadId}${
        carriedQueryString ? `?${carriedQueryString}` : ""
      }`;

      const { error: notificationErr } = await supabase
        .from("notifications")
        .insert({
          user_id: otherUserId,
          type: "chat_message",
          title: notificationTitle,
          body: notificationBody,
          target_url: notificationUrl,
          is_read: false,
          related_thread_id: threadId,
          related_team_id: resolvedSendTeamId,
        });

      if (notificationErr) {
        console.error("notification insert error:", notificationErr);
      } else {
        try {
          const pushRes = await fetch("/api/push/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userId: otherUserId,
              title: notificationTitle,
              body: notificationBody,
              url: notificationUrl,
            }),
          });

          if (!pushRes.ok) {
            const pushJson = await pushRes.json().catch(() => null);
            console.error("push send error:", pushJson ?? pushRes.statusText);
          }
        } catch (e) {
          console.error("push send fetch error:", e);
        }
      }
    }

    await markRead();
    setSending(false);
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (canSend) send();
    }
  };

  if (authLoading) {
    return (
      <main style={pageWrap}>
        <section style={chatPanel}>
          <div style={authLoadingBox}>ログイン状態を確認中…</div>
        </section>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      <section style={chatPanel}>
        <header style={panelHeader}>
          <div style={headerLeft}>
            <Link href={backLink.href} className="sh-btn">
              {backLink.label}
            </Link>

            <div style={titleWrap}>
              <div style={threadTitle}>{otherTeamName}</div>
              <div style={threadSubTitle}>
                {otherTeamCategory || "チャット"}
              </div>
            </div>
          </div>

          <div style={headerRight}>
            {otherTeamId ? (
              <Link
                href={`/teams/${otherTeamId}${
                  carriedQueryString ? `?${carriedQueryString}` : ""
                }`}
                className="sh-btn"
              >
                チーム詳細
              </Link>
            ) : null}

            {notificationPermission === "granted" ? (
              <span style={notifyBadgeGranted}>通知ON</span>
            ) : notificationPermission !== "unsupported" ? (
              <button
                type="button"
                className="sh-btn"
                onClick={requestNotificationPermission}
              >
                通知をON
              </button>
            ) : null}
          </div>
        </header>

        <div ref={chatBodyRef} style={chatBody}>
          {loading ? <p style={{ color: "#666" }}>読み込み中…</p> : null}

          {!loading && !isMember ? (
            <p style={{ color: "#991b1b" }}>
              このスレッドに参加していません
            </p>
          ) : null}

          {!loading && isMember && messages.length === 0 ? (
            <p style={{ color: "#666" }}>メッセージはまだありません</p>
          ) : null}

          <div style={messageList}>
            {messages.map((m, i) => {
              const mine = m.sender_id === meId;
              const optimistic = isOptimisticMessageId(m.id);
              const prev = i > 0 ? messages[i - 1] : null;
              const showDate = !prev || !sameDate(prev.created_at, m.created_at);

              const isLatestMyMessage = mine && m.id === lastMyMessageId;
              const isRead = isReadByOther({
                messageCreatedAt: m.created_at,
                otherLastReadAt,
              });

              return (
                <React.Fragment key={m.id}>
                  {showDate ? (
                    <div style={dateDividerWrap}>
                      <span style={dateDivider}>
                        {formatDateDivider(m.created_at)}
                      </span>
                    </div>
                  ) : null}

                  <div
                    style={{
                      ...bubbleRow,
                      justifyContent: mine ? "flex-end" : "flex-start",
                    }}
                  >
                    {!mine ? <div style={avatarCircle}>⚽</div> : null}

                    <div
                      style={{
                        ...bubbleWrap,
                        alignItems: mine ? "flex-end" : "flex-start",
                      }}
                    >
                      {!mine ? (
                        <div style={senderName}>{otherTeamName}</div>
                      ) : null}

                      <div
                        style={{
                          ...bubbleBase,
                          ...(mine ? bubbleMine : bubbleOther),
                          ...(optimistic ? bubbleSending : null),
                        }}
                      >
                        <div style={bubbleText}>{m.body}</div>
                      </div>

                      <div
                        style={{
                          ...bubbleMeta,
                          justifyContent: mine ? "flex-end" : "flex-start",
                        }}
                      >
                        <span>
                          {optimistic ? "送信中…" : formatBubbleTime(m.created_at)}
                        </span>

                        {isLatestMyMessage ? (
                          <span style={readStateText}>
                            {optimistic
                              ? ""
                              : isRead
                              ? `既読 ${formatReadTime(otherLastReadAt)}`
                              : "未読"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

            <div ref={bottomRef} />
          </div>
        </div>

        <div style={inputArea}>
          {sendError ? (
            <div style={sendErrorText}>送信エラー: {sendError}</div>
          ) : null}

          <div style={inputRow}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="メッセージを入力"
              style={textareaStyle}
              disabled={!meId || !isMember || sending}
            />

            <button
              className="sh-btn sh-btn--primary"
              type="button"
              onClick={send}
              disabled={!canSend}
              style={sendButton}
            >
              送信
            </button>
          </div>

          <div style={inputHint}>
            Enterで改行 / Ctrl+Enter または Cmd+Enter で送信
          </div>
        </div>
      </section>
    </main>
  );
}

const pageWrap: React.CSSProperties = {
  padding: 12,
  maxWidth: 860,
  margin: "0 auto",
  height: "100dvh",
  boxSizing: "border-box",
};

const chatPanel: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 20,
  background: "#f6fbf7",
  overflow: "hidden",
  display: "grid",
  gridTemplateRows: "auto 1fr auto",
  height: "calc(100dvh - 24px)",
  minHeight: 0,
};

const authLoadingBox: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  minHeight: 240,
  padding: 24,
  color: "#666",
  background: "#fff",
};

const panelHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: 12,
  borderBottom: "1px solid #e5ece7",
  background: "#ffffff",
  position: "sticky",
  top: 0,
  zIndex: 2,
  flexWrap: "wrap",
};

const headerLeft: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
  flexWrap: "wrap",
};

const titleWrap: React.CSSProperties = {
  minWidth: 0,
};

const headerRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
};

const threadTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
  lineHeight: 1.3,
};

const threadSubTitle: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  marginTop: 2,
};

const notifyBadgeGranted: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 32,
  padding: "0 10px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#166534",
  fontSize: 12,
  fontWeight: 900,
};

const chatBody: React.CSSProperties = {
  minHeight: 0,
  overflowY: "auto",
  padding: 14,
  background: "linear-gradient(180deg, #eef8f0 0%, #f8fcf9 100%)",
};

const messageList: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const dateDividerWrap: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  margin: "4px 0 2px",
};

const dateDivider: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "4px 10px",
  borderRadius: 999,
  background: "rgba(0,0,0,0.08)",
  color: "#374151",
  fontSize: 12,
  fontWeight: 700,
};

const bubbleRow: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "flex-end",
};

const avatarCircle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  background: "#ffffff",
  border: "1px solid #d9e8dd",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  fontSize: 16,
};

const bubbleWrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  maxWidth: "78%",
};

const senderName: React.CSSProperties = {
  fontSize: 11,
  color: "#6b7280",
  paddingLeft: 4,
};

const bubbleBase: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 18,
  lineHeight: 1.6,
  fontSize: 14,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
};

const bubbleMine: React.CSSProperties = {
  background: "#8de17a",
  color: "#17311b",
  borderTopRightRadius: 6,
};

const bubbleOther: React.CSSProperties = {
  background: "#ffffff",
  color: "#111827",
  border: "1px solid #e5e7eb",
  borderTopLeftRadius: 6,
};

const bubbleSending: React.CSSProperties = {
  opacity: 0.7,
};

const bubbleText: React.CSSProperties = {
  lineHeight: 1.7,
};

const bubbleMeta: React.CSSProperties = {
  fontSize: 11,
  color: "#6b7280",
  padding: "0 4px",
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const readStateText: React.CSSProperties = {
  fontSize: 11,
  color: "#4b5563",
  fontWeight: 700,
};

const inputArea: React.CSSProperties = {
  borderTop: "1px solid #e5ece7",
  background: "#fff",
  padding: 12,
  display: "grid",
  gap: 8,
};

const inputRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 8,
  alignItems: "end",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 48,
  maxHeight: 140,
  padding: "12px 14px",
  borderRadius: 18,
  border: "1px solid #d1d5db",
  background: "#fff",
  resize: "vertical",
  fontSize: 14,
  lineHeight: 1.6,
};

const sendButton: React.CSSProperties = {
  minWidth: 72,
  alignSelf: "stretch",
};

const inputHint: React.CSSProperties = {
  fontSize: 11,
  color: "#6b7280",
};

const sendErrorText: React.CSSProperties = {
  color: "#991b1b",
  fontSize: 12,
  whiteSpace: "pre-wrap",
};