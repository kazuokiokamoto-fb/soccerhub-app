import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);

    const offset = Number(url.searchParams.get("offset") ?? "0");
    const limit = Number(url.searchParams.get("limit") ?? "92");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const selectionSecret = process.env.SELECTION_SECRET;

    if (!supabaseUrl || !anonKey || !selectionSecret) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing env",
          hasSupabaseUrl: Boolean(supabaseUrl),
          hasAnonKey: Boolean(anonKey),
          hasSelectionSecret: Boolean(selectionSecret),
        },
        { status: 500 }
      );
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

    let data: any = null;

    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    const nextOffset =
      typeof data?.nextOffset === "number"
        ? data.nextOffset
        : offset + 1;

    const remainingLimit =
      typeof data?.remainingLimit === "number"
        ? data.remainingLimit
        : limit - 1;

    const hasMore =
      data?.hasMore === true ||
      data?.nextOffset != null ||
      remainingLimit > 0;

    if (hasMore && remainingLimit > 0) {
      const nextUrl =
        `${url.origin}/api/cron/selection-crawler` +
        `?offset=${nextOffset}` +
        `&limit=${remainingLimit}`;

      await fetch(nextUrl, {
        method: "GET",
        headers: {
          "x-selection-secret": selectionSecret,
        },
      }).catch(console.error);
    }

    return NextResponse.json({
      ok: true,
      offset,
      nextOffset,
      remainingLimit,
      hasMore,
      crawler: data,
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}