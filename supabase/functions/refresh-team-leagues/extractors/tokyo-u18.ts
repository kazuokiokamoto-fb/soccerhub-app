import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const TOKYO_U18_2026 = [
  "三菱養和ユース",
  "南葛SC",
  "大森FC",
  "アローレ八王子",
  "プロメテウスEC",
  "FCトリプレッタユース",
  "LSS MITAKA",
  "東京23FC",
  "GA FC",
  "東京杉並ソシオFC",
  "RIO FC",
  "クリアソン新宿",
  "Raiz Chofu FC",
  "杉並アヤックス",
  "横河武蔵野FC",
  "杉並FCユース",
];

export async function parseTokyoU18(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  if (TOKYO_U18_2026.length > 0) {
    return TOKYO_U18_2026.map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}