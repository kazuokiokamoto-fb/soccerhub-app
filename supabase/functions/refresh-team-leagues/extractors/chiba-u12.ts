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

    "2N01": [
    "トリプレッタSC",
    "市川MFCフォックス",
    "矢切SC",
    "FCヴィレ",
    "流山隼少年SC",
    "常盤平SC",
    "印西FC",
    "FCアクティブ柏",
    "アミスター ブルー",
    "市川真間DSC",
  ],

  "2N02": [
    "風早レクトFC",
    "流山翼SC",
    "クラッキー",
    "FC.Forte",
    "ラビットキッカーズ レッド",
    "ルキナス印西SC レッド",
    "習志野MSS香澄",
    "松戸小金原FC",
    "新松戸SC",
    "市川FCレーベ",
  ],

  "2N03": [
    "菅野FC",
    "夏見FC",
    "湖北台クラブ",
    "南市川JFC",
    "舞浜FCファルコンズ",
    "東習志野FC ブルー",
    "バリエンテオンセFC",
    "FCゼンニチ",
    "江戸川台FC",
    "ペガサスジュニアFC ブルー",
  ],

  "2N04": [
    "FUTE SOCCER CLUB",
    "まちサカFC2013柏の葉",
    "木刈FC",
    "FC浦安ブルーウィングス ホワイト",
    "フォルテ野田SC",
    "FC八幡ビーバーズ",
    "つくし野 レッド",
    "北習志野FC",
    "FC Lazofio鎌ヶ谷",
    "葛飾FC",
  ],

  "2N05": [
    "見明川SC",
    "大久保東FC",
    "アミスター ブラック",
    "AF United",
    "松戸FC",
    "稲荷木少年SC",
    "船橋海神スポーツクラブ サンダー",
    "新浜FC",
    "柏ラッセルFC",
    "流山東部FC",
  ],

    "2N06": [
    "FC ALMA",
    "FC高洲",
    "VIVAIO船橋SC U-12",
    "つくしSC",
    "高柳FC柏",
    "カナデル塩浜スポーツクラブ",
    "八木が谷北FC",
    "FCギャルソン浦安",
    "柏SSC",
    "中原SC ベータ",
  ],

  "2N07": [
    "清水台FC",
    "フォルマーレ",
    "大久保SC",
    "白井FC",
    "高野山SSS",
    "ラビットキッカーズ ホワイト",
    "新浦安ユナイテッドFC ブルー",
    "南行徳FC",
    "FC芝山クルセイド mission",
    "スリーオークス",
  ],

  "2N08": [
    "白井冨士FC",
    "新浦安ユナイテッドFC レッド",
    "向山イレブンSC",
    "ヴィスポ柏99FC",
    "豊四季FC",
    "上本郷SC",
    "FC市川GUNNERS GOLD",
    "流山翼SC エスペランサ",
    "船橋イレブン2002",
    "百合台SC",
  ],

  "2N09": [
    "イレブンジュニアFC",
    "まつひだいSC ブランコ",
    "市川北FC",
    "ミナトSC",
    "ウニオンFC船橋",
    "松葉SC",
    "FC浦安ブルーウィングス ブルー",
    "D.U.C",
    "藤崎SC",
    "中国分リトルウイングスFC",
  ],

  "2N10": [
    "カナリーニョ・ダムFC",
    "ペガサスジュニアFC レッド",
    "ブリオベッカ浦安・市川ジュニア U-12",
    "行田西FC",
    "塚田FC",
    "三小キッカーズ",
    "南流山SC",
    "柏エフォートFC",
    "市川中央リトルキッズ",
    "アミスター ホワイト",
  ],

    "2N11": [
    "鷺沼FC",
    "中原SC アルファ",
    "明海FC",
    "東習志野FC ホワイト",
    "船橋海神スポーツクラブ ストーム",
    "我孫子翼SC",
    "初石少年SC",
    "まちサカFC2013柏の葉 U-12",
    "南市川JFC ブルー",
    "柏央アクセルFC",
  ],

  "2N12": [
    "行田東FC",
    "滝野FC",
    "松戸旭SC",
    "つくし野 ホワイト",
    "高洲SCホッパーズ ホワイト",
    "FC芝山クルセイド passion",
    "ルキナス印西SC ホワイト",
    "FC八幡ビーバーズ イエロー",
    "鎌ヶ谷少年SC",
    "NSP CLUB",
  ],

  "2N13": [
    "峰台FC",
    "柏マイティーFC",
    "エンデバーFC",
    "市川真間DSC ブラック",
    "マリーナF.C.",
    "船橋法典FC",
    "FC LIEN柏",
    "光ヶ丘SC",
    "梅郷SC",
  ],
};

function leagueKey(leagueName: string) {
  const t = String(leagueName || "").toUpperCase();

  if (t.includes("TOP")) return "TOP";
  if (t.includes("1部") || t.includes("１部")) return "1";

  const nMatch = t.match(/2N(0[1-9]|1[0-3])/);
  if (nMatch) return `2N${nMatch[1]}`;

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