import type { CandidatePage, SelectionSource } from "./types.ts";
import {
  buildDuplicateKey,
  buildSummary,
  buildTitle,
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
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

  const { pageUrl, pageTitle, rawText, html, status, pdf, priority, reason } =
    candidate;

  const title = buildTitle(pageTitle, source.name, rawText, pageUrl);
  const eventDate = safeDate(extractDateNearKeyword(rawText));
  const deadline = safeDate(extractDeadline(rawText));
  const checksum = await sha256(rawText);

  const { data: pageRow, error: pageError } = await supabase
    .from("selection_crawl_pages")
    .insert({
      source_id: source.id,
      page_url: pageUrl,
      page_title: pageTitle,
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
    organizationName: source.name,
    eventDate,
  });

  const contentHash = await sha256(
    `${title}|${eventDate ?? "date_unknown"}|${pageUrl}`,
  );

  const payload = {
    source_id: source.id,
    crawl_page_id: pageRow?.id ?? null,
    title,
    organization_name: source.name,
    organization_type: source.organization_type || "other",
    source_rank: normalizeSourceRank(source, rawText),
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
    source_url: pageUrl,
    official_url: pageUrl,
    summary: pdf
      ? buildSummary(rawText) ||
        "PDF募集資料を検出しました。詳細は公式PDFをご確認ください。"
      : buildSummary(rawText),
    memo: eventDate
      ? "※本情報は公開情報をもとに自動収集した参考情報です。最新情報・申込条件は必ず公式サイトでご確認ください。"
      : "※日付未取得の募集情報です。開催日・申込条件は必ず公式サイトでご確認ください。",
    fetched_at: new Date().toISOString(),
    raw_text: rawText.slice(0, 500000),
    content_hash: contentHash,
    duplicate_key: duplicateKey,
    status: "published",
    display_status: displayStatusFromDates(eventDate, deadline, rawText),
    is_featured: source.organization_type === "j_club",
    last_seen_at: new Date().toISOString(),

    source_type: pdf ? "pdf" : "web",
    pdf_url: pdf ? pageUrl : null,
    instagram_url: null,
    external_url: pdf ? pageUrl : null,
    extraction_status: eventDate ? "success" : "date_missing",
    extraction_error: eventDate ? null : "event_date not found",
    page_priority: priority,
    priority_reason: reason,
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