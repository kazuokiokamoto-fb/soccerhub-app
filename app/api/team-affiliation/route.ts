import { readAffiliationState, saveAffiliation } from "@/app/lib/server/affiliation";
import { authed, jsonResult, readBody } from "@/app/lib/server/officialResultsHttp";
import { affiliationDraftFromBody } from "@/lib/affiliation/validate";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authed();
  if ("response" in auth) return auth.response;
  return jsonResult(await readAffiliationState(auth.session.supabase, auth.session.userId));
}

export async function POST(req: Request) {
  const auth = await authed();
  if ("response" in auth) return auth.response;
  const body = await readBody(req);
  if (!body || typeof body.teamId !== "string") {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }
  return jsonResult(
    await saveAffiliation(
      auth.session.supabase,
      auth.session.userId,
      body.teamId,
      affiliationDraftFromBody(body),
    ),
  );
}
