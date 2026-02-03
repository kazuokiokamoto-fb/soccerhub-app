// app/match/components/ChatPanel.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import type { DbRequest } from "../types";

type Toast = { type: "success" | "error" | "info"; text: string };

// chat_messages の最小型（必要な分だけ）
type ChatMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_team_id: string | null;
  body: string;
  created_at: string;
};

export function ChatPanel(props: {
  request: DbRequest; // accepted の request（現状 SlotDetail が accepted の時だけ呼んでる）
  slotOwnerId: string; // match_slots.owner_id（ホストユーザー）
  meId: string; // auth.uid()
  hostTeamId: string; // match_slots.host_team_id
  requesterTeamId: string; // match_requests.requester_team_id
  onToast?: (t: Toast | null) => void;
}) {
  const { request, slotOwnerId, meId, hostTeamId, requesterTeamId, onToast } = props;

  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");

  // ✅ この Slot の当事者ユーザーだけ表示（現状の挙動を維持）
  const isParticipant = useMemo(() => {
    return !!meId && (meId === slotOwnerId || meId === request.requester_user_id);
  }, [meId, slotOwnerId, request.requester_user_id]);

  // ✅ 自分が「どっちのチームとして」送るか（ホスト側ユーザーなら hostTeamId、申込側なら requesterTeamId）
  const myTeamId = useMemo(() => {
    if (!meId) return "";
    if (meId === slotOwnerId) return hostTeamId;
    if (meId === request.requester_user_id) return requesterTeamId;
    return "";
  }, [meId, slotOwnerId, request.requester_user_id, hostTeamId, requesterTeamId]);

  // ✅ 相手チーム
  const otherTeamId = useMemo(() => {
    if (!myTeamId) return "";
    return myTeamId === hostTeamId ? requesterTeamId : hostTeamId;
  }, [myTeamId, hostTeamId, requesterTeamId]);

  // ===== 初回：常設DM確保 → messagesロード =====
  useEffect(() => {
    if (!isParticipant) return;
    if (!myTeamId || !otherTeamId) return;

    (async () => {
      setLoading(true);
      try {
        const tid = await openDm(myTeamId, otherTeamId);
        setThreadId(tid);

        // 念のため：自分を chat_members に入れておく（RPCが入れてる想定だが保険）
        await upsertMyMembership(tid, myTeamId);

        await loadMessages(tid);
      } catch (e: any) {
        console.error("ChatPanel init failed:", e);
        const msg = e?.message || "不明なエラー";
        onToast?.({ type: "error", text: `チャット開始に失敗: ${msg}` });
        alert(`チャット開始に失敗: ${msg}\n（RPC / RLS / ログイン状態を確認）`);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isParticipant, myTeamId, otherTeamId, request.id]);

  // ✅ 常設DMスレッドを「必ず1本」にするRPC（あなたの rpc_get_or_create_dm_thread 前提）
  async function openDm(myTeamId_: string, otherTeamId_: string) {
    const { data, error } = await supabase.rpc("rpc_get_or_create_dm_thread", {
      my_team_id: myTeamId_,
      other_team_id: otherTeamId_,
    });
    if (error) throw error;
    return data as string; // threadId(uuid)
  }

  async function upsertMyMembership(tid: string, teamId: string) {
    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return;

    // chat_members に入っていればOK。無ければ作成。
    // ※ unique制約が (thread_id, user_id) などで入ってる想定
    const { error } = await supabase.from("chat_members").insert({
      thread_id: tid,
      user_id: uid,
      team_id: teamId,
    });

    // すでに入ってる時のエラーは無視してOK（constraint名が環境で違うので雑に握る）
    if (error && !String(error.message || "").toLowerCase().includes("duplicate")) {
      // RLSや制約の可能性
      console.warn("upsertMyMembership warn:", error);
    }
  }

  async function loadMessages(tid: string) {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("id,thread_id,sender_id,sender_team_id,body,created_at")
      .eq("thread_id", tid)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("loadMessages error:", error);
      onToast?.({ type: "error", text: `メッセージ取得に失敗: ${error.message}` });
      alert(`メッセージ取得に失敗: ${error.message}\n（chat_members RLS を確認）`);
      setMessages([]);
      return;
    }

    setMessages((data ?? []) as ChatMessage[]);
  }

  async function send() {
    if (!threadId) return alert("threadId がありません");
    const body = text.trim();
    if (!body) return;

    const { data: u } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (!uid) return alert("ログインできていません");

    if (!myTeamId) return alert("送信チームIDが決められません（myTeamId が空）");

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          thread_id: threadId,
          sender_id: uid,
          sender_team_id: myTeamId,
          body,
        })
        .select("id,thread_id,sender_id,sender_team_id,body,created_at")
        .single();

      if (error) {
        console.error("send error:", error);
        onToast?.({ type: "error", text: `送信に失敗: ${error.message}` });
        alert(`送信に失敗: ${error.message}\n（chat_messages RLS / chat_members を確認）`);
        return;
      }

      // ✅ UI反映（即時）
      setMessages((prev) => [...prev, data as ChatMessage]);
      setText("");
    } finally {
      setLoading(false);
    }
  }

  if (!isParticipant) return null;

  return (
    <div style={wrap}>
      <div style={{ fontWeight: 900, marginBottom: 8 }}>チャット</div>

      <div style={box}>
        {messages.length === 0 ? (
          <div style={{ color: "#777" }}>まだメッセージがありません。まずは挨拶しましょう。</div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {messages.map((m) => (
              <div key={m.id} style={msg}>
                <div style={{ fontSize: 12, color: "#777" }}>
                  {m.sender_id === meId ? "あなた" : "相手"} / {new Date(m.created_at).toLocaleString()}
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
        ※ 送信できない場合は「RLSで弾かれている」か「chat_membersに参加できていない」可能性が高いです
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