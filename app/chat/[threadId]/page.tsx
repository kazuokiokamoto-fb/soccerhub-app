"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

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

export default function ChatThreadPage() {
  const params = useParams<{ threadId: string }>();
  const threadId = params.threadId;

  const [meId, setMeId] = useState<string>("");
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

  const canSend = useMemo(() => {
    return !!meId && !!threadId && isMember && text.trim().length > 0 && !sending;
  }, [meId, threadId, isMember, text, sending]);

  const scrollToBottom = (smooth = true) => {
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" })
    );
  };

  const markRead = async () => {
    if (!threadId || !meId) return;
    try {
      const { error } = await supabase
        .from("chat_members")
        .update({ last_read_at: nowIso() })
        .eq("thread_id", threadId)
        .eq("user_id", meId);

      if (error) console.error("markRead update error:", error);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    setNotificationPermission(Notification.permission);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMeId(data?.user?.id ?? "");
    })();
  }, []);

  useEffect(() => {
    if (!meId || !threadId) return;

    (async () => {
      setLoading(true);
      setIsMember(false);

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

      const { data: memberRows, error: memberErr } = await supabase
        .from("chat_members")
        .select("team_id")
        .eq("thread_id", threadId);

      if (memberErr) {
        console.error(memberErr);
      } else {
        const teamIds = (memberRows ?? [])
          .map((r: any) => r.team_id as string)
          .filter(Boolean);

        if (teamIds.length > 0) {
          const { data: myTeams } = await supabase
            .from("teams")
            .select("id")
            .eq("owner_id", meId);

          const myTeamIds = new Set<string>(
            (myTeams ?? []).map((r: any) => r.id).filter(Boolean)
          );

          const otherTeamId =
            teamIds.find((id) => !myTeamIds.has(id)) ?? teamIds[0] ?? null;

          if (otherTeamId) {
            const { data: teamRow } = await supabase
              .from("teams")
              .select("id,name,category")
              .eq("id", otherTeamId)
              .maybeSingle();

            if (teamRow) {
              const team = teamRow as TeamMini;
              setOtherTeamName(team.name ?? "相手チーム");
              setOtherTeamCategory(team.category ?? "");
            }
          }
        }
      }

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

      setMessages(((data ?? []) as any[]).filter(Boolean) as Msg[]);
      setLoading(false);

      scrollToBottom(false);
      await markRead();
    })();
  }, [meId, threadId]);

  useEffect(() => {
    if (!meId || !threadId || !isMember) return;

    const channel = supabase
      .channel(`chat:${threadId}`)
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
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });

          scrollToBottom(true);

          if (row.sender_id && row.sender_id !== meId) {
            notifyIncomingMessage(row.body);
            await markRead();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meId, threadId, isMember, otherTeamName]);

  const send = async () => {
    setSendError("");

    const body = text.trim();
    if (!body) return;
    if (!meId) return alert("ログインが必要です");
    if (!threadId) return alert("threadId がありません");
    if (!isMember) return alert("このスレッドに参加していません");
    if (sending) return;

    setSending(true);
    setText("");

    const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimistic: Msg = {
      id: optimisticId,
      thread_id: threadId,
      sender_id: meId,
      sender_team_id: null,
      body,
      created_at: nowIso(),
    };

    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom(true);

    const payload: any = {
      thread_id: threadId,
      sender_id: meId,
      sender_team_id: null,
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

    setMessages((prev) => {
      const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
      const real = data as any as Msg;
      if (withoutOptimistic.some((m) => m.id === real.id)) return withoutOptimistic;
      return [...withoutOptimistic, real].sort((a, b) =>
        a.created_at > b.created_at ? 1 : -1
      );
    });

    scrollToBottom(true);
    await markRead();
    setSending(false);
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) send();
    }
  };

  return (
    <main style={pageWrap}>
      <header style={headerWrap}>
        <div style={headerLeft}>
          <Link href="/chat" className="sh-btn">
            ← 一覧
          </Link>

          <div>
            <div style={threadTitle}>{otherTeamName}</div>
            <div style={threadSubTitle}>
              {otherTeamCategory || "チャット"}
            </div>
          </div>
        </div>

        <div style={headerRight}>
          {notificationPermission === "granted" ? (
            <span style={notifyBadgeGranted}>通知ON</span>
          ) : notificationPermission === "unsupported" ? (
            <span style={notifyBadgeMuted}>通知非対応</span>
          ) : (
            <button
              type="button"
              className="sh-btn"
              onClick={requestNotificationPermission}
            >
              通知をON
            </button>
          )}
        </div>
      </header>

      <section style={chatPanel}>
        <div style={chatBody}>
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
              const optimistic = String(m.id).startsWith("optimistic-");
              const prev = i > 0 ? messages[i - 1] : null;
              const showDate = !prev || !sameDate(prev.created_at, m.created_at);

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
                        <div style={senderName}>
                          {otherTeamName}
                        </div>
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

                      <div style={bubbleMeta}>
                        {optimistic ? "送信中…" : formatBubbleTime(m.created_at)}
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
            Enterで送信 / Shift+Enterで改行
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
};

const headerWrap: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
  flexWrap: "wrap",
};

const headerLeft: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

const headerRight: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const threadTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
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

const notifyBadgeMuted: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 32,
  padding: "0 10px",
  borderRadius: 999,
  background: "#f3f4f6",
  color: "#4b5563",
  fontSize: 12,
  fontWeight: 900,
};

const chatPanel: React.CSSProperties = {
  border: "1px solid #e5ece7",
  borderRadius: 20,
  background: "#f6fbf7",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  minHeight: "calc(100vh - 180px)",
};

const chatBody: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: 14,
  background:
    "linear-gradient(180deg, #eef8f0 0%, #f8fcf9 100%)",
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