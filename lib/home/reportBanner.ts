// Home banner copy on top of the official-results API.
// Phase (in_progress / due / overdue) and obligation code already come from
// listedDuties, describeDuty, and obligation. This module does not recompute
// the fiscal window and does not read the database.

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UNSUBMITTED = new Set(["not_started", "draft", "in_review"]);

export type ReportNoticePhase = "due" | "overdue";

export type ReportNotice = {
  teamId: string;
  teamName: string;
  fiscalYear: number;
  deadlineYear: number;
  phase: ReportNoticePhase;
  message: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function cleanTeamName(value: unknown): string {
  if (typeof value !== "string") return "名称未設定";
  const name = value.replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  if (!name) return "名称未設定";
  return name.slice(0, 80);
}

function dueMessage(teamName: string, fiscalYear: number, deadlineYear: number): string {
  return `${teamName}の${fiscalYear}年度の公式戦年次報告の提出期限は${deadlineYear}年5月31日です。期限内に確認して提出してください。`;
}

function overdueMessage(deadlineYear: number): string {
  return `提出期限（${deadlineYear}年5月31日）を過ぎています。期限後も提出できます。ほかの機能はそのまま使えます。`;
}

function noticeFromYear(
  teamId: string,
  teamName: string,
  year: Record<string, unknown>,
): ReportNotice | null {
  const phase = year.phase;
  if (phase !== "due" && phase !== "overdue") return null;
  if (typeof year.code !== "string" || !UNSUBMITTED.has(year.code)) return null;

  const fiscalYear = year.fiscalYear;
  if (typeof fiscalYear !== "number" || !Number.isInteger(fiscalYear)) return null;
  if (fiscalYear < 1990 || fiscalYear > 2100) return null;

  const deadlineDate = year.deadlineDate;
  if (typeof deadlineDate !== "string") return null;
  const expected = `${fiscalYear + 1}-05-31`;
  if (deadlineDate !== expected) return null;

  const deadlineYear = fiscalYear + 1;
  return {
    teamId,
    teamName,
    fiscalYear,
    deadlineYear,
    phase,
    message:
      phase === "due"
        ? dueMessage(teamName, fiscalYear, deadlineYear)
        : overdueMessage(deadlineYear),
  };
}

export function reportNoticesFromPayload(payload: unknown): ReportNotice[] {
  const body = asRecord(payload);
  if (!body || body.ok !== true || !Array.isArray(body.teams)) return [];

  const notices: ReportNotice[] = [];
  const seen = new Set<string>();

  for (const teamValue of body.teams) {
    const team = asRecord(teamValue);
    if (!team) continue;
    if (team.role !== "owner" && team.role !== "coach") continue;
    if (typeof team.id !== "string" || !UUID.test(team.id)) continue;
    if (!Array.isArray(team.years)) continue;

    const teamName = cleanTeamName(team.name);
    for (const yearValue of team.years) {
      const year = asRecord(yearValue);
      if (!year) continue;
      const notice = noticeFromYear(team.id, teamName, year);
      if (!notice) continue;
      const key = `${notice.teamId}:${notice.fiscalYear}`;
      if (seen.has(key)) continue;
      seen.add(key);
      notices.push(notice);
    }
  }

  notices.sort((a, b) => {
    if (a.phase !== b.phase) return a.phase === "overdue" ? -1 : 1;
    return a.teamName.localeCompare(b.teamName, "ja") || a.fiscalYear - b.fiscalYear;
  });
  return notices;
}

export function reportNoticeHref(notices: readonly ReportNotice[]): string {
  const teamIds = [...new Set(notices.map((notice) => notice.teamId))];
  if (teamIds.length !== 1) return "/results";
  const teamId = teamIds[0];
  const target = notices.find((notice) => notice.phase === "overdue") ?? notices[0];
  if (!target) return "/results";
  return `/results/${teamId}?year=${target.fiscalYear}`;
}
