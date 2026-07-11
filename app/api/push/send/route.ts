import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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

function getEnvOrThrow() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  if (!supabaseUrl) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!serviceRoleKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
  if (!vapidPublicKey) throw new Error("Missing env: NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  if (!vapidPrivateKey) throw new Error("Missing env: VAPID_PRIVATE_KEY");

  return {
    supabaseUrl,
    serviceRoleKey,
    vapidPublicKey,
    vapidPrivateKey,
  };
}

function createSupabaseAdmin() {
  const { supabaseUrl, serviceRoleKey } = getEnvOrThrow();

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function ensureWebPushConfigured() {
  const { vapidPublicKey, vapidPrivateKey } = getEnvOrThrow();

  webpush.setVapidDetails(
    "mailto:your@email.com",
    vapidPublicKey,
    vapidPrivateKey
  );
}

// =========================
// 未読数計算
// =========================
async function getUnreadChatCount(userId: string) {
  const supabase = createSupabaseAdmin();

  const { data: memberRows } = await supabase
    .from("chat_members")
    .select("thread_id,last_read_at")
    .eq("user_id", userId);

  const members = (memberRows ?? []) as ChatMemberRow[];
  const threadIds = members.map((x) => x.thread_id).filter(Boolean);

  if (threadIds.length === 0) return 0;

  const { data: msgRows } = await supabase
    .from("chat_messages")
    .select("id,thread_id,sender_id,created_at,deleted_at,deleted_for_everyone")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false })
    .limit(3000);

  const messages = ((msgRows ?? []) as ChatMessageRow[]).filter((m) => {
    if (!m) return false;
    if (m.deleted_at) return false;
    if (m.deleted_for_everyone) return false;
    return true;
  });

  const latestByThread = new Map<string, ChatMessageRow>();

  for (const m of messages) {
    if (!latestByThread.has(m.thread_id)) {
      latestByThread.set(m.thread_id, m);
    }
  }

  let unread = 0;

  for (const member of members) {
    const latest = latestByThread.get(member.thread_id);
    if (!latest?.created_at) continue;

    if (latest.sender_id === userId) continue;

    if (!member.last_read_at) {
      unread++;
      continue;
    }

    if (
      new Date(latest.created_at).getTime() >
      new Date(member.last_read_at).getTime()
    ) {
      unread++;
    }
  }

  return unread;
}

// notifications テーブルの未読件数(チャット以外: selection_event, match_request, offer 等)。
// "chat" タイプは getUnreadChatCount 側で既に計算しているため、二重カウント防止のため除外する。
async function getUnreadOtherNotificationCount(userId: string) {
  const supabase = createSupabaseAdmin();

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false)
    .neq("type", "chat");

  if (error) {
    console.error("getUnreadOtherNotificationCount error:", error);
    return 0;
  }

  return count ?? 0;
}

// 統一バッジ = チャット未読数 + それ以外の通知(セレクション新着・オファー・試合申込等)の未読数
async function getUnifiedBadgeCount(userId: string) {
  const [chatCount, otherCount] = await Promise.all([
    getUnreadChatCount(userId),
    getUnreadOtherNotificationCount(userId),
  ]);

  return chatCount + otherCount;
}

// =========================
// ★ここが重要：遅延追加
// =========================
function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: Request) {
  try {
    ensureWebPushConfigured();
    const supabase = createSupabaseAdmin();

    const json = (await req.json()) as PushSendBody;

    const userId = json?.userId;
    const title = json?.title;
    const body = json?.body;
    const url = json?.url || "/";

    if (!userId || !title || !body) {
      return Response.json(
        { error: "userId, title, body are required" },
        { status: 400 }
      );
    }

    // ★ここ追加（重要）
    await wait(300);

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
        sent++;
      } catch (e: any) {
        console.error("push send error:", e?.message ?? e);

        if (e?.statusCode === 404 || e?.statusCode === 410) {
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
    console.error("push route error:", e);
    return Response.json(
      { error: e?.message ?? "invalid request" },
      { status: 500 }
    );
  }
}
