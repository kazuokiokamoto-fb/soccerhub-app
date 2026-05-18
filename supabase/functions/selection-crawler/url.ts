import {
  CRAWL_ENTRY_PATHS,
  MAX_EXTERNAL_LINKS_PER_PAGE,
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
    lower.includes("/ticket") ||
    lower.includes("/goods") ||
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
    lower.includes("school_visit")
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
      "/school/",
      "/academy/",
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
    const u = new URL(url);
    const path = u.pathname.toLowerCase();

    if (isThinPath(url)) return false;

    if (
      /\/news\/.+/.test(path) ||
      /\/topics\/.+/.test(path) ||
      /\/info\/.+/.test(path) ||
      /\/information\/.+/.test(path) ||
      /\/blog\/.+/.test(path) ||
      /\/post\/.+/.test(path) ||
      /\/article\/.+/.test(path) ||
      /\/pickup\/.+/.test(path)
    ) {
      return true;
    }

    if (
      (path.includes("selection") ||
        path.includes("tryout") ||
        path.includes("trial") ||
        path.includes("recruit") ||
        path.includes("entry")) &&
      getUrlDepth(url) >= 2
    ) {
      return true;
    }

    if (/\d{4}/.test(path) && getUrlDepth(url) >= 2) return true;

    return false;
  } catch {
    return false;
  }
}

export function looksLikeSoccerExternalUrl(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.toLowerCase();
    const text = `${host} ${path}`;

    if (isSnsOrMapUrl(url)) return false;
    if (isBlockedFile(url)) return false;
    if (isBlockedPath(url)) return false;

    return (
      text.includes("soccer") ||
      text.includes("football") ||
      text.includes("fc") ||
      text.includes("futsal") ||
      text.includes("academy") ||
      text.includes("school") ||
      text.includes("club") ||
      text.includes("jsc") ||
      text.includes("junior") ||
      text.includes("youth") ||
      text.includes("u-") ||
      text.includes("u_") ||
      text.includes("u12") ||
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

export function buildSeedUrls(baseUrl: string) {
  const urls = new Set<string>();

  try {
    const base = new URL(baseUrl);
    urls.add(normalizeUrl(base.toString()));

    for (const path of CRAWL_ENTRY_PATHS) {
      const u = new URL(path, base.origin);
      urls.add(normalizeUrl(u.toString()));
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
        `${cleanPath}member/`,
        `${cleanPath}school/`,
        `${cleanPath}sitemap.xml`,
      ];

      for (const path of nested) {
        const u = new URL(path, base.origin);
        urls.add(normalizeUrl(u.toString()));
      }
    }
  } catch {
    urls.add(baseUrl);
  }

  return Array.from(urls).slice(0, 50);
}

export function extractLinks(html: string, baseUrl: string) {
  const links = new Set<string>();
  const re = /href=["']([^"']+)["']/gi;

  let match: RegExpExecArray | null;

  while ((match = re.exec(html))) {
    const href = match[1];
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

      links.add(abs);
    } catch {
      // ignore
    }
  }

  return Array.from(links);
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
        anchorText.includes("スクール") ||
        anchorText.includes("クラブ") ||
        anchorText.includes("チーム");

      if (!looksLikeSoccerExternalUrl(abs) && !anchorLooksUseful) continue;

      links.add(abs);
    } catch {
      // ignore
    }
  }

  return Array.from(links).slice(0, MAX_EXTERNAL_LINKS_PER_PAGE);
}