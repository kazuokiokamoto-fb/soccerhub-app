import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

webpush.setVapidDetails(
  "mailto:your@email.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

type PushSendBody = {
  userId: string;
  title: string;
  body: string;
  url?: string;
};

type ChatMemberRow = {
  thread_id: string;
  last_read_at: string | null;
};

type ChatMessageRow = {
  id: string;
  thread_id: string;
  sender_id: string | null;
  created_at: string;
  deleted_at?: string | null;
  deleted_for_everyone?: boolean | null;
};

function isVisibleMessage(message: ChatMessageRow) {
  if (message.deleted_at) return false;
  if (message.deleted_for_everyone === true) return false;
  return true;
}

// =========================
// チャット未読数を算出
// 自分が最後に送ったスレッドは未読にしない
// =========================
async function getUnreadChatCount(userId: string) {
  const { data: memberRows, error: memberErr } = await supabase
    .from("chat_members")
    .select("thread_id,last_read_at")
    .eq("user_id", userId);

  if (memberErr) {
    console.error("chat unread member error:", memberErr);
    return 0;
  }

  const members = (memberRows ?? []) as ChatMemberRow[];
  const threadIds = members.map((x) => x.thread_id).filter(Boolean);

  if (threadIds.length === 0) return 0;

  const { data: msgRows, error: msgErr } = await supabase
    .from("chat_messages")
    .select("id,thread_id,sender_id,created_at,deleted_at,deleted_for_everyone")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false })
    .limit(3000);

  if (msgErr) {
    console.error("chat unread message error:", msgErr);
    return 0;
  }

  const latestByThread = new Map<string, ChatMessageRow>();

  for (const raw of (msgRows ?? []) as ChatMessageRow[]) {
    if (!isVisibleMessage(raw)) continue;

    if (!latestByThread.has(raw.thread_id)) {
      latestByThread.set(raw.thread_id, raw);
    }
  }

  let unread = 0;

  for (const member of members) {
    const latest = latestByThread.get(member.thread_id);
    if (!latest?.created_at) continue;

    // ✅ 自分が最後に送ったメッセージなら未読にしない
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

  return unread;
}

// 必要なら今後ここで通知やオファーも合算
async function getUnifiedBadgeCount(userId: string) {
  const unreadChatCount = await getUnreadChatCount(userId);
  return Math.max(0, unreadChatCount);
}

export async function POST(req: Request) {
  try {
    const json = (await req.json()) as PushSendBody;

    const userId =
      typeof json?.userId === "string" ? json.userId.trim() : "";
    const title =
      typeof json?.title === "string" ? json.title.trim() : "";
    const body =
      typeof json?.body === "string" ? json.body.trim() : "";
    const url =
      typeof json?.url === "string" && json.url.trim() ? json.url.trim() : "/";

    if (!userId || !title || !body) {
      return Response.json(
        { error: "userId, title, body are required" },
        { status: 400 }
      );
    }

    const badgeCount = await getUnifiedBadgeCount(userId);

    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return Response.json({
        success: true,
        sent: 0,
        skipped: true,
        badgeCount,
      });
    }

    const payload = JSON.stringify({
      title,
      body,
      url,
      badgeCount,
    });

    let sent = 0;

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload
        );
        sent += 1;
      } catch (e: any) {
        console.error("push send error:", e?.message ?? e);

        const statusCode = e?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", sub.endpoint);
        }
      }
    }

    return Response.json({
      success: true,
      sent,
      total: subscriptions.length,
      badgeCount,
    });
  } catch (e: any) {
    return Response.json(
      { error: e?.message ?? "invalid request" },
      { status: 400 }
    );
  }
}