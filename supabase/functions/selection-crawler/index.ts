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
  buildSelectionDescription,
  getSelectionKeywordStats,
  isTargetPage,
  shouldExtractExternalLinks,
} from "./classify.ts";

import { fetchHtml } from "./fetch.ts";
import { saveCandidateEvent } from "./db.ts";

function sampleText(text: string, length = 260) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, length);
}

function pushSample(arr: any[], value: any, max = 12) {
  if (arr.length < max) arr.push(value);
}

async function readJsonBody(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) return {};
    return await req.json();
  } catch {
    return {};
  }
}

function getRequestNumber(params: {
  url: URL;
  body: any;
  key: string;
  defaultValue: number;
}) {
  const fromQuery = params.url.searchParams.get(params.key);
  const fromBody = params.body?.[params.key];
  const raw = fromQuery ?? fromBody ?? params.defaultValue;
  const num = Number(raw);

  if (!Number.isFinite(num)) return params.defaultValue;
  return num;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isHttpErrorPage(pageTitle: string, rawText: string) {
  const text = `${pageTitle} ${rawText}`.toLowerCase();

  return (
    text.includes("404 not found") ||
    text.includes("403 forbidden") ||
    text.includes("not found") ||
    text.includes("forbidden") ||
    pageTitle.includes("404") ||
    pageTitle.includes("403") ||
    pageTitle.includes("ページエラー") ||
    pageTitle.includes("お探しのページは見つかりません") ||
    pageTitle.includes("ページが見つかりません")
  );
}

function getUrlRank(pageUrl: string) {
  const url = decodeURIComponent(pageUrl.toLowerCase());

  if (url.includes("selection")) return 1;
  if (url.includes("tryout")) return 2;
  if (url.includes("trial")) return 3;
  if (url.includes("recruit")) return 4;
  if (url.includes("entry")) return 5;
  if (url.includes("boshu")) return 6;
  if (url.includes("nyudan")) return 7;
  if (url.includes("taiken")) return 8;
  if (url.includes("experience")) return 9;
  if (url.includes("/news/") || url.includes("/info/")) return 10;
  if (url.includes("/topics/") || url.includes("/information/")) return 11;
  if (url.includes("academy")) return 12;
  if (url.includes("junior") || url.includes("youth")) return 13;

  return 99;
}

function shouldRejectByKeywordStats(stats: any) {
  if (stats.isHttpErrorPage) return "http_error_page";

  if (stats.isHardBlockedUrl && !stats.isStrongArticleUrl) {
    return "hard_blocked_url";
  }

  if (
    stats.negativeCount >= 2 &&
    stats.strongCount === 0 &&
    stats.recruitCount === 0
  ) {
    return "negative_context";
  }

  if (stats.keywordCount <= 0) return "no_keyword";

  if (
    stats.isIndexLikeUrl &&
    stats.titleStrongCount === 0 &&
    stats.strongCount === 0 &&
    stats.recruitCount < 2 &&
    stats.keywordCount < 18
  ) {
    return "index_like_url";
  }

  return null;
}

function buildReason(stats: any) {
  if (stats.titleStrongCount >= 1) return "title_selection_keyword";

  if (stats.isStrongArticleUrl && stats.strongCount >= 1) {
    return "article_url_with_selection_keyword";
  }

  if (stats.isSelectionLikeUrl && stats.strongCount >= 1) {
    return "selection_like_url_with_selection_keyword";
  }

  if (stats.isSelectionLikeUrl) return "selection_like_url";
  if (stats.strongCount >= 1) return "selection_keyword";
  if (stats.recruitCount >= 2) return "recruit_keywords";

  return "keyword_match";
}

function makeCandidateSortKey(candidate: CandidatePage) {
  const stats = candidate.keywordStats ?? {};

  return {
    urlRank: getUrlRank(candidate.pageUrl),
    titleStrongCount: stats.titleStrongCount ?? 0,
    strongCount: stats.strongCount ?? 0,
    recruitCount: stats.recruitCount ?? 0,
    scheduleCount: stats.scheduleCount ?? 0,
    applicationCount: stats.applicationCount ?? 0,
    hasDate: stats.hasDate ? 1 : 0,
    isStrongArticleUrl: stats.isStrongArticleUrl ? 1 : 0,
    isSelectionLikeUrl: stats.isSelectionLikeUrl ? 1 : 0,
    urlLength: candidate.pageUrl.length,
  };
}

function compareCandidates(a: CandidatePage, b: CandidatePage) {
  const ka = makeCandidateSortKey(a);
  const kb = makeCandidateSortKey(b);

  const aTitle = a.pageTitle || "";
  const bTitle = b.pageTitle || "";

  const aUrl = decodeURIComponent(a.pageUrl.toLowerCase());
  const bUrl = decodeURIComponent(b.pageUrl.toLowerCase());

  const aHasSelectionTitle =
    aTitle.includes("セレクション") ||
    aTitle.includes("選考会") ||
    aTitle.includes("トライアウト");

  const bHasSelectionTitle =
    bTitle.includes("セレクション") ||
    bTitle.includes("選考会") ||
    bTitle.includes("トライアウト");

  if (aHasSelectionTitle !== bHasSelectionTitle) {
    return bHasSelectionTitle ? 1 : -1;
  }

  const aPdf = isPdfUrl(a.pageUrl);
  const bPdf = isPdfUrl(b.pageUrl);

  if (aPdf !== bPdf) {
    return bPdf ? 1 : -1;
  }

  if (kb.isStrongArticleUrl !== ka.isStrongArticleUrl) {
    return kb.isStrongArticleUrl - ka.isStrongArticleUrl;
  }

  const aSelectionUrl =
    aUrl.includes("selection") ||
    aUrl.includes("tryout") ||
    aUrl.includes("recruit") ||
    aUrl.includes("boshu");

  const bSelectionUrl =
    bUrl.includes("selection") ||
    bUrl.includes("tryout") ||
    bUrl.includes("recruit") ||
    bUrl.includes("boshu");

  if (aSelectionUrl !== bSelectionUrl) {
    return bSelectionUrl ? 1 : -1;
  }

  if (kb.applicationCount !== ka.applicationCount) {
    return kb.applicationCount - ka.applicationCount;
  }

  if (kb.scheduleCount !== ka.scheduleCount) {
    return kb.scheduleCount - ka.scheduleCount;
  }

  if (kb.hasDate !== ka.hasDate) {
    return kb.hasDate - ka.hasDate;
  }

  if (kb.recruitCount !== ka.recruitCount) {
    return kb.recruitCount - ka.recruitCount;
  }

  if (kb.strongCount !== ka.strongCount) {
    return kb.strongCount - ka.strongCount;
  }

  const aFixed =
    aUrl.endsWith("/academy/") ||
    aUrl.endsWith("/school/") ||
    aUrl.endsWith("/junior/") ||
    aUrl.endsWith("/junioryouth/") ||
    aUrl.endsWith("/youth/");

  const bFixed =
    bUrl.endsWith("/academy/") ||
    bUrl.endsWith("/school/") ||
    bUrl.endsWith("/junior/") ||
    bUrl.endsWith("/junioryouth/") ||
    bUrl.endsWith("/youth/");

  if (aFixed !== bFixed) {
    return aFixed ? 1 : -1;
  }

  if (ka.urlRank !== kb.urlRank) {
    return ka.urlRank - kb.urlRank;
  }

  return kb.urlLength - ka.urlLength;
}

serve(async (req) => {
  const url = new URL(req.url);
  const body = await readJsonBody(req);

  const offset = Math.max(
    getRequestNumber({
      url,
      body,
      key: "offset",
      defaultValue: 0,
    }),
    0,
  );

  const requestedLimit = getRequestNumber({
    url,
    body,
    key: "limit",
    defaultValue: 1,
  });

  const limit = clampNumber(requestedLimit, 1, 5);

  const requestedMaxPagesPerSource = getRequestNumber({
    url,
    body,
    key: "maxPagesPerSource",
    defaultValue: 30,
  });

  const maxPagesPerSource = clampNumber(
    requestedMaxPagesPerSource,
    10,
    Math.min(MAX_PAGES_PER_SOURCE, 60),
  );

  const queueMaxSize = maxPagesPerSource * 3;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("SB_URL");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SB_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { ok: false, error: "Missing env" },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: sources, error } = await supabase
    .from("selection_sources")
    .select("id,name,base_url,organization_type,source_rank,enabled")
    .eq("enabled", true)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    return Response.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  let fetchedPages = 0;
  let savedPages = 0;
  let insertedEvents = 0;
  let updatedEvents = 0;

  const errors: string[] = [];
  const debugBySource: any[] = [];

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
      sourceName: source.name,
      baseUrl: source.base_url,
      queued: 0,
      fetched: 0,
      maxPagesPerSource,
      sitemapLinks: 0,
      internalLinks: 0,
      externalLinks: 0,
      targetRejected: 0,
      keywordRejected: 0,
      candidates: 0,
      uniqueCandidates: 0,
      selected: 0,
      saved: 0,
      inserted: 0,
      updated: 0,
      targetRejectedSamples: [],
      keywordRejectedSamples: [],
      candidateSamples: [],
      selectedSamples: [],
      saveErrors: [],
    };

    try {
      const seedUrls = buildSeedUrls(source.base_url);
      const queue = [...seedUrls].slice(0, queueMaxSize);

      const visited = new Set<string>();
      const candidates: CandidatePage[] = [];

      debug.queued = queue.length;

      while (queue.length > 0 && visited.size < maxPagesPerSource) {
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
        } catch (e) {
          pushSample(debug.targetRejectedSamples, {
            pageUrl,
            reason: "fetch_failed",
            error: e instanceof Error ? e.message : String(e),
          });

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
          isPdfUrl(pageUrl) ||
          String(fetched.contentType || "").includes("pdf");

        const sitemap =
          isSitemapUrl(pageUrl) ||
          String(fetched.contentType || "").includes("xml") ||
          String(fetched.contentType || "").includes("text/xml");

        const html = fetched.html || "";

        if (sitemap && html) {
          const sitemapLinks = extractSitemapUrls(html, pageUrl);

          debug.sitemapLinks += sitemapLinks.length;

          for (const link of sitemapLinks) {
            if (!visited.has(link) && queue.length < queueMaxSize) {
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
            if (!visited.has(link) && queue.length < queueMaxSize) {
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
            const externalLinks = extractExternalCandidateLinks(
              html,
              pageUrl,
            );

            debug.externalLinks += externalLinks.length;

            for (const externalLink of externalLinks) {
              if (
                !visited.has(externalLink) &&
                queue.length < queueMaxSize
              ) {
                queue.push(externalLink);
              }
            }
          }
        }

        if (isHttpErrorPage(pageTitle, rawText)) {
          debug.targetRejected += 1;

          pushSample(debug.targetRejectedSamples, {
            pageUrl,
            pageTitle,
            reason: "http_error_page",
            textSample: sampleText(rawText),
          });

          continue;
        }

        const stats = getSelectionKeywordStats({
          rawText,
          pageTitle,
          pageUrl,
          sourceName: source.name,
        });

        const rejectReason = shouldRejectByKeywordStats(stats);

        if (rejectReason) {
          debug.keywordRejected += 1;

          pushSample(debug.keywordRejectedSamples, {
            pageUrl,
            pageTitle,
            reason: rejectReason,
            keywordCount: stats.keywordCount,
            titleStrongCount: stats.titleStrongCount,
            strongCount: stats.strongCount,
            recruitCount: stats.recruitCount,
            textSample: sampleText(rawText),
          });

          continue;
        }

        const target = isTargetPage({
          rawText,
          pageTitle,
          pageUrl,
          sourceName: source.name,
        });

        if (!target) {
          debug.targetRejected += 1;

          pushSample(debug.targetRejectedSamples, {
            pageUrl,
            pageTitle,
            reason: "not_target_page",
            keywordCount: stats.keywordCount,
            titleStrongCount: stats.titleStrongCount,
            strongCount: stats.strongCount,
            recruitCount: stats.recruitCount,
            textSample: sampleText(rawText),
          });

          continue;
        }

        const description = buildSelectionDescription({
          rawText,
          pageTitle,
          maxLength: 180,
        });

        const candidate = {
          pageUrl,
          pageTitle,
          rawText,
          html,
          status: fetched.status,
          contentType: fetched.contentType,
          pdf,
          priority: 0,
          reason: buildReason(stats),
          keywordStats: stats,
          description,
          summary: description,
        };

        candidates.push(candidate);

        debug.candidates += 1;

        pushSample(debug.candidateSamples, {
          pageUrl,
          pageTitle,
          reason: candidate.reason,
          keywordCount: stats.keywordCount,
          titleStrongCount: stats.titleStrongCount,
          strongCount: stats.strongCount,
          recruitCount: stats.recruitCount,
          description,
          textSample: sampleText(rawText),
        });
      }

      const uniqueByDuplicateKey = new Map<string, CandidatePage>();

      for (const candidate of candidates) {
        const title = buildTitle(
          candidate.pageTitle,
          source.name,
          candidate.rawText,
          candidate.pageUrl,
        );

        const eventDate = safeDate(
          extractDateNearKeyword(candidate.rawText),
        );

        const key = buildDuplicateKey({
          title,
          organizationName: source.name,
          eventDate,
        });

        const existing = uniqueByDuplicateKey.get(key);

        if (!existing || compareCandidates(candidate, existing) < 0) {
          uniqueByDuplicateKey.set(key, candidate);
        }
      }

      debug.uniqueCandidates = uniqueByDuplicateKey.size;

      const selectedCandidates = Array.from(
        uniqueByDuplicateKey.values(),
      )
        .sort(compareCandidates)
        .slice(0, MAX_EVENTS_PER_SOURCE);

      debug.selected = selectedCandidates.length;

      for (const candidate of selectedCandidates) {
        pushSample(debug.selectedSamples, {
          pageUrl: candidate.pageUrl,
          pageTitle: candidate.pageTitle,
          reason: candidate.reason,
          keywordCount: candidate.keywordStats?.keywordCount,
          titleStrongCount: candidate.keywordStats?.titleStrongCount,
          strongCount: candidate.keywordStats?.strongCount,
          recruitCount: candidate.keywordStats?.recruitCount,
          description: candidate.description,
          textSample: sampleText(candidate.rawText),
        });

        try {
          const result = await saveCandidateEvent({
            supabase,
            source,
            candidate,
          });

          if (result.pageSaved) {
            savedPages += 1;
            debug.saved += 1;
          }

          if (result.inserted) {
            insertedEvents += 1;
            sourceInsertedEvents += 1;
            debug.inserted += 1;
          }

          if (result.updated) {
            updatedEvents += 1;
            sourceUpdatedEvents += 1;
            debug.updated += 1;
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);

          pushSample(debug.saveErrors, {
            pageUrl: candidate.pageUrl,
            pageTitle: candidate.pageTitle,
            error: message,
          });

          errors.push(
            `${source.name}: ${candidate.pageUrl}: ${message}`,
          );
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
            success: errors.length === 0,
            fetched_pages: sourceFetchedPages,
            inserted_events: sourceInsertedEvents,
            updated_events: sourceUpdatedEvents,
            candidate_count: candidates.length,
            rejected_count:
              debug.targetRejected + debug.keywordRejected,
            debug_message: JSON.stringify(debug),
            error_message:
              candidates.length > 0
                ? null
                : "No target candidates found",
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
            rejected_count:
              debug.targetRejected + debug.keywordRejected,
            debug_message: JSON.stringify(debug),
          })
          .eq("id", logId);
      }
    }

    debugBySource.push(debug);
  }

  return Response.json({
    ok: errors.length === 0,
    sourceCount: sources?.length ?? 0,
    offset,
    nextOffset: sources?.length
      ? offset + sources.length
      : null,
    requestedLimit,
    appliedLimit: limit,
    maxPagesPerSource,
    remainingLimit: Math.max(
      limit - (sources?.length ?? 0),
      0,
    ),
    fetchedPages,
    savedPages,
    insertedEvents,
    updatedEvents,
    errors,
    debugBySource,
  });
});