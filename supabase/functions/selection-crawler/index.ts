// @ts-nocheck

// supabase/functions/selection-crawler/index.ts

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SelectionSource = {
  id: string;
  name: string;
  base_url: string;
  organization_type: string;
  enabled: boolean;
};

const KEYWORDS = [
  "セレクション",
  "選考会",
  "体験練習",
  "体験会",
  "練習会",
  "ジュニアユース",
  "ジュニア",
  "U-12",
  "U-13",
  "U-14",
  "U-15",
  "募集",
];

const CATEGORY_KEYWORDS = [
  "U-12",
  "U-13",
  "U-14",
  "U-15",
  "小1",
  "小2",
  "小3",
  "小4",
  "小5",
  "小6",
  "中1",
  "中2",
  "中3",
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

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function getTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function containsSelectionKeyword(text: string) {
  return KEYWORDS.some((keyword) => text.includes(keyword));
}

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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

async function fetchHtml(url: string) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "SakaMatchBot/1.0 (+https://www.sakamatch.com/; public selection info crawler)",
      accept: "text/html,application/xhtml+xml",
    },
  });

  const html = await res.text();

  return {
    status: res.status,
    html,
  };
}

function extractCategories(text: string) {
  return CATEGORY_KEYWORDS.filter((v) => text.includes(v));
}

function extractPrefecture(text: string) {
  return PREFECTURES.find((v) => text.includes(v)) ?? null;
}

function extractEventDate(text: string) {
  const now = new Date();
  const currentYear = now.getFullYear();

  const patterns = [
    /(\d{4})[年\/.-](\d{1,2})[月\/.-](\d{1,2})日?/,
    /(\d{1,2})月(\d{1,2})日/,
    /(\d{1,2})\/(\d{1,2})/,
  ];

  const full = text.match(patterns[0]);
  if (full) {
    const y = Number(full[1]);
    const m = Number(full[2]);
    const d = Number(full[3]);
    if (y && m && d) return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const md = text.match(patterns[1]) || text.match(patterns[2]);
  if (md) {
    const m = Number(md[1]);
    const d = Number(md[2]);
    if (m && d) {
      return `${currentYear}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  return null;
}

function extractDeadline(text: string) {
  const idx =
    text.indexOf("申込期限") >= 0
      ? text.indexOf("申込期限")
      : text.indexOf("締切") >= 0
        ? text.indexOf("締切")
        : -1;

  if (idx < 0) return null;

  const around = text.slice(idx, idx + 80);
  return extractEventDate(around);
}

function buildSummary(text: string) {
  const idx = KEYWORDS.map((k) => text.indexOf(k)).filter((v) => v >= 0).sort((a, b) => a - b)[0];

  if (idx == null) {
    return text.slice(0, 120);
  }

  return text.slice(Math.max(0, idx - 40), idx + 160).trim();
}

function buildTitle(pageTitle: string, sourceName: string, text: string) {
  if (pageTitle && containsSelectionKeyword(pageTitle)) {
    return pageTitle.slice(0, 120);
  }

  const keyword = KEYWORDS.find((k) => text.includes(k)) ?? "セレクション情報";
  return `${sourceName} ${keyword}`.slice(0, 120);
}

function displayStatusFromDates(eventDate: string | null, deadline: string | null) {
  const today = new Date().toISOString().slice(0, 10);

  if (eventDate && eventDate < today) return "開催終了";
  if (deadline && deadline < today) return "申込終了";

  return "募集中";
}

serve(async () => {
  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") ||
    Deno.env.get("SB_URL");

  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SB_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      {
        ok: false,
        error:
          "Missing SUPABASE_URL/SB_URL or SUPABASE_SERVICE_ROLE_KEY/SB_SERVICE_ROLE_KEY",
      },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: sources, error: sourceError } = await supabase
    .from("selection_sources")
    .select("id,name,base_url,organization_type,enabled")
    .eq("enabled", true)
    .limit(20);

  if (sourceError) {
    return Response.json(
      {
        ok: false,
        error: sourceError.message,
      },
      { status: 500 }
    );
  }

  let fetchedPages = 0;
  let savedPages = 0;
  let insertedEvents = 0;
  let updatedEvents = 0;

  const errors: string[] = [];

  for (const source of (sources ?? []) as SelectionSource[]) {
    const logInsert = await supabase
      .from("selection_fetch_logs")
      .insert({
        source_id: source.id,
        success: false,
      })
      .select("id")
      .single();

    const logId = logInsert.data?.id as string | undefined;

    try {
      const pageUrl = normalizeUrl(source.base_url);

      const { status, html } = await fetchHtml(pageUrl);
      fetchedPages += 1;

      const rawText = stripHtml(html);
      const pageTitle = getTitle(html);
      const checksum = await sha256(rawText);

      let crawlPageId: string | null = null;

      if (containsSelectionKeyword(rawText)) {
        const { data: pageRow, error: insertPageError } = await supabase
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

        if (insertPageError) {
          throw insertPageError;
        }

        crawlPageId = pageRow?.id ?? null;
        savedPages += 1;

        const title = buildTitle(pageTitle, source.name, rawText);
        const targetCategories = extractCategories(rawText);
        const prefecture = extractPrefecture(rawText);
        const eventDate = extractEventDate(rawText);
        const deadline = extractDeadline(rawText);
        const displayStatus = displayStatusFromDates(eventDate, deadline);
        const summary = buildSummary(rawText);

        const contentHash = await sha256(`${title}|${eventDate ?? ""}|${pageUrl}`);

        const payload = {
          source_id: source.id,
          crawl_page_id: crawlPageId,
          title,
          organization_name: source.name,
          organization_type: source.organization_type || "other",
          target_categories: targetCategories,
          gender: "any",
          prefecture,
          event_date: eventDate,
          application_deadline: deadline,
          source_url: pageUrl,
          official_url: pageUrl,
          summary,
          memo:
            "※本情報は公開情報をもとに自動収集した参考情報です。最新情報・申込条件は必ず公式サイトでご確認ください。",
          fetched_at: new Date().toISOString(),
          raw_text: rawText.slice(0, 500000),
          content_hash: contentHash,
          status: "published",
          display_status: displayStatus,
          is_featured: source.organization_type === "j_club",
          last_seen_at: new Date().toISOString(),
        };

        const { data: existing } = await supabase
          .from("selection_events")
          .select("id")
          .eq("source_url", pageUrl)
          .maybeSingle();

        if (existing?.id) {
          const { error: updateError } = await supabase
            .from("selection_events")
            .update(payload)
            .eq("id", existing.id);

          if (updateError) throw updateError;

          updatedEvents += 1;
        } else {
          const { error: insertEventError } = await supabase
            .from("selection_events")
            .insert(payload);

          if (insertEventError) throw insertEventError;

          insertedEvents += 1;
        }
      }

      await supabase
        .from("selection_sources")
        .update({
          last_crawled_at: new Date().toISOString(),
        })
        .eq("id", source.id);

      if (logId) {
        await supabase
          .from("selection_fetch_logs")
          .update({
            finished_at: new Date().toISOString(),
            success: true,
            fetched_pages: 1,
            inserted_events: insertedEvents,
            updated_events: updatedEvents,
          })
          .eq("id", logId);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push(`${source.name}: ${message}`);

      if (logId) {
        await supabase
          .from("selection_fetch_logs")
          .update({
            finished_at: new Date().toISOString(),
            success: false,
            error_message: message,
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