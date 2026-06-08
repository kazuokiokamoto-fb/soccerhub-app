import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing Supabase environment variables",
        },
        { status: 500 },
      );
    }

    const url = `${supabaseUrl}/functions/v1/find-team-homepages`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        batchSize: 5,
      }),
    });

    const text = await res.text();

    let data: any = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      data,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: String(e?.message || e),
      },
      { status: 500 },
    );
  }
}