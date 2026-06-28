import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const TOCHIGI_U12_2026: Record<string, string[]> = {
  "1": [
    "ともぞうSC",
    "FC VALON",
    "イデア真岡",
    "栃木SCジュニア",
    "ヴェルフェ矢板U-12",
    "FCガナドール",
    "FCアネーロ宇都宮",
    "FC毛野",
    "FC城東",
    "FC朱雀",
  ],

  "2": [
    "野原グランディオスFC",
    "KOHARU PROUD栃木FC",
    "壬生FCユナイテッド",
    "FC氏家",
    "御厨FC",
    "FCスポルト宇都宮",
    "祖母井クラブ",
    "JFCアミスタ市貝",
    "FC真岡21",
    "間東FCミラクルズ",
  ],

  // 地区トップリーグ（league_rank = 3）
  "3": [
    "FC西那須野",
    "FCブロケード",
    "姿川中央SC",
    "FC栃木ジュニオール",
    "FCグラディオ",
    "石井FC",
    "大谷北FCフォルテ",
    "FCバジェルボ那須烏山",
    "FCリベルタ",
    "FCファイターズ",
  ],
};

function leagueKey(leagueName: string) {
  const t = String(leagueName || "").toUpperCase();

  if (t.includes("1部") || t.includes("１部") || t.includes("T1")) {
    return "1";
  }

  if (t.includes("2部") || t.includes("２部") || t.includes("T2")) {
    return "2";
  }

  if (
    t.includes("3部") ||
    t.includes("３部") ||
    t.includes("T3") ||
    t.includes("地区トップ") ||
    t.includes("TOP")
  ) {
    return "3";
  }

  return "";
}

export async function parseTochigiU12(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  const key = leagueKey(leagueName);

  if (key && TOCHIGI_U12_2026[key]) {
    return TOCHIGI_U12_2026[key].map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}