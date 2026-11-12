import { isAffiliationCategory } from "../affiliation/catalog.ts";

export type StandingHit = {
  category: string | null;
  rank: number;
  evidence: string;
  confidence: "high" | "low";
};

const CATEGORY_TOKENS = [
  "U-18",
  "U-15",
  "U-14",
  "U-13",
  "U-12",
  "U-10",
  "U-8",
  "U-6",
  "シニア",
  "一般",
  "女子",
];

function decode(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, digits: string) => {
      const code = Number(digits);
      return code > 31 && code < 0x110000 ? String.fromCodePoint(code) : " ";
    })
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTeamToken(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

function mentionsYear(text: string, year: number): boolean {
  const next = String(year + 1);
  const label = String(year);
  return (
    text.includes(`${label}年度`) ||
    text.includes(`${label}年`) ||
    text.includes(`${label}/${next}`) ||
    text.includes(`${label}-${next}`) ||
    text.includes(`${label}〜${next}`) ||
    text.includes(`${label}～${next}`)
  );
}

function onlyOtherFiscalYear(text: string, year: number): boolean {
  const years = [...text.matchAll(/(19|20)\d{2}年度/g)].map((match) => Number(match[0].slice(0, 4)));
  if (years.length === 0) return false;
  return years.every((value) => value !== year);
}

function nearestCategory(text: string): string | null {
  let found: { index: number; token: string } | null = null;
  for (const token of CATEGORY_TOKENS) {
    const index = text.lastIndexOf(token);
    if (index < 0) continue;
    if (!found || index > found.index) found = { index, token };
  }
  return found && isAffiliationCategory(found.token) ? found.token : null;
}

function rankInCell(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2})\s*位?$/);
  if (!match) return null;
  const rank = Number(match[1]);
  if (!Number.isInteger(rank) || rank < 1 || rank > 99) return null;
  return rank;
}

function tableRows(html: string): { cells: string[]; index: number }[] {
  const rows: { cells: string[]; index: number }[] = [];
  const pattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const cells: string[] = [];
    const cellPattern = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cell: RegExpExecArray | null;
    while ((cell = cellPattern.exec(match[1]))) cells.push(decode(cell[1]));
    if (cells.length > 0) rows.push({ cells, index: match.index });
  }
  return rows;
}

function evidenceOf(parts: string[]): string {
  const text = parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return text.slice(0, 240);
}

export function extractStanding(input: {
  html: string;
  teamName: string;
  fiscalYear: number;
  categoryHint?: string | null;
}): StandingHit | null {
  const team = normalizeTeamToken(input.teamName);
  if (team.length < 2) return null;
  const visible = decode(input.html);
  if (!mentionsYear(visible, input.fiscalYear)) return null;
  if (onlyOtherFiscalYear(visible, input.fiscalYear)) return null;

  for (const row of tableRows(input.html)) {
    const teamIndex = row.cells.findIndex((cell) => normalizeTeamToken(cell).includes(team));
    if (teamIndex < 0) continue;
    const rank =
      rankInCell(row.cells[0] ?? "") ??
      (teamIndex > 0 ? rankInCell(row.cells[teamIndex - 1] ?? "") : null);
    if (!rank) continue;
    const before = decode(input.html.slice(Math.max(0, row.index - 800), row.index));
    const category =
      nearestCategory(before) ??
      (input.categoryHint && before.includes(input.categoryHint) ? input.categoryHint : null);
    return {
      category: category && isAffiliationCategory(category) ? category : null,
      rank,
      evidence: evidenceOf(row.cells),
      confidence: category ? "high" : "low",
    };
  }

  const compact = visible.replace(/\s+/g, "").toLowerCase();
  const at = compact.indexOf(team);
  if (at < 0) return null;
  const before = compact.slice(Math.max(0, at - 40), at);
  const after = compact.slice(at + team.length, at + team.length + 12);
  const rankMatch = before.match(/(\d{1,2})位$/) ?? after.match(/^(\d{1,2})位/);
  if (!rankMatch) return null;
  const rank = Number(rankMatch[1]);
  if (rank < 1 || rank > 99) return null;
  const nameAt = visible.indexOf(input.teamName.trim());
  const windowStart = Math.max(0, (nameAt >= 0 ? nameAt : 0) - 400);
  const around = visible.slice(windowStart, windowStart + 700);
  const category = nearestCategory(around);
  const snippetStart = Math.max(0, at - 24);
  return {
    category,
    rank,
    evidence: evidenceOf([compact.slice(snippetStart, at + team.length + 12)]),
    confidence: category ? "high" : "low",
  };
}
