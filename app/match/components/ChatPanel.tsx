// app/match/components/ChatPanel.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { DbMessage, DbThread, DbRequest } from "../types";

type Toast = { type: "success" | "error" | "info"; text: string };

export function ChatPanel(props: {
  request: DbRequest;            // accepted の request
  slotOwnerId: string;           // match_slots.owner_id（ホストユーザー）
  meId: string;                  // auth.uid()
  hostTeamId: string;            // match_slots.host_team_id
  requesterTeamId: string;       // match_requests.requester_team_id
  onToast?: (t: Toast | null) => void;
}) {
  const { request, slotOwnerId, meId, hostTeamId, requesterTeamId, onToast } = props;

  const [loading, setLoading] = useState(false);
  const [thread, setThread] = useState<DbThread | null>(null);
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [text, setText] = useState("");

  const isParticipant = useMemo(() => {
    return !!meId && (meId === slotOwnerId || meId === request.requester_user_id);
  }, [meId, slotOwnerId, request.requester_user_id]);

  useEffect(() => {
    if (!isParticipant) return;
    // 初回：thread確保→messagesロード
    (async () => {
      setLoading(true);
      try {
        const t = await ensureThread();
        if (t) {
          await loadMessages(t.id);
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.id, isParticipant]);

  const ensureThread = async () => {
    // 1) 既存 thread を探す
    const { data: existing, error: selErr } = await supabase
      .from("match_threads")
      .select("id,slot_id,request_id,host_team_id,requester_team_id,created_at")
      .eq("request_id", request.id)
      .maybeSingle();

    if (selErr) {
      console.error(selErr);
      onToast?.({ type: "error", text: `チャット開始に失敗: ${selErr.message}` });
      return null;
    }
    if (existing?.id) {
      setThread(existing as DbThread);
      return existing as DbThread;
    }

    // 2) なければ作る（accepted の時だけ）
    const payload = {
      slot_id: request.slot_id,
      request_id: request.id,
      host_team_id: hostTeamId,
      requester_team_id: requesterTeamId,
    };

    const { data: created, error: insErr } = await supabase
      .from("match_threads")
      .insert(payload)
      .select("id,slot_id,request_id,host_team_id,requester_team_id,created_at")
      .single();

    if (insErr) {
      console.error(insErr);
      onToast?.({ type: "error", text: `チャット部屋作成に失敗: ${insErr.message}` });
      return null;
    }

    setThread(created as DbThread);
    return created as DbThread;
  };

  const loadMessages = async (threadId: string) => {
    const { data, error } = await supabase
      .from("match_messages")
      .select("id,thread_id,sender_user_id,sender_team_id,body,created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      onToast?.({ type: "error", text: `メッセージ取得に失敗: ${error.message}` });
      setMessages([]);
      return;
    }

    setMessages((data ?? []) as DbMessage[]);
  };

  const send = async () => {
    if (!thread?.id) return;
    const body = text.trim();
    if (!body) return;

    setLoading(true);
    try {
      const payload = {
        thread_id: thread.id,
        sender_user_id: meId,
        sender_team_id: null, // 後で「自分のチーム」を渡せるようにしてもOK
        body,
      };

      const { error } = await supabase.from("match_messages").insert(payload);
      if (error) {
        console.error(error);
        onToast?.({ type: "error", text: `送信に失敗: ${error.message}` });
        return;
      }

      setText("");
      await loadMessages(thread.id);
    } finally {
      setLoading(false);
    }
  };

  if (!isParticipant) return null;

  return (
    <div style={wrap}>
      <div style={{ fontWeight: 900, marginBottom: 8 }}>チャット / 連絡先交換</div>

      <div style={box}>
        {messages.length === 0 ? (
          <div style={{ color: "#777" }}>まだメッセージがありません。まずは挨拶しましょう。</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {messages.map((m) => (
              <div key={m.id} style={msg}>
                <div style={{ fontSize: 12, color: "#777" }}>
                  {m.sender_user_id === meId ? "あなた" : "相手"} / {new Date(m.created_at).toLocaleString()}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例：はじめまして。○/○の13:00でお願いします！"
          style={input}
          disabled={loading}
        />
        <button className="sh-btn" type="button" onClick={send} disabled={loading || !text.trim()}>
          送信
        </button>
      </div>

      <div style={{ marginTop: 6, color: "#777", fontSize: 12 }}>
        ※ まずはチャットで集合時間・学年・ユニフォーム（メイン/サブ）などを確認しましょう
      </div>
    </div>
  );
}

const wrap: React.CSSProperties = {
  marginTop: 12,
  paddingTop: 12,
  borderTop: "1px solid #eaeaea",
};

const box: React.CSSProperties = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 10,
  background: "white",
  maxHeight: 260,
  overflow: "auto",
};

const msg: React.CSSProperties = {
  border: "1px solid #f3f4f6",
  borderRadius: 10,
  padding: 8,
  background: "#fafafa",
};

const input: React.CSSProperties = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
};