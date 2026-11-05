import "@/app/lib/server/patchNodeUrlParse";
import webpush from "web-push";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasCronAuthorization, getSessionUserId } from "@/app/lib/server/internalAuth";
import { callerMayNotify, isUuid } from "@/app/lib/server/pushAuthorization";
import { safePushPath } from "@/app/lib/server/pushPath";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PushSendBody = {
  userId?: unknown;
  title?: unknown;
  body?: unknown;
  url?: unknown;
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

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function requiredEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    throw new Error("push is not configured");
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    vapidPublicKey,
    vapidPrivateKey,
  };
}

function createSupabaseAdmin() {
  const { supabaseUrl, serviceRoleKey } = requiredEnv();

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function vapidSubject() {
  const configured = process.env.VAPID_SUBJECT?.trim();
  if (!configured) return "https://www.sakamatch.com";
  if (configured.startsWith("mailto:") || configured.startsWith("https://")) {
    return configured;
  }
  throw new Error("push is not configured");
}

function ensureWebPushConfigured() {
  const { vapidPublicKey, vapidPrivateKey } = requiredEnv();
  webpush.setVapidDetails(vapidSubject(), vapidPublicKey, vapidPrivateKey);
}

function clipText(value: string, max: number) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getUnreadChatCount(supabase: SupabaseClient, userId: string) {
  const { data: memberRows } = await supabase
    .from("chat_members")
    .select("thread_id,last_read_at")
    .eq("user_id", userId);

  const members = (memberRows ?? []) as ChatMemberRow[];
  const threadIds = members.map((row) => row.thread_id).filter(Boolean);
  if (threadIds.length === 0) return 0;

  const { data: msgRows } = await supabase
    .from("chat_messages")
    .select("id,thread_id,sender_id,created_at,deleted_at,deleted_for_everyone")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false })
    .limit(3000);

  const messages = ((msgRows ?? []) as ChatMessageRow[]).filter((message) => {
    if (!message) return false;
    if (message.deleted_at) return false;
    if (message.deleted_for_everyone) return false;
    return true;
  });

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

async function getUnreadOtherNotificationCount(
  supabase: SupabaseClient,
  userId: string,
) {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false)
    .neq("type", "chat_message");

  if (error) {
    console.error("getUnreadOtherNotificationCount error");
    return 0;
  }

  return count ?? 0;
}

function statusCodeOf(error: unknown) {
  if (!error || typeof error !== "object" || !("statusCode" in error)) return undefined;
  const statusCode = error.statusCode;
  return typeof statusCode === "number" ? statusCode : undefined;
}

export async function POST(req: Request) {
  try {
    const internal = hasCronAuthorization(req);
    const callerId = internal ? null : await getSessionUserId();
    if (!internal && !callerId) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }

    const json = (await req.json()) as PushSendBody;
    const userId = typeof json.userId === "string" ? json.userId : "";
    const title = typeof json.title === "string" ? json.title : "";
    const body = typeof json.body === "string" ? json.body : "";
    const url = safePushPath(json.url);

    if (!isUuid(userId) || !title.trim() || !body.trim()) {
      return Response.json(
        { error: "userId, title, body are required" },
        { status: 400 },
      );
    }

    ensureWebPushConfigured();
    const supabase = createSupabaseAdmin();

    if (!internal && callerId) {
      const allowed = await callerMayNotify(supabase, callerId, userId);
      if (!allowed) {
        return Response.json({ error: "forbidden" }, { status: 403 });
      }
    }

    await wait(300);

    const [chatCount, otherCount] = await Promise.all([
      getUnreadChatCount(supabase, userId),
      getUnreadOtherNotificationCount(supabase, userId),
    ]);
    const badgeCount = chatCount + otherCount;

    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (error) {
      console.error("push subscription lookup failed");
      return Response.json({ error: "push failed" }, { status: 500 });
    }

    const rows = (subscriptions ?? []) as PushSubscriptionRow[];
    if (rows.length === 0) {
      return Response.json({
        success: true,
        sent: 0,
        skipped: true,
        badgeCount,
      });
    }

    const payload = JSON.stringify({
      title: clipText(title, 80),
      body: clipText(body, 180),
      url,
      badgeCount,
    });

    let sent = 0;
    for (const sub of rows) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          payload,
        );
        sent++;
      } catch (sendError: unknown) {
        const statusCode = statusCodeOf(sendError);
        console.error("push send error:", statusCode ?? "unknown");

        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    }

    return Response.json({
      success: true,
      sent,
      total: rows.length,
      badgeCount,
    });
  } catch (error) {
    console.error("push route error:", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "push failed" }, { status: 500 });
  }
}
