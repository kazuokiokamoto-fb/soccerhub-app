/** Hosts we never fetch. Instagram is included because its robots and terms disallow scraping. */
const UNCRAWLABLE_SUFFIXES = [
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "line.me",
  "lin.ee",
  "facebook.com",
  "fb.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "t.co",
  "google.com",
  "forms.gle",
  "docs.google.com",
  "maps.google.com",
];

/**
 * Directories, news, and association sites that are not a team's own website.
 * Search hits on these hosts are kept for review and are not auto-accepted.
 */
export const SHARED_OR_MEDIA_SUFFIXES = [
  "gekisaka.jp",
  "playerapp.tokyo",
  "japan-football.net",
  "soccer-db.net",
  "transfermarkt.com",
  "transfermarkt.jp",
  "wikipedia.org",
  "goal.com",
  "soccerdigestweb.com",
  "yahoo.co.jp",
  "prtimes.jp",
  "sponichi.co.jp",
  "nikkansports.com",
  "football-zone.net",
  "soccer-king.jp",
  "qoly.jp",
  "ultra-soccer.jp",
  "jfa.jp",
  "jfa.or.jp",
  "jleague.jp",
  "jfl.or.jp",
  "kanto-fa.jp",
  "tokyo-fa.or.jp",
  "kanagawa-fa.gr.jp",
  "chiba-fa.gr.jp",
  "saitamafa.or.jp",
  "ibaraki-fa.jp",
  "tochigi-fa.com",
  "gunma-fa.com",
  "clubyouth-football.com",
  "clubyouth-u18.com",
  "clubyouth-u15.com",
  "tokyo-cy.jp",
  "kanagawa-cy.com",
  "saitama-cy.com",
  "chiba-cy.com",
  "ibaraki-cy.com",
  "tochigi-cy.com",
  "gunma-cy.com",
  "jy-soccer.jp",
  "juniorsoccer-news.com",
  "junior-soccer.jp",
  "green-card.co.jp",
  "footballnavi.jp",
  "sportspulse.site",
  "sgrum.com",
  "teams.one",
  "sports-bank.jp",
  "labola.jp",
  "spobook.com",
  "sposuru.com",
  "duckduckgo.com",
  "u-18soccer.com",
  "koko-soccer.com",
  "soccerstation.co.jp",
  "ameblo.jp",
  "note.com",
  "linktr.ee",
  "lit.link",
  "metro.tokyo.lg.jp",
];

const PLATFORM_SUFFIXES = [
  "wixsite.com",
  "jimdofree.com",
  "jimdo.com",
  "webnode.com",
  "amebaownd.com",
  "blogspot.com",
  "wordpress.com",
  "github.io",
  "sakura.ne.jp",
];

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/\.$/, "").toLowerCase();
  } catch {
    return "";
  }
}

function hostMatches(host: string, suffix: string): boolean {
  return host === suffix || host.endsWith(`.${suffix}`);
}

export function hostKey(url: string): string {
  return hostnameOf(url).replace(/^www\./, "");
}

export function isUncrawlableUrl(url: string | null | undefined): boolean {
  const host = hostKey(String(url || ""));
  if (!host) return true;
  return UNCRAWLABLE_SUFFIXES.some((suffix) => hostMatches(host, suffix));
}

export function isSharedOrMediaUrl(url: string | null | undefined): boolean {
  const host = hostKey(String(url || ""));
  if (!host) return true;
  if (host.endsWith(".lg.jp") || host.endsWith(".city.jp") || host.includes(".pref.")) return true;
  return SHARED_OR_MEDIA_SUFFIXES.some((suffix) => hostMatches(host, suffix));
}

export function isPlatformHost(url: string): boolean {
  const host = hostKey(url);
  return PLATFORM_SUFFIXES.some((suffix) => hostMatches(host, suffix));
}

export function isPublicHttpUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".local") || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return false;
  }
  if (isPrivateIp(host)) return false;
  return true;
}

function isPrivateIp(host: string): boolean {
  if (host.includes(":")) {
    const lower = host.toLowerCase();
    return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:");
  }
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  const n = v4.slice(1).map(Number);
  if (n.some((part) => part > 255)) return true;
  const [a, b] = n;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

/** Same shape as public.normalize_selection_url: lowercase, drop the scheme and trailing slashes. */
export function normalizeSelectionUrl(input: string | null | undefined): string {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

export function selectionIdentity(
  teamMasterId: string | null | undefined,
  sourceUrl: string,
  organizationName?: string | null,
): string {
  const norm = normalizeSelectionUrl(sourceUrl);
  if (teamMasterId) return `${teamMasterId}:${norm}`;
  return `org:${organizationName ?? ""}:${norm}`;
}

export function originOf(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.hostname}`;
}

/** Team sites on a website builder keep their path. Dedicated domains use the site root. */
export function officialCrawlTarget(url: string): string {
  if (isPlatformHost(url)) {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  }
  return originOf(url);
}
