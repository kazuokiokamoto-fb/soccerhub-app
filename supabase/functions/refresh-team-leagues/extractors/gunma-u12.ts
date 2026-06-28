import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const GUNMA_U12_2026: Record<string, string[]> = {
  "1": [
    "ファナティコス",
    "PALAISTRA U-12",
    "ザスパクサツ群馬U-12",
    "FC FORTE",
    "tonan前橋U-12",
    "ブルーボタンSC",
    "FC伊勢崎境ジュニア",
    "高崎KⅡビクトリーズFC",
    "前橋ジュニア",
    "FCリオエステJr前橋",
  ],

  "2": [
    "FC長野",
    "新田88FC",
    "宝泉東FC",
    "ジラーフ赤堀SC",
    "高崎FCイーグル",
    "妙義ジュニアSC",
    "桐生境野FC",
    "FC富岡",
    "オール東SSS",
    "FC殖蓮少年団",
  ],

  // 地区トップリーグ（league_rank = 3）
  "3": [
    "FC新田88",
    "FC前橋南",
    "ゴラッソ高崎FC",
    "伊勢崎広瀬JFC",
    "前橋芳賀SC",
    "FC尾島ジュニア",
    "高崎中央SS",
    "パレイストラJr",
    "宝東SS",
    "FCルミエール",
  ],
};

function leagueKey(leagueName: string) {
  const t = String(leagueName || "").toUpperCase();

  if (t.includes("1部") || t.includes("１部") || t.includes("G1")) {
    return "1";
  }

  if (t.includes("2部") || t.includes("２部") || t.includes("G2")) {
    return "2";
  }

  if (
    t.includes("3部") ||
    t.includes("３部") ||
    t.includes("G3") ||
    t.includes("地区トップ") ||
    t.includes("TOP")
  ) {
    return "3";
  }

  return "";
}

export async function parseGunmaU12(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  const key = leagueKey(leagueName);

  if (key && GUNMA_U12_2026[key]) {
    return GUNMA_U12_2026[key].map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}