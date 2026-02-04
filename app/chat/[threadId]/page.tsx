// app/chat/[threadId]/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import type { ChatMessage } from "../types";

type Msg = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  sender_team_id: string | null;
  body: string | null;
  created_at: string;
};

function nowIso() {
  return new Date().toISOString();
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

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => {
    return !!meId && !!threadId && isMember && text.trim().length > 0 && !sending;
  }, [meId, threadId, isMember, text, sending]);

  const scrollToBottom = (smooth = true) => {
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" })
    );
  };

  // ✅ 既読を付ける（chat_members.last_read_at を now）
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

  // auth
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMeId(data?.user?.id ?? "");
    })();
  }, []);

  // 初回ロード（member確認 → messages取得 → 既読）
  useEffect(() => {
    if (!meId || !threadId) return;

    (async () => {
      setLoading(true);
      setIsMember(false);

      // ✅ 自分がこの thread の member かチェック
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

      // ✅ messages 取得
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

      // ✅ 開いたら即既読
      await markRead();
    })();
  }, [meId, threadId]);

  // Realtime購読（INSERTを即反映）＋ 相手メッセージを受けたら既読
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
            if (prev.some((m) => m.id === row.id)) return prev; // 重複ガード
            return [...prev, row];
          });

          scrollToBottom(true);

          // ✅ 相手から来た新着なら既読
          if (row.sender_id && row.sender_id !== meId) {
            await markRead();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meId, threadId, isMember]);

  // ✅ 送信：insert 成功した瞬間に messages に追加して「送れた感」を出す
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

    // ✅ 楽観表示（仮メッセージ）
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

      // ✅ 仮メッセージを消して、入力を戻す
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setText(body);
      setSendError(error.message || "送信に失敗しました");
      setSending(false);
      return;
    }

    // ✅ 仮メッセージを「本物」に差し替え（Realtime待たない）
    setMessages((prev) => {
      const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
      const real = data as any as Msg;
      if (withoutOptimistic.some((m) => m.id === real.id)) return withoutOptimistic;
      return [...withoutOptimistic, real].sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
    });

    scrollToBottom(true);

    // ✅ 自分が送った直後も既読
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
    <main style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>チャット</h1>
          <div style={{ fontSize: 12, color: "#666" }}>thread: {threadId}</div>
        </div>
      </header>

      <section
        style={{
          marginTop: 12,
          border: "1px solid #eee",
          borderRadius: 14,
          background: "#fff",
          padding: 12,
          minHeight: 420,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: 1, overflow: "auto", padding: 6 }}>
          {loading ? <p style={{ color: "#666" }}>読み込み中…</p> : null}

          {!loading && !isMember ? (
            <p style={{ color: "#991b1b" }}>このスレッドに参加していません（権限/RLSを確認してください）</p>
          ) : null}

          {!loading && isMember && messages.length === 0 ? (
            <p style={{ color: "#666" }}>メッセージはまだありません</p>
          ) : null}

          <div style={{ display: "grid", gap: 10 }}>
            {messages.map((m) => {
              const mine = m.sender_id === meId;
              const optimistic = String(m.id).startsWith("optimistic-");

              return (
                <div key={m.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                  <div
                    style={{
                      maxWidth: "78%",
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #eee",
                      background: mine ? "#eff6ff" : "#fafafa",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.4,
                      opacity: optimistic ? 0.65 : 1,
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 4, display: "flex", gap: 8, alignItems: "center" }}>
                      <span>
                        {mine ? "あなた" : "相手"} ・ {new Date(m.created_at).toLocaleString()}
                      </span>
                      {optimistic ? (
                        <span style={{ fontSize: 11, color: "#6b7280" }}>送信中…</span>
                      ) : null}
                    </div>
                    {m.body}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </div>

        <div style={{ borderTop: "1px solid #eee", paddingTop: 10, display: "grid", gap: 8 }}>
          {sendError ? (
            <div style={{ color: "#991b1b", fontSize: 12, whiteSpace: "pre-wrap" }}>
              送信エラー: {sendError}
            </div>
          ) : null}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="メッセージ（Enterで送信 / Shift+Enterで改行）"
            style={{
              width: "100%",
              minHeight: 70,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              resize: "vertical",
            }}
            disabled={!meId || !isMember || sending}
          />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "#666" }}>
              {!meId ? "ログインが必要です" : !isMember ? "参加していません" : sending ? "送信中…" : ""}
            </span>

            <button className="sh-btn" type="button" onClick={send} disabled={!canSend}>
              送信
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}