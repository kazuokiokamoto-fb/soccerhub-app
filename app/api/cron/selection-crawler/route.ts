import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing env",
        },
        { status: 500 }
      );
    }

    const functionUrl =
      `${supabaseUrl}/functions/v1/selection-crawler` +
      `?offset=0&limit=92`;

    const res = await fetch(functionUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        triggeredBy: "vercel-cron",
      }),
    });

    const text = await res.text();

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      response: text,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : typeof e === "string"
              ? e
              : "Unknown error",
      },
      { status: 500 }
    );
  }
}