import { NextResponse } from "next/server";
import { cronUnauthorized, hasCronAuthorization } from "@/app/lib/server/internalAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!hasCronAuthorization(req)) return cronUnauthorized();

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("find-team-homepages cron is not configured");
      return NextResponse.json({ ok: false, error: "not configured" }, { status: 500 });
    }

    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/functions/v1/find-team-homepages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          batchSize: 5,
        }),
      },
    );

    const text = await response.text();
    let data: unknown = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      data,
    });
  } catch (error) {
    console.error(
      "find-team-homepages cron failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ ok: false, error: "cron failed" }, { status: 500 });
  }
}
