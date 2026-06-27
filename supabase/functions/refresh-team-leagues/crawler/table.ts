import { cleanText, stripTags } from "./normalize.ts";

export type HtmlTable = {
  html: string;
  text: string;
  score: number;
};

function scoreTable(text: string) {
  let score = 0;

  const POSITIVE = [
    "順位",
    "チーム",
    "クラブ",
    "勝点",
    "勝ち点",
    "試合",
    "勝",
    "分",
    "敗",
    "得点",
    "失点",
    "得失点",
    "Points",
    "Club",
    "Team",
    "Standing",
  ];

  const NEGATIVE = [
    "要項",
    "ニュース",
    "お知らせ",
    "お問い合わせ",
    "スポンサー",
    "役員",
    "PDF",
    "ダウンロード",
  ];

  for (const w of POSITIVE) {
    if (text.includes(w)) score += 20;
  }

  for (const w of NEGATIVE) {
    if (text.includes(w)) score -= 30;
  }

  // チーム数っぽい行数
  const lines = text
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  if (lines.length >= 8) score += 30;
  if (lines.length >= 12) score += 30;

  return score;
}

export function extractTables(html: string): HtmlTable[] {
  const matches =
    html.match(/<table[\s\S]*?<\/table>/gi) || [];

  const tables: HtmlTable[] = [];

  for (const tableHtml of matches) {
    const text = cleanText(stripTags(tableHtml));

    const score = scoreTable(text);

    tables.push({
      html: tableHtml,
      text,
      score,
    });
  }

  return tables.sort((a, b) => b.score - a.score);
}

export function findBestTable(html: string): HtmlTable | null {
  const tables = extractTables(html);

  if (tables.length === 0) return null;

  if (tables[0].score < 40) return null;

  return tables[0];
}