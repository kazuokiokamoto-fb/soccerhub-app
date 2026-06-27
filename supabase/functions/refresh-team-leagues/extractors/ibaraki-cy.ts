import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const IBARAKI_U15_2026: Record<string, string[]> = {
  "1": [],
  "2": [],
  "3": [],
  "4": [],
};

function leagueKey(leagueName: string) {
  const t = String(leagueName || "").toUpperCase();
  if (t.includes("1部") || t.includes("１部")) return "1";
  if (t.includes("2部") || t.includes("２部")) return "2";
  if (t.includes("3部") || t.includes("３部")) return "3";
  if (t.includes("4部") || t.includes("４部")) return "4";
  return "";
}

export async function parseIbarakiCY(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  const key = leagueKey(leagueName);

  if (key && IBARAKI_U15_2026[key]) {
    return IBARAKI_U15_2026[key].map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}