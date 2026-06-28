import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const TOCHIGI_U18_2026 = [
  "栃木SC U-18",
  "栃木シティU-18",
  "ヴェルディSS小山ユース",
  "矢板SC U-18",
  "FC VALON U-18",
  "ともぞうSC U-18",
  "ラソティーロFC U-18",
  "プログレッソ佐野FC U-18",
  "FC SHUJAKU U-18",
  "union SC U-18",
  "那須野ヶ原FCボンジボーラU-18",
  "イデアFC真岡U-18",
];

export async function parseTochigiU18(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  if (TOCHIGI_U18_2026.length > 0) {
    return TOCHIGI_U18_2026.map((teamName) => ({
      teamName,
      leagueName,
    }));
  }

  return await parseGenericTable(html, leagueName);
}