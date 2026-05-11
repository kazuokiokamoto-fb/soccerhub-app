// @ts-nocheck

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SelectionSource = {
  id: string;
  name: string;
  base_url: string;
  organization_type: string;
  enabled: boolean;
};

const MAX_PAGES_PER_SOURCE = 10;

const KEYWORDS = [
  "セレクション",
  "選考会",
  "練習参加",
  "加入",
  "入団",
  "募集",
  "参加者募集",
  "新加入",
  "トライアウト",
  "体験",
  "体験練習",
  "体験会",
  "練習会",
  "アカデミー",
  "育成",
  "スクール",
  "ジュニア",
  "ジュニアユース",
  "ユース",
  "トップチーム",
  "レディース",
  "女子",
  "WEリーグ",
  "フットサル",
  "GK",
  "ゴールキーパー",
  "キャンプ",
  "短期スクール",
  "tryout",
  "academy",
  "school",
  "ladies",
  "women",
  "futsal",
  "topteam",
  "join",
  "recruit",
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
    .replace(/\s+/g, " ")
    .trim();
}

function getTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function containsKeyword(text: string) {
  return KEYWORDS.some((keyword) => text.includes(keyword));
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

function sameHost(url: string, baseUrl: string) {
  try {
    return new URL(url).hostname === new URL(baseUrl).hostname;
  } catch {
    return false;
  }
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
    if (href.includes(".pdf")) continue;
    if (href.includes(".jpg")) continue;
    if (href.includes(".png")) continue;

    try {
      const abs = normalizeUrl(new URL(href, baseUrl).toString());
      if (!sameHost(abs, baseUrl)) continue;

      const lower = abs.toLowerCase();

      const likely =
        abs.includes("セレクション") ||
        abs.includes("選考") ||
        abs.includes("体験") ||
        abs.includes("募集") ||
        abs.includes("入団") ||
        abs.includes("加入") ||
        abs.includes("育成") ||
        abs.includes("アカデミー") ||
        abs.includes("スクール") ||
        abs.includes("ジュニア") ||
        abs.includes("ジュニアユース") ||
        abs.includes("ユース") ||
        abs.includes("レディース") ||
        abs.includes("女子") ||
        abs.includes("フットサル") ||
        abs.includes("トップチーム") ||
        lower.includes("selection") ||
        lower.includes("tryout") ||
        lower.includes("trial") ||
        lower.includes("junior") ||
        lower.includes("academy") ||
        lower.includes("school") ||
        lower.includes("ladies") ||
        lower.includes("women") ||
        lower.includes("futsal") ||
        lower.includes("topteam") ||
        lower.includes("top-team") ||
        lower.includes("player") ||
        lower.includes("join") ||
        lower.includes("recruit") ||
        lower.includes("u-12") ||
        lower.includes("u12") ||
        lower.includes("u-13") ||
        lower.includes("u13") ||
        lower.includes("u-15") ||
        lower.includes("u15") ||
        lower.includes("u-18") ||
        lower.includes("u18") ||
        lower.includes("news");

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

function extractDate(text: string) {
  const year = new Date().getFullYear();

  const full = text.match(/(\d{4})[年\/.-](\d{1,2})[月\/.-](\d{1,2})日?/);
  if (full) {
    return `${full[1]}-${String(full[2]).padStart(2, "0")}-${String(
      full[3]
    ).padStart(2, "0")}`;
  }

  const md = text.match(/(\d{1,2})月(\d{1,2})日/) || text.match(/(\d{1,2})\/(\d{1,2})/);
  if (md) {
    return `${year}-${String(md[1]).padStart(2, "0")}-${String(md[2]).padStart(
      2,
      "0"
    )}`;
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

  return extractDate(text.slice(idx, idx + 120));
}

function buildTitle(pageTitle: string, sourceName: string, text: string) {
  if (pageTitle && containsKeyword(pageTitle)) return pageTitle.slice(0, 120);

  const keyword = KEYWORDS.find((k) => text.includes(k)) ?? "セレクション情報";
  return `${sourceName} ${keyword}`.slice(0, 120);
}

function buildSummary(text: string) {
  const idx = KEYWORDS.map((k) => text.indexOf(k))
    .filter((v) => v >= 0)
    .sort((a, b) => a - b)[0];

  if (idx == null) return text.slice(0, 160);
  return text.slice(Math.max(0, idx - 50), idx + 220).trim();
}

function displayStatusFromDates(eventDate: string | null, deadline: string | null) {
  const today = new Date().toISOString().slice(0, 10);

  if (eventDate && eventDate < today) return "開催終了";
  if (deadline && deadline < today) return "申込終了";

  return "募集中";
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
        user_id: userId,
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
    .limit(20);

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

    try {
      const firstUrl = normalizeUrl(source.base_url);
      const first = await fetchHtml(firstUrl);

      const urls = [
        firstUrl,
        ...extractLinks(first.html, firstUrl),
      ].slice(0, MAX_PAGES_PER_SOURCE);

      for (const pageUrl of urls) {
        const fetched =
          pageUrl === firstUrl ? first : await fetchHtml(pageUrl);

        fetchedPages += 1;

        const html = fetched.html;
        const rawText = stripHtml(html);
        const pageTitle = getTitle(html);
        const checksum = await sha256(rawText);

        const lowerPageUrl = pageUrl.toLowerCase();

        const isTargetPage =
          containsKeyword(rawText) &&
          (
            pageTitle.includes("セレクション") ||
            pageTitle.includes("選考会") ||
            pageTitle.includes("体験") ||
            pageTitle.includes("募集") ||
            pageTitle.includes("練習参加") ||
            pageTitle.includes("トライアウト") ||
            pageTitle.includes("スクール") ||
            pageTitle.includes("アカデミー") ||
            lowerPageUrl.includes("selection") ||
            lowerPageUrl.includes("tryout") ||
            lowerPageUrl.includes("trial") ||
            lowerPageUrl.includes("recruit") ||
            lowerPageUrl.includes("school") ||
            lowerPageUrl.includes("academy")
          );

        const isJClub = source.organization_type === "j_club";

        if (!isTargetPage) continue;

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

        const title = buildTitle(pageTitle, source.name, rawText);
        const eventDate = safeDate(extractDate(rawText));
        const deadline = safeDate(extractDeadline(rawText));
        const contentHash = await sha256(`${title}|${eventDate ?? ""}|${pageUrl}`);

        const payload = {
          source_id: source.id,
          crawl_page_id: pageRow?.id ?? null,
          title,
          organization_name: source.name,
          organization_type: source.organization_type || "other",
          target_categories: extractCategories(rawText),
          gender: "any",
          prefecture: extractPrefecture(rawText),
          event_date: eventDate,
          application_deadline: deadline,
          source_url: pageUrl,
          official_url: pageUrl,
          summary: buildSummary(rawText),
          memo:
            "※本情報は公開情報をもとに自動収集した参考情報です。最新情報・申込条件は必ず公式サイトでご確認ください。",
          fetched_at: new Date().toISOString(),
          raw_text: rawText.slice(0, 500000),
          content_hash: contentHash,
          status: "published",
          display_status: displayStatusFromDates(eventDate, deadline),
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
          const { data: insertedEvent, error: insertError } = await supabase
            .from("selection_events")
            .insert(payload)
            .select("id,title")
            .single();

          if (insertError) throw insertError;

          insertedEvents += 1;

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
            fetched_pages: fetchedPages,
            inserted_events: insertedEvents,
            updated_events: updatedEvents,
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