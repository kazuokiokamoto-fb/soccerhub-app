import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const IBARAKI_U12_2026: Record<string, string[]> = {
  "1": [
    "鹿島アントラーズジュニア",
    "鹿島アントラーズノルテジュニア",
    "つくばFC",
    "アイデンティみらい",
    "ばらきSC",
    "FC COLORZ",
    "古河SS",
    "中根FC",
    "東光台SC",
    "石岡アセンブルFC",
  ],

  "2": [
    "神谷SSS",
    "龍ケ崎SSS",
    "FOURWINDS FC",
    "境トリニタスジュニア",
    "舟石川SSS",
    "下妻FC1992",
    "FC REGISTA TSUKUBA",
    "吉田SSS",
    "潮来SSS",
    "岩瀬SSS",
  ],

  // 地区トップリーグ（league_rank = 3）
  "3": [
    "ポルターラ水戸SC",
    "FC日立",
    "真鍋FC",
    "守谷JFC",
    "大久保SSS",
    "八原SSS",
    "石神SSS",
    "六ツ野SSS",
    "竹園東FC",
    "牛久SSS",
  ],
};

function leagueKey(leagueName: string) {
  const t = String(leagueName || "").toUpperCase();

  if (t.includes("1部") || t.includes("１部") || t.includes("I1")) {
    return "1";
  }

  if (t.includes("2部") || t.includes("２部") || t.includes("I2")) {
    return "2";
  }

  if (
    t.includes("3部") ||
    t.includes("３部") ||
    t.includes("I3") ||
    t.includes("地区トップ") ||
    t.includes("TOP")
  ) {
    return "3";
  }

  return "";
}

export async function parseIbarakiU12(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  const key = leagueKey(leagueName);

  if (key && IBARAKI_U12_2026[key]) {
    return IBARAKI_U12_2026[key].map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}