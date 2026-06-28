import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const CHIBA_U15_2026: Record<string, string[]> = {
  TOP: [
    "VIVAIO船橋SC",
    "Wings A",
    "FCクラッキス松戸",
    "ブリオベッカ浦安・市川",
    "Forte K-2",
    "成田SC",
    "ローヴァーズ木更津",
    "アトレチコ君津",
    "柏レイソルA.A.TOR’82",
    "ACカラクテル",
    "JSC CHIBA",
    "Eins.FC八千代",
    "VITTORIAS FC",
    "FC市川GUNNERS",
    "FCリベレオ",
    "VONDS市原FC",
  ],
  C1: [
    "クラブ・アストーレ",
    "Wings B",
    "柏レイソルA.A.流山",
    "VIVAIO船橋06SC",
    "暁星国際中学校",
    "ブリエッタFC浦安",
    "ルキナス印西",
    "FC HANAZONO",
    "SOLTILO CHIBA FC B",
    "トリプレッタSC松戸",
    "カナリーニョFC",
    "柏レイソルA.A.長生",
    "エクサス松戸SC",
    "FC稲毛",
    "船橋市立宮本中学校",
    "北総ローヴァーズFC",
  ],
  C2: [
    "ヴィスポ柏99FC",
    "FC Lazofio鎌ヶ谷",
    "ブリオベッカ浦安・市川 B",
    "FELICE FC浦安",
    "コスモTFC",
    "館山中学校",
    "ラーナーズFC",
    "千葉SC",
    "TJFA",
    "柏エフォートFC",
    "ヴェルディS.S.レスチ",
    "柏レイソルA.A.長生 B",
    "柏マイティーFC",
    "柏レイソルA.A.野田",
    "クレトゥーロFC",
    "MVCC",
    "アベーリャス千葉FC",
    "千葉日大第一中学校",
    "松陰中学校",
    "オーシャングランクール習志野",
    "ジョカーレFC",
    "FCヴァイスブリッツ",
    "ACカラクテルアルマ",
    "ミナトSC",
  ],
};

function leagueKey(leagueName: string) {
  const t = String(leagueName || "").toUpperCase();

  if (t.includes("TOP")) return "TOP";
  if (t.includes("C1")) return "C1";
  if (t.includes("C2")) return "C2";

  return "";
}

export async function parseChibaCY(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  const key = leagueKey(leagueName);

  if (key && CHIBA_U15_2026[key]) {
    return CHIBA_U15_2026[key].map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}