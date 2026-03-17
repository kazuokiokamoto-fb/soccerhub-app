import { supabase } from "./supabase";

export type ChatUnreadThreadRow = {
  thread_id: string;
  last_read_at: string | null;
};

export type ChatUnreadMessageRow = {
  thread_id: string;
  created_at: string;
};

export type ChatUnreadSummary = {
  unreadThreads: number;
  unreadMessages: number;
  unreadThreadIds: string[];
};

export async function getChatUnreadSummary(meId: string): Promise<ChatUnreadSummary> {
  if (!meId) {
    return {
      unreadThreads: 0,
      unreadMessages: 0,
      unreadThreadIds: [],
    };
  }

  const { data: memberRows, error: memberErr } = await supabase
    .from("chat_members")
    .select("thread_id,last_read_at")
    .eq("user_id", meId);

  if (memberErr) {
    console.error("[getChatUnreadSummary] chat_members error:", memberErr);
    return {
      unreadThreads: 0,
      unreadMessages: 0,
      unreadThreadIds: [],
    };
  }

  const members = ((memberRows ?? []) as ChatUnreadThreadRow[]).filter(
    (r) => !!r.thread_id
  );

  if (members.length === 0) {
    return {
      unreadThreads: 0,
      unreadMessages: 0,
      unreadThreadIds: [],
    };
  }

  const threadIds = Array.from(new Set(members.map((r) => r.thread_id)));

  const { data: messageRows, error: msgErr } = await supabase
    .from("chat_messages")
    .select("thread_id,created_at")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false })
    .limit(Math.max(500, threadIds.length * 100));

  if (msgErr) {
    console.error("[getChatUnreadSummary] chat_messages error:", msgErr);
    return {
      unreadThreads: 0,
      unreadMessages: 0,
      unreadThreadIds: [],
    };
  }

  const messages = ((messageRows ?? []) as ChatUnreadMessageRow[]).filter(
    (r) => !!r.thread_id && !!r.created_at
  );

  const messagesByThread = new Map<string, ChatUnreadMessageRow[]>();

  for (const row of messages) {
    if (!messagesByThread.has(row.thread_id)) {
      messagesByThread.set(row.thread_id, []);
    }
    messagesByThread.get(row.thread_id)!.push(row);
  }

  let unreadThreads = 0;
  let unreadMessages = 0;
  const unreadThreadIds: string[] = [];

  for (const member of members) {
    const rows = messagesByThread.get(member.thread_id) ?? [];
    if (rows.length === 0) continue;

    if (!member.last_read_at) {
      unreadThreads += 1;
      unreadMessages += rows.length;
      unreadThreadIds.push(member.thread_id);
      continue;
    }

    const lastRead = new Date(member.last_read_at).getTime();
    const newerRows = rows.filter(
      (m) => new Date(m.created_at).getTime() > lastRead
    );

    if (newerRows.length > 0) {
      unreadThreads += 1;
      unreadMessages += newerRows.length;
      unreadThreadIds.push(member.thread_id);
    }
  }

  return {
    unreadThreads,
    unreadMessages,
    unreadThreadIds,
  };
}