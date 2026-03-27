import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

webpush.setVapidDetails(
  "mailto:your@email.com",
  "BFISQsrF1NiWyt3PN2ru0Xvykn2QxVwn1M1pjeYuVT3JSLtjd3uz7NSWdB1i8RqkKAQ2j7HTYAh_wa5sLkvLk24",
  "Vka2kVY_V5x6p_uIZ_lFKh5zYvlwrUys8cIq17fApuw"
);

type PushSendBody = {
  userId: string;
  title: string;
  body: string;
  url?: string;
};

// =========================
// 🔥 チャット未読数を算出
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

  const members = memberRows ?? [];
  const threadIds = members.map((x: any) => x.thread_id).filter(Boolean);

  if (threadIds.length === 0) return 0;

  const { data: msgRows, error: msgErr } = await supabase
    .from("chat_messages")
    .select("id,thread_id,created_at")
    .in("thread_id", threadIds)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (msgErr) {
    console.error("chat unread message error:", msgErr);
    return 0;
  }

  const latestByThread = new Map<string, any>();

  for (const m of msgRows ?? []) {
    if (!latestByThread.has(m.thread_id)) {
      latestByThread.set(m.thread_id, m);
    }
  }

  let unread = 0;

  for (const member of members) {
    const latest = latestByThread.get(member.thread_id);
    if (!latest?.created_at) continue;

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

export async function POST(req: Request) {
  try {
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

    // =========================
    // 🔥 チャット未読数を取得（統一）
    // =========================
    const badgeCount = await getUnreadChatCount(userId);

    // push購読取得
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

    // =========================
    // 🔥 payload（統一済み）
    // =========================
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