import type { CandidatePage, SelectionSource } from "./types.ts";
import {
  buildDuplicateKey,
  buildSummary,
  displayStatusFromDates,
  extractCategories,
  extractCity,
  extractDateNearKeyword,
  extractDeadline,
  extractPrefecture,
  safeDate,
} from "./extract.ts";
import { normalizeSourceRank } from "./classify.ts";
import { isPdfUrl } from "./url.ts";
import { notifyNewSelectionEvent } from "./notify.ts";

export async function sha256(text: string) {
  const safeText = cleanDbText(text);
  const data = new TextEncoder().encode(safeText);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function cleanDbText(value?: string | null) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\x00/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTitleText(value?: string | null) {
  return cleanDbText(value)
    .replace(/｜/g, " ")
    .replace(/\|/g, " ")
    .replace(/公式サイト.*$/g, "")
    .replace(/公式ウェブサイト.*$/g, "")
    .replace(/サッカークラブ公式.*$/g, "")
    .replace(/MENU.*$/g, "")
    .replace(/メニュー.*$/g, "")
    .replace(/NEWS.*$/g, "")
    .replace(/ニュース.*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isWeakPageTitle(title: string) {
  const t = cleanTitleText(title);

  if (!t) return true;
  if (t === "アカデミー") return true;
  if (t === "スクール") return true;
  if (t === "ニュース") return true;
  if (t === "NEWS") return true;
  if (t === "ホーム") return true;
  if (t === "TOP") return true;
  if (t.includes("404")) return true;
  if (t.includes("Not Found")) return true;

  return false;
}

function extractUsefulTitleFromText(rawText: string) {
  const text = cleanDbText(rawText);

  const patterns = [
    /20\d{2}年度[^。]{0,60}(セレクション|練習会|選手募集|募集要項|体験会)[^。]{0,60}/,
    /20\d{2}年[^。]{0,60}(セレクション|練習会|選手募集|募集要項|体験会)[^。]{0,60}/,
    /第\d+期生[^。]{0,60}(セレクション|練習会|選手募集|募集要項)[^。]{0,60}/,
    /新U-?\d{1,2}[^。]{0,50}(セレクション|練習会|体験会|募集)[^。]{0,50}/,
    /U-?\d{1,2}[^。]{0,50}(セレクション|練習会|体験会|募集)[^。]{0,50}/,
    /ジュニアユース[^。]{0,60}(セレクション|練習会|選手募集|募集要項)[^。]{0,60}/,
    /ユース[^。]{0,60}(セレクション|練習会|選手募集|募集要項)[^。]{0,60}/,
    /スペシャルクラス[^。]{0,60}(セレクション|体験|募集)[^。]{0,60}/,
    /無料体験[^。]{0,60}(申込|申し込み|受付|募集)[^。]{0,60}/,
    /セレクション[^。]{0,80}/,
    /練習会[^。]{0,80}/,
    /選手募集[^。]{0,80}/,
    /体験会[^。]{0,80}/,
    /無料体験[^。]{0,80}/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) {
      return cleanTitleText(match[0]).slice(0, 90);
    }
  }

  return "";
}

function buildCleanEventTitle(params: {
  pageTitle: string;
  sourceName: string;
  rawText: string;
  pageUrl: string;
}) {
  const { pageTitle, sourceName, rawText, pageUrl } = params;

  const cleanSourceName = cleanTitleText(sourceName);
  const cleanPageTitle = cleanTitleText(pageTitle);
  const textTitle = extractUsefulTitleFromText(rawText);

  let title = "";

  if (!isWeakPageTitle(cleanPageTitle)) {
    title = cleanPageTitle;
  } else if (textTitle) {
    title = textTitle;
  }

  if (!title) {
    title = textTitle || cleanPageTitle || cleanSourceName || pageUrl;
  }

  if (
    cleanSourceName &&
    !title.includes(cleanSourceName) &&
    title.length < 80
  ) {
    title = `${cleanSourceName} ${title}`;
  }

  return cleanDbText(title).slice(0, 120);
}

export function normalizeOrganizationType(value?: string | null) {
  const v = String(value ?? "").trim();

  if (v === "j_club") return "j_club";
  if (v === "strong_team") return "strong_team";
  if (v === "school") return "school";
  if (v === "club_team") return "club_team";
  if (v === "other") return "other";

  if (v === "club") return "club_team";
  if (v === "academy") return "club_team";
  if (v === "j_academy") return "j_club";

  if (v === "ladies") return "club_team";
  if (v === "women") return "club_team";
  if (v === "girls") return "club_team";

  if (v === "サッカースクール") return "school";
  if (v === "スクール") return "school";

  if (v === "地域クラブ") return "club_team";
  if (v === "街クラブ") return "club_team";
  if (v === "女子クラブ") return "club_team";
  if (v === "少年団") return "club_team";

  return "other";
}

export function isMissingColumnError(err: any) {
  const msg = String(err?.message ?? "");
  return (
    msg.includes("Could not find") ||
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("column")
  );
}

export function removeOptionalCrawlerColumns(payload: any) {
  const copy = { ...payload };
  delete copy.source_type;
  delete copy.pdf_url;
  delete copy.instagram_url;
  delete copy.external_url;
  delete copy.extraction_status;
  delete copy.extraction_error;
  delete copy.page_priority;
  delete copy.priority_reason;
  return copy;
}

export async function saveCandidateEvent(params: {
  supabase: any;
  source: SelectionSource;
  candidate: CandidatePage;
}) {
  const { supabase, source, candidate } = params;

  const {
    pageUrl,
    pageTitle,
    rawText: originalRawText,
    html: originalHtml,
    status,
    pdf,
    priority,
    reason,
  } = candidate;

  const rawText = cleanDbText(originalRawText);
  const html = cleanDbText(originalHtml);
  const cleanPageTitle = cleanDbText(pageTitle);
  const cleanSourceName = cleanDbText(source.name);
  const cleanPageUrl = cleanDbText(pageUrl);

  const title = buildCleanEventTitle({
    pageTitle: cleanPageTitle,
    sourceName: cleanSourceName,
    rawText,
    pageUrl: cleanPageUrl,
  });

  const eventDate = safeDate(extractDateNearKeyword(rawText));
  const deadline = safeDate(extractDeadline(rawText));
  const checksum = await sha256(rawText);

  const { data: pageRow, error: pageError } = await supabase
    .from("selection_crawl_pages")
    .insert({
      source_id: source.id,
      page_url: cleanPageUrl,
      page_title: cleanPageTitle,
      http_status: status,
      raw_html: html.slice(0, 500000),
      raw_text: rawText.slice(0, 500000),
      checksum,
    })
    .select("id")
    .single();

  if (pageError) throw pageError;

  const duplicateKey = buildDuplicateKey({
    title,
    organizationName: cleanSourceName,
    eventDate,
  });

  const contentHash = await sha256(
    `${title}|${eventDate ?? "date_unknown"}|${cleanPageUrl}`,
  );

  const normalizedOrganizationType = normalizeOrganizationType(
    source.organization_type,
  );

  const payload = {
    source_id: source.id,
    crawl_page_id: pageRow?.id ?? null,
    title,
    organization_name: cleanSourceName,
    organization_type: normalizedOrganizationType,
    source_rank: cleanDbText(normalizeSourceRank(source, rawText)),
    target_categories: extractCategories(rawText),
    gender:
      rawText.includes("女子") ||
      rawText.includes("レディース") ||
      rawText.includes("ガールズ")
        ? "girls"
        : "any",
    prefecture: extractPrefecture(rawText),
    city: extractCity(rawText),
    event_date: eventDate,
    application_deadline: deadline,
    source_url: cleanPageUrl,
    official_url: cleanPageUrl,
    summary: cleanDbText(
      pdf
        ? buildSummary(rawText) ||
          "PDF募集資料を検出しました。詳細は公式PDFをご確認ください。"
        : buildSummary(rawText),
    ),
    memo: eventDate
      ? "※本情報は公開情報をもとに自動収集した参考情報です。最新情報・申込条件は必ず公式サイトでご確認ください。"
      : "※日付未取得の募集情報です。開催日・申込条件は必ず公式サイトでご確認ください。",
    fetched_at: new Date().toISOString(),
    raw_text: rawText.slice(0, 500000),
    content_hash: contentHash,
    duplicate_key: duplicateKey,
    status: "published",
    display_status: displayStatusFromDates(eventDate, deadline, rawText),
    is_featured: normalizedOrganizationType === "j_club",
    last_seen_at: new Date().toISOString(),

    source_type: pdf ? "pdf" : "web",
    pdf_url: pdf ? cleanPageUrl : null,
    instagram_url: null,
    external_url: pdf ? cleanPageUrl : null,
    extraction_status: eventDate ? "success" : "date_missing",
    extraction_error: eventDate ? null : "event_date not found",
    page_priority: priority,
    priority_reason: reason,
  };

  let existing: any = null;

  const { data: existingByUrl, error: existingByUrlError } = await supabase
    .from("selection_events")
    .select("id")
    .eq("source_url", cleanPageUrl)
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

    return { inserted: false, updated: true, pageSaved: true };
  }

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

  if (insertedEvent?.id) {
    await notifyNewSelectionEvent(
      supabase,
      insertedEvent.id,
      insertedEvent.title || title,
    );
  }

  return { inserted: true, updated: false, pageSaved: true };
}