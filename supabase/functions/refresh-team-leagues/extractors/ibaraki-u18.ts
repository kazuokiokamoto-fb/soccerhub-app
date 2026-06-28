import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const IBARAKI_U18_2026 = [
  "水戸ホーリーホックユース",
  "鹿島アントラーズユース",
  "鹿島アントラーズつくばユース",
  "鹿島アントラーズノルテユース",
  "つくばFC U-18",
  "アイデンティみらいU-18",
  "FC古河U-18",
  "FOURWINDS FC U-18",
  "BLOSSON U-18",
  "DO SOCCER CLUB U-18",
  "FC VIALA水戸U-18",
  "malva SC U-18",
];

export async function parseIbarakiU18(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  if (IBARAKI_U18_2026.length > 0) {
    return IBARAKI_U18_2026.map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}