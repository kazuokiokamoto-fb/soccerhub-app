import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const SAITAMA_U12_2026: Record<string, string[]> = {
  "1": [
    "レジスタFC",
    "RB大宮アルディージャU-12",
    "上尾朝日FC",
    "エクセレントフィートFC",
    "新座片山FC",
    "浦和レッズジュニア",
    "FCアビリスタ",
    "1FC川越水上公園",
    "江南南SS",
    "ヴィオレータFC",
  ],

  "2": [
    "GRANDE FC",
    "FC宗岡",
    "はくつるFC",
    "大宮南ウイングスFC",
    "新座スカイファイターズ",
    "SCN",
    "FCリアル",
    "NEOS FC",
    "大増サンライズFC",
    "FCなめがわ",
  ],

  // 地区トップリーグ（league_rank = 3）
  "3": [
    // 東部
    "プライドFC",
    "FC Gois YANAKA",
    "FC LIEN",
    "あけぼのFC",

    // 西部
    "アルベスタ小川",
    "川越福原SC U-12",
    "ダイナモ川越FC",
    "チャレンジSC",

    // 南部
    "大宮西カリオカFC",
    "RCDエスパニョールジャパンアカデミー",
    "プログレッソSC",
    "にいざえーすFC",
    "戸田二SSS",
    "FC KILONGA",

    // 北部
    "FCチベッタ",
    "FCチベッタ深谷",
  ],
};

function leagueKey(leagueName: string) {
  const t = String(leagueName || "").toUpperCase();

  if (t.includes("1部") || t.includes("１部") || t.includes("S1")) {
    return "1";
  }

  if (t.includes("2部") || t.includes("２部") || t.includes("S2")) {
    return "2";
  }

  if (
    t.includes("3部") ||
    t.includes("３部") ||
    t.includes("S3") ||
    t.includes("地区トップ") ||
    t.includes("TOP")
  ) {
    return "3";
  }

  return "";
}

export async function parseSaitamaU12(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  const key = leagueKey(leagueName);

  if (key && SAITAMA_U12_2026[key]) {
    return SAITAMA_U12_2026[key].map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}