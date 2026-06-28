import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const KANAGAWA_U15_2026: Record<string, string[]> = {
  "1": [
    "FC Kanaloa A",
    "フロンターレ等々力",
    "瀬谷IF",
    "ヴィアージャ",
    "シュート",
    "シーガルズ",
    "足柄",
    "CHAMP",
    "FUTURO",
    "カルぺソール湘南",
  ],
  "2": [
    "FC HORTENCIA",
    "FC Kanaloa B",
    "FC厚木JY DREAMS",
    "AC等々力",
    "大豆戸FC JY A",
    "SC相模原",
    "横浜FC JY B",
    "FC湘南JY",
    "F.C.REGALIA",
    "和光ユナイテッド 川崎FC",
    "SCH.FC",
    "湘南リーヴレ・ エスチーロJY",
    "横浜ジュニオールJY",
    "エスペランサSC JY A",
    "エストレーラFC インファンチル",
    "Fスタジオ",
    "SUERTE FC Chigasaki",
    "横浜FTAR FC",
    "FC. vinculo",
  ],
    "3": [
    "FC ASAHI",
    "大豆戸FC JY B",
    "FC VIDA",
    "FC川崎CHAMP JY",
    "湘南ベルマーレEAST",
    "湘南ベルマーレWEST",
    "横須賀シーガルズ",
    "FC厚木MELLIZO",
    "BANFF横浜",
    "FCグラシア相模原",
    "FCコラソン・インファンチル",
    "クラブテアトロ",
    "P.S.T.C. LONDRINA",
    "秦野FC",
    "FCパルピターレ",
    "AZ FCエスペランサ",
    "YSCC",
    "FC HORTENCIA B",
    "FC CIVIL",
    "湘南リーヴレ",
  ],
};

function leagueKey(leagueName: string) {
  const t = String(leagueName || "").toUpperCase();

  if (t.includes("1部") || t.includes("１部") || t.includes("K1")) return "1";
  if (t.includes("2部") || t.includes("２部") || t.includes("K2")) return "2";
  if (t.includes("3部") || t.includes("３部") || t.includes("K3")) return "3";
  if (t.includes("4部") || t.includes("４部") || t.includes("K4")) return "4";

  return "";
}

export async function parseKanagawaCY(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  const key = leagueKey(leagueName);

  if (key && KANAGAWA_U15_2026[key]) {
    return KANAGAWA_U15_2026[key].map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}