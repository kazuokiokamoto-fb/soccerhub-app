"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase";

type TeamMemberRow = {
  team_id: string;
  user_id: string;
  role?: string | null;
};

type ChatMemberRow = {
  thread_id: string;
  user_id: string | null;
  team_id: string | null;
};

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((v): v is string => !!v)));
}

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

        const { data: teamRow, error: teamError } = await supabase
          .from("teams")
          .select("id,owner_id")
          .eq("id", teamId)
          .maybeSingle();

        if (teamError) throw teamError;

        if (!teamRow) {
          throw new Error("チームが見つかりません。");
        }

        const ownerId = String((teamRow as any).owner_id ?? "");

        const { data: memberRowsRaw, error: memberError } = await supabase
          .from("team_members")
          .select("team_id,user_id,role")
          .eq("team_id", teamId);

        if (memberError) throw memberError;

        const memberRows = ((memberRowsRaw ?? []) as TeamMemberRow[]).filter(
          Boolean
        );

        const teamUserIds = uniqueValues([
          ownerId,
          ...memberRows.map((row) => row.user_id),
        ]);

        const isAllowed = teamUserIds.includes(meId);

        if (!isAllowed) {
          throw new Error("このチームのチャットを見る権限がありません。");
        }

        const { data: existingTeamMembersRaw, error: existingMemberError } =
          await supabase
            .from("chat_members")
            .select("thread_id,user_id,team_id")
            .eq("team_id", teamId);

        if (existingMemberError) throw existingMemberError;

        const existingTeamMembers = (
          (existingTeamMembersRaw ?? []) as ChatMemberRow[]
        ).filter(Boolean);

        const candidateThreadIds = uniqueValues(
          existingTeamMembers.map((row) => row.thread_id)
        );

        let existingThreadId = "";

        if (candidateThreadIds.length > 0) {
          const { data: allCandidateMembersRaw, error: allCandidateError } =
            await supabase
              .from("chat_members")
              .select("thread_id,user_id,team_id")
              .in("thread_id", candidateThreadIds);

          if (allCandidateError) throw allCandidateError;

          const allCandidateMembers = (
            (allCandidateMembersRaw ?? []) as ChatMemberRow[]
          ).filter(Boolean);

          for (const threadId of candidateThreadIds) {
            const rows = allCandidateMembers.filter(
              (row) => row.thread_id === threadId
            );

            const teamIdsInThread = uniqueValues(rows.map((row) => row.team_id));

            const hasOnlyThisTeam =
            teamIdsInThread.length === 1 && teamIdsInThread[0] === teamId;

            const hasMe = rows.some((row) => row.user_id === meId);

            const memberUserIds = uniqueValues(rows.map((row) => row.user_id));

            const isSameMembers =
            memberUserIds.length === teamUserIds.length &&
            memberUserIds.every((id) => teamUserIds.includes(id));

            if (hasOnlyThisTeam && hasMe && isSameMembers) {
            existingThreadId = threadId;
            break;
            }
          }
        }

        let threadId = existingThreadId;

        if (!threadId) {
          const { data: threadRow, error: threadError } = await supabase
            .from("chat_threads")
            .insert({})
            .select("id")
            .single();

          if (threadError) throw threadError;

          threadId = String((threadRow as any)?.id ?? "");

          if (!threadId) {
            throw new Error("チームチャットの作成に失敗しました。");
          }

          const insertRows = teamUserIds.map((userId) => ({
            thread_id: threadId,
            user_id: userId,
            team_id: teamId,
          }));

          const { error: insertMembersError } = await supabase
            .from("chat_members")
            .insert(insertRows);

          if (insertMembersError) throw insertMembersError;
        }

        if (cancelled) return;

        router.replace(`/chat/${threadId}?from=team-message&teamId=${teamId}`);
      } catch (e: any) {
        console.error("team chat redirect error:", e);
        if (!cancelled) {
          setErrorText(e?.message ?? "チームチャットを開けませんでした。");
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