import {
  CRAWL_ENTRY_PATHS,
  MAX_EXTERNAL_LINKS_PER_PAGE,
  SEARCH_KEYWORDS,
} from "./constants.ts";

export function normalizeUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

export function sameHost(url: string, baseUrl: string) {
  try {
    return new URL(url).hostname === new URL(baseUrl).hostname;
  } catch {
    return false;
  }
}

export function getHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isPdfUrl(url: string) {
  const lower = url.toLowerCase();
  return lower.endsWith(".pdf") || lower.includes(".pdf?");
}

export function isSitemapUrl(url: string) {
  const lower = url.toLowerCase();
  return lower.includes("sitemap") && lower.includes(".xml");
}

export function isInstagramUrl(url: string) {
  return url.toLowerCase().includes("instagram.com/");
}

export function isSnsOrMapUrl(url: string) {
  const lower = url.toLowerCase();

  return (
    lower.includes("instagram.com/") ||
    lower.includes("facebook.com/") ||
    lower.includes("x.com/") ||
    lower.includes("twitter.com/") ||
    lower.includes("youtube.com/") ||
    lower.includes("youtu.be/") ||
    lower.includes("line.me/") ||
    lower.includes("lin.ee/") ||
    lower.includes("tiktok.com/") ||
    lower.includes("google.com/maps") ||
    lower.includes("goo.gl/maps") ||
    lower.includes("maps.app.goo.gl")
  );
}

export function isSearchResultUrl(url: string) {
  const lower = decodeURIComponent(url.toLowerCase());

  return (
    lower.includes("?s=") ||
    lower.includes("&s=") ||
    lower.includes("?q=") ||
    lower.includes("&q=") ||
    lower.includes("/search/") ||
    lower.includes("/search?")
  );
}

export function isBlockedFile(url: string) {
  const lower = url.toLowerCase();

  if (isSitemapUrl(url)) return false;

  return (
    lower.includes(".jpg") ||
    lower.includes(".jpeg") ||
    lower.includes(".png") ||
    lower.includes(".webp") ||
    lower.includes(".gif") ||
    lower.includes(".css") ||
    lower.includes(".js") ||
    lower.includes(".json") ||
    lower.includes(".xml") ||
    lower.includes(".svg") ||
    lower.includes(".ico") ||
    lower.includes(".zip") ||
    lower.includes(".mp4") ||
    lower.includes(".mov") ||
    lower.includes("swiper") ||
    lower.includes("style.css")
  );
}

export function isBlockedPath(url: string) {
  const lower = decodeURIComponent(url.toLowerCase());

  return (
    isSearchResultUrl(url) ||
    lower.includes("/tag/") ||
    lower.includes("/tags/") ||
    lower.includes("/category/") ||
    lower.includes("/categories/") ||
    lower.includes("/author/") ||
    lower.includes("/wp-json/") ||
    lower.includes("/staff") ||
    lower.includes("/coach") ||
    lower.includes("coach_staff") ||
    lower.includes("/concept") ||
    lower.includes("/profile") ||
    lower.includes("/academy/coach") ||
    lower.includes("/academy/staff") ||
    lower.includes("/academy/profile") ||
    lower.includes("/player") ||
    lower.includes("/schedule") ||
    lower.includes("/result") ||
    lower.includes("/standings") ||
    lower.includes("/privacy") ||
    lower.includes("/company") ||
    lower.includes("/feed") ||
    lower.includes("/contact") ||
    lower.includes("/inquiry") ||
    lower.includes("/login") ||
    lower.includes("/admin") ||
    lower.includes("visitschool") ||
    lower.includes("visit-school") ||
    lower.includes("visit_school") ||
    lower.includes("school-visit") ||
    lower.includes("school_visit") ||
    lower.includes("/ticket") ||
    lower.includes("/goods") ||
    lower.includes("/shop") ||
    lower.includes("/samurai") ||
    lower.includes("/nadeshiko") ||
    lower.includes("/national") ||
    lower.includes("/tv") ||
    lower.includes("/movie") ||
    lower.includes("/photo") ||
    lower.includes("/fan") ||
    lower.includes("/support") ||
    lower.includes("/ranking") ||
    lower.includes("/museum") ||
    lower.includes("/national-team") ||
    lower.includes("/national_team") ||
    lower.includes("/japan") ||
    lower.includes("/samuraiblue") ||
    lower.includes("/futsal") ||
    lower.includes("/beachsoccer") ||
    lower.includes("/referee") ||
    lower.includes("/committee") ||
    lower.includes("/about-jfa") ||
    lower.includes("/association") ||
    lower.includes("/grass_roots") ||
    lower.includes("/grassroots") ||
    lower.includes("/en-world/") ||
    lower.includes("/en/") ||
    lower.includes("/english/")
  );
}

export function isThinPath(url: string) {
  try {
    const path = new URL(url).pathname.toLowerCase();

    const thinPaths = [
      "/selection/",
      "/trial/",
      "/tryout/",
      "/entry/",
      "/recruit/",
      "/join/",
      "/member/",
      "/academy/selection/",
      "/academy/recruit/",
      "/academy/entry/",
      "/academy/trial/",
      "/academy/tryout/",
      "/news/",
      "/topics/",
      "/info/",
      "/information/",
    ];

    return thinPaths.includes(path);
  } catch {
    return false;
  }
}

export function getUrlDepth(url: string) {
  try {
    return new URL(url).pathname.split("/").filter(Boolean).length;
  } catch {
    return 0;
  }
}

export function looksLikeArticleUrl(url: string) {
  try {
    if (isSearchResultUrl(url)) return false;

    const u = new URL(url);
    const path = decodeURIComponent(u.pathname.toLowerCase());
    const full = `${u.hostname}${path}${u.search}`.toLowerCase();

    if (isThinPath(url)) return false;

    return (
      /\/news\/.+/.test(path) ||
      /\/topics\/.+/.test(path) ||
      /\/info\/.+/.test(path) ||
      /\/information\/.+/.test(path) ||
      /\/blog\/.+/.test(path) ||
      /\/post\/.+/.test(path) ||
      /\/article\/.+/.test(path) ||
      /\/pickup\/.+/.test(path) ||
      /\/archives\/.+/.test(path) ||
      /\?p=\d+/.test(full) ||
      /\/\d{4}\/\d{1,2}\//.test(path) ||
      /\/\d{5,}\/?$/.test(path)
    );
  } catch {
    return false;
  }
}

export function looksLikeSoccerExternalUrl(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = decodeURIComponent(u.pathname.toLowerCase());
    const text = `${host} ${path}`;

    if (isSnsOrMapUrl(url)) return false;
    if (isBlockedFile(url)) return false;
    if (isBlockedPath(url)) return false;

    return (
      text.includes("soccer") ||
      text.includes("football") ||
      text.includes("fc") ||
      text.includes("academy") ||
      text.includes("school") ||
      text.includes("club") ||
      text.includes("junior") ||
      text.includes("youth") ||
      text.includes("u12") ||
      text.includes("u13") ||
      text.includes("u15") ||
      text.includes("u18") ||
      text.includes("selection") ||
      text.includes("tryout") ||
      text.includes("trial") ||
      text.includes("recruit") ||
      text.includes("entry")
    );
  } catch {
    return false;
  }
}

function buildSiteSearchPaths(keyword: string) {
  const q = encodeURIComponent(keyword);

  return [
    `/?s=${q}`,
    `/search?q=${q}`,
    `/news/?s=${q}`,
    `/topics/?s=${q}`,
    `/info/?s=${q}`,
    `/information/?s=${q}`,
    `/academy/?s=${q}`,
  ];
}

function buildMonthlyInfoPaths() {
  return [];
}

function linkPriority(url: string) {
  const lower = decodeURIComponent(url.toLowerCase());

  let score = 0;

  if (lower.includes("selection")) score += 120;
  if (lower.includes("tryout")) score += 100;
  if (lower.includes("trial")) score += 90;
  if (lower.includes("recruit")) score += 80;
  if (lower.includes("entry")) score += 70;
  if (lower.includes("boshu")) score += 70;
  if (lower.includes("nyudan")) score += 70;
  if (lower.includes("taiken")) score += 60;
  if (lower.includes("experience")) score += 60;

  if (/\?p=\d+/.test(lower)) score += 90;
  if (/\/\d{5,}\/?$/.test(lower)) score += 80;
  if (/\/\d{4}\/\d{1,2}\//.test(lower)) score += 60;

  if (lower.includes("junior-youth")) score += 45;
  if (lower.includes("junioryouth")) score += 45;
  if (lower.includes("youth")) score += 35;
  if (lower.includes("academy")) score += 30;
  if (lower.includes("u-13") || lower.includes("u13")) score += 30;
  if (lower.includes("u-15") || lower.includes("u15")) score += 25;

  if (lower.includes("/news/")) score += 45;
  if (lower.includes("/info/")) score += 45;
  if (lower.includes("/topics/")) score += 30;
  if (lower.includes("/information/")) score += 30;

  if (isThinPath(lower)) score -= 80;

  if (lower.includes("/ticket")) score -= 100;
  if (lower.includes("/fan")) score -= 100;
  if (lower.includes("/goods")) score -= 100;
  if (lower.includes("/shop")) score -= 100;
  if (lower.includes("/en-world/")) score -= 200;
  if (lower.includes("/english/")) score -= 200;

  return score;
}

export function buildSeedUrls(baseUrl: string) {
  const urls = new Set<string>();

  try {
    const base = new URL(baseUrl);

    urls.add(normalizeUrl(base.toString()));

    const aggressiveSeeds = [
      "/selection/",
      "/academy/selection/",
      "/academy/news/",
      "/academy/info/",
      "/academy/topics/",
      "/academy/recruit/",
      "/academy/u15/",
      "/academy/u-15/",
      "/academy/junioryouth/",
      "/news/article/",
      "/academy/news/article/",
      "/junior-youth/",
      "/junior_youth/",
      "/junioryouth/",
      "/jy/",
      "/youth/",
      "/u-13/",
      "/u13/",
      "/u-15/",
      "/u15/",
      "/tryout/",
      "/trial/",
      "/recruit/",
      "/entry/",
      "/taiken/",
      "/experience/",
      "/news/",
      "/topics/",
      "/info/",
      "/information/",
      "/archives/",
      "/blog/",
    ];

    for (const path of aggressiveSeeds) {
      urls.add(normalizeUrl(new URL(path, base.origin).toString()));
    }

    if (base.pathname && base.pathname !== "/") {
      const cleanPath = base.pathname.endsWith("/")
        ? base.pathname
        : `${base.pathname}/`;

      const nested = [
        cleanPath,
        `${cleanPath}news/`,
        `${cleanPath}info/`,
        `${cleanPath}topics/`,
        `${cleanPath}selection/`,
        `${cleanPath}recruit/`,
        `${cleanPath}entry/`,
        `${cleanPath}join/`,
        `${cleanPath}junior-youth/`,
        `${cleanPath}junioryouth/`,
        `${cleanPath}youth/`,
        `${cleanPath}u-13/`,
        `${cleanPath}u13/`,
        `${cleanPath}u-15/`,
        `${cleanPath}u15/`,
        `${cleanPath}archives/`,
        `${cleanPath}blog/`,
        `${cleanPath}sitemap.xml`,
      ];

      for (const path of nested) {
        urls.add(normalizeUrl(new URL(path, base.origin).toString()));
      }
    }

    for (const path of CRAWL_ENTRY_PATHS) {
      urls.add(normalizeUrl(new URL(path, base.origin).toString()));
    }

    for (const keyword of SEARCH_KEYWORDS) {
      for (const path of buildSiteSearchPaths(keyword)) {
        urls.add(normalizeUrl(new URL(path, base.origin).toString()));
      }
    }
  } catch {
    urls.add(baseUrl);
  }

  return Array.from(urls)
    .filter((url) => !isBlockedPath(url))
    .sort((a, b) => linkPriority(b) - linkPriority(a))
    .slice(0, 120);
}

export function extractLinks(html: string, baseUrl: string) {
  const links = new Set<string>();
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;

  while ((match = re.exec(html))) {
    const href = match[1];

    const anchorText = String(match[2] || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    if (!href) continue;
    if (href.startsWith("#")) continue;
    if (href.startsWith("mailto:")) continue;
    if (href.startsWith("tel:")) continue;
    if (href.startsWith("javascript:")) continue;

    try {
      const abs = normalizeUrl(new URL(href, baseUrl).toString());

      if (isSnsOrMapUrl(abs)) continue;
      if (isBlockedFile(abs)) continue;

      const pdf = isPdfUrl(abs);
      const sitemap = isSitemapUrl(abs);

      if (!pdf && !sitemap && !sameHost(abs, baseUrl)) continue;
      if (!pdf && !sitemap && isBlockedPath(abs)) continue;

      const decoded = decodeURIComponent(abs.toLowerCase());

      const looksImportant =
        decoded.includes("selection") ||
        decoded.includes("tryout") ||
        decoded.includes("trial") ||
        decoded.includes("recruit") ||
        decoded.includes("entry") ||
        decoded.includes("join") ||
        decoded.includes("academy") ||
        decoded.includes("school") ||
        decoded.includes("junior") ||
        decoded.includes("youth") ||
        decoded.includes("u13") ||
        decoded.includes("u-13") ||
        decoded.includes("u15") ||
        decoded.includes("u-15") ||
        decoded.includes("taiken") ||
        decoded.includes("experience") ||
        decoded.includes("news") ||
        decoded.includes("topics") ||
        decoded.includes("info") ||
        /\?p=\d+/.test(decoded) ||
        /\/\d{5,}\/?$/.test(decoded);

      const anchorLooksImportant =
        anchorText.includes("セレクション") ||
        anchorText.includes("選考会") ||
        anchorText.includes("募集") ||
        anchorText.includes("体験") ||
        anchorText.includes("練習会") ||
        anchorText.includes("ジュニアユース") ||
        anchorText.includes("アカデミー") ||
        anchorText.includes("スクール") ||
        anchorText.includes("u-13") ||
        anchorText.includes("u13") ||
        anchorText.includes("u-15") ||
        anchorText.includes("u15") ||
        anchorText.includes("新中1") ||
        anchorText.includes("現小6") ||
        anchorText.includes("入団") ||
        anchorText.includes("追加") ||
        anchorText.includes("エントリー") ||
        anchorText.includes("新中学1年") ||
        anchorText.includes("現小学6年") ||
        anchorText.includes("u-12") ||
        anchorText.includes("u12") ||
        anchorText.includes("u-18") ||
        anchorText.includes("u18");

      if (
        !pdf &&
        !sitemap &&
        !looksImportant &&
        !anchorLooksImportant &&
        !looksLikeArticleUrl(abs)
      ) {
        continue;
      }

      links.add(abs);
    } catch {
      // ignore
    }
  }

  return Array.from(links)
    .sort((a, b) => linkPriority(b) - linkPriority(a))
    .slice(0, 1000);
}

export function extractExternalCandidateLinks(html: string, baseUrl: string) {
  const links = new Set<string>();
  const baseHost = getHost(baseUrl);
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match: RegExpExecArray | null;

  while ((match = re.exec(html))) {
    const href = match[1];

    const anchorText = String(match[2] || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!href) continue;
    if (href.startsWith("#")) continue;
    if (href.startsWith("mailto:")) continue;
    if (href.startsWith("tel:")) continue;
    if (href.startsWith("javascript:")) continue;

    try {
      const abs = normalizeUrl(new URL(href, baseUrl).toString());
      const host = getHost(abs);

      if (!host) continue;
      if (host === baseHost) continue;
      if (isSnsOrMapUrl(abs)) continue;
      if (isBlockedFile(abs)) continue;
      if (isBlockedPath(abs)) continue;

      const anchorLooksUseful =
        anchorText.includes("公式") ||
        anchorText.includes("詳細") ||
        anchorText.includes("こちら") ||
        anchorText.includes("申込") ||
        anchorText.includes("申し込み") ||
        anchorText.includes("応募") ||
        anchorText.includes("エントリー") ||
        anchorText.includes("体験") ||
        anchorText.includes("セレクション") ||
        anchorText.includes("アカデミー") ||
        anchorText.includes("クラブ") ||
        anchorText.includes("チーム") ||
        anchorText.includes("ジュニアユース") ||
        anchorText.includes("募集") ||
        anchorText.includes("練習会");

      if (!looksLikeSoccerExternalUrl(abs) && !anchorLooksUseful) continue;

      links.add(abs);
    } catch {
      // ignore
    }
  }

  return Array.from(links)
    .sort((a, b) => linkPriority(b) - linkPriority(a))
    .slice(0, MAX_EXTERNAL_LINKS_PER_PAGE);
}