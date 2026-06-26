export type TeamRow = {
  teamName: string;
  leagueName: string;
};

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
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clean(text: string) {
  return String(text || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
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
    if (!url.includes("tokyo-cy.jp")) continue;
    if (seen.has(url)) continue;

    seen.add(url);
    links.push({ url, label });
  }

  return links;
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

function leagueKey(leagueName: string) {
  const t = String(leagueName || "").toUpperCase();

  if (t.includes("T1")) return "T1";
  if (t.includes("T2")) return "T2";
  if (t.includes("T3")) return "T3";
  if (t.includes("T4")) return "T4";

  return "";
}

function isCandidateLink(link: { url: string; label: string }, key: string) {
  const hay = `${link.url} ${link.label}`.toUpperCase();

  if (!hay.includes("U-15") && !hay.includes("U15") && !hay.includes("ジュニアユース")) {
    return false;
  }

  if (key && hay.includes(key)) return true;

  return hay.includes("リーグ") || hay.includes("LEAGUE") || hay.includes("星取表");
}

function looksLikeTeamName(text: string) {
  const t = clean(text);

  if (!t) return false;
  if (t.length < 2 || t.length > 80) return false;

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
    "東京都クラブユース",
    "関東クラブユース",
  ];

  if (bad.some((w) => t.includes(w))) return false;

  return /FC|SC|サッカー|フットボール|クラブ|ユース|ジュニア|U-?15|アカデミー|トレーロス|杉並|府中|町田|東京|調布|多摩|世田谷|三鷹|渋谷|江東|大森|暁星|プラウド|インテリオール|クリアージュ/i.test(t);
}

function extractTeamsFromHtml(html: string, leagueName: string) {
  const rows: TeamRow[] = [];
  const seen = new Set<string>();

  const text = stripTags(html);
  const parts = text
    .split(/\n|。|｜|\||・|●|■|◆|▶|▼|▽/)
    .map(clean)
    .filter(Boolean);

  for (const part of parts) {
    if (!looksLikeTeamName(part)) continue;

    let teamName = part
      .replace(/^[0-9０-９]+[.)．、\s]*/g, "")
      .replace(/^[A-ZＡ-Ｚ]ブロック\s*/g, "")
      .replace(/\s*様$/g, "")
      .trim();

    if (!looksLikeTeamName(teamName)) continue;

    const key = `${leagueName}|${teamName}`;
    if (seen.has(key)) continue;

    seen.add(key);
    rows.push({ teamName, leagueName });
  }

  return rows;
}

export async function parseTokyoCY(
  html: string,
  leagueName: string,
): Promise<TeamRow[]> {
  const key = leagueKey(leagueName);
  const pages: string[] = [html];

  const links = extractLinks(html)
    .filter((link) => isCandidateLink(link, key))
    .slice(0, 30);

  for (const link of links) {
    const pageHtml = await fetchHtml(link.url);
    if (pageHtml) pages.push(pageHtml);
  }

  const all: TeamRow[] = [];
  const seen = new Set<string>();

  for (const pageHtml of pages) {
    const pageText = stripTags(pageHtml).toUpperCase();

    if (key && !pageText.includes(key)) continue;

    const teams = extractTeamsFromHtml(pageHtml, leagueName);

    for (const team of teams) {
      const dedupeKey = `${leagueName}|${team.teamName}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      all.push(team);
    }
  }

  return all;
}