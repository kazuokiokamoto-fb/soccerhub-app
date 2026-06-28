import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const SAITAMA_U18_2026 = [
  "大宮アルディージャU18",
  "浦和レッズユース",
  "クマガヤSCユース",
  "GRANDE FC U18",
  "1FC川越水上公園U18",
  "FC LAVIDA U18",
  "プレジールSC U18",
  "FC Gois U18",
  "武南ジュニアユースU18",
  "FC深谷ユース",
  "FC KASUKABE U18",
  "アヴェントゥーラ川口U18",
  "CAアレグレU18",
  "K's FC U18",
  "さいたまSC U18",
  "レジェンド熊谷U18",
];

export async function parseSaitamaU18(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  if (SAITAMA_U18_2026.length > 0) {
    return SAITAMA_U18_2026.map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}