import { cleanText, stripTags, normalizeTeamName, normalizedKey } from "./normalize.ts";

export type ParsedTeam = {
  teamName: string;
};

function extractRows(tableHtml: string): string[][] {
  const rows: string[][] = [];
  const trMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  for (const tr of trMatches) {
    const cellMatches = tr.match(/<(td|th)[^>]*>[\s\S]*?<\/\1>/gi) || [];
    const cells = cellMatches
      .map((cell) => cleanText(stripTags(cell)))
      .filter(Boolean);

    if (cells.length > 0) rows.push(cells);
  }

  return rows;
}

function looksLikeHeader(row: string[]) {
  const text = row.join(" ");

  return (
    text.includes("順位") ||
    text.includes("チーム") ||
    text.includes("クラブ") ||
    text.includes("勝点") ||
    text.includes("勝ち点") ||
    text.toLowerCase().includes("team") ||
    text.toLowerCase().includes("club")
  );
}

function findTeamColumn(rows: string[][]) {
  const header = rows.find(looksLikeHeader);

  if (header) {
    const idx = header.findIndex((cell) => {
      const c = cell.toLowerCase();
      return (
        cell.includes("チーム") ||
        cell.includes("クラブ") ||
        c.includes("team") ||
        c.includes("club")
      );
    });

    if (idx >= 0) return idx;
  }

  // よくある順位表: 0列目=順位、1列目=チーム名
  return 1;
}

function isNoise(text: string) {
  const t = cleanText(text);

  if (!t) return true;
  if (t.length < 2) return true;
  if (t.length > 80) return true;

  const badWords = [
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
    "結果",
    "日程",
    "会場",
    "大会",
    "要項",
    "リーグ",
    "順位表",
    "星取表",
    "戦績表",
    "サッカー連盟",
    "クラブユース",
    "高円宮杯",
    "参加",
    "出場",
    "以下",
    "以上",
    "U-15で行う",
    "PDF",
    "download",
    "schedule",
    "news",
  ];

  if (badWords.some((w) => t.toLowerCase().includes(w.toLowerCase()))) {
    return true;
  }

  // 数字だけ、記号だけ
  if (/^[0-9０-９.\-ー－\s]+$/.test(t)) return true;

  return false;
}

function looksLikeTeamName(text: string) {
  const t = cleanText(text);

  if (isNoise(t)) return false;

  const teamWords = [
    "FC",
    "ＦＣ",
    "SC",
    "ＳＣ",
    "JY",
    "ジュニア",
    "ユース",
    "クラブ",
    "フットボール",
    "サッカー",
    "アカデミー",
    "ベルマーレ",
    "マリノス",
    "フロンターレ",
    "ヴェルディ",
    "レイソル",
    "アントラーズ",
    "レッズ",
    "アルディージャ",
    "ジェフ",
    "ゼルビア",
    "トリプレッタ",
    "フォルツァ",
    "Forza",
    "LAVIDA",
    "GRANDE",
    "Kanaloa",
  ];

  if (teamWords.some((w) => t.toLowerCase().includes(w.toLowerCase()))) {
    return true;
  }

  // 日本語チーム名だけのケース
  if (/^[ァ-ヶー一-龠々A-Za-z0-9０-９・･'.\-\s]+$/.test(t)) {
    return true;
  }

  return false;
}

export function parseTeamsFromTable(tableHtml: string): ParsedTeam[] {
  const rows = extractRows(tableHtml);

  if (rows.length === 0) return [];

  const teamColumn = findTeamColumn(rows);

  const seen = new Set<string>();
  const teams: ParsedTeam[] = [];

  for (const row of rows) {
    if (looksLikeHeader(row)) continue;

    const candidates = [
      row[teamColumn],
      row[1],
      row[0],
      ...row,
    ].filter(Boolean);

    for (const candidate of candidates) {
      const teamName = normalizeTeamName(candidate);

      if (!looksLikeTeamName(teamName)) continue;

      const key = normalizedKey(teamName);
      if (!key || seen.has(key)) continue;

      seen.add(key);
      teams.push({ teamName });
      break;
    }
  }

  return teams;
}