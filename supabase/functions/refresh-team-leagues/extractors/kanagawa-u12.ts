import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const KANAGAWA_U12_2026: Record<string, string[]> = {
  "1": [
    "バディーSC",
    "川崎フロンターレ",
    "中野島FC",
    "FC PORTA",
    "横浜F・マリノス",
    "JFC FUTURO",
    "あざみ野FC",
    "横浜F・マリノス追浜",
    "SCH.FC",
  ],

  "2A": [
    "FCパーシモン",
    "FC Testigo",
    "足柄FC",
    "横浜ジュニオールSC",
    "YSGEM FC",
    "黒滝SC",
    "AC等々力",
    "FC本郷",
    "湘南ゴールデン",
  ],

  "2B": [
    "SFAT ISEHARA SC",
    "寒川SC",
    "藤沢FC",
    "太尾FC",
    "FC MAT",
    "原FC",
    "バオムFC川崎",
    "荻野SC",
    "FCオルテンシア",
  ],

  "2C": [
    "東住吉SC",
    "ESFORCO F.C.",
    "横浜すみれSC",
    "大豆戸FC",
    "リバーFC",
    "GEO-X FC",
    "FCヴィンクーロ",
    "横浜GSFC",
    "TDFC",
  ],
};

function leagueKey(leagueName: string) {
  const t = String(leagueName || "").toUpperCase();

  if (t.includes("1部") || t.includes("１部")) return "1";
  if (t.includes("2A") || t.includes("２A") || t.includes("2部A") || t.includes("２部A")) return "2A";
  if (t.includes("2B") || t.includes("２B") || t.includes("2部B") || t.includes("２部B")) return "2B";
  if (t.includes("2C") || t.includes("２C") || t.includes("2部C") || t.includes("２部C")) return "2C";

  return "";
}

export async function parseKanagawaU12(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  const key = leagueKey(leagueName);

  if (key && KANAGAWA_U12_2026[key]) {
    return KANAGAWA_U12_2026[key].map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}