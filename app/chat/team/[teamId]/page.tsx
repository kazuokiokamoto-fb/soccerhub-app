"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

export default function TeamChatRedirectPage() {
  const params = useParams<{ teamId: string }>();
  const router = useRouter();

  const teamId = params?.teamId ?? "";

  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (!teamId) return;

    let cancelled = false;

    async function run() {
      setErrorText("");

      try {
        // ログインチェック
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        const meId = user?.id ?? "";

        if (!meId) {
          router.replace(
            `/login?redirect=${encodeURIComponent(`/chat/team/${teamId}`)}`
          );
          return;
        }

        const { data: existingThread, error: existingThreadError } = await supabase
          .from("chat_threads")
          .select("id")
          .eq("thread_type", "team")
          .eq("team_a_id", teamId)
          .is("team_b_id", null)
          .is("slot_id", null)
          .maybeSingle();

        if (existingThreadError) throw existingThreadError;

        let threadId = String(existingThread?.id ?? "");

        if (!threadId) {
          const { data: createdThread, error: createThreadError } = await supabase
            .from("chat_threads")
            .insert({
              thread_type: "team",
              slot_id: null,
              team_a_id: teamId,
              team_b_id: null,
              created_by: meId,
            })
            .select("id")
            .single();

          if (createThreadError) throw createThreadError;

          threadId = String(createdThread?.id ?? "");
        }

        if (!threadId) {
          throw new Error("チームチャットの作成に失敗しました。");
        }

        if (cancelled) return;

        // チャット画面へ
        router.replace(
          `/chat/${threadId}?from=team-message&teamId=${teamId}`
        );
      } catch (e: any) {
        console.error("team chat redirect error:", e);
        if (!cancelled) {
          setErrorText(
            e?.message ?? "チームチャットを開けませんでした。"
          );
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [teamId, router]);

  return (
    <main style={pageWrap}>
      <div style={box}>
        {errorText ? (
          <>
            <div style={title}>チームチャットを開けませんでした</div>
            <div style={text}>{errorText}</div>
            <div style={{ marginTop: 14 }}>
              <Link href="/chat" className="sh-btn sh-btn--primary">
                チャット一覧へ戻る
              </Link>
            </div>
          </>
        ) : (
          <>
            <div style={title}>チームチャットを準備中…</div>
            <div style={text}>少しお待ちください。</div>
          </>
        )}
      </div>
    </main>
  );
}

const pageWrap: React.CSSProperties = {
  padding: 16,
  maxWidth: 980,
  margin: "0 auto",
};

const box: React.CSSProperties = {
  marginTop: 16,
  padding: 20,
  borderRadius: 16,
  border: "1px solid #e5ece7",
  background: "#fff",
  lineHeight: 1.8,
};

const title: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#16391f",
};

const text: React.CSSProperties = {
  marginTop: 8,
  color: "#66756d",
};