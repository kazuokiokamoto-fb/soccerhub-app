export type AffiliationPrompt = {
  teamId: string;
  teamName: string;
  kind: "affiliation" | "results_url";
  suggestedUrl: string | null;
  blocksProduct: false;
};

type TeamRef = { id: string; name: string; role: string };

export function affiliationPrompts(input: {
  teams: readonly TeamRef[];
  affiliations: readonly { teamId: string; status: string }[];
  dismissals: readonly { teamId: string }[];
  pages: readonly { teamId: string; status: string; suggestedUrl: string | null }[];
}): AffiliationPrompt[] {
  const affiliated = new Map(input.affiliations.map((row) => [row.teamId, row.status]));
  const dismissed = new Set(input.dismissals.map((row) => row.teamId));
  const pages = new Map(input.pages.map((row) => [row.teamId, row]));
  const prompts: AffiliationPrompt[] = [];

  for (const team of input.teams) {
    if (team.role !== "owner" && team.role !== "coach") continue;
    const status = affiliated.get(team.id);
    if (!status) {
      if (dismissed.has(team.id)) continue;
      prompts.push({
        teamId: team.id,
        teamName: team.name,
        kind: "affiliation",
        suggestedUrl: null,
        blocksProduct: false,
      });
      continue;
    }
    if (status !== "affiliated") continue;
    const page = pages.get(team.id);
    if (!page || page.status === "needs_url") {
      prompts.push({
        teamId: team.id,
        teamName: team.name,
        kind: "results_url",
        suggestedUrl: page?.suggestedUrl ?? null,
        blocksProduct: false,
      });
    }
  }

  return prompts;
}
