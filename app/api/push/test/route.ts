import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // ← 後で設定
);

webpush.setVapidDetails(
  "mailto:your@email.com",
  "BFISQsrF1NiWyt3PN2ru0Xvykn2QxVwn1M1pjeYuVT3JSLtjd3uz7NSWdB1i8RqkKAQ2j7HTYAh_wa5sLkvLk24",
  "Vka2kVY_V5x6p_uIZ_lFKh5zYvlwrUys8cIq17fApuw"
);

export async function GET() {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("*");

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const payload = JSON.stringify({
    title: "サカまち",
    body: "テスト通知です！",
    url: "/",
  });

  for (const sub of data) {
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
    } catch (e) {
      console.error("push error:", e);
    }
  }

  return Response.json({ success: true, count: data.length });
}