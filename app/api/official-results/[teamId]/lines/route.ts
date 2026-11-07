import { NextResponse } from "next/server";
import { addLine, updateLine } from "@/app/lib/server/officialResults";
import { authed, jsonResult, readBody, yearFrom } from "@/app/lib/server/officialResultsHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ teamId: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await authed();
  if ("response" in auth) return auth.response;
  const { teamId } = await params;
  const body = await readBody(req);
  const year = yearFrom(body?.year);
  if (!body || year === null) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }
  return jsonResult(await addLine(auth.session.supabase, auth.session.userId, teamId, year, body));
}

export async function PATCH(req: Request, { params }: Params) {
  const auth = await authed();
  if ("response" in auth) return auth.response;
  const { teamId } = await params;
  const body = await readBody(req);
  const year = yearFrom(body?.year);
  if (!body || year === null) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }
  return jsonResult(
    await updateLine(auth.session.supabase, auth.session.userId, teamId, year, body),
  );
}
