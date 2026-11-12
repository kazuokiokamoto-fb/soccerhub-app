import { isPlatformHost, isPublicHttpUrl, isSharedOrMediaUrl, isUncrawlableUrl, officialCrawlTarget } from "./urls.ts";

export const OFFICIAL_SITE_ACCEPT_SCORE = 120;
export const OFFICIAL_SITE_MARGIN = 25;

const GENERIC_TOKENS = [
  "fc",
  "sc",
  "jr",
  "jy",
  "soccer",
  "football",
  "club",
  "academy",
  "u12",
  "u13",
  "u15",
  "u18",
  "サッカー",
  "サッカ",
  "クラブ",
  "ジュニアユース",
  "ジュニア",
  "ユース",
  "アカデミー",
  "フットボール",
  "スポーツ少年団",
  "少年団",
];

export function normalizeTeamText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, "")
    .replace(/[・･.\-ー＿_（）()［\]【】「」『』]/g, "");
}

export function distinctiveParts(teamName: string): string[] {
  let cleaned = normalizeTeamText(teamName);
  for (const token of [...GENERIC_TOKENS].sort((a, b) => b.length - a.length)) {
    cleaned = cleaned.replaceAll(token, " ");
  }
  return Array.from(new Set(cleaned.split(/\s+/).map((part) => part.trim()).filter((part) => part.length >= 2))).slice(0, 6);
}

export type PageScore = {
  score: number;
  reasons: string[];
  blocked: boolean;
};

export function scoreOfficialPage(input: {
  url: string;
  title: string;
  text: string;
  teamName: string;
  prefecture?: string | null;
}): PageScore {
  if (!isPublicHttpUrl(input.url) || isUncrawlableUrl(input.url) || isSharedOrMediaUrl(input.url)) {
    return { score: 0, reasons: ["blocked_host"], blocked: true };
  }

  const team = normalizeTeamText(input.teamName);
  const host = normalizeTeamText(new URL(input.url).hostname);
  const title = normalizeTeamText(input.title);
  const body = normalizeTeamText(input.text).slice(0, 8000);
  const url = normalizeTeamText(input.url);
  const reasons: string[] = [];
  let score = 0;

  if (!team) return { score: 0, reasons: ["empty_name"], blocked: true };

  if (title.includes(team)) {
    score += 120;
    reasons.push("title_has_full_team_name");
  }
  if (body.includes(team)) {
    score += 70;
    reasons.push("body_has_full_team_name");
  }
  if (host.includes(team) || url.includes(team)) {
    score += 120;
    reasons.push("url_or_host_has_full_team_name");
  }

  for (const part of distinctiveParts(input.teamName)) {
    if (host.includes(part)) {
      score += 95;
      reasons.push(`host_has_part:${part}`);
    }
    if (title.includes(part)) {
      score += 55;
      reasons.push(`title_has_part:${part}`);
    }
    if (body.includes(part)) {
      score += 35;
      reasons.push(`body_has_part:${part}`);
    }
  }

  const hostName = new URL(input.url).hostname.toLowerCase();
  if (hostName.endsWith(".or.jp")) {
    score += 80;
    reasons.push("official_jp_org_domain");
  } else if (hostName.endsWith(".co.jp")) {
    score += 70;
    reasons.push("official_company_domain");
  } else if (hostName.endsWith(".jp")) {
    score += 45;
    reasons.push("jp_domain");
  }

  const hay = `${input.url} ${input.title} ${input.text}`.toLowerCase();
  if (input.prefecture && hay.includes(input.prefecture.toLowerCase())) {
    score += 15;
    reasons.push("prefecture_hint");
  }
  if (/(公式|official|ホームページ|クラブ概要|チーム紹介)/i.test(`${input.title}\n${input.text}`)) {
    score += 30;
    reasons.push("official_hint_words");
  }
  if (/(fc|サッカー|soccer|football|クラブ|club)/i.test(hay)) {
    score += 30;
    reasons.push("team_words");
  }

  const path = new URL(input.url).pathname;
  const depth = path.split("/").filter(Boolean).length;
  if (depth <= 1) {
    score += 20;
    reasons.push("shallow_homepage_like");
  }
  if (depth >= 4) {
    score -= 20;
    reasons.push("deep_url_penalty");
  }
  if (/\/(news|article|articles|post|posts|blog|category|tag|archive)\//i.test(input.url)) {
    score -= 60;
    reasons.push("article_url_penalty");
  }
  if (/(試合速報|順位表|大会結果|まとめ|ニュース一覧|関連記事)/.test(`${input.title}`)) {
    score -= 45;
    reasons.push("media_title_penalty");
  }
  if (input.text.trim().length > 0 && input.text.trim().length < 200) {
    score -= 25;
    reasons.push("thin_page_penalty");
  }
  if (isPlatformHost(input.url)) {
    score -= 25;
    reasons.push("site_builder_penalty");
  }

  return { score, reasons, blocked: false };
}

export type OfficialCandidate = {
  url: string;
  score: number;
  reasons: string[];
  verified: boolean;
  blocked: boolean;
};

export type OfficialDecision = {
  decision: "auto_accept" | "pending" | "none";
  candidate: OfficialCandidate | null;
  crawlTarget: string | null;
  margin: number | null;
};

function hasStrongIdentity(reasons: string[], teamName: string, verified: boolean): boolean {
  if (!verified) return false;
  const team = normalizeTeamText(teamName);
  const fullTitle = reasons.includes("title_has_full_team_name");
  const fullHost = reasons.includes("url_or_host_has_full_team_name");
  const body = reasons.includes("body_has_full_team_name");
  const hostPart = reasons.some((reason) => reason.startsWith("host_has_part:"));
  const titlePart = reasons.some((reason) => reason.startsWith("title_has_part:"));
  if (team.length < 5) return fullTitle && fullHost;
  return fullTitle || fullHost || (hostPart && titlePart && body);
}

export function decideOfficialSite(teamName: string, candidates: OfficialCandidate[]): OfficialDecision {
  const usable = candidates
    .filter((candidate) => candidate.verified && !candidate.blocked && isPublicHttpUrl(candidate.url))
    .sort((a, b) => b.score - a.score);
  const best = usable[0] ?? null;
  if (!best) return { decision: "none", candidate: null, crawlTarget: null, margin: null };

  const bestHost = new URL(best.url).hostname;
  const second = usable.find((candidate) => new URL(candidate.url).hostname !== bestHost) ?? null;
  const margin = second ? best.score - second.score : null;
  const clearLead = margin == null || margin >= OFFICIAL_SITE_MARGIN || (second?.score ?? 0) < 80;
  const depth = new URL(best.url).pathname.split("/").filter(Boolean).length;
  const hostTied = best.reasons.includes("url_or_host_has_full_team_name")
    || best.reasons.some((reason) => reason.startsWith("host_has_part:"));
  const homepageLike = depth <= 1 || hostTied;
  const accept = best.score >= OFFICIAL_SITE_ACCEPT_SCORE
    && hasStrongIdentity(best.reasons, teamName, true)
    && clearLead
    && homepageLike;

  return {
    decision: accept ? "auto_accept" : "pending",
    candidate: best,
    crawlTarget: accept ? officialCrawlTarget(best.url) : null,
    margin,
  };
}
