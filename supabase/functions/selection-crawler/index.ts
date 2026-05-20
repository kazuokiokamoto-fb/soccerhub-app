// @ts-nocheck

/// <reference lib="deno.window" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import type { CandidatePage, SelectionSource } from "./types.ts";

import {
  MAX_EVENTS_PER_SOURCE,
  MAX_PAGES_PER_SOURCE,
} from "./constants.ts";

import {
  buildSeedUrls,
  extractLinks,
  extractExternalCandidateLinks,
  getUrlDepth,
  isBlockedFile,
  isBlockedPath,
  isInstagramUrl,
  isPdfUrl,
  isSitemapUrl,
  normalizeUrl,
} from "./url.ts";

import {
  buildDuplicateKey,
  buildTitle,
  extractDateNearKeyword,
  extractSitemapUrls,
  getTitle,
  safeDate,
  stripHtml,
} from "./extract.ts";

import {
  getPagePriority,
  isTargetPage,
  shouldExtractExternalLinks,
} from "./classify.ts";

import { fetchHtml } from "./fetch.ts";
import { saveCandidateEvent } from "./db.ts";

function candidateSortScore(candidate: CandidatePage) {
  const url = decodeURIComponent(candidate.pageUrl.toLowerCase());
  const text = `${candidate.pageTitle} ${candidate.rawText}`;

  let score = candidate.priority;

  if (url.includes("selection")) score += 40;
  if (url.includes("tryout")) score += 35;
  if (url.includes("trial")) score += 30;
  if (url.includes("recruit")) score += 25;
  if (url.includes("entry")) score += 20;
  if (url.includes("academy")) score += 20;
  if (url.includes("junior-youth")) score += 25;
  if (url.includes("u-13") || url.includes("u13")) score += 25;
  if (url.includes("u-15") || url.includes("u15")) score += 20;
  if (url.includes("news") || url.includes("info") || url.includes("topics")) score += 10;

  if (text.includes("セレクション")) score += 35;
  if (text.includes("選考会")) score += 30;
  if (text.includes("トライアウト")) score += 30;
  if (text.includes("選手募集")) score += 25;
  if (text.includes("参加者募集")) score += 20;
  if (text.includes("体験会")) score += 15;
  if (text.includes("練習会")) score += 15;
  if (text.includes("ジュニアユース")) score += 20;
  if (text.includes("新中1") || text.includes("現小6")) score += 20;
  if (text.includes("U-13") || text.includes("U13")) score += 20;
  if (text.includes("申込") || text.includes("応募") || text.includes("締切")) score += 15;

  const depth = getUrlDepth(candidate.pageUrl);
  if (depth <= 1) score -= 40;
  if (depth >= 3) score += 15;

  return score;
}

serve(async (req) => {
  const url = new URL(req.url);

  const offset = Number(url.searchParams.get("offset") || "0");
  const limit = Number(url.searchParams.get("limit") || "1");

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
    .select("id,name,base_url,organization_type,source_rank,enabled")
    .eq("enabled", true)
    .order("created_at", { ascending: true })
    .range(offset, offset);

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
      .insert({
        source_id: source.id,
        success: false,
      })
      .select("id")
      .single();

    const logId = log?.id;

    let sourceFetchedPages = 0;
    let sourceInsertedEvents = 0;
    let sourceUpdatedEvents = 0;

    const debug = {
      queued: 0,
      fetched: 0,
      sitemapLinks: 0,
      internalLinks: 0,
      externalLinks: 0,
      targetRejected: 0,
      priorityRejected: 0,
      candidates: 0,
      uniqueCandidates: 0,
      selected: 0,
    };

    try {
      const seedUrls = buildSeedUrls(source.base_url);
      const queue = [...seedUrls];
      const visited = new Set<string>();
      const candidates: CandidatePage[] = [];

      debug.queued = seedUrls.length;

      while (queue.length > 0 && visited.size < MAX_PAGES_PER_SOURCE) {
        let pageUrl = normalizeUrl(queue.shift() || "");

        if (!pageUrl) continue;
        if (visited.has(pageUrl)) continue;
        if (isInstagramUrl(pageUrl)) continue;

        if (
          !isPdfUrl(pageUrl) &&
          !isSitemapUrl(pageUrl) &&
          isBlockedFile(pageUrl)
        ) {
          continue;
        }

        if (
          !isPdfUrl(pageUrl) &&
          !isSitemapUrl(pageUrl) &&
          isBlockedPath(pageUrl)
        ) {
          continue;
        }

        visited.add(pageUrl);

        let fetched: any = null;

        try {
          fetched = await fetchHtml(pageUrl);
        } catch {
          continue;
        }

        const finalUrl = normalizeUrl(fetched.finalUrl || pageUrl);

        if (finalUrl !== pageUrl) {
          if (visited.has(finalUrl)) continue;

          pageUrl = finalUrl;
          visited.add(pageUrl);
        }

        fetchedPages += 1;
        sourceFetchedPages += 1;
        debug.fetched += 1;

        const pdf =
          isPdfUrl(pageUrl) || String(fetched.contentType || "").includes("pdf");

        const sitemap =
          isSitemapUrl(pageUrl) ||
          String(fetched.contentType || "").includes("xml") ||
          String(fetched.contentType || "").includes("text/xml");

        const html = fetched.html || "";

        if (sitemap && html) {
          const sitemapLinks = extractSitemapUrls(html, pageUrl);
          debug.sitemapLinks += sitemapLinks.length;

          for (const link of sitemapLinks) {
            if (!visited.has(link) && queue.length < MAX_PAGES_PER_SOURCE * 5) {
              queue.push(link);
            }
          }

          continue;
        }

        let rawText = "";
        let pageTitle = "";

        if (pdf) {
          rawText = pageUrl;
          pageTitle = pageUrl;
        } else {
          rawText = stripHtml(html);
          pageTitle = getTitle(html);

          const foundLinks = extractLinks(html, pageUrl);
          debug.internalLinks += foundLinks.length;

          for (const link of foundLinks) {
            if (!visited.has(link) && queue.length < MAX_PAGES_PER_SOURCE * 5) {
              queue.push(link);
            }
          }

          if (
            shouldExtractExternalLinks({
              rawText,
              pageTitle,
              pageUrl,
              sourceName: source.name,
            })
          ) {
            const externalLinks = extractExternalCandidateLinks(html, pageUrl);
            debug.externalLinks += externalLinks.length;

            for (const externalLink of externalLinks) {
              if (
                !visited.has(externalLink) &&
                queue.length < MAX_PAGES_PER_SOURCE * 5
              ) {
                queue.push(externalLink);
              }
            }
          }
        }

        const target = isTargetPage({
          rawText,
          pageTitle,
          pageUrl,
          sourceName: source.name,
        });

        if (!target) {
          debug.targetRejected += 1;
          continue;
        }

        const priority = getPagePriority({
          rawText,
          pageTitle,
          pageUrl,
        });

        if (priority.priority <= 0) {
          debug.priorityRejected += 1;
          continue;
        }

        candidates.push({
          pageUrl,
          pageTitle,
          rawText,
          html,
          status: fetched.status,
          contentType: fetched.contentType,
          pdf,
          priority: candidateSortScore({
            pageUrl,
            pageTitle,
            rawText,
            html,
            status: fetched.status,
            contentType: fetched.contentType,
            pdf,
            priority: priority.priority,
            reason: priority.reason,
          }),
          reason: priority.reason,
        });

        debug.candidates += 1;
      }

      const uniqueByDuplicateKey = new Map<string, CandidatePage>();

      for (const candidate of candidates) {
        const title = buildTitle(
          candidate.pageTitle,
          source.name,
          candidate.rawText,
          candidate.pageUrl,
        );

        const eventDate = safeDate(extractDateNearKeyword(candidate.rawText));

        const key = buildDuplicateKey({
          title,
          organizationName: source.name,
          eventDate,
        });

        const existing = uniqueByDuplicateKey.get(key);

        if (!existing || candidate.priority > existing.priority) {
          uniqueByDuplicateKey.set(key, candidate);
        }
      }

      debug.uniqueCandidates = uniqueByDuplicateKey.size;

      const selectedCandidates = Array.from(uniqueByDuplicateKey.values())
        .sort((a, b) => {
          if (b.priority !== a.priority) return b.priority - a.priority;
          return b.pageUrl.length - a.pageUrl.length;
        })
        .slice(0, MAX_EVENTS_PER_SOURCE);

      debug.selected = selectedCandidates.length;

      for (const candidate of selectedCandidates) {
        const result = await saveCandidateEvent({
          supabase,
          source,
          candidate,
        });

        if (result.pageSaved) savedPages += 1;

        if (result.inserted) {
          insertedEvents += 1;
          sourceInsertedEvents += 1;
        }

        if (result.updated) {
          updatedEvents += 1;
          sourceUpdatedEvents += 1;
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
            fetched_pages: sourceFetchedPages,
            inserted_events: sourceInsertedEvents,
            updated_events: sourceUpdatedEvents,
            candidate_count: candidates.length,
            rejected_count: debug.targetRejected + debug.priorityRejected,
            debug_message: JSON.stringify(debug),
            error_message:
              candidates.length > 0 ? null : "No target candidates found",
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
            candidate_count: 0,
            rejected_count: debug.targetRejected + debug.priorityRejected,
            debug_message: JSON.stringify(debug),
          })
          .eq("id", logId);
      }
    }
  }

  return Response.json({
    ok: errors.length === 0,
    sourceCount: sources?.length ?? 0,
    offset,
    nextOffset: sources?.length ? offset + 1 : null,
    remainingLimit: Math.max(limit - 1, 0),
    fetchedPages,
    savedPages,
    insertedEvents,
    updatedEvents,
    errors,
  });
});