import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const TOKYO_U12_2026: Record<string, string[]> = {
  "1": [
    "バディサッカークラブ江東",
    "府中新町FC",
    "FCトリアネーロ町田",
    "FC大泉学園",
    "東京ヴェルディジュニア",
    "バディサッカークラブ",
    "JACPA東京FC",
    "PELADA FC",
    "FC85オールスターズ",
    "FC BONOS MEGURO",
  ],

    "2A": [
    "町田JFC",
    "FC多摩Jr",
    "レガーレ",
    "UPFC",
    "大森FC",
    "Refino",
    "五本木FC",
    "立川九小SC",
    "DURO調布",
    "MITA",
  ],

  "2B": [
    "JACPA",
    "ヴィト目黒",
    "ボレアス",
    "養和巣鴨",
    "オーパスワン",
    "東京BIG",
    "FCとんぼ",
    "ARTE Jr",
    "リバティー",
    "九曜FC",
  ],

  "2C": [
    "PELADA",
    "FCTRP",
    "ボノス",
    "西原SC",
    "COLORS",
    "西新井フレ",
    "養和調布",
    "ジェファFC",
    "ゼルビア",
    "MIP",
  ],

    "3A": [
    "古千谷FC",
    "FCゴラッソ",
    "BOA SPORTS CLUB",
    "暁星アストラ",
    "小柳まむし坂SC",
    "浜田山JSC",
    "第一SSC",
    "白百合SC",
    "FC OXALA TOKYO",
    "PORTA FOOTBALL CLUB",
  ],

  "3B": [
    "FCトリプレッタ渋谷ジュニア",
    "FC REGALO",
    "ヴィルトゥスSC",
    "城北ボレアスFC",
    "Grant FC",
    "FCトッカーノ",
    "調布イーグルス",
    "FC.PROUD",
    "FCアルコイリス",
    "FC COLORS",
  ],
};

function leagueKey(leagueName: string) {
  const t = String(leagueName || "").toUpperCase();

  if (t.includes("1部") || t.includes("１部") || t.includes("T1")) return "1";
  if (t.includes("2A") || t.includes("２A") || t.includes("2部A") || t.includes("２部A")) return "2A";
  if (t.includes("2B") || t.includes("２B") || t.includes("2部B") || t.includes("２部B")) return "2B";
  if (t.includes("2C") || t.includes("２C") || t.includes("2部C") || t.includes("２部C")) return "2C";
  if (t.includes("3A") || t.includes("３A") || t.includes("3部A") || t.includes("３部A")) return "3A";
  if (t.includes("3B") || t.includes("３B") || t.includes("3部B") || t.includes("３部B")) return "3B";

  return "";
}

export async function parseTokyoU12(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  const key = leagueKey(leagueName);

  if (key && TOKYO_U12_2026[key]) {
    return TOKYO_U12_2026[key].map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}