// /app/api/cron/selection-crawler/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);

  const offset = Number(url.searchParams.get("offset") ?? "0");
  const limit = Number(url.searchParams.get("limit") ?? "92");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return Response.json(
      { ok: false, error: "Missing Supabase env" },
      { status: 500 }
    );
  }

  try {
    const functionUrl =
      `${supabaseUrl.replace(/\/$/, "")}/functions/v1/selection-crawler` +
      `?offset=${offset}&limit=1`;

    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 25000);

    try {
      await fetch(functionUrl, {
        method: "GET",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        signal: controller.signal,
      });
    } catch (err) {
      console.error("selection crawler fetch error:", err);
    } finally {
      clearTimeout(timeout);
    }

    const nextOffset = offset + 1;

    if (nextOffset < limit) {
      const nextUrl =
        `${url.origin}/api/cron/selection-crawler` +
        `?offset=${nextOffset}&limit=${limit}`;

      fetch(nextUrl).catch(console.error);
    }

    return Response.json({
      ok: true,
      offset,
      nextOffset,
      limit,
    });
  } catch (e) {
    console.error(e);

    return Response.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "unknown",
      },
      { status: 500 }
    );
  }
}