import { normalizeUrl, sameHost } from "./normalize.ts";

export function extractLinks(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();

  const regex = /<a[^>]+href=["']([^"'#]+)["']/gi;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(html))) {
    const href = normalizeUrl(match[1], baseUrl);

    if (!href) continue;
    if (!sameHost(href, baseUrl)) continue;

    urls.add(href);
  }

  return [...urls];
}

export function scoreLink(url: string): number {
  const u = url.toLowerCase();

  let score = 0;

  // 強い候補
  if (u.includes("league")) score += 100;
  if (u.includes("standing")) score += 100;
  if (u.includes("standings")) score += 100;
  if (u.includes("ranking")) score += 100;
  if (u.includes("table")) score += 80;
  if (u.includes("result")) score += 50;

  // よくあるリーグページ
  if (u.includes("u15")) score += 40;
  if (u.includes("t1")) score += 40;
  if (u.includes("t2")) score += 40;
  if (u.includes("t3")) score += 40;
  if (u.includes("t4")) score += 40;
  if (u.includes("1部")) score += 40;
  if (u.includes("2部")) score += 40;
  if (u.includes("3部")) score += 40;
  if (u.includes("4部")) score += 40;

  // 弱い候補
  if (u.includes("news")) score -= 100;
  if (u.includes("pdf")) score -= 100;
  if (u.includes("download")) score -= 100;
  if (u.includes("schedule")) score -= 80;
  if (u.includes("topic")) score -= 80;
  if (u.includes("event")) score -= 60;
  if (u.includes("gallery")) score -= 60;
  if (u.includes("photo")) score -= 60;

  return score;
}

export function sortCandidateLinks(urls: string[]): string[] {
  return [...urls].sort((a, b) => scoreLink(b) - scoreLink(a));
}