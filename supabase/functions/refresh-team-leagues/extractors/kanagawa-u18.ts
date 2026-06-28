import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const KANAGAWA_U18_2026 = [
  "湘南ベルマーレU-18",
  "SC相模原U-18",
  "Y.S.C.C.横浜U-18",
  "FC AIVANCE YOKOSUKA U-18",
  "FC厚木DREAMS U-18",
  "FC厚木JY DREAMS U-18",
  "エスペランサSCユース",
  "東急SレイエスFC U-18",
  "綾瀬FCユース",
  "相模原みどりSCユース",
  "フットワーククラブ寒川U-18",
  "FC川崎CHAMP U-18",
  "FCグラシア相模原U-18",
  "ヴェルディSS相模原ユース",
  "FCヴィアージャユース",
  "ONODERA FC U-18",
];

export async function parseKanagawaU18(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  if (KANAGAWA_U18_2026.length > 0) {
    return KANAGAWA_U18_2026.map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}