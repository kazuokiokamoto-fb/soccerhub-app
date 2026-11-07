import { listManagedTeams } from "@/app/lib/server/officialResults";
import { authed, jsonResult } from "@/app/lib/server/officialResultsHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authed();
  if ("response" in auth) return auth.response;
  return jsonResult(await listManagedTeams(auth.session.supabase, auth.session.userId));
}
