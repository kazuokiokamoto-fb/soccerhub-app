import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const CHIBA_U12_2026: Record<string, string[]> = {
  TOP: [
    "ジェフユナイテッド市原・千葉U-12",
    "柏レイソルA.A.TOR'82",
    "FCラルクヴェール千葉",
    "VIVAIO船橋SC",
    "Wings U-12",
    "FCトリムジュニア",
    "ブリオベッカ浦安・市川ジュニア U-12",
    "JSC CHIBA",
    "VITTORIAS FC",
    "FC市川GUNNERS",
  ],

  "1": [
    "市川真間DSC ブラック",
    "マリーナF.C.",
    "船橋法典FC",
    "FC LIEN柏",
    "光ヶ丘SC",
    "梅郷SC",
    "行田西FC",
    "塚田FC",
    "三小キッカーズ",
    "南流山SC",
    "柏エフォートFC",
    "市川中央リトルキッズ",
    "アミスター ホワイト",
    "鷺沼FC",
    "中原SC アルファ",
    "明海FC",
    "東習志野FC ホワイト",
    "船橋海神スポーツクラブ ストーム",
    "我孫子翼SC",
    "初石少年SC",
  ],
};

function leagueKey(leagueName: string) {
  const t = String(leagueName || "").toUpperCase();

  if (t.includes("TOP")) return "TOP";
  if (t.includes("1部") || t.includes("１部")) return "1";

  return "";
}

export async function parseChibaU12(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  const key = leagueKey(leagueName);

  if (key && CHIBA_U12_2026[key]) {
    return CHIBA_U12_2026[key].map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}