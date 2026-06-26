import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const BASE_URL = "https://tokyo-cy.jp/";

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

function clean(text: string) {
  return String(text || "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function normalizeUrl(url: string, base = BASE_URL) {
  try {
    const u = new URL(url, base);
    u.hash = "";
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

function leagueKey(leagueName: string) {
  const t = String(leagueName || "").toUpperCase();
  if (t.includes("T1")) return "T1";
  if (t.includes("T2")) return "T2";
  if (t.includes("T3")) return "T3";
  if (t.includes("T4")) return "T4";
  return "";
}

function extractLinks(html: string) {
  const links: { url: string; label: string }[] = [];
  const seen = new Set<string>();

  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = re.exec(html)) !== null) {
    const url = normalizeUrl(decodeHtml(m[1] || ""));
    const label = clean(stripTags(m[2] || ""));

    if (!url) continue;
    if (!url.includes("tokyo-cy.jp")) continue;
    if (seen.has(url)) continue;

    seen.add(url);
    links.push({ url, label });
  }

  return links;
}

function isRankingPageLink(link: { url: string; label: string }, key: string) {
  const hay = `${link.url} ${link.label}`.toUpperCase();

  if (!key || !hay.includes(key)) return false;

  const positive = [
    "順位表",
    "星取表",
    "戦績表",
    "リーグ表",
    "STANDING",
    "STANDINGS",
    "TABLE",
    "RESULT",
    "LEAGUE",
  ];

  const negative = [
    "要項",
    "大会要項",
    "規約",
    "日程",
    "SCHEDULE",
    "トーナメント",
    "高円宮杯",
    "ニュース",
    "NEWS",
    "お知らせ",
    "PDF",
    ".PDF",
  ];

  if (negative.some((w) => hay.includes(w))) return false;

  return positive.some((w) => hay.includes(w));
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ja,en-US;q=0.9,en;q=0.8",
    },
  });

  if (!res.ok) return "";
  return await res.text();
}

function isBadTeamName(name: string) {
  const t = clean(name);

  const bad = [
    "高円宮杯",
    "東京都予選",
    "トーナメント",
    "参加権",
    "出場権",
    "SCHEDULE",
    "リーグ",
    "順位表",
    "星取表",
    "要項",
    "ブロック",
    "以下のチーム",
    "そのブロック",
    "チーム",
  ];

  return bad.some((w) => t.includes(w));
}

function filterTeams(rows: TeamRow[], leagueName: string) {
  const seen = new Set<string>();
  const out: TeamRow[] = [];

  for (const row of rows) {
    const teamName = clean(row.teamName);

    if (!teamName) continue;
    if (isBadTeamName(teamName)) continue;
    if (teamName.length < 2 || teamName.length > 60) continue;

    const key = `${leagueName}|${teamName}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ teamName, leagueName });
  }

  return out;
}

export async function parseTokyoCY(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  const key = leagueKey(leagueName);

  const links = extractLinks(html).filter((link) =>
    isRankingPageLink(link, key)
  );

  const pages: string[] = [];

  for (const link of links.slice(0, 10)) {
    const pageHtml = await fetchHtml(link.url);
    if (pageHtml) pages.push(pageHtml);
  }

  if (pages.length === 0) {
    return filterTeams(await parseGenericTable(html, leagueName), leagueName);
  }

  const all: TeamRow[] = [];

  for (const pageHtml of pages) {
    const parsed = await parseGenericTable(pageHtml, leagueName);
    all.push(...parsed);
  }

  return filterTeams(all, leagueName);
}