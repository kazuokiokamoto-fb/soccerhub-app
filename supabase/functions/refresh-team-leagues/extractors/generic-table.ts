export type TeamRow = {
  teamName: string;
  leagueName: string;
};

function decodeHtml(s: string) {
  return String(s || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", `"`)
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ");
}

function stripTags(html: string) {
  return decodeHtml(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeTeamName(text: string) {
  const t = String(text || "").normalize("NFKC").trim();
  if (!t) return false;
  if (t.length < 2 || t.length > 80) return false;

  const bad = ["順位", "勝点", "得点", "失点", "試合", "結果", "日程"];
  if (bad.some((w) => t.includes(w))) return false;

  return /FC|SC|サッカー|フットボール|クラブ|ユース|ジュニア|U-?15|U-?18|アカデミー/i.test(t);
}

export async function parseGenericTable(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  const rows: TeamRow[] = [];
  const seen = new Set<string>();

  const tableMatches = String(html || "").match(/<table[\s\S]*?<\/table>/gi) || [];

  for (const tableHtml of tableMatches) {
    const trMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];

    for (const trHtml of trMatches) {
      const cellMatches = trHtml.match(/<(td|th)[^>]*>[\s\S]*?<\/\1>/gi) || [];
      const cells = cellMatches.map((cellHtml) => stripTags(cellHtml));

      for (const cell of cells) {
        if (!looksLikeTeamName(cell)) continue;

        const teamName = cell;
        const key = `${leagueName}|${teamName}`;

        if (seen.has(key)) continue;
        seen.add(key);

        rows.push({
          teamName,
          leagueName,
        });

        break;
      }
    }
  }

  return rows;
}