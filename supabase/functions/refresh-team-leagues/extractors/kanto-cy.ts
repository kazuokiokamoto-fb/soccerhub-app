import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const KANTO_U15_2026: Record<string, string[]> = {
  "1": [
    "川崎フロンターレU-15生田",
    "柏レイソルU-15",
    "FC東京U-15深川",
    "FC東京U-15むさし",
    "横浜FC",
    "三菱養和SC巣鴨ジュニアユース",
    "横浜F・マリノスJY追浜",
    "東京ヴェルディ",
    "横浜F・マリノスJY",
    "鹿島アントラーズFC",
    "FC LAVIDA",
    "FC多摩",
    "鹿島アントラーズつくば",
    "RB大宮アルディージャU-15",
    "横河武蔵野FC U-15",
    "浦和レッドダイヤモンズJY",
  ],
  "2": [
    "クラブドラゴンズ柏",
    "横浜FC鶴見JY",
    "ジェファフットボールクラブU-15",
    "ワセダクラブForza'02",
    "湘南ベルマーレU-15EAST",
    "MSCジュニアユース",
    "GRANDE FC",
    "ウイングスSC",
    "クマガヤSC",
    "東急SレイエスFC U-15",
    "A.C.アスミジュニアユース",
    "三菱養和SC調布ジュニアユース",
    "ヴァンフォーレ甲府U-15",
    "水戸ホーリーホックU-15",
    "FCラルクヴェール千葉",
    "フォルトゥナSC U-15",
    "湘南ベルマーレ",
    "ジェフユナイテッド市原・千葉U-15",
    "FCトリプレッタJrユース",
    "アメージングアカデミー",
    "CA アレグレ",
    "クラブテアトロ",
    "前橋FC",
    "カシマアカデミーJrY",
    "クラブ与野",
    "鹿島アントラーズノルテ",
    "バディーJY横浜",
    "SOLTILO CHIBA FC U-15",
    "湘南ベルマーレU-15WEST",
    "ジェフユナイテッド市原・千葉U-15コラソン",
    "栃木SC",
    "上州フットボールクラブ高崎",
  ],
};

function leagueRankKey(leagueName: string) {
  const t = String(leagueName || "");
  if (t.includes("1部") || t.includes("１部")) return "1";
  if (t.includes("2部") || t.includes("２部")) return "2";
  return "";
}

export async function parseKantoCY(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  const key = leagueRankKey(leagueName);

  if (key && KANTO_U15_2026[key]) {
    return KANTO_U15_2026[key].map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}