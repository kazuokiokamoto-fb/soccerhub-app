import { NextResponse } from "next/server";
import { createDraft, markInReview, readReportBundle } from "@/app/lib/server/officialResults";
import { authed, jsonResult, readBody, yearFrom } from "@/app/lib/server/officialResultsHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ teamId: string }> };

export async function GET(req: Request, { params }: Params) {
  const auth = await authed();
  if ("response" in auth) return auth.response;
  const { teamId } = await params;
  const year = yearFrom(new URL(req.url).searchParams.get("year"));
  if (year === null) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }
  return jsonResult(
    await readReportBundle(auth.session.supabase, auth.session.userId, teamId, year),
  );
}

export async function POST(req: Request, { params }: Params) {
  const auth = await authed();
  if ("response" in auth) return auth.response;
  const { teamId } = await params;
  const body = await readBody(req);
  const year = yearFrom(body?.year);
  if (!body || year === null) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }
  if (body.action === "review") {
    if (typeof body.expectedVersion !== "number") {
      return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
    }
    return jsonResult(
      await markInReview(
        auth.session.supabase,
        auth.session.userId,
        teamId,
        year,
        body.expectedVersion,
      ),
    );
  }
  return jsonResult(await createDraft(auth.session.supabase, auth.session.userId, teamId, year));
}
