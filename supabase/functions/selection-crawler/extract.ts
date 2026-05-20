import { CITIES, KEYWORDS, PREFECTURES } from "./constants.ts";
import { isPdfUrl } from "./url.ts";

export function stripHtml(html: string) {
  return String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\u0000/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getTitle(html: string) {
  const match = String(html ?? "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  return match?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

export function containsKeyword(text: string) {
  return KEYWORDS.some((keyword) => text.includes(keyword));
}

export function safeDate(value?: string | null) {
  if (!value) return null;

  const text = String(value).trim();

  const match = text.match(
    /^(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})日?$/,
  );

  if (!match) return null;

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);

  if (!y || !m || !d) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;

  const date = new Date(Date.UTC(y, m - 1, d));

  const valid =
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d;

  if (!valid) return null;

  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function extractDateNearKeyword(text: string) {
  const keywordIndexes = KEYWORDS.map((k) => text.indexOf(k))
    .filter((v) => v >= 0)
    .sort((a, b) => a - b);

  for (const idx of keywordIndexes) {
    const part = text.slice(Math.max(0, idx - 500), idx + 2000);

    const date = extractDate(part);

    if (date) return date;
  }

  return extractDate(text);
}

export function extractDate(text: string) {
  const now = new Date();

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  const currentYear = today.getFullYear();

  const full = text.match(
    /(\d{4})[年\/.-](\d{1,2})[月\/.-](\d{1,2})日?/,
  );

  if (full) {
    const y = Number(full[1]);
    const m = Number(full[2]);
    const d = Number(full[3]);

    const parsed = new Date(y, m - 1, d);

    if (Number.isNaN(parsed.getTime())) return null;

    const currentYear = today.getFullYear();

    if (y < currentYear) {
      return null;
    }

    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const md =
    text.match(/(\d{1,2})月(\d{1,2})日/) ||
    text.match(/(\d{1,2})\/(\d{1,2})/);

  if (md) {
    const m = Number(md[1]);
    const d = Number(md[2]);

    let y = currentYear;

    let parsed = new Date(y, m - 1, d);

    if (parsed < today) {
      y += 1;
      parsed = new Date(y, m - 1, d);
    }

    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  return null;
}

export function extractDeadline(text: string) {
  const words = [
    "申込期限",
    "申込締切",
    "応募締切",
    "締切",
    "〆切",
    "申込み期限",
    "募集締切",
  ];

  for (const word of words) {
    const idx = text.indexOf(word);

    if (idx >= 0) {
      return extractDate(text.slice(idx, idx + 300));
    }
  }

  return null;
}

export function extractCategories(text: string) {
  const found = new Set<string>();

  const normalized = String(text ?? "")
    .replace(/Ｕ/g, "U")
    .replace(/－/g, "-")
    .replace(/ー/g, "-")
    .replace(/\s+/g, "");

  if (/未就学|幼児|年中|年長|キッズ/.test(normalized)) {
    found.add("未就学");
  }

  if (/年長/.test(normalized)) {
    found.add("年長");
  }

  if (/U-?6|年長/.test(normalized)) found.add("U-6");

  if (/U-?7|小学1年|小1|1年生|新小学1年|新小1/.test(normalized)) {
    found.add("U-7");
  }

  if (/U-?8|小学2年|小2|2年生|新小学2年|新小2/.test(normalized)) {
    found.add("U-8");
  }

  if (/U-?9|小学3年|小3|3年生|新小学3年|新小3/.test(normalized)) {
    found.add("U-9");
  }

  if (/U-?10|小学4年|小4|4年生|新小学4年|新小4/.test(normalized)) {
    found.add("U-10");
  }

  if (/U-?11|小学5年|小5|5年生|新小学5年|新小5/.test(normalized)) {
    found.add("U-11");
  }

  if (/U-?12|小学6年|小6|6年生|新小学6年|新小6/.test(normalized)) {
    found.add("U-12");
  }

  if (/U-?13|中学1年|中1|新中学1年|新中1/.test(normalized)) {
    found.add("U-13");
  }

  if (/U-?14|中学2年|中2|新中学2年|新中2/.test(normalized)) {
    found.add("U-14");
  }

  if (/U-?15|中学3年|中3|新中学3年|新中3/.test(normalized)) {
    found.add("U-15");
  }

  if (/U-?16|高校1年|高1|新高校1年|新高1/.test(normalized)) {
    found.add("U-16");
  }

  if (/U-?17|高校2年|高2|新高校2年|新高2/.test(normalized)) {
    found.add("U-17");
  }

  if (/U-?18|高校3年|高3|新高校3年|新高3|ユース/.test(normalized)) {
    found.add("U-18");
  }

  if (/ジュニアユース/.test(normalized)) {
    found.add("ジュニアユース");
  }

  if (/ユース/.test(normalized)) {
    found.add("ユース");
  }

  if (/スクール生|スクール|アカデミー/.test(normalized)) {
    found.add("スクール生");
  }

  if (/GK|ＧＫ|ゴールキーパー/.test(normalized)) {
    found.add("GK");
  }

  if (/女子|レディース|ガールズ/.test(normalized)) {
    found.add("女子");
  }

  return Array.from(found);
}

export function extractPrefecture(text: string) {
  return PREFECTURES.find((v) => text.includes(v)) ?? null;
}

export function extractCity(text: string) {
  return CITIES.find((v) => text.includes(v)) ?? null;
}

export function titleFromUrl(pageUrl: string, fallback: string) {
  try {
    const u = new URL(pageUrl);

    const file = decodeURIComponent(
      u.pathname.split("/").filter(Boolean).pop() || "",
    );

    if (file) {
      return file.replace(/\.pdf$/i, "").slice(0, 120);
    }
  } catch {
    // ignore
  }

  return fallback;
}

export function buildTitle(
  pageTitle: string,
  sourceName: string,
  text: string,
  pageUrl: string,
) {
  if (isPdfUrl(pageUrl)) {
    return `${sourceName} ${titleFromUrl(pageUrl, "PDF募集資料")}`.slice(
      0,
      120,
    );
  }

  if (pageTitle && containsKeyword(pageTitle)) {
    return pageTitle.slice(0, 120);
  }

  const keyword =
    KEYWORDS.find((k) => text.includes(k)) ?? "募集情報";

  return `${sourceName} ${keyword}`.slice(0, 120);
}

export function buildSummary(text: string) {
  const idx = KEYWORDS.map((k) => text.indexOf(k))
    .filter((v) => v >= 0)
    .sort((a, b) => a - b)[0];

  if (idx == null) {
    return text.slice(0, 180);
  }

  return text.slice(Math.max(0, idx - 200), idx + 900).trim();
}

export function normalizeDuplicateText(text?: string | null) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
      String.fromCharCode(s.charCodeAt(0) - 0xfee0)
    )
    .replace(/[\s　]/g, "")
    .replace(/-|－|ー/g, "")
    .replace(/[()（）【】［］]/g, "")
    .trim();
}

export function buildDuplicateKey(params: {
  title?: string | null;
  organizationName?: string | null;
  eventDate?: string | null;
}) {
  return [
    normalizeDuplicateText(params.organizationName),
    normalizeDuplicateText(params.title),
    params.eventDate ?? "date_unknown",
  ].join("|");
}

export function displayStatusFromDates(
  eventDate: string | null,
  deadline: string | null,
  rawText: string,
) {
  if (
    rawText.includes("募集終了") ||
    rawText.includes("受付終了") ||
    rawText.includes("終了しました")
  ) {
    return "申込終了";
  }

  const today = new Date().toISOString().slice(0, 10);

  if (eventDate && eventDate < today) {
    return "開催終了";
  }

  if (deadline && deadline < today) {
    return "申込終了";
  }

  if (!eventDate && rawText.includes("随時募集")) {
    return "随時募集";
  }

  if (!eventDate) {
    return "日付未取得";
  }

  return "募集中";
}

export function extractSitemapUrls(xml: string, baseUrl: string) {
  const urls = new Set<string>();

  const re = /<loc[^>]*>([\s\S]*?)<\/loc>/gi;

  let match: RegExpExecArray | null;

  while ((match = re.exec(xml))) {
    const loc = String(match[1] ?? "")
      .replace(/<!\[CDATA\[/g, "")
      .replace(/\]\]>/g, "")
      .trim();

    if (!loc) continue;

    try {
      urls.add(new URL(loc, baseUrl).toString());
    } catch {
      // ignore
    }
  }

  return Array.from(urls);
}