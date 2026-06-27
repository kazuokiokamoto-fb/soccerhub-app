import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const KANAGAWA_U15_2026: Record<string, string[]> = {
  "1": [],
  "2": [],
  "3": [],
  "4": [],
};

function leagueKey(leagueName: string) {
  const t = String(leagueName || "").toUpperCase();
  if (t.includes("1部") || t.includes("１部") || t.includes("K1")) return "1";
  if (t.includes("2部") || t.includes("２部") || t.includes("K2")) return "2";
  if (t.includes("3部") || t.includes("３部") || t.includes("K3")) return "3";
  if (t.includes("4部") || t.includes("４部") || t.includes("K4")) return "4";
  return "";
}

export async function parseKanagawaCY(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  const key = leagueKey(leagueName);

  if (key && KANAGAWA_U15_2026[key]) {
    return KANAGAWA_U15_2026[key].map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}