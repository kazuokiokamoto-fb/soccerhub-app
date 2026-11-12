import { NextResponse } from "next/server";
import { cronUnauthorized, hasCronAuthorization } from "@/app/lib/server/internalAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function boundedInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? "");
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

// Left unscheduled. This source crawler is a second writer, and one Vercel Hobby
// invocation cannot finish the selection-source list. Selection pages stay on the
// Supabase cron. The only Vercel cron is /api/cron/results-standings.
export async function GET(req: Request) {
  if (!hasCronAuthorization(req)) return cronUnauthorized();

  try {
    const url = new URL(req.url);
    const offset = boundedInt(url.searchParams.get("offset"), 0, 0, 100000);
    const cronSecretEarly = process.env.CRON_SECRET;
    if (offset === 0 && cronSecretEarly) {
      fetch(`${url.origin}/api/cron/results-standings`, {
        method: "GET",
        headers: { authorization: `Bearer ${cronSecretEarly}` },
      }).catch((error) => {
        console.error(
          "results standings kick skipped:",
          error instanceof Error ? error.message : "unknown",
        );
      });
    }
    const limit = boundedInt(url.searchParams.get("limit"), 92, 1, 200);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const selectionSecret = process.env.SELECTION_SECRET;
    const cronSecret = process.env.CRON_SECRET;

    if (!supabaseUrl || !anonKey || !selectionSecret || !cronSecret) {
      console.error("selection crawler cron is not configured");
      return NextResponse.json({ ok: false, error: "not configured" }, { status: 500 });
    }

    const functionUrl =
      `${supabaseUrl.replace(/\/$/, "")}/functions/v1/selection-crawler` +
      `?offset=${offset}` +
      `&limit=${limit}`;

    const response = await fetch(functionUrl, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "x-selection-secret": selectionSecret,
        "Content-Type": "application/json",
      },
    });

    const text = await response.text();
    type CrawlerStatus = {
      nextOffset?: unknown;
      remainingLimit?: unknown;
      hasMore?: unknown;
    };
    let data: CrawlerStatus | null = null;

    try {
      data = JSON.parse(text) as CrawlerStatus;
    } catch {
      data = null;
    }

    const nextOffset =
      typeof data?.nextOffset === "number" ? data.nextOffset : offset + 1;
    const remainingLimit =
      typeof data?.remainingLimit === "number" ? data.remainingLimit : limit - 1;
    const hasMore =
      data?.hasMore === true || data?.nextOffset != null || remainingLimit > 0;

    if (hasMore && remainingLimit > 0) {
      const nextUrl =
        `${url.origin}/api/cron/selection-crawler` +
        `?offset=${nextOffset}` +
        `&limit=${remainingLimit}`;

      fetch(nextUrl, {
        method: "GET",
        headers: {
          authorization: `Bearer ${cronSecret}`,
        },
      }).catch((error) => {
        console.error(
          "selection crawler chain failed:",
          error instanceof Error ? error.message : "unknown",
        );
      });
    }

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      offset,
      nextOffset,
      remainingLimit,
      hasMore,
    });
  } catch (error) {
    console.error(
      "selection crawler cron failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ ok: false, error: "cron failed" }, { status: 500 });
  }
}
