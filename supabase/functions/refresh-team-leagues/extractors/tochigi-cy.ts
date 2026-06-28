import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const TOCHIGI_U15_2026: Record<string, string[]> = {
  "1": [
    "矢板SC",
    "FC VALON",
    "ともぞうSC",
    "栃木シティFC U15",
    "ヴェルディSS小山",
    "ラソティーロFC",
    "プログレッソ佐野FC",
    "FC SHUJAKU",
    "union SC",
    "那須野ヶ原FCボンジボーラ",
  ],

  "2": [
    "イデアFC真岡",
    "矢板SC B",
    "HFC AMISTA",
    "NIKKO SC セレソン",
    "J-SPORTS FC",
    "FCファイターズ",
    "足利・両毛ユナイテッドFC",
    "ウイングスSC 2nd",
    "今市FCアルシオーネ",
    "FC CASA",
    "FC栃木",
    "FCスポルト宇都宮",
    "P.S.T.C. LONDRINA",
    "FCパルピターレ",
    "AZFCエスペランサ",
    "YSCC",
    "FC HORTENCIA B",
    "FC CIVIL",
    "湘南リーヴレ",
  ],

  "3": [
    "宇都宮チェルトFC",
    "佐野フットボールアカデミーU15",
    "union SC U14",
    "上河内中学校",
    "豊郷中学校",
    "Fantasista栃木",
    "KOHARU PROUD栃木FC",
    "サウス宇都宮SC",
    "FCスポルト宇都宮クラウド",
    "イデアFC真岡U14",
    "栃木シティFC U15B",
    "ファルケ宇都宮ジュニアユース",
    "おおぞらSC",
    "J-SPORTS FOOTBALL CLUB B",
    "今市FCアルシオーネU13",
    "FC栃木U14",
  ],
};

function leagueKey(leagueName: string) {
  const t = String(leagueName || "").toUpperCase();

  if (t.includes("1部") || t.includes("１部")) return "1";
  if (t.includes("2部") || t.includes("２部")) return "2";
  if (t.includes("3部") || t.includes("３部")) return "3";

  return "";
}

export async function parseTochigiCY(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  const key = leagueKey(leagueName);

  if (key && TOCHIGI_U15_2026[key]) {
    return TOCHIGI_U15_2026[key].map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}