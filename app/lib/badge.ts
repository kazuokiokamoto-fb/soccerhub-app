"use client";

import { supabase } from "@/app/lib/supabase";

type ChatMemberRow = {
  thread_id: string;
  last_read_at: string | null;
};

type ChatMessageRow = {
  id: string;
  thread_id: string;
  created_at: string;
  sender_id: string | null;
  deleted_at?: string | null;
  deleted_for_everyone?: boolean | null;
};

function isVisibleMessage(message: ChatMessageRow) {
  if (!message) return false;
  if (message.deleted_at) return false;
  if (message.deleted_for_everyone === true) return false;
  return true;
}

export async function getUnreadChatCount(userId: string) {
  if (!userId) return 0;

  const { data: memberRows, error: memberErr } = await supabase
    .from("chat_members")
    .select("thread_id,last_read_at")
    .eq("user_id", userId);

  if (memberErr) {
    console.error("getUnreadChatCount member error:", memberErr);
    return 0;
  }

  const members = (memberRows ?? []) as ChatMemberRow[];
  const threadIds = members.map((x) => x.thread_id).filter(Boolean);

  if (threadIds.length === 0) return 0;

  const { data: msgRows, error: msgErr } = await supabase
    .from("chat_messages")
    .select(
      "id,thread_id,created_at,sender_id,deleted_at,deleted_for_everyone"
    )
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false })
    .limit(3000);

  if (msgErr) {
    console.error("getUnreadChatCount message error:", msgErr);
    return 0;
  }

  const messages = ((msgRows ?? []) as ChatMessageRow[]).filter(
    isVisibleMessage
  );

  const latestByThread = new Map<string, ChatMessageRow>();

  for (const message of messages) {
    if (!latestByThread.has(message.thread_id)) {
      latestByThread.set(message.thread_id, message);
    }
  }

  let unread = 0;

  for (const member of members) {
    const latest = latestByThread.get(member.thread_id);
    if (!latest?.created_at) continue;

    // 自分が最後に送ったスレッドは未読にしない
    if (latest.sender_id === userId) continue;

    if (!member.last_read_at) {
      unread += 1;
      continue;
    }

    if (
      new Date(latest.created_at).getTime() >
      new Date(member.last_read_at).getTime()
    ) {
      unread += 1;
    }
  }

  return Math.max(0, unread);
}

// いまは「統一バッジ」= チャット未読数のみ
export async function getUnifiedBadgeCount(userId: string) {
  if (!userId) return 0;
  return getUnreadChatCount(userId);
}

export async function syncAppBadge(count: number) {
  if (typeof window === "undefined") return;

  try {
    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };

    if (!("setAppBadge" in nav)) return;

    if (count > 0) {
      await nav.setAppBadge?.(count);
    } else if ("clearAppBadge" in nav) {
      await nav.clearAppBadge?.();
    }
  } catch (e) {
    console.error("syncAppBadge error:", e);
  }
}