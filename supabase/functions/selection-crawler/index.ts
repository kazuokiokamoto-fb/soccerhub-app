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

      if (containsSelectionKeyword(rawText)) {
        const { error: insertPageError } = await supabase
          .from("selection_crawl_pages")
          .insert({
            source_id: source.id,
            page_url: pageUrl,
            page_title: pageTitle,
            http_status: status,
            raw_html: html.slice(0, 500000),
            raw_text: rawText.slice(0, 500000),
            checksum,
          });

        if (insertPageError) {
          throw insertPageError;
        }

        savedPages += 1;
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
            inserted_events: 0,
            updated_events: 0,
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
    errors,
  });
});