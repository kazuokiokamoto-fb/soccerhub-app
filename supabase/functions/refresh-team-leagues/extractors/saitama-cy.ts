import { parseGenericTable, type TeamRow } from "./generic-table.ts";

const BASE_URL = "https://saitama-cy.com/";

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

function extractLinks(html: string) {
  const links: { url: string; label: string }[] = [];
  const seen = new Set<string>();
  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;

  while ((m = re.exec(html)) !== null) {
    const url = normalizeUrl(decodeHtml(m[1] || ""));
    const label = clean(stripTags(m[2] || ""));

    if (!url) continue;
    if (!url.includes("saitama-cy.com")) continue;
    if (seen.has(url)) continue;

    seen.add(url);
    links.push({ url, label });
  }

  return links;
}

function leagueKey(leagueName: string) {
  const t = String(leagueName || "").toUpperCase();

  if (t.includes("1部") || t.includes("１部") || t.includes("S1")) return "1";
  if (t.includes("2部") || t.includes("２部") || t.includes("S2")) return "2";
  if (t.includes("3部") || t.includes("３部") || t.includes("S3")) return "3";
  if (t.includes("4部") || t.includes("４部") || t.includes("S4")) return "4";

  return "";
}

function isLeaguePageLink(link: { url: string; label: string }, key: string) {
  const hay = `${link.url} ${link.label}`.toUpperCase();

  if (!key) return false;

  const positive = [
    "U-15",
    "U15",
    "リーグ",
    "LEAGUE",
    "順位",
    "星取",
    "結果",
    "1部",
    "2部",
    "3部",
    "4部",
    "S1",
    "S2",
    "S3",
    "S4",
  ];

  const negative = [
    "要項",
    "規約",
    "日程",
    "SCHEDULE",
    "トーナメント",
    "ニュース",
    "NEWS",
    "お知らせ",
    "PDF",
    ".PDF",
  ];

  if (negative.some((w) => hay.includes(w))) return false;

  if (key === "1" && !(hay.includes("1部") || hay.includes("１部") || hay.includes("S1"))) return false;
  if (key === "2" && !(hay.includes("2部") || hay.includes("２部") || hay.includes("S2"))) return false;
  if (key === "3" && !(hay.includes("3部") || hay.includes("３部") || hay.includes("S3"))) return false;
  if (key === "4" && !(hay.includes("4部") || hay.includes("４部") || hay.includes("S4"))) return false;

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
    "順位",
    "勝点",
    "得点",
    "失点",
    "試合",
    "結果",
    "日程",
    "会場",
    "詳細",
    "ニュース",
    "お知らせ",
    "大会",
    "要項",
    "組み合わせ",
    "星取表",
    "前期",
    "後期",
    "リーグ",
    "埼玉県クラブユース",
    "関東クラブユース",
    "SCHEDULE",
    "U-15",
    "U15",
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
    if (teamName.length < 2 || teamName.length > 70) continue;

    const key = `${leagueName}|${teamName}`;
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ teamName, leagueName });
  }

  return out;
}

export async function parseSaitamaCY(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  const key = leagueKey(leagueName);

  const links = extractLinks(html).filter((link) =>
    isLeaguePageLink(link, key)
  );

  const pages: string[] = [];

  for (const link of links.slice(0, 15)) {
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