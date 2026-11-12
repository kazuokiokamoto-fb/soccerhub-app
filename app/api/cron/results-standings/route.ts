import { after, NextResponse } from "next/server";
import { cronUnauthorized, hasCronAuthorization } from "@/app/lib/server/internalAuth";
import { runStandingsCron, standingsService } from "@/app/lib/server/standingsCron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function passNumber(value: string | null) {
  const parsed = Number(value ?? "0");
  if (!Number.isInteger(parsed) || parsed < 0) return 0;
  return Math.min(parsed, 20);
}

export async function GET(req: Request) {
  if (!hasCronAuthorization(req)) return cronUnauthorized();
  const service = standingsService();
  if (!service) {
    console.error("results standings cron is not configured");
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 500 });
  }
  try {
    const url = new URL(req.url);
    const pass = passNumber(url.searchParams.get("pass"));
    const result = await runStandingsCron(service);
    if (result.more && pass < 12) {
      const cronSecret = process.env.CRON_SECRET;
      if (cronSecret) {
        const nextUrl = `${url.origin}/api/cron/results-standings?pass=${pass + 1}`;
        after(async () => {
          try {
            await fetch(nextUrl, {
              method: "GET",
              headers: { authorization: `Bearer ${cronSecret}` },
            });
          } catch (error) {
            console.error(
              "results standings chain skipped:",
              error instanceof Error ? error.message : "unknown",
            );
          }
        });
      }
    }
    return NextResponse.json({ ok: true, pass, ...result });
  } catch (error) {
    console.error(
      "results standings cron failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ ok: true, checked: 0, failed: 1, error: "recorded" });
  }
}
