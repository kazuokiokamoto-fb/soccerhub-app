import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const CHIBA_U18_2026 = [
  "ジェフユナイテッド市原・千葉U-18",
  "柏レイソルU-18",
  "VIVAIO船橋SC U-18",
  "ブリオベッカ浦安・市川U-18",
  "FC市川GUNNERS U-18",
  "SOLTILO CHIBA FC U-18",
  "Wings U-18",
  "FCトリムU-18",
  "JSC CHIBA U-18",
  "FCリベレオU-18",
  "クラッキス松戸U-18",
  "ローヴァーズ木更津U-18",
  "アトレチコ君津U-18",
  "Forte K-2 U-18",
  "Eins.FC八千代U-18",
  "VITTORIAS FC U-18",
];

export async function parseChibaU18(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  if (CHIBA_U18_2026.length > 0) {
    return CHIBA_U18_2026.map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}