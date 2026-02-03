// app/chat/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";
import type { ChatThread } from "./types";

type ThreadRow = ChatThread & {
  chat_members: { team_id: string }[]; // 参加チーム（最低限）
};

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

      // 参加スレッド（自分の chat_members を起点に threads を引く）
      // ※ これが通るために RLS/Policy が必要（あなたの方では既に作っている前提）
      const { data, error } = await supabase
        .from("chat_members")
        .select("thread_id, chat_threads(id,created_at,updated_at,kind), chat_threads:chat_threads(chat_members(team_id))")
        .eq("user_id", meId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        setThreads([]);
        setLoading(false);
        return;
      }

      // Supabase の join 返りが少し癖あるので整形
      const rows = (data ?? [])
        .map((r: any) => {
          const t = r.chat_threads;
          const members = (r.chat_threads?.chat_members ?? []) as { team_id: string }[];
          if (!t?.id) return null;
          return {
            id: t.id,
            created_at: t.created_at,
            updated_at: t.updated_at,
            kind: t.kind,
            chat_members: members,
          } as ThreadRow;
        })
        .filter(Boolean) as ThreadRow[];

      // 重複 thread を排除（念のため）
      const seen = new Set<string>();
      const uniq = rows.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));

      setThreads(uniq);
      setLoading(false);
    })();
  }, [meId]);

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

      {!loading && threads.length === 0 ? (
        <p style={{ color: "#666" }}>スレッドがありません（チームから「チャット開始」を作ると増えます）</p>
      ) : null}

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {threads.map((t) => (
          <Link
            key={t.id}
            href={`/chat/${t.id}`}
            className="sh-btn"
            style={{
              display: "block",
              padding: 12,
              borderRadius: 12,
              border: "1px solid #eee",
              background: "#fff",
              textAlign: "left",
            }}
          >
            <div style={{ fontWeight: 900 }}>スレッド</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              kind: {t.kind ?? "unknown"} / 参加チーム数: {t.chat_members?.length ?? 0}
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>
              id: {t.id}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}