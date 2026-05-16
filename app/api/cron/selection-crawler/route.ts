// /app/api/cron/selection-crawler/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const offset = url.searchParams.get("offset") ?? "0";
  const limit = url.searchParams.get("limit") ?? "92";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return Response.json(
      {
        ok: false,
        error: "Missing Supabase env",
      },
      {
        status: 500,
      }
    );
  }

  const functionUrl =
    `${supabaseUrl.replace(/\/$/, "")}/functions/v1/selection-crawler` +
    `?offset=${encodeURIComponent(offset)}` +
    `&limit=${encodeURIComponent(limit)}`;

  const task = fetch(functionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anonKey}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      triggeredBy: "vercel-cron",
      offset: Number(offset),
      limit: Number(limit),
    }),
  }).catch((error) => {
    console.error("selection crawler trigger failed:", error);
  });

  (globalThis as any).waitUntil?.(task);

  return Response.json({
    ok: true,
    message: "selection-crawler started",
    offset: Number(offset),
    limit: Number(limit),
  });
}