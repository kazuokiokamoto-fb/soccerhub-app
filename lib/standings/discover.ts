import { inspectCrawlUrl } from "./crawlUrl.ts";

export type PageScore = {
  score: number;
  confidence: "high" | "low" | "none";
};

const STANDINGS_WORD = /順位表|星取|勝点|順位/;

export function normalizeLabel(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

export function scoreStandingsPage(
  html: string,
  hints: { organization: string; category: string; prefecture: string },
): PageScore {
  const text = normalizeLabel(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " "));
  let score = 0;
  if (STANDINGS_WORD.test(text)) score += 3;
  const organization = normalizeLabel(hints.organization);
  if (organization.length >= 4 && text.includes(organization)) score += 3;
  if (hints.category && text.includes(normalizeLabel(hints.category))) score += 1;
  const prefecture = hints.prefecture.replace(/[都道府県]$/u, "");
  if (prefecture && text.includes(normalizeLabel(prefecture))) score += 1;
  const confidence = score >= 6 ? "high" : score >= 3 ? "low" : "none";
  return { score, confidence };
}

export function sameHostStandingsLinks(html: string, base: URL): string[] {
  const found: string[] = [];
  const pattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) && found.length < 2) {
    const label = `${match[1]} ${match[2].replace(/<[^>]+>/g, " ")}`;
    if (!/順位|星取|結果|勝点/.test(label)) continue;
    let next: URL;
    try {
      next = new URL(match[1], base);
    } catch {
      continue;
    }
    if (next.host !== base.host) continue;
    const inspected = inspectCrawlUrl(next.toString());
    if (!inspected.ok) continue;
    const url = inspected.url.toString();
    if (!found.includes(url)) found.push(url);
  }
  return found;
}

export type AssociationSeed = {
  prefecture: string;
  names: readonly string[];
  url: string;
};

/** Homepages already treated as prefectural associations elsewhere in this app. */
export const ASSOCIATION_SEEDS: readonly AssociationSeed[] = [
  { prefecture: "東京都", names: ["東京都サッカー協会", "東京サッカー協会"], url: "https://www.tokyofa.or.jp/" },
  { prefecture: "神奈川県", names: ["神奈川県サッカー協会", "神奈川サッカー協会"], url: "https://www.kanagawa-fa.gr.jp/" },
  { prefecture: "埼玉県", names: ["埼玉県サッカー協会", "埼玉サッカー協会"], url: "https://www.saitamafa.or.jp/" },
  { prefecture: "千葉県", names: ["千葉県サッカー協会", "千葉サッカー協会"], url: "https://www.chiba-fa.gr.jp/" },
  { prefecture: "茨城県", names: ["茨城県サッカー協会", "茨城サッカー協会"], url: "https://www.ibaraki-fa.jp/" },
  { prefecture: "栃木県", names: ["栃木県サッカー協会", "栃木サッカー協会"], url: "https://www.tochigi-fa.gr.jp/" },
  { prefecture: "群馬県", names: ["群馬県サッカー協会", "群馬サッカー協会"], url: "https://www.gunma-fa.com/" },
  { prefecture: "山梨県", names: ["山梨県サッカー協会", "山梨サッカー協会"], url: "https://www.yamanashi-football.com/" },
];

export function embeddedPublicUrl(organization: string): string | null {
  const match = organization.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;
  const raw = match[0].replace(/[),.;]+$/g, "");
  const inspected = inspectCrawlUrl(raw);
  return inspected.ok ? inspected.url.toString() : null;
}

export function initialDiscoveryUrls(input: {
  prefecture: string;
  organization: string;
}): string[] {
  const urls: string[] = [];
  const embedded = embeddedPublicUrl(input.organization);
  const seed = seedUrlFor(input.prefecture, input.organization);
  for (const url of [embedded, seed]) {
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

export function seedUrlFor(prefecture: string, organization: string): string | null {
  const label = normalizeLabel(organization);
  if (label.length < 4) return null;
  for (const seed of ASSOCIATION_SEEDS) {
    if (seed.prefecture !== prefecture) continue;
    const hit = seed.names.some((name) => label.includes(normalizeLabel(name)));
    if (!hit) continue;
    const inspected = inspectCrawlUrl(seed.url);
    return inspected.ok ? inspected.url.toString() : null;
  }
  return null;
}

export type DiscoveryChoice = {
  status: "found" | "needs_url";
  url: string | null;
  suggestedUrl: string | null;
  confidence: "high" | "low" | "none";
};

export function chooseDiscoveredPage(
  pages: readonly { url: string; score: PageScore }[],
): DiscoveryChoice {
  const ranked = [...pages].sort((a, b) => b.score.score - a.score.score);
  const best = ranked[0];
  if (!best || best.score.confidence === "none") {
    return { status: "needs_url", url: null, suggestedUrl: null, confidence: "none" };
  }
  if (best.score.confidence === "high") {
    return { status: "found", url: best.url, suggestedUrl: null, confidence: "high" };
  }
  return { status: "needs_url", url: null, suggestedUrl: best.url, confidence: "low" };
}
