import { compareSelectionStrength, type StrengthFields } from "../../../lib/selection-crawl/priority.ts";

type SupabaseLike = {
  from: (table: string) => any;
};

type StrengthContext = {
  leagueLevel: string | null;
  leagueDivision: number | null;
  strengthRank: string | null;
  teamLevel: number | null;
};

function teamOf(row: any) {
  const team = row?.team_master;
  return Array.isArray(team) ? team[0] || {} : team || {};
}

function fieldsFor(row: any, extra: StrengthContext | undefined): StrengthFields & { checkedAt?: string | null } {
  const team = teamOf(row);
  return {
    leagueLevel: extra?.leagueLevel ?? null,
    leagueDivision: extra?.leagueDivision ?? null,
    leagueName: team.current_league_name ?? null,
    leagueRank: team.current_league_rank ?? null,
    strengthRank: extra?.strengthRank ?? null,
    teamLevel: extra?.teamLevel ?? null,
  };
}

async function loadStrengthContext(supabase: SupabaseLike, teamIds: string[]) {
  const ids = [...new Set(teamIds.filter(Boolean))];
  const context = new Map<string, StrengthContext>();
  if (ids.length === 0) return context;
  for (let index = 0; index < ids.length; index += 100) {
    const chunk = ids.slice(index, index + 100);
    const [teams, affiliations] = await Promise.all([
      supabase.from("teams").select("id, strength_rank, level").in("id", chunk),
      supabase.from("team_affiliations").select("team_id, league_level, league_division, status").in("team_id", chunk),
    ]);
    if (!teams.error) {
      for (const row of teams.data || []) {
        context.set(row.id, {
          leagueLevel: null,
          leagueDivision: null,
          strengthRank: row.strength_rank ?? null,
          teamLevel: row.level ?? null,
        });
      }
    }
    if (!affiliations.error) {
      for (const row of affiliations.data || []) {
        if (row.status !== "affiliated") continue;
        const current = context.get(row.team_id) || {
          leagueLevel: null,
          leagueDivision: null,
          strengthRank: null,
          teamLevel: null,
        };
        current.leagueLevel = row.league_level ?? null;
        current.leagueDivision = row.league_division ?? null;
        context.set(row.team_id, current);
      }
    }
  }
  return context;
}

export async function orderByTeamStrength<T extends { team_master_id?: string | null }>(
  supabase: SupabaseLike,
  rows: T[],
  checkedAtKey: string,
): Promise<T[]> {
  const context = await loadStrengthContext(
    supabase,
    rows.map((row) => row.team_master_id || ""),
  );
  return [...rows].sort((a, b) => compareSelectionStrength(
    { ...fieldsFor(a, context.get(a.team_master_id || "")), checkedAt: (a as any)[checkedAtKey] ?? null },
    { ...fieldsFor(b, context.get(b.team_master_id || "")), checkedAt: (b as any)[checkedAtKey] ?? null },
  ));
}
