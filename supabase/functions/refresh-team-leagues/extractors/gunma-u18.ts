import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const GUNMA_U18_2026 = [
  "ザスパ群馬U-18",
  "tonan前橋U-18",
  "tonan群馬U-18",
  "ルーヴェン高崎U-18",
  "PALAISTRA U-18",
  "前橋ジュニアU-18",
  "FC KRILO U-18",
  "フェルボーレ富岡U-18",
  "パルケFC前橋U-18",
  "FC桐生U-18",
  "おおたシティU-18",
  "FC伊勢崎境U-18",
];

export async function parseGunmaU18(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  if (GUNMA_U18_2026.length > 0) {
    return GUNMA_U18_2026.map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}