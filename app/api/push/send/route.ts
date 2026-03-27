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

    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return Response.json({ success: true, sent: 0, skipped: true });
    }

    const payload = JSON.stringify({
      title,
      body,
      url,
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

        // 無効な購読は削除
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
    });
  } catch (e: any) {
    return Response.json(
      { error: e?.message ?? "invalid request" },
      { status: 400 }
    );
  }
}