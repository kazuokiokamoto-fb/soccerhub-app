// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.4.168";

type SelectionSource = {
  id: string;
  name: string;
  base_url: string;
  organization_type: string;
  enabled: boolean;
};

const MAX_PAGES_PER_SOURCE = 20;

const KEYWORDS = [
  "セレクション",
  "選考会",
  "追加セレクション",
  "GKセレクション",
  "ゴールキーパーセレクション",

  "募集",
  "参加者募集",
  "選手募集",
  "入団",
  "加入",
  "新加入",
  "応募",
  "申込",
  "申し込み",
  "エントリー",

  "練習参加",
  "練習会",
  "体験練習",
  "体験会",
  "体験",
  "無料体験",

  "トライアウト",
  "アカデミー",
  "アカデミーセレクション",
  "育成",
  "ジュニア",
  "ジュニアユース",
  "ユース",
  "スクール",
  "レディース",
  "女子",
  "GK",
  "ゴールキーパー",

  "selection",
  "select",
  "tryout",
  "trial",
  "entry",
  "recruit",
  "recruitment",
  "join",
  "academy",
  "academy-selection",
  "school",
  "junior",
  "youth",
  "ladies",
  "women",
  "girls",
  "gk",
];

const EXCLUDE_KEYWORDS = [
  "試合結果",
  "大会結果",
  "順位表",
  "戦績",
  "マッチレポート",
  "代表メンバー",
  "日本代表",
  "ハイライト",
  "チケット",
  "グッズ",
  "観戦",
  "スタッフ紹介",
  "スタッフ",
  "選手一覧",
  "選手紹介",
  "コーチ",
  "会社概要",
  "プライバシー",
  "個人情報",
  "利用規約",
];

const PREFECTURES = [
  "東京都",
  "神奈川県",
  "埼玉県",
  "千葉県",
  "茨城県",
  "栃木県",
  "群馬県",
  "山梨県",
];

const CITIES = [
  "世田谷区",
  "杉並区",
  "練馬区",
  "大田区",
  "目黒区",
  "渋谷区",
  "新宿区",
  "中野区",
  "板橋区",
  "足立区",
  "江戸川区",
  "江東区",
  "品川区",
  "町田市",
  "調布市",
  "府中市",
  "三鷹市",
  "武蔵野市",
  "八王子市",
  "立川市",
  "横浜市",
  "川崎市",
  "相模原市",
  "藤沢市",
  "大和市",
  "厚木市",
  "さいたま市",
  "川口市",
  "所沢市",
  "越谷市",
  "川越市",
  "千葉市",
  "船橋市",
  "市川市",
  "柏市",
  "松戸市",
  "浦安市",
  "流山市",
  "つくば市",
  "水戸市",
  "宇都宮市",
  "前橋市",
  "高崎市",
];

function stripHtml(html: string) {
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
    .replace(/\s+/g, " ")
    .trim();
}

function getTitle(html: string) {
  const match = String(html ?? "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function containsKeyword(text: string) {
  return KEYWORDS.some((keyword) => text.includes(keyword));
}

function containsExcludeKeyword(text: string) {
  return EXCLUDE_KEYWORDS.some((keyword) => text.includes(keyword));
}

function normalizeUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

function sameHost(url: string, baseUrl: string) {
  try {
    return new URL(url).hostname === new URL(baseUrl).hostname;
  } catch {
    return false;
  }
}

function isPdfUrl(url: string) {
  const lower = url.toLowerCase();
  return lower.endsWith(".pdf") || lower.includes(".pdf?");
}

function isInstagramUrl(url: string) {
  const lower = url.toLowerCase();
  return lower.includes("instagram.com/");
}

function safeDate(value?: string | null) {
  if (!value) return null;

  const text = String(value).trim();
  const match = text.match(/^(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})日?$/);
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

function extractLinks(html: string, baseUrl: string) {
  const links = new Set<string>();
  const re = /href=["']([^"']+)["']/gi;

  let match: RegExpExecArray | null;

  while ((match = re.exec(html))) {
    const href = match[1];
    if (!href) continue;
    if (href.startsWith("#")) continue;
    if (href.startsWith("mailto:")) continue;
    if (href.startsWith("tel:")) continue;

    const lowerHref = href.toLowerCase();

    if (lowerHref.includes(".jpg")) continue;
    if (lowerHref.includes(".jpeg")) continue;
    if (lowerHref.includes(".png")) continue;
    if (lowerHref.includes(".webp")) continue;

    const blockedFile =
      lowerHref.includes(".css") ||
      lowerHref.includes(".js") ||
      lowerHref.includes(".json") ||
      lowerHref.includes(".xml") ||
      lowerHref.includes(".svg") ||
      lowerHref.includes(".ico");

    if (blockedFile) continue;

    try {
      const abs = normalizeUrl(new URL(href, baseUrl).toString());
      const lower = decodeURIComponent(abs).toLowerCase();

      const pdf = isPdfUrl(abs);
      const instagram = isInstagramUrl(abs);

      const blockedPath =
        lower.includes("/staff") ||
        lower.includes("/coach") ||
        lower.includes("/player") ||
        lower.includes("/team") ||
        lower.includes("/schedule") ||
        lower.includes("/result") ||
        lower.includes("/standings") ||
        lower.includes("/ticket") ||
        lower.includes("/goods") ||
        lower.includes("/privacy") ||
        lower.includes("/company") ||
        lower.includes("/feed");

      if (!pdf && !instagram && blockedPath) continue;

      if (!pdf && !instagram && !sameHost(abs, baseUrl)) continue;

      const likely =
        pdf ||
        instagram ||
        lower.includes("selection") ||
        lower.includes("select") ||
        lower.includes("tryout") ||
        lower.includes("trial") ||
        lower.includes("recruit") ||
        lower.includes("recruitment") ||
        lower.includes("entry") ||
        lower.includes("join") ||
        lower.includes("academy-selection") ||
        lower.includes("academy") ||
        lower.includes("school") ||
        lower.includes("junior") ||
        lower.includes("youth") ||
        lower.includes("ladies") ||
        lower.includes("women") ||
        lower.includes("girls") ||
        lower.includes("gk") ||
        abs.includes("セレクション") ||
        abs.includes("選考") ||
        abs.includes("体験") ||
        abs.includes("募集") ||
        abs.includes("入団") ||
        abs.includes("加入") ||
        abs.includes("応募") ||
        abs.includes("申込") ||
        abs.includes("練習会") ||
        abs.includes("練習参加") ||
        abs.includes("アカデミー") ||
        abs.includes("スクール") ||
        abs.includes("ジュニア") ||
        abs.includes("ユース") ||
        abs.includes("女子");

      if (likely) links.add(abs);
    } catch {
      // ignore
    }
  }

  return Array.from(links).slice(0, MAX_PAGES_PER_SOURCE - 1);
}

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "SakaMatchBot/1.0 (+https://www.sakamatch.com/; public selection info crawler)",
      accept: "text/html,application/xhtml+xml,application/pdf",
    },
  });

  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/pdf") || isPdfUrl(url)) {
    const arrayBuffer = await res.arrayBuffer();

    return {
      status: res.status,
      html: "",
      contentType,
      pdfBuffer: arrayBuffer,
    };
  }

  const html = await res.text();

  return {
    status: res.status,
    html,
    contentType,
    pdfBuffer: null,
  };
}

async function extractPdfTextFromBuffer(buffer: ArrayBuffer) {
  try {
    const pdf = await pdfjsLib.getDocument({
      data: buffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

    let fullText = "";

    const maxPages = Math.min(pdf.numPages, 20);

    for (let pageNo = 1; pageNo <= maxPages; pageNo++) {
      const page = await pdf.getPage(pageNo);

      const content = await page.getTextContent();

      const pageText = content.items
        .map((item: any) => item.str || "")
        .join(" ");

      fullText += "\n" + pageText;
    }

    return fullText
      .replace(/\s+/g, " ")
      .trim();
  } catch (e) {
    console.error("PDF extract error", e);
    return "";
  }
}

function extractInstagramText(html: string, pageUrl: string, sourceName: string) {
  const source = String(html ?? "");

  const candidates: string[] = [];

  const metaPatterns = [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i,
  ];

  for (const pattern of metaPatterns) {
    const m = source.match(pattern);
    if (m?.[1]) candidates.push(m[1]);
  }

  const scriptTextMatches = source.match(/"text":"([^"]+)"/g) ?? [];
  for (const item of scriptTextMatches.slice(0, 20)) {
    const m = item.match(/"text":"([^"]+)"/);
    if (m?.[1]) candidates.push(m[1]);
  }

  const captionMatches = source.match(/"caption":"([^"]+)"/g) ?? [];
  for (const item of captionMatches.slice(0, 20)) {
    const m = item.match(/"caption":"([^"]+)"/);
    if (m?.[1]) candidates.push(m[1]);
  }

  const accessibilityMatches =
    source.match(/"accessibility_caption":"([^"]+)"/g) ?? [];

  for (const item of accessibilityMatches.slice(0, 20)) {
    const m = item.match(/"accessibility_caption":"([^"]+)"/);
    if (m?.[1]) candidates.push(m[1]);
  }

  const edgeCaptionMatches =
    source.match(/"edge_media_to_caption"[\s\S]{0,800}/g) ?? [];

  for (const item of edgeCaptionMatches.slice(0, 10)) {
    const m = item.match(/"text":"([^"]+)"/);
    if (m?.[1]) candidates.push(m[1]);
  }

  const joined = candidates
    .map((v) =>
      String(v)
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
          String.fromCharCode(parseInt(code, 16))
        )
        .replace(/\\"/g, '"')
        .replace(/\\n/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean)
    .join(" ");

  return [
    sourceName,
    "Instagram投稿",
    joined,
    pageUrl,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCategories(text: string) {
  const found = new Set<string>();

  const normalized = String(text ?? "")
    .replace(/Ｕ/g, "U")
    .replace(/－/g, "-")
    .replace(/ー/g, "-")
    .replace(/\s+/g, "");

  if (/U-?7|小学1年|小1|1年生/.test(normalized)) found.add("U-7");
  if (/U-?8|小学2年|小2|2年生/.test(normalized)) found.add("U-8");
  if (/U-?9|小学3年|小3|3年生/.test(normalized)) found.add("U-9");
  if (/U-?10|小学4年|小4|4年生/.test(normalized)) found.add("U-10");
  if (/U-?11|小学5年|小5|5年生/.test(normalized)) found.add("U-11");
  if (/U-?12|小学6年|小6|6年生/.test(normalized)) found.add("U-12");
  if (/U-?13|中学1年|中1/.test(normalized)) found.add("U-13");
  if (/U-?14|中学2年|中2/.test(normalized)) found.add("U-14");
  if (/U-?15|中学3年|中3|ジュニアユース/.test(normalized)) found.add("U-15");
  if (/U-?18|ユース/.test(normalized)) found.add("U-18");

  return Array.from(found);
}

function extractPrefecture(text: string) {
  return PREFECTURES.find((v) => text.includes(v)) ?? null;
}

function extractCity(text: string) {
  return CITIES.find((v) => text.includes(v)) ?? null;
}

function extractDateNearKeyword(text: string) {
  const keywordIndexes = KEYWORDS.map((k) => text.indexOf(k))
    .filter((v) => v >= 0)
    .sort((a, b) => a - b);

  for (const idx of keywordIndexes) {
    const part = text.slice(Math.max(0, idx - 200), idx + 800);
    const date = extractDate(part);
    if (date) return date;
  }

  return extractDate(text);
}

function extractDate(text: string) {
  const year = new Date().getFullYear();

  const full = text.match(/(\d{4})[年\/.-](\d{1,2})[月\/.-](\d{1,2})日?/);
  if (full) {
    return `${full[1]}-${String(full[2]).padStart(2, "0")}-${String(
      full[3]
    ).padStart(2, "0")}`;
  }

  const md =
    text.match(/(\d{1,2})月(\d{1,2})日/) ||
    text.match(/(\d{1,2})\/(\d{1,2})/);

  if (md) {
    return `${year}-${String(md[1]).padStart(2, "0")}-${String(md[2]).padStart(
      2,
      "0"
    )}`;
  }

  return null;
}

function extractDeadline(text: string) {
  const words = ["申込期限", "申込締切", "応募締切", "締切", "〆切", "申込み期限"];

  for (const word of words) {
    const idx = text.indexOf(word);
    if (idx >= 0) {
      return extractDate(text.slice(idx, idx + 180));
    }
  }

  return null;
}

function titleFromUrl(pageUrl: string, fallback: string) {
  try {
    const u = new URL(pageUrl);
    const file = decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() || "");
    if (file) return file.replace(/\.pdf$/i, "").slice(0, 120);
  } catch {
    // ignore
  }

  return fallback;
}

function buildTitle(pageTitle: string, sourceName: string, text: string, pageUrl: string) {
  if (isPdfUrl(pageUrl)) {
    return `${sourceName} ${titleFromUrl(pageUrl, "PDF募集資料")}`.slice(0, 120);
  }

  if (isInstagramUrl(pageUrl)) {
    return `${sourceName} Instagram投稿`.slice(0, 120);
  }

  if (pageTitle && containsKeyword(pageTitle)) return pageTitle.slice(0, 120);

  const keyword = KEYWORDS.find((k) => text.includes(k)) ?? "セレクション情報";
  return `${sourceName} ${keyword}`.slice(0, 120);
}

function buildSummary(text: string) {
  const idx = KEYWORDS.map((k) => text.indexOf(k))
    .filter((v) => v >= 0)
    .sort((a, b) => a - b)[0];

  if (idx == null) return text.slice(0, 160);
  return text.slice(Math.max(0, idx - 50), idx + 260).trim();
}

function normalizeDuplicateText(text?: string | null) {
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

function buildDuplicateKey(params: {
  title?: string | null;
  organizationName?: string | null;
  eventDate?: string | null;
}) {
  return [
    normalizeDuplicateText(params.organizationName),
    normalizeDuplicateText(params.title),
    params.eventDate ?? "",
  ].join("|");
}

function displayStatusFromDates(eventDate: string | null, deadline: string | null) {
  const today = new Date().toISOString().slice(0, 10);

  if (eventDate && eventDate < today) return "開催終了";
  if (deadline && deadline < today) return "申込終了";

  return "募集中";
}

function isTargetPage(params: {
  rawText: string;
  pageTitle: string;
  pageUrl: string;
  sourceName: string;
}) {
  const { rawText, pageTitle, pageUrl, sourceName } = params;

  const text = `${sourceName} ${pageTitle} ${rawText}`;
  const lowerUrl = pageUrl.toLowerCase();

  if (isPdfUrl(pageUrl)) return true;
  if (isInstagramUrl(pageUrl)) return true;

  if (!containsKeyword(text)) return false;
  if (containsExcludeKeyword(text)) return false;

  const positiveScore =
    (text.includes("セレクション") ? 10 : 0) +
    (text.includes("選考会") ? 9 : 0) +
    (text.includes("トライアウト") ? 9 : 0) +
    (text.includes("追加セレクション") ? 10 : 0) +
    (text.includes("GKセレクション") ? 8 : 0) +
    (text.includes("選手募集") ? 8 : 0) +
    (text.includes("参加者募集") ? 7 : 0) +
    (text.includes("練習参加") ? 6 : 0) +
    (text.includes("練習会") ? 5 : 0) +
    (text.includes("体験練習") ? 5 : 0) +
    (text.includes("体験会") ? 5 : 0) +
    (text.includes("入団") ? 5 : 0) +
    (text.includes("加入") ? 5 : 0) +
    (text.includes("応募") ? 4 : 0) +
    (text.includes("申込") ? 4 : 0) +
    (text.includes("エントリー") ? 4 : 0) +
    (lowerUrl.includes("selection") ? 10 : 0) +
    (lowerUrl.includes("tryout") ? 9 : 0) +
    (lowerUrl.includes("trial") ? 7 : 0) +
    (lowerUrl.includes("recruit") ? 7 : 0) +
    (lowerUrl.includes("entry") ? 5 : 0) +
    (lowerUrl.includes("join") ? 5 : 0);

  return positiveScore >= 5;
}

function isMissingColumnError(err: any) {
  const msg = String(err?.message ?? "");
  return (
    msg.includes("Could not find") ||
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("column")
  );
}

function removeOptionalCrawlerColumns(payload: any) {
  const copy = { ...payload };
  delete copy.source_type;
  delete copy.pdf_url;
  delete copy.instagram_url;
  delete copy.external_url;
  delete copy.extraction_status;
  delete copy.extraction_error;
  return copy;
}

async function notifyNewSelectionEvent(
  supabase: any,
  eventId: string,
  title: string
) {
  const notificationTitle = "新しいセレクション情報";
  const notificationBody = `${title} が追加されました`;
  const targetUrl = `/selection/${eventId}`;

  const { data: teams, error } = await supabase
    .from("teams")
    .select("owner_id")
    .not("owner_id", "is", null)
    .limit(500);

  if (error) {
    await supabase.from("selection_notification_logs").insert({
      selection_event_id: eventId,
      notification_type: "push",
      title: notificationTitle,
      body: notificationBody,
      target_url: targetUrl,
      success: false,
      error_message: error.message,
    });
    return;
  }

  const userIds = Array.from(
    new Set((teams ?? []).map((t: any) => t.owner_id).filter(Boolean))
  );

  for (const userId of userIds) {
    try {
      await supabase.from("notifications").insert({
        user_id: userId,
        type: "selection_event",
        title: notificationTitle,
        body: notificationBody,
        target_url: targetUrl,
        is_read: false,
      });

      await supabase.from("selection_notification_logs").insert({
        selection_event_id: eventId,
        user_id: userId,
        notification_type: "push",
        title: notificationTitle,
        body: notificationBody,
        target_url: targetUrl,
        success: true,
      });
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "object"
            ? JSON.stringify(e)
            : String(e);

      await supabase.from("selection_notification_logs").insert({
        selection_event_id: eventId,
        user_id,
        notification_type: "push",
        title: notificationTitle,
        body: notificationBody,
        target_url: targetUrl,
        success: false,
        error_message: message,
      });
    }
  }
}

serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SB_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ ok: false, error: "Missing env" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: sources, error } = await supabase
    .from("selection_sources")
    .select("id,name,base_url,organization_type,enabled")
    .eq("enabled", true)
    .limit(50);

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  let fetchedPages = 0;
  let savedPages = 0;
  let insertedEvents = 0;
  let updatedEvents = 0;
  const errors: string[] = [];

  for (const source of (sources ?? []) as SelectionSource[]) {
    const { data: log } = await supabase
      .from("selection_fetch_logs")
      .insert({ source_id: source.id, success: false })
      .select("id")
      .single();

    const logId = log?.id;

    let sourceFetchedPages = 0;
    let sourceInsertedEvents = 0;
    let sourceUpdatedEvents = 0;

    try {
      const firstUrl = normalizeUrl(source.base_url);
      const first = await fetchHtml(firstUrl);

      const urls = [firstUrl, ...extractLinks(first.html || "", firstUrl)].slice(
        0,
        MAX_PAGES_PER_SOURCE
      );

      for (const pageUrl of urls) {
        const fetched = pageUrl === firstUrl ? first : await fetchHtml(pageUrl);

        fetchedPages += 1;
        sourceFetchedPages += 1;

        const pdf = isPdfUrl(pageUrl) || fetched.contentType?.includes("pdf");
        const instagram = isInstagramUrl(pageUrl);

        const html = fetched.html || "";

        let rawText = "";
        let pageTitle = "";

        if (pdf) {
          pageTitle = titleFromUrl(pageUrl, "PDF募集資料");

          const pdfText = fetched.pdfBuffer
            ? await extractPdfTextFromBuffer(fetched.pdfBuffer)
            : "";

          rawText = [
            source.name,
            pageTitle,
            pdfText,
            pageUrl,
          ]
            .filter(Boolean)
            .join(" ");

          if (!rawText.trim()) {
            rawText = `${source.name} PDF募集資料 ${pageUrl}`;
          }
        } else if (instagram) {
          pageTitle = "Instagram投稿";

          const instagramText = extractInstagramText(html, pageUrl, source.name);

          rawText = instagramText || `${source.name} Instagram投稿 ${pageUrl}`;
        } else {
          rawText = stripHtml(html);
          pageTitle = getTitle(html);
        }

        const checksum = await sha256(rawText);

        if (
          !isTargetPage({
            rawText,
            pageTitle,
            pageUrl,
            sourceName: source.name,
          })
        ) {
          continue;
        }

        const { data: pageRow, error: pageError } = await supabase
          .from("selection_crawl_pages")
          .insert({
            source_id: source.id,
            page_url: pageUrl,
            page_title: pageTitle,
            http_status: fetched.status,
            raw_html: html.slice(0, 500000),
            raw_text: rawText.slice(0, 500000),
            checksum,
          })
          .select("id")
          .single();

        if (pageError) throw pageError;

        savedPages += 1;

        const title = buildTitle(pageTitle, source.name, rawText, pageUrl);

        const eventDate = safeDate(extractDateNearKeyword(rawText));

        const deadline = safeDate(extractDeadline(rawText));

        const duplicateKey = buildDuplicateKey({
          title,
          organizationName: source.name,
          eventDate,
        });

        const contentHash = await sha256(
          `${title}|${eventDate ?? ""}|${pageUrl}`
        );

        const payload = {
          source_id: source.id,
          crawl_page_id: pageRow?.id ?? null,
          title,
          organization_name: source.name,
          organization_type: source.organization_type || "other",
          target_categories: extractCategories(rawText),
          gender: rawText.includes("女子") || rawText.includes("レディース")
            ? "girls"
            : "any",
          prefecture: extractPrefecture(rawText),
          city: extractCity(rawText),
          event_date: eventDate,
          application_deadline: deadline,
          source_url: pageUrl,
          official_url: pageUrl,
          summary: pdf
            ? buildSummary(rawText) || "PDF募集資料を検出しました。詳細は公式PDFをご確認ください。"
            : instagram
              ? buildSummary(rawText) || "Instagram投稿を検出しました。詳細は公式投稿をご確認ください。"
              : buildSummary(rawText),
          memo:
            "※本情報は公開情報をもとに自動収集した参考情報です。最新情報・申込条件は必ず公式サイトでご確認ください。",
          fetched_at: new Date().toISOString(),
          raw_text: rawText.slice(0, 500000),
          content_hash: contentHash,
          duplicate_key: duplicateKey,
          status: "published",
          display_status: displayStatusFromDates(eventDate, deadline),
          is_featured: source.organization_type === "j_club",
          last_seen_at: new Date().toISOString(),

          source_type: pdf ? "pdf" : instagram ? "instagram" : "web",
          pdf_url: pdf ? pageUrl : null,
          instagram_url: instagram ? pageUrl : null,
          external_url: pdf || instagram ? pageUrl : null,
          extraction_status: "success",
          extraction_error: null,
        };

        let existing: any = null;

        const { data: existingByUrl, error: existingByUrlError } = await supabase
          .from("selection_events")
          .select("id")
          .eq("source_url", pageUrl)
          .maybeSingle();

        if (existingByUrlError) throw existingByUrlError;

        existing = existingByUrl;

        if (!existing?.id) {
          const { data: existingByDuplicateKey, error: existingByDuplicateKeyError } =
            await supabase
              .from("selection_events")
              .select("id")
              .eq("duplicate_key", duplicateKey)
              .maybeSingle();

          if (existingByDuplicateKeyError) throw existingByDuplicateKeyError;

          existing = existingByDuplicateKey;
        }

        if (existing?.id) {
          let { error: updateError } = await supabase
            .from("selection_events")
            .update(payload)
            .eq("id", existing.id);

          if (updateError && isMissingColumnError(updateError)) {
            const fallbackPayload = removeOptionalCrawlerColumns(payload);

            const retry = await supabase
              .from("selection_events")
              .update(fallbackPayload)
              .eq("id", existing.id);

            updateError = retry.error;
          }

          if (updateError) throw updateError;

          updatedEvents += 1;
          sourceUpdatedEvents += 1;
        } else {
          let { data: insertedEvent, error: insertError } = await supabase
            .from("selection_events")
            .insert(payload)
            .select("id,title")
            .single();

          if (insertError && isMissingColumnError(insertError)) {
            const fallbackPayload = removeOptionalCrawlerColumns(payload);

            const retry = await supabase
              .from("selection_events")
              .insert(fallbackPayload)
              .select("id,title")
              .single();

            insertedEvent = retry.data;
            insertError = retry.error;
          }

          if (insertError) throw insertError;

          insertedEvents += 1;
          sourceInsertedEvents += 1;

          if (insertedEvent?.id) {
            await notifyNewSelectionEvent(
              supabase,
              insertedEvent.id,
              insertedEvent.title || title
            );
          }
        }
      }

      await supabase
        .from("selection_sources")
        .update({ last_crawled_at: new Date().toISOString() })
        .eq("id", source.id);

      if (logId) {
        await supabase
          .from("selection_fetch_logs")
          .update({
            finished_at: new Date().toISOString(),
            success: true,
            fetched_pages: sourceFetchedPages,
            inserted_events: sourceInsertedEvents,
            updated_events: sourceUpdatedEvents,
          })
          .eq("id", logId);
      }
    } catch (e) {
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "object"
            ? JSON.stringify(e)
            : String(e);

      errors.push(`${source.name}: ${message}`);

      if (logId) {
        await supabase
          .from("selection_fetch_logs")
          .update({
            finished_at: new Date().toISOString(),
            success: false,
            error_message: message,
            fetched_pages: sourceFetchedPages,
            inserted_events: sourceInsertedEvents,
            updated_events: sourceUpdatedEvents,
          })
          .eq("id", logId);
      }
    }
  }

  return Response.json({
    ok: errors.length === 0,
    sourceCount: sources?.length ?? 0,
    fetchedPages,
    savedPages,
    insertedEvents,
    updatedEvents,
    errors,
  });
});