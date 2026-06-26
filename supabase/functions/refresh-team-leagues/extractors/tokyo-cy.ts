import { parseGenericTable } from "./generic-table.ts";

export async function parseTokyoCY(
  html: string,
  leagueName: string
) {
  return await parseGenericTable(html, leagueName);
}