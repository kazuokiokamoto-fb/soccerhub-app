import { NextResponse } from "next/server";
import { readReportBundle, submitReport } from "@/app/lib/server/officialResults";
import { readStandingExtras, submitStanding } from "@/app/lib/server/standingReport";
import type { ReportOutcome } from "@/lib/official-results/rules";
import { authed, jsonResult, readBody, yearFrom } from "@/app/lib/server/officialResultsHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ teamId: string }> };

function outcomeFrom(value: unknown): ReportOutcome | null {
  if (value === "has_results" || value === "no_official_results") return value;
  return null;
}

export async function POST(req: Request, { params }: Params) {
  const auth = await authed();
  if ("response" in auth) return auth.response;
  const { teamId } = await params;
  const body = await readBody(req);
  const year = yearFrom(body?.year);
  if (body?.kind === "standing") {
    if (!body || year === null || (body.mode !== "confirm" && body.mode !== "edit")) {
      return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
    }
    if (typeof body.expectedVersion !== "number") {
      return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
    }
    const saved = await submitStanding(auth.session.supabase, auth.session.userId, teamId, {
      year,
      expectedVersion: body.expectedVersion,
      mode: body.mode,
      category: body.category,
      rank: body.rank,
      unknown: body.unknown,
    });
    if (!saved.ok) return jsonResult(saved);
    const bundle = await readReportBundle(auth.session.supabase, auth.session.userId, teamId, year);
    if (!bundle.ok || !("team" in bundle)) return jsonResult(bundle);
    const standing = await readStandingExtras(auth.session.supabase, teamId, year);
    if ("status" in standing) return jsonResult(standing);
    return jsonResult({ ...bundle, standing, idempotent: saved.idempotent });
  }
  const outcome = outcomeFrom(body?.outcome);
  if (!body || year === null || outcome === null || typeof body.expectedVersion !== "number") {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }
  return jsonResult(
    await submitReport(
      auth.session.supabase,
      auth.session.userId,
      teamId,
      year,
      body.expectedVersion,
      outcome,
    ),
  );
}
