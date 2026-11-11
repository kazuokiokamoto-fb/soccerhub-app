// Home treats owner, coach, and member as "has a team".
// Owner comes from teams.owner_id. Coach and member come from team_members.
// Filing the annual report stays owner/coach only; that filter lives with the report banner.

export type HomeTeamRole = "owner" | "coach" | "member";

export type HomeTeam = {
  id: string;
  role: HomeTeamRole;
};

const HOME_TEAM_ROLES = new Set<HomeTeamRole>(["owner", "coach", "member"]);

function cleanId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function mergeHomeTeams(input: {
  owned: Array<{ id?: unknown }>;
  members: Array<{ team_id?: unknown; role?: unknown }>;
}): HomeTeam[] {
  const teams = new Map<string, HomeTeam>();

  for (const row of input.owned) {
    const id = cleanId(row?.id);
    if (!id) continue;
    teams.set(id, { id, role: "owner" });
  }

  for (const row of input.members) {
    const id = cleanId(row?.team_id);
    const role = typeof row?.role === "string" ? row.role : "";
    if (!id || !HOME_TEAM_ROLES.has(role as HomeTeamRole)) continue;
    if (teams.has(id)) continue;
    teams.set(id, { id, role: role as HomeTeamRole });
  }

  return [...teams.values()];
}

export function canFileOfficialReport(teams: readonly HomeTeam[]): boolean {
  return teams.some((team) => team.role === "owner" || team.role === "coach");
}
