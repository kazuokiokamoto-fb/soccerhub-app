import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const KANTO_U18_2026 = [
  "アイデンティみらい",
  "ヴェルディ相模原",
  "三菱養和ユース",
  "FC AIVANCE YOKOSUKA",
  "南葛SC",
  "大森FC",
  "湘南ベルマーレ",
  "相模原みどりSC",
  "アローレ八王子",
  "プロメテウスEC",
  "綾瀬FCユース",
  "FCトリプレッタユース",
  "エスペランサSCユース",
  "FC厚木ユース",
  "LSS MITAKA",
  "SC相模原",
  "ブリオベッカ浦安・市川U-18",
  "東京23FC",
  "FC Gois",
  "GA FC",
  "水戸ホーリーホック",
  "FC ASAHI Youth",
  "QUON FD",
  "tonan前橋",
  "つくばFC",
  "ザスパ群馬",
  "東京杉並ソシオFC",
  "RIO FC",
  "クリアソン新宿",
  "東急SレイエスFC",
  "FC川崎栗の木",
  "Raiz Chofu FC",
  "千葉SC",
  "房総ローヴァーズ木更津FC",
  "杉並アヤックス",
  "SOLTILO CHIBA FC",
  "フットワーククラブ寒川",
  "栃木シティFC",
  "横河武蔵野FC",
  "FCグラシア相模原",
  "エセンシア",
  "杉並FCユース",
  "FC市川ガナーズ",
  "Y.S.C.C.",
];

export async function parseKantoU18(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  if (KANTO_U18_2026.length > 0) {
    return KANTO_U18_2026.map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}