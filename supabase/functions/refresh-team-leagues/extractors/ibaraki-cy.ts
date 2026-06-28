import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const IBARAKI_U15_2026: Record<string, string[]> = {
  "1": [
    "FC古河",
    "FOURWINDS FC",
    "つくばFC",
    "BLOSSON",
    "アイデンティみらいU-15",
    "DO SOCCER CLUB",
    "鹿島アントラーズノルテジュニアユースB",
    "石岡アセンブルFC",
  ],
  "2": [
    "FCジュネス",
    "FC古河ネクスト",
    "ジュノーFC",
    "境トリニタスジュニアユース",
    "鹿島アントラーズつくばジュニアユースB",
    "鹿島アントラーズジュニアユースB",
    "malva SC",
    "FC VIALA水戸",
  ],
  "3": [
    "FOURWINDS FC NEXT",
    "ポルターラ水戸",
    "アウルフットボールクラブ取手",
    "日立ジュニアユースサッカークラブ",
    "KASHIMA UNITED FC（鹿島中学校）",
    "TRAUM SV",
    "佐和ワークショップFC",
    "アセノサッカークラブ",
    "水戸ホーリーホックジュニアユースB",
    "FCクレセール鹿嶋ジュニアユース",
    "FCヴェレン大洗U-15",
    "F.C.リリー",
    "FC COLORZ",
    "BLOSSON B",
    "FC鹿嶋U15",
    "カシマアカデミーJryセカンド",
  ],
};

function leagueKey(leagueName: string) {
  const t = String(leagueName || "").toUpperCase();

  if (t.includes("1部") || t.includes("１部")) return "1";
  if (t.includes("2部") || t.includes("２部")) return "2";
  if (t.includes("3部") || t.includes("３部")) return "3";

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