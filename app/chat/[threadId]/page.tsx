// app/chat/[threadId]/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import type { ChatMessage } from "../types";

export default function ChatThreadPage() {
  const params = useParams<{ threadId: string }>();
  const threadId = params.threadId;

  const [meId, setMeId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState<boolean>(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

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
        .update({ last_read_at: new Date().toISOString() })
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

      // ✅ messages 取得（DBの実カラム：sender_id / sender_team_id）
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

      setMessages((data ?? []) as any);
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
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${threadId}` },
        async (payload) => {
          const row = payload.new as any;

          setMessages((prev) => {
            if ((prev as any[]).some((m) => (m as any).id === row.id)) return prev;
            return [...(prev as any[]), row] as any;
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

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    if (!meId) return alert("ログインが必要です");
    if (!threadId) return alert("threadId がありません");
    if (!isMember) return alert("このスレッドに参加していません");

    setSending(true);
    setText("");

    const payload: any = {
      thread_id: threadId,
      sender_id: meId,
      sender_team_id: null,
      body,
    };

    const { error } = await supabase.from("chat_messages").insert(payload);

    if (error) {
      console.error(error);
      setText(body);
      setSending(false);
      alert(`送信に失敗: ${error.message}`);
      return;
    }

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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="sh-btn" href="/chat">一覧</Link>
          <Link className="sh-btn" href="/match">マッチング</Link>
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

          {!loading && isMember && (messages as any[]).length === 0 ? (
            <p style={{ color: "#666" }}>メッセージはまだありません</p>
          ) : null}

          <div style={{ display: "grid", gap: 10 }}>
            {(messages as any[]).map((m: any) => {
              const mine = m.sender_id === meId;
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
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
                      {mine ? "あなた" : "相手"} ・ {new Date(m.created_at).toLocaleString()}
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