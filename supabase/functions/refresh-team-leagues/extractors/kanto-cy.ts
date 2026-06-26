import { parseGenericTable } from "./generic-table.ts";

export async function parseKantoCY(
  html: string,
  leagueName: string
) {
  return await parseGenericTable(html, leagueName);
}