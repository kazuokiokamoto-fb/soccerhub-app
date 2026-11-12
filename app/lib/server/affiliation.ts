import type { SupabaseClient } from "@supabase/supabase-js";
import { affiliationPrompts } from "@/lib/affiliation/prompts";
import { validateAffiliation, type AffiliationDraft } from "@/lib/affiliation/validate";
import { inspectCrawlUrl } from "@/lib/standings/crawlUrl";
import { requireManager, schemaMissing, type Failure } from "@/app/lib/server/officialResults";
import { createServiceClient } from "@/app/lib/server/serviceSupabase";
import { crawlSavedPage, discoverResultsPage } from "@/app/lib/server/resultsDiscovery";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(status: number, error: string): Failure {
  return { ok: false, status, error };
}

type ManagerTeam = { id: string; name: string; role: string };

async function managerTeams(
  supabase: SupabaseClient,
  userId: string,
): Promise<ManagerTeam[] | Failure> {
  const [owned, member] = await Promise.all([
    supabase.from("teams").select("id,name").eq("owner_id", userId),
    supabase.from("team_members").select("team_id,role").eq("user_id", userId),
  ]);
  if (owned.error || member.error) return fail(500, "read_failed");
  const teams = new Map<string, ManagerTeam>();
  for (const row of owned.data ?? []) {
    if (typeof row.id === "string") {
      teams.set(row.id, {
        id: row.id,
        name: typeof row.name === "string" ? row.name : "",
        role: "owner",
      });
    }
  }
  const missing: string[] = [];
  for (const row of member.data ?? []) {
    if (typeof row.team_id !== "string" || teams.has(row.team_id)) continue;
    if (row.role !== "owner" && row.role !== "coach") continue;
    missing.push(row.team_id);
    teams.set(row.team_id, { id: row.team_id, name: "", role: row.role });
  }
  if (missing.length > 0) {
    const named = await supabase.from("teams").select("id,name").in("id", missing);
    if (named.error) return fail(500, "read_failed");
    for (const row of named.data ?? []) {
      const current = teams.get(String(row.id));
      if (current) current.name = typeof row.name === "string" ? row.name : "";
    }
  }
  return [...teams.values()];
}

export async function readAffiliationState(supabase: SupabaseClient, userId: string) {
  const teams = await managerTeams(supabase, userId);
  if (!Array.isArray(teams)) return teams;
  if (teams.length === 0) {
    return { ok: true as const, schemaReady: true, prompts: [], teams: [] };
  }
  const ids = teams.map((team) => team.id);
  const [affiliations, dismissals, pages] = await Promise.all([
    supabase
      .from("team_affiliations")
      .select("team_id,status,prefecture,category,organization_name")
      .in("team_id", ids),
    supabase.from("team_affiliation_dismissals").select("team_id").eq("user_id", userId),
    supabase
      .from("team_result_pages")
      .select("team_id,status,url,suggested_url,confidence")
      .in("team_id", ids),
  ]);
  if ([affiliations.error, dismissals.error, pages.error].some((error) => schemaMissing(error))) {
    return { ok: true as const, schemaReady: false, prompts: [], teams: [] };
  }
  if (affiliations.error || dismissals.error || pages.error) return fail(500, "read_failed");

  const affiliationRows = affiliations.data ?? [];
  const pageRows = pages.data ?? [];
  const prompts = affiliationPrompts({
    teams,
    affiliations: affiliationRows.map((row) => ({
      teamId: String(row.team_id),
      status: String(row.status),
    })),
    dismissals: (dismissals.data ?? []).map((row) => ({ teamId: String(row.team_id) })),
    pages: pageRows.map((row) => ({
      teamId: String(row.team_id),
      status: String(row.status),
      suggestedUrl: typeof row.suggested_url === "string" ? row.suggested_url : null,
    })),
  });

  return {
    ok: true as const,
    schemaReady: true,
    prompts,
    teams: teams.map((team) => {
      const affiliation = affiliationRows.find((row) => row.team_id === team.id) ?? null;
      const page = pageRows.find((row) => row.team_id === team.id) ?? null;
      return {
        ...team,
        affiliation: affiliation
          ? {
              status: affiliation.status,
              prefecture: affiliation.prefecture,
              category: affiliation.category,
              organizationName: affiliation.organization_name,
            }
          : null,
        page: page
          ? {
              status: page.status,
              url: page.url,
              suggestedUrl: page.suggested_url,
              confidence: page.confidence,
            }
          : null,
      };
    }),
  };
}

async function writePage(
  supabase: SupabaseClient,
  teamId: string,
  userId: string,
  page: {
    status: string;
    confidence: string;
    url: string | null;
    suggestedUrl: string | null;
    note: string | null;
    crawled?: boolean;
  },
) {
  const saved = await supabase.from("team_result_pages").upsert(
    {
      team_id: teamId,
      status: page.status,
      confidence: page.confidence,
      url: page.url,
      suggested_url: page.suggestedUrl,
      note: page.note,
      updated_by: userId,
      ...(page.crawled ? { last_crawled_at: new Date().toISOString() } : {}),
    },
    { onConflict: "team_id" },
  );
  return saved.error;
}

export async function saveAffiliation(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
  draft: AffiliationDraft,
) {
  if (!UUID_RE.test(teamId)) return fail(400, "validation");
  const value = validateAffiliation(draft);
  if (!value.ok) return fail(400, "validation");
  const access = await requireManager(supabase, userId, teamId);
  if ("ok" in access) return access;

  const row =
    value.value.status === "none"
      ? {
          team_id: teamId,
          status: "none",
          prefecture: null,
          category: null,
          organization_name: null,
          updated_by: userId,
        }
      : {
          team_id: teamId,
          status: "affiliated",
          prefecture: value.value.prefecture,
          category: value.value.category,
          organization_name: value.value.organizationName,
          updated_by: userId,
        };
  const saved = await supabase.from("team_affiliations").upsert(row, { onConflict: "team_id" });
  if (schemaMissing(saved.error)) return fail(503, "schema_unavailable");
  if (saved.error) return fail(500, "write_failed");

  if (value.value.status === "none") {
    const pageError = await writePage(supabase, teamId, userId, {
      status: "none",
      confidence: "none",
      url: null,
      suggestedUrl: null,
      note: null,
    });
    if (pageError && !schemaMissing(pageError)) return fail(500, "write_failed");
    return {
      ok: true as const,
      resultsPage: { status: "none", url: null, suggestedUrl: null },
    };
  }

  await writePage(supabase, teamId, userId, {
    status: "searching",
    confidence: "none",
    url: null,
    suggestedUrl: null,
    note: null,
  });

  let choice: {
    status: "found" | "needs_url";
    url: string | null;
    suggestedUrl: string | null;
    confidence: "high" | "low" | "none";
  } = {
    status: "needs_url",
    url: null,
    suggestedUrl: null,
    confidence: "none",
  };
  try {
    const discovered = await discoverResultsPage({
      service: createServiceClient(),
      teamId,
      teamName: access.team.name,
      prefecture: value.value.prefecture,
      category: value.value.category,
      organizationName: value.value.organizationName,
    });
    choice = {
      status: discovered.status,
      url: discovered.url,
      suggestedUrl: discovered.suggestedUrl,
      confidence: discovered.confidence,
    };
  } catch (error) {
    console.error(
      "affiliation discovery skipped:",
      error instanceof Error ? error.message : "unknown",
    );
  }

  const pageError = await writePage(supabase, teamId, userId, {
    status: choice.status,
    confidence: choice.confidence,
    url: choice.url,
    suggestedUrl: choice.suggestedUrl,
    note: choice.status === "needs_url" ? "結果ページは未確定です。" : null,
    crawled: choice.status === "found",
  });
  if (pageError && !schemaMissing(pageError)) return fail(500, "write_failed");
  return { ok: true as const, resultsPage: choice };
}

export async function dismissAffiliationPrompt(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
) {
  if (!UUID_RE.test(teamId)) return fail(400, "validation");
  const access = await requireManager(supabase, userId, teamId);
  if ("ok" in access) return access;
  const saved = await supabase.from("team_affiliation_dismissals").upsert(
    { team_id: teamId, user_id: userId, dismissed_at: new Date().toISOString() },
    { onConflict: "team_id,user_id" },
  );
  if (schemaMissing(saved.error)) return fail(503, "schema_unavailable");
  if (saved.error) return fail(500, "write_failed");
  return { ok: true as const };
}

export async function saveResultsPage(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
  rawUrl: unknown,
) {
  if (!UUID_RE.test(teamId) || typeof rawUrl !== "string") return fail(400, "validation");
  const inspected = inspectCrawlUrl(rawUrl);
  if (!inspected.ok) return fail(400, "unsafe_url");
  const access = await requireManager(supabase, userId, teamId);
  if ("ok" in access) return access;
  const affiliation = await supabase
    .from("team_affiliations")
    .select("status,category")
    .eq("team_id", teamId)
    .maybeSingle();
  if (schemaMissing(affiliation.error)) return fail(503, "schema_unavailable");
  if (affiliation.error) return fail(500, "read_failed");
  if (!affiliation.data || affiliation.data.status !== "affiliated") return fail(400, "validation");

  const url = inspected.url.toString();
  const pageError = await writePage(supabase, teamId, userId, {
    status: "manual",
    confidence: "high",
    url,
    suggestedUrl: null,
    note: null,
  });
  if (schemaMissing(pageError)) return fail(503, "schema_unavailable");
  if (pageError) return fail(500, "write_failed");

  try {
    await crawlSavedPage({
      service: createServiceClient(),
      teamId,
      teamName: access.team.name,
      categoryHint: typeof affiliation.data.category === "string" ? affiliation.data.category : null,
      url,
    });
    await supabase
      .from("team_result_pages")
      .update({ last_crawled_at: new Date().toISOString(), updated_by: userId })
      .eq("team_id", teamId);
  } catch (error) {
    console.error(
      "manual results page crawl skipped:",
      error instanceof Error ? error.message : "unknown",
    );
  }
  return { ok: true as const, resultsPage: { status: "manual", url, suggestedUrl: null } };
}
