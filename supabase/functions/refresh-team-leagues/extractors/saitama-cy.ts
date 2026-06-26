import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const SAITAMA_U15_2026: Record<string, string[]> = {
  "1": [
    "クラブ与野",
    "FC LAVIDA",
    "GRANDE FC",
    "クマガヤSC",
    "CAアレグレ",
    "1FC川越水上公園",
    "A.C.アスミ",
    "東川口FC",
    "プレジールSC",
    "カムイJrユース",
  ],
  "2": [
    "フォルチFC",
    "成立ゼブラ",
    "FC深谷",
    "レスト戸田",
    "アスレンテ加須",
    "FC KASUKABE",
    "FCコルージャ",
    "HAN FC",
    "FC ASAS",
    "FC VIENTAS",
    "FC Gois",
    "狭山JY",
    "K's FC",
    "三郷Jr Youth FC",
    "武南ジュニアユース",
    "FC Cano",
  ],
  "3": [
    "さいたまSC",
    "FC入間",
    "クラブレジェンド熊谷",
    "越谷FC",
    "FCアビリスタ",
    "FCリアル",
    "FC八潮",
    "エステレーラ",
    "上尾SC",
    "川口西中学校",
    "大宮FC",
    "FC KAZO",
    "FC OWL",
    "FC LIEN",
    "草加Jr",
    "川越JSC",
  ],
  "4": [
    "川口ミナミFC",
    "FC KILONGA",
    "FC狭山",
    "FC児玉",
    "FCカーニョ",
    "ペレーニア",
    "FCアスリート三郷",
    "東春72",
    "越谷サンシン",
    "FCアウル",
    "鴻巣FC",
    "FC宮代",
    "川越Future",
    "FC KAZO B",
    "FCリアルB",
    "埼玉UNITED",
  ],
};

function leagueKey(leagueName: string) {
  const t = String(leagueName || "").toUpperCase();

  if (t.includes("1部") || t.includes("１部") || t.includes("S1")) return "1";
  if (t.includes("2部") || t.includes("２部") || t.includes("S2")) return "2";
  if (t.includes("3部") || t.includes("３部") || t.includes("S3")) return "3";
  if (t.includes("4部") || t.includes("４部") || t.includes("S4")) return "4";

  return "";
}

export async function parseSaitamaCY(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  const key = leagueKey(leagueName);

  if (key && SAITAMA_U15_2026[key]) {
    return SAITAMA_U15_2026[key].map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}