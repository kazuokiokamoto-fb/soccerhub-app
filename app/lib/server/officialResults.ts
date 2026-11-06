import type { SupabaseClient } from "@supabase/supabase-js";
import { extractOfficialCandidates } from "@/lib/official-results/extract";
import { isTeamManagerRole } from "@/lib/official-results/permissions";
import {
  dateInFiscalYear,
  describeDuty,
  isCanonicalPolicy,
  isReportingYear,
  listedDuties,
} from "@/lib/official-results/fiscal";
import {
  decideReview,
  decideSubmit,
  obligation,
  type ReportOutcome,
  type ReportState,
  resultLabel,
  sourceDoesNotSubmit,
} from "@/lib/official-results/rules";
import { fetchPublicPage, PublicFetchError } from "@/lib/official-results/ssrf";
import { cleanTeamText } from "@/lib/official-results/text";

const FETCH_LIMIT = 8;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DISCOVERY = {
  automaticSearch: false,
  extent: "no_automatic_search",
  label:
    "インターネット全体の自動検索はしていません。チームが指定した公開URLの取得と、チーム自身の入力だけです。取得結果は下書き候補であり、提出ではありません。",
} as const;

export type Failure = { ok: false; status: number; error: string };

function fail(status: number, error: string): Failure {
  return { ok: false, status, error };
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function schemaMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST204";
}

type TeamRef = { id: string; name: string };

async function requireManager(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
): Promise<{ team: TeamRef } | Failure> {
  if (!isUuid(teamId)) return fail(400, "validation");
  const team = await supabase
    .from("teams")
    .select("id,name,owner_id")
    .eq("id", teamId)
    .maybeSingle();
  if (schemaMissing(team.error)) return fail(503, "schema_unavailable");
  if (team.error) return fail(500, "read_failed");
  if (!team.data || typeof team.data.id !== "string") return fail(404, "not_found");

  const isOwner = team.data.owner_id === userId;
  let memberRole: string | null = null;
  if (!isOwner) {
    const member = await supabase
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", userId)
      .maybeSingle();
    if (member.error) return fail(500, "read_failed");
    memberRole = typeof member.data?.role === "string" ? member.data.role : null;
  }
  if (!isTeamManagerRole({ isOwner, memberRole })) return fail(403, "not_manager");
  return {
    team: {
      id: team.data.id,
      name: typeof team.data.name === "string" ? team.data.name : "",
    },
  };
}

export async function readPolicy(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("official_result_policy")
    .select("period_kind,deadline_month,deadline_day,deadline_time_zone,enforcement,late_submission")
    .eq("id", 1)
    .maybeSingle();
  if (schemaMissing(error)) return fail(503, "schema_unavailable");
  if (error || !data) return fail(500, "read_failed");
  const policy = {
    periodKind: String(data.period_kind ?? ""),
    deadlineMonth: Number(data.deadline_month),
    deadlineDay: Number(data.deadline_day),
    deadlineTimeZone: String(data.deadline_time_zone ?? ""),
    enforcement: String(data.enforcement ?? ""),
    lateSubmission: String(data.late_submission ?? ""),
  };
  if (!isCanonicalPolicy(policy)) return fail(500, "policy_invalid");
  return { ok: true as const, policy };
}

export async function listManagedTeams(supabase: SupabaseClient, userId: string) {
  const policy = await readPolicy(supabase);
  if (!policy.ok) return policy;

  const [owned, member] = await Promise.all([
    supabase.from("teams").select("id,name").eq("owner_id", userId),
    supabase.from("team_members").select("team_id,role").eq("user_id", userId),
  ]);
  if (owned.error || member.error) return fail(500, "read_failed");

  const teams = new Map<string, { id: string; name: string; role: string }>();
  for (const row of owned.data ?? []) {
    if (typeof row.id === "string") {
      teams.set(row.id, {
        id: row.id,
        name: typeof row.name === "string" ? row.name : "",
        role: "owner",
      });
    }
  }
  const memberIds: string[] = [];
  for (const row of member.data ?? []) {
    if (typeof row.team_id !== "string" || typeof row.role !== "string") continue;
    if (!isTeamManagerRole({ isOwner: false, memberRole: row.role })) continue;
    if (teams.has(row.team_id)) continue;
    memberIds.push(row.team_id);
    teams.set(row.team_id, { id: row.team_id, name: "", role: row.role });
  }
  if (memberIds.length > 0) {
    const named = await supabase.from("teams").select("id,name").in("id", memberIds);
    if (named.error) return fail(500, "read_failed");
    for (const row of named.data ?? []) {
      const current = teams.get(String(row.id));
      if (current) current.name = typeof row.name === "string" ? row.name : "";
    }
  }

  const ids = [...teams.keys()];
  const duties = listedDuties(new Date());
  const reportsByTeam = new Map<string, Map<number, { state: ReportState; outcome: ReportOutcome }>>();
  if (ids.length > 0) {
    const reports = await supabase
      .from("official_result_reports")
      .select("team_id,state,outcome,reporting_year")
      .in("team_id", ids)
      .in("reporting_year", duties.map((duty) => duty.fiscalYear));
    if (schemaMissing(reports.error)) return fail(503, "schema_unavailable");
    if (reports.error) return fail(500, "read_failed");
    for (const row of reports.data ?? []) {
      if (typeof row.team_id !== "string") continue;
      const year = Number(row.reporting_year);
      const byYear = reportsByTeam.get(row.team_id) ?? new Map();
      byYear.set(year, {
        state: row.state as ReportState,
        outcome: row.outcome as ReportOutcome,
      });
      reportsByTeam.set(row.team_id, byYear);
    }
  }

  return {
    ok: true as const,
    discovery: DISCOVERY,
    policy: policy.policy,
    duties,
    teams: [...teams.values()].map((team) => ({
      ...team,
      years: duties.map((duty) => {
        const report = reportsByTeam.get(team.id)?.get(duty.fiscalYear) ?? null;
        const status = obligation({ report });
        return {
          ...duty,
          code: status.code,
          report,
        };
      }),
    })),
  };
}

async function loadReport(
  supabase: SupabaseClient,
  teamId: string,
  year: number,
) {
  const { data, error } = await supabase
    .from("official_result_reports")
    .select("id,team_id,reporting_year,state,outcome,version,submitted_at,submitted_by,created_at,updated_at")
    .eq("team_id", teamId)
    .eq("reporting_year", year)
    .maybeSingle();
  if (schemaMissing(error)) return fail(503, "schema_unavailable");
  if (error) return fail(500, "read_failed");
  return { ok: true as const, report: data };
}

export async function readReportBundle(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
  year: number,
) {
  if (!isReportingYear(year, new Date())) return fail(400, "validation");
  const access = await requireManager(supabase, userId, teamId);
  if ("ok" in access) return access;
  const policy = await readPolicy(supabase);
  if (!policy.ok) return policy;
  const loaded = await loadReport(supabase, teamId, year);
  if (!loaded.ok) return loaded;

  if (!loaded.report) {
    return {
      ok: true as const,
      discovery: DISCOVERY,
      policy: policy.policy,
      duty: describeDuty(year, new Date()),
      team: access.team,
      report: null,
      sources: [],
      candidates: [],
      lines: [],
      revisions: [],
    };
  }

  const reportId = String(loaded.report.id);
  const [sources, candidates, lines, revisions] = await Promise.all([
    supabase
      .from("official_result_sources")
      .select("id,source_url,retrieved_at,retrieval_method,discovery_extent,match_confidence,http_status,content_sha256,page_title,note")
      .eq("report_id", reportId)
      .order("retrieved_at", { ascending: false }),
    supabase
      .from("official_result_candidates")
      .select("id,source_id,competition_name,opponent_name,played_on,team_goals,opponent_goals,excerpt,match_basis,fingerprint")
      .eq("report_id", reportId)
      .order("created_at", { ascending: true }),
    supabase
      .from("official_result_lines")
      .select("id,origin_candidate_id,competition_name,opponent_name,played_on,team_goals,opponent_goals,result_label,included,team_note,sort_order,version")
      .eq("report_id", reportId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("official_result_line_revisions")
      .select("id,line_id,editor_id,edited_at,before_values,after_values")
      .eq("report_id", reportId)
      .order("edited_at", { ascending: false })
      .limit(50),
  ]);
  if (sources.error || candidates.error || lines.error || revisions.error) {
    return fail(500, "read_failed");
  }

  return {
    ok: true as const,
    discovery: DISCOVERY,
    policy: policy.policy,
    duty: describeDuty(year, new Date()),
    team: access.team,
    report: loaded.report,
    sources: sources.data ?? [],
    candidates: candidates.data ?? [],
    lines: lines.data ?? [],
    revisions: revisions.data ?? [],
  };
}

export async function createDraft(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
  year: number,
) {
  if (!isReportingYear(year, new Date())) return fail(400, "validation");
  const access = await requireManager(supabase, userId, teamId);
  if ("ok" in access) return access;
  const inserted = await supabase
    .from("official_result_reports")
    .insert({
      team_id: teamId,
      reporting_year: year,
      state: "draft",
      outcome: "unspecified",
      version: 1,
      created_by: userId,
    })
    .select("id")
    .maybeSingle();
  if (inserted.error && inserted.error.code !== "23505") {
    if (schemaMissing(inserted.error)) return fail(503, "schema_unavailable");
    return fail(500, "write_failed");
  }
  return readReportBundle(supabase, userId, teamId, year);
}

export async function markInReview(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
  year: number,
  expectedVersion: number,
) {
  const bundle = await readReportBundle(supabase, userId, teamId, year);
  if (!bundle.ok || !("report" in bundle)) return bundle;
  if (!bundle.report) return fail(404, "not_found");
  const decision = decideReview({
    state: bundle.report.state as ReportState,
    version: Number(bundle.report.version),
    expectedVersion,
  });
  if (decision.action === "reject") {
    return fail(decision.code === "version_conflict" ? 409 : 409, decision.code);
  }
  if (decision.action === "idempotent") return bundle;
  const updated = await supabase
    .from("official_result_reports")
    .update({
      state: "in_review",
      version: expectedVersion + 1,
    })
    .eq("id", bundle.report.id)
    .eq("version", expectedVersion)
    .eq("state", "draft")
    .select("id");
  if (updated.error) return fail(500, "write_failed");
  if (!updated.data || updated.data.length === 0) return fail(409, "version_conflict");
  return readReportBundle(supabase, userId, teamId, year);
}

function parseLineInput(body: Record<string, unknown>, year: number) {
  const competition = cleanTeamText(String(body.competitionName ?? ""), 80);
  const opponent = cleanTeamText(String(body.opponentName ?? ""), 80);
  if (!competition || !opponent) return null;
  const goals = parseGoals(body.teamGoals, body.opponentGoals);
  if (!goals) return null;
  const playedOn = parsePlayedOn(body.playedOn, year);
  if (playedOn === undefined) return null;
  const note =
    body.teamNote == null || body.teamNote === ""
      ? null
      : cleanTeamText(String(body.teamNote), 200);
  if (body.teamNote && note === null) return null;
  return {
    competition_name: competition,
    opponent_name: opponent,
    played_on: playedOn,
    team_goals: goals.team,
    opponent_goals: goals.opponent,
    result_label: resultLabel(goals.team, goals.opponent),
    included: body.included !== false,
    team_note: note,
  };
}

function parseGoals(team: unknown, opponent: unknown) {
  if (team == null && opponent == null) return { team: null, opponent: null };
  if (typeof team !== "number" || typeof opponent !== "number") return null;
  if (!Number.isInteger(team) || !Number.isInteger(opponent)) return null;
  if (team < 0 || team > 20 || opponent < 0 || opponent > 20) return null;
  return { team, opponent };
}

function parsePlayedOn(value: unknown, year: number): string | null | undefined {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !dateInFiscalYear(value, year)) return undefined;
  return value;
}

async function openReport(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
  year: number,
) {
  const access = await requireManager(supabase, userId, teamId);
  if ("ok" in access) return access;
  const loaded = await loadReport(supabase, teamId, year);
  if (!loaded.ok) return loaded;
  if (!loaded.report) return fail(404, "not_found");
  if (loaded.report.state === "submitted") return fail(409, "submitted");
  return { ok: true as const, team: access.team, report: loaded.report };
}

export async function addLine(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
  year: number,
  body: Record<string, unknown>,
) {
  if (!isReportingYear(year, new Date())) return fail(400, "validation");
  const opened = await openReport(supabase, userId, teamId, year);
  if (!opened.ok) return opened;
  const fields = parseLineInput(body, year);
  if (!fields) return fail(400, "validation");

  let origin: string | null = null;
  if (body.candidateId != null) {
    if (typeof body.candidateId !== "string" || !isUuid(body.candidateId)) {
      return fail(400, "validation");
    }
    const candidate = await supabase
      .from("official_result_candidates")
      .select("id")
      .eq("id", body.candidateId)
      .eq("report_id", opened.report.id)
      .maybeSingle();
    if (candidate.error) return fail(500, "read_failed");
    if (!candidate.data) return fail(404, "not_found");
    origin = body.candidateId;
  }

  const inserted = await supabase.from("official_result_lines").insert({
    report_id: opened.report.id,
    team_id: teamId,
    origin_candidate_id: origin,
    ...fields,
    version: 1,
  });
  if (inserted.error) return fail(500, "write_failed");
  return readReportBundle(supabase, userId, teamId, year);
}

export async function updateLine(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
  year: number,
  body: Record<string, unknown>,
) {
  if (!isReportingYear(year, new Date())) return fail(400, "validation");
  if (typeof body.lineId !== "string" || !isUuid(body.lineId)) return fail(400, "validation");
  if (typeof body.expectedVersion !== "number" || !Number.isInteger(body.expectedVersion)) {
    return fail(400, "validation");
  }
  const opened = await openReport(supabase, userId, teamId, year);
  if (!opened.ok) return opened;
  const fields = parseLineInput(body, year);
  if (!fields) return fail(400, "validation");
  const updated = await supabase
    .from("official_result_lines")
    .update(fields)
    .eq("id", body.lineId)
    .eq("report_id", opened.report.id)
    .eq("version", body.expectedVersion)
    .select("id");
  if (updated.error) return fail(500, "write_failed");
  if (!updated.data || updated.data.length === 0) return fail(409, "version_conflict");
  return readReportBundle(supabase, userId, teamId, year);
}

export async function submitReport(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
  year: number,
  expectedVersion: number,
  nextOutcome: ReportOutcome,
) {
  if (!isReportingYear(year, new Date())) return fail(400, "validation");
  const access = await requireManager(supabase, userId, teamId);
  if ("ok" in access) return access;
  const loaded = await loadReport(supabase, teamId, year);
  if (!loaded.ok) return loaded;
  if (!loaded.report) return fail(404, "not_found");

  const included = await supabase
    .from("official_result_lines")
    .select("id", { count: "exact", head: true })
    .eq("report_id", loaded.report.id)
    .eq("included", true);
  if (included.error) return fail(500, "read_failed");

  const decision = decideSubmit({
    current: {
      state: loaded.report.state as ReportState,
      outcome: loaded.report.outcome as ReportOutcome,
      version: Number(loaded.report.version),
    },
    expectedVersion,
    nextOutcome,
    includedLineCount: included.count ?? 0,
  });
  if (decision.action === "reject") {
    const status = decision.code === "not_found" ? 404 : decision.code === "version_conflict" ? 409 : 422;
    return fail(status, decision.code);
  }
  if (decision.action === "idempotent") {
    const bundle = await readReportBundle(supabase, userId, teamId, year);
    return bundle.ok ? { ...bundle, idempotent: true } : bundle;
  }

  const updated = await supabase
    .from("official_result_reports")
    .update({
      state: "submitted",
      outcome: nextOutcome,
      version: Number(loaded.report.version) + 1,
    })
    .eq("id", loaded.report.id)
    .eq("version", loaded.report.version)
    .neq("state", "submitted")
    .select("id");
  if (updated.error) return fail(500, "write_failed");
  if (!updated.data || updated.data.length === 0) {
    const again = await loadReport(supabase, teamId, year);
    if (!again.ok || !again.report) return fail(409, "version_conflict");
    const retry = decideSubmit({
      current: {
        state: again.report.state as ReportState,
        outcome: again.report.outcome as ReportOutcome,
        version: Number(again.report.version),
      },
      expectedVersion: Number(again.report.version),
      nextOutcome,
      includedLineCount: included.count ?? 0,
    });
    if (retry.action === "idempotent") {
      const bundle = await readReportBundle(supabase, userId, teamId, year);
      return bundle.ok ? { ...bundle, idempotent: true } : bundle;
    }
    return fail(409, "version_conflict");
  }
  return readReportBundle(supabase, userId, teamId, year);
}

export async function fetchSource(
  supabase: SupabaseClient,
  userId: string,
  teamId: string,
  year: number,
  rawUrl: unknown,
) {
  if (typeof rawUrl !== "string") return fail(400, "validation");
  if (!isReportingYear(year, new Date())) return fail(400, "validation");
  const opened = await openReport(supabase, userId, teamId, year);
  if (!opened.ok) return opened;

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await supabase
    .from("official_result_fetch_attempts")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId)
    .gte("created_at", since);
  if (recent.error) {
    if (schemaMissing(recent.error)) return fail(503, "schema_unavailable");
    return fail(500, "read_failed");
  }
  if ((recent.count ?? 0) >= FETCH_LIMIT) return fail(429, "rate_limited");

  const attempt = await supabase
    .from("official_result_fetch_attempts")
    .insert({ team_id: teamId, user_id: userId });
  if (attempt.error) return fail(500, "write_failed");

  let page;
  try {
    page = await fetchPublicPage(rawUrl);
  } catch (error) {
    if (error instanceof PublicFetchError) return fail(400, error.code);
    return fail(400, "unsafe_url");
  }

  const stateBefore = sourceDoesNotSubmit(opened.report.state as ReportState);
  if (page.failure || !page.html || !page.sha256) {
    const failed = await supabase.from("official_result_sources").insert({
      report_id: opened.report.id,
      team_id: teamId,
      source_url: page.finalUrl.slice(0, 500),
      retrieval_method: "manual_url",
      discovery_extent: "fetch_failed",
      match_confidence: "not_evaluated",
      http_status: page.status || null,
      note: page.failure ?? "fetch_failed",
      created_by: userId,
    });
    if (failed.error) return fail(500, "write_failed");
    const bundle = await readReportBundle(supabase, userId, teamId, year);
    return bundle.ok ? { ...bundle, reportStateUnchanged: stateBefore } : bundle;
  }

  const existing = await supabase
    .from("official_result_sources")
    .select("id")
    .eq("report_id", opened.report.id)
    .eq("source_url", page.finalUrl)
    .eq("content_sha256", page.sha256)
    .maybeSingle();
  if (existing.error) return fail(500, "read_failed");
  if (existing.data) {
    const bundle = await readReportBundle(supabase, userId, teamId, year);
    return bundle.ok ? { ...bundle, duplicate: true, reportStateUnchanged: stateBefore } : bundle;
  }

  const extracted = extractOfficialCandidates({
    html: page.html,
    teamName: opened.team.name,
    reportingYear: year,
  });
  const source = await supabase
    .from("official_result_sources")
    .insert({
      report_id: opened.report.id,
      team_id: teamId,
      source_url: page.finalUrl.slice(0, 500),
      retrieval_method: "manual_url",
      discovery_extent: "page_fetched",
      match_confidence: extracted.matchConfidence,
      http_status: page.status,
      content_sha256: page.sha256,
      page_title: extracted.pageTitle,
      note: extracted.note,
      created_by: userId,
    })
    .select("id")
    .maybeSingle();
  if (source.error || !source.data?.id) return fail(500, "write_failed");
  const sourceId = String(source.data.id);

  if (extracted.candidates.length > 0) {
    const prior = await supabase
      .from("official_result_candidates")
      .select("fingerprint")
      .eq("report_id", opened.report.id);
    if (prior.error) return fail(500, "read_failed");
    const seen = new Set((prior.data ?? []).map((row) => String(row.fingerprint)));
    const rows = extracted.candidates
      .filter((candidate) => !seen.has(candidate.fingerprint))
      .map((candidate) => ({
        source_id: sourceId,
        report_id: opened.report.id,
        team_id: teamId,
        competition_name: candidate.competitionName,
        opponent_name: candidate.opponentName,
        played_on: candidate.playedOn,
        team_goals: candidate.teamGoals,
        opponent_goals: candidate.opponentGoals,
        excerpt: candidate.excerpt,
        match_basis: candidate.matchBasis,
        fingerprint: candidate.fingerprint,
      }));
    if (rows.length > 0) {
      const inserted = await supabase.from("official_result_candidates").insert(rows);
      if (inserted.error && inserted.error.code !== "23505") return fail(500, "write_failed");
    }
  }

  const bundle = await readReportBundle(supabase, userId, teamId, year);
  return bundle.ok ? { ...bundle, reportStateUnchanged: stateBefore } : bundle;
}
