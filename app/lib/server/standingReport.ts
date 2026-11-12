import type { SupabaseClient } from "@supabase/supabase-js";
import { isReportingYear } from "@/lib/official-results/fiscal";
import { loadReport, requireManager, schemaMissing } from "@/app/lib/server/officialResults";
import { decideStandingSubmit, parseStandingEdit, type StandingValue } from "@/lib/standings/submit";

function fail(status: number, error: string) {
  return { ok: false as const, status, error };
}

type CandidateRow = {
  id: string;
  category: string | null;
  rank: number | null;
  source_url: string;
  fetched_at: string;
  evidence: string;
  confidence: string;
};

export async function readStandingExtras(
  supabase: SupabaseClient,
  teamId: string,
  year: number,
) {
  const [candidate, page] = await Promise.all([
    supabase
      .from("official_standing_candidates")
      .select("id,category,rank,source_url,fetched_at,evidence,confidence")
      .eq("team_id", teamId)
      .eq("fiscal_year", year)
      .order("fetched_at", { ascending: false })
      .limit(1),
    supabase
      .from("team_result_pages")
      .select("status,url,suggested_url,confidence")
      .eq("team_id", teamId)
      .maybeSingle(),
  ]);
  if (schemaMissing(candidate.error) || schemaMissing(page.error)) {
    return { candidate: null, page: null };
  }
  if (candidate.error || page.error) return fail(500, "read_failed");
  const row = (candidate.data ?? [])[0] as CandidateRow | undefined;
  return {
    ok: true as const,
    candidate: row
      ? {
          id: row.id,
          category: row.category,
          rank: row.rank,
          sourceUrl: row.source_url,
          fetchedAt: row.fetched_at,
          evidence: row.evidence,
          confidence: row.confidence,
        }
      : null,
    page: page.data
      ? {
          status: page.data.status,
          url: page.data.url,
          suggestedUrl: page.data.suggested_url,
          confidence: page.data.confidence,
        }
      : null,
  };
}

async function ensureDraft(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
  year: number,
  expectedVersion: number,
) {
  const loaded = await loadReport(supabase, teamId, year);
  if (!loaded.ok) return loaded;
  if (loaded.report) return loaded;
  if (expectedVersion !== 0) return fail(409, "version_conflict");
  const inserted = await supabase.from("official_result_reports").insert({
    team_id: teamId,
    reporting_year: year,
    state: "draft",
    outcome: "unspecified",
    version: 1,
    created_by: userId,
  });
  if (inserted.error && inserted.error.code !== "23505") {
    if (schemaMissing(inserted.error)) return fail(503, "schema_unavailable");
    return fail(500, "write_failed");
  }
  return loadReport(supabase, teamId, year);
}

export async function submitStanding(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
  input: {
    year: number;
    expectedVersion: number;
    mode: "confirm" | "edit";
    category: unknown;
    rank: unknown;
    unknown: unknown;
  },
) {
  if (!isReportingYear(input.year, new Date())) return fail(400, "validation");
  if (!Number.isInteger(input.expectedVersion)) return fail(400, "validation");
  const access = await requireManager(supabase, userId, teamId);
  if ("ok" in access) return access;

  const next: StandingValue | null = parseStandingEdit({
    category: input.category,
    rank: input.rank,
    unknown: input.unknown,
  });
  const existing = await loadReport(supabase, teamId, input.year);
  if (!existing.ok) return existing;
  const created = !existing.report;
  const loaded = existing.report
    ? existing
    : await ensureDraft(supabase, userId, teamId, input.year, input.expectedVersion);
  if (!loaded.ok) return loaded;
  if (!loaded.report) return fail(404, "not_found");

  const extras = await readStandingExtras(supabase, teamId, input.year);
  if ("status" in extras) return extras;
  const candidate = extras.candidate
    ? { category: extras.candidate.category, rank: extras.candidate.rank }
    : null;
  const decision = decideStandingSubmit({
    current: {
      state: loaded.report.state,
      version: Number(loaded.report.version),
      category: loaded.report.standing_category ?? null,
      rank: loaded.report.standing_rank ?? null,
      unknown: Boolean(loaded.report.standing_rank_unknown),
    },
    expectedVersion: created ? Number(loaded.report.version) : input.expectedVersion,
    next,
    mode: input.mode,
    candidate,
  });
  if (decision.action === "reject") {
    const status = decision.code === "not_found" ? 404 : decision.code === "version_conflict" ? 409 : 422;
    return fail(status, decision.code);
  }
  if (decision.action === "idempotent") return { ok: true as const, idempotent: true };
  if (!next) return fail(400, "validation");

  const sourceUrl =
    input.mode === "confirm"
      ? extras.candidate?.sourceUrl ?? extras.page?.url ?? null
      : extras.page?.url ?? extras.candidate?.sourceUrl ?? null;
  const updated = await supabase
    .from("official_result_reports")
    .update({
      state: "submitted",
      outcome: next?.unknown ? "no_official_results" : "has_results",
      submission_kind: "standing",
      standing_category: next?.category,
      standing_rank: next?.unknown ? null : next?.rank,
      standing_rank_unknown: Boolean(next?.unknown),
      standing_source_url: sourceUrl,
      standing_candidate_id: input.mode === "confirm" ? extras.candidate?.id ?? null : null,
      version: Number(loaded.report.version) + 1,
    })
    .eq("id", loaded.report.id)
    .eq("version", loaded.report.version)
    .neq("state", "submitted")
    .select("id");
  if (updated.error) {
    if (schemaMissing(updated.error)) return fail(503, "schema_unavailable");
    return fail(500, "write_failed");
  }
  if (!updated.data || updated.data.length === 0) {
    const again = await loadReport(supabase, teamId, input.year);
    if (!again.ok || !again.report) return fail(409, "version_conflict");
    const retry = decideStandingSubmit({
      current: {
        state: again.report.state,
        version: Number(again.report.version),
        category: again.report.standing_category ?? null,
        rank: again.report.standing_rank ?? null,
        unknown: Boolean(again.report.standing_rank_unknown),
      },
      expectedVersion: Number(again.report.version),
      next,
      mode: input.mode,
      candidate,
    });
    if (retry.action === "idempotent") return { ok: true as const, idempotent: true };
    return fail(409, "version_conflict");
  }
  return { ok: true as const, idempotent: false };
}
