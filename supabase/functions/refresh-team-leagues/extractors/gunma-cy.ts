import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const GUNMA_U15_2026: Record<string, string[]> = {
  "1": [
    "ザスパ群馬",
    "前橋Jr",
    "PALAISTRA",
    "藤岡キッカーズ",
    "アスブロンサ高崎FC",
    "FC KRILO",
    "tonan群馬",
    "ルーヴェン高崎",
    "フェルボーレ富岡",
    "桐生大学附属中",
  ],

  "2": [
    "パルケFC前橋",
    "FC AslanAzul",
    "アスブロンサ高崎SC",
    "藤岡KSテルセーロ",
    "Y’sFC",
    "FC桐生",
    "ジェダリスタ",
    "SPLASHBOUT",
    "前橋ジュニアB",
    "MSC B",
    "グローバルFC",
    "おおたシティ",
    "FC伊勢崎境",
    "AVS群馬エヴォリスタ",
    "PALAISTRA B",
    "fervore富岡B",
  ],

  "3": [
    "FC Aslan Azul JY",
    "CV前橋",
    "クレアデール",
    "前橋一中学校",
    "宮郷中学校",
    "ファリーナ高崎",
    "FC ZEAD",
    "MSC C",
    "伊勢崎境B",
    "渋川FC",
    "グローバルFC B",
    "ジェダリスタB",
    "笠懸中学校",
    "ジェットストリーム",
    "赤堀中学校",
    "ルーヴェン高崎FC Zwei",
    "おおたシティ B",
    "新里中学校",
    "PARQUE FC",
    "tonan群馬B",
    "イースト群馬ユナイテッド",
    "tonan前橋",
    "伊四中",
  ],
};

function leagueKey(leagueName: string) {
  const t = String(leagueName || "").toUpperCase();

  if (t.includes("ウルトラ") || t.includes("1部") || t.includes("１部")) return "1";
  if (t.includes("G1") || t.includes("2部") || t.includes("２部")) return "2";
  if (t.includes("G2") || t.includes("3部") || t.includes("３部")) return "3";

  return "";
}

export async function parseGunmaCY(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  const key = leagueKey(leagueName);

  if (key && GUNMA_U15_2026[key]) {
    return GUNMA_U15_2026[key].map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}