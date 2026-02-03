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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => {
    return !!meId && !!threadId && text.trim().length > 0;
  }, [meId, threadId, text]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
  };

  // auth
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setMeId(data?.user?.id ?? "");
    })();
  }, []);

  // 初回ロード
  useEffect(() => {
    if (!meId || !threadId) return;

    (async () => {
      setLoading(true);

      // 自分がこの thread の member かを軽くチェック（RLSで弾かれる前提でもOK）
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
        return;
      }

      const { data, error } = await supabase
        .from("chat_messages")
        .select("id,thread_id,sender_user_id,sender_team_id,body,created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        setMessages([]);
        setLoading(false);
        return;
      }

      setMessages((data ?? []) as ChatMessage[]);
      setLoading(false);
      scrollToBottom();
    })();
  }, [meId, threadId]);

  // Realtime購読（新規メッセージの insert を即反映）
  useEffect(() => {
    if (!meId || !threadId) return;

    const channel = supabase
      .channel(`chat:${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const row = payload.new as ChatMessage;

          setMessages((prev) => {
            // 重複ガード
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meId, threadId]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;

    // 先にUIを軽くロック
    setText("");

    const payload: any = {
      thread_id: threadId,
      body,
      // sender_user_id は DB側の default(auth.uid()) でも良いが、列定義次第なので両対応にする
      sender_user_id: meId,
    };

    const { error } = await supabase.from("chat_messages").insert(payload);
    if (error) {
      console.error(error);
      // 失敗したら戻す（最低限）
      setText(body);
      alert(`送信に失敗: ${error.message}`);
      return;
    }

    // Realtime で届くのでここでは追加しない（重複防止）
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    // Enter 送信（Shift+Enter は改行）
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

          {!loading && messages.length === 0 ? (
            <p style={{ color: "#666" }}>メッセージはまだありません</p>
          ) : null}

          <div style={{ display: "grid", gap: 10 }}>
            {messages.map((m) => {
              const mine = m.sender_user_id === meId;
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
            disabled={!meId}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: "#666" }}>
              {meId ? "" : "ログインが必要です"}
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