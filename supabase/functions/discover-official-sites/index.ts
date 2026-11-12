// @ts-nocheck
// Finds an official website for teams whose selection URL is Instagram.
// Search is Serper (Google). Instagram is never fetched. Candidates are stored
// with a confidence score. Only a verified high-confidence homepage is written
// back, and the previous Instagram URL is kept so the change can be reversed.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createSupabaseHostStore, HostGate } from "../_shared/host-gate.ts";
import { requireSelectionSecret } from "../_shared/selection-secret.ts";
import { decideOfficialSite, scoreOfficialPage } from "../../../lib/selection-crawl/official-site.ts";
import { isPublicHttpUrl, isUncrawlableUrl, normalizeSelectionUrl } from "../../../lib/selection-crawl/urls.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SERPER_ENDPOINT = "https://google.serper.dev/search";
const BATCH_SIZE = 2;
const MAX_RUN_MS = 100_000;
const RECHECK_DAYS = 30;
const MAX_FETCHES = 3;

function nowIso() { return new Date().toISOString(); }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function pageTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
}

function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
}

async function serperSearch(query: string) {
  const key = Deno.env.get("SERPER_API_KEY");
  if (!key) throw new Error("SERPER_API_KEY missing");
  const response = await fetch(SERPER_ENDPOINT, {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl: "jp", hl: "ja", num: 8 }),
  });
  if (!response.ok) throw new Error(`Serper HTTP ${response.status}`);
  const data = await response.json();
  return (data.organic || []) as Array<{ title?: string; link?: string; snippet?: string }>;
}

async function claimInstagramTeams(limit: number) {
  const cutoff = new Date(Date.now() - RECHECK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("team_selection_research")
    .select("id, team_master_id, selection_page_url, official_homepage_url, previous_selection_page_url, notes, team_master:team_master_id(id, team_name, prefecture, official_url)")
    .ilike("selection_page_url", "%instagram.com%")
    .or(`official_site_checked_at.is.null,official_site_checked_at.lt.${cutoff}`)
    .order("official_site_checked_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function startRun(trigger: string, batchSize: number) {
  await supabase
    .from("selection_crawl_runs")
    .update({ status: "interrupted", finished_at: nowIso(), error: "worker_stopped" })
    .eq("pipeline", "discover-official-sites")
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - 3 * 60 * 1000).toISOString());
  const { data: active } = await supabase
    .from("selection_crawl_runs")
    .select("id")
    .eq("pipeline", "discover-official-sites")
    .eq("status", "running")
    .limit(1);
  if (active && active.length > 0) return { id: null, overlap: true };
  const { data, error } = await supabase
    .from("selection_crawl_runs")
    .insert({
      pipeline: "discover-official-sites",
      status: "running",
      trigger,
      batch_size: batchSize,
    })
    .select("id")
    .single();
  if (error) {
    console.error("discovery run log skipped", error.message);
    return { id: null, overlap: false };
  }
  return { id: data.id as string, overlap: false };
}

async function finishRun(runId: string | null, patch: Record<string, unknown>) {
  if (!runId) return;
  await supabase.from("selection_crawl_runs").update({ ...patch, finished_at: nowIso() }).eq("id", runId);
}

async function recordOutcome(runId: string | null, row: Record<string, unknown>) {
  if (!runId) return;
  const { error } = await supabase.from("selection_crawl_url_outcomes").insert({
    run_id: runId,
    ...row,
    finished_at: nowIso(),
  });
  if (error) console.error("discovery outcome skipped", error.message);
}

async function storeCandidate(row: Record<string, unknown>) {
  const { error } = await supabase
    .from("team_official_site_candidates")
    .upsert(row, { onConflict: "team_master_id,candidate_norm" });
  if (error) console.error("candidate save skipped", error.message);
}

async function discoverTeam(research: any, gate: HostGate, runId: string | null) {
  const team = research.team_master || {};
  const teamName = String(team.team_name || "").trim();
  const prefecture = team.prefecture || "";
  if (!teamName) {
    await supabase.from("team_selection_research").update({
      official_site_checked_at: nowIso(),
      official_site_decision: "no_candidate",
    }).eq("id", research.id);
    return { status: "no_candidate", accepted: false };
  }

  const queries = [
    `"${teamName.replace(/"/g, " ")}" ${prefecture} サッカー 公式 -site:instagram.com`.replace(/\s+/g, " ").trim(),
    `"${teamName.replace(/"/g, " ")}" 公式サイト -site:instagram.com`.replace(/\s+/g, " ").trim(),
  ];
  const seen = new Set<string>();
  const hits: Array<{ query: string; title: string; link: string; snippet: string }> = [];
  for (const query of queries) {
    if (gate.shouldStop()) throw new Error("time_budget");
    const rows = await serperSearch(query);
    for (const row of rows) {
      if (!row.link || seen.has(row.link)) continue;
      seen.add(row.link);
      hits.push({ query, title: row.title || "", link: row.link, snippet: row.snippet || "" });
    }
    const promising = hits.some((hit) => {
      const scored = scoreOfficialPage({
        url: hit.link,
        title: hit.title,
        text: hit.snippet,
        teamName,
        prefecture,
      });
      return !scored.blocked && scored.score >= 80;
    });
    if (promising) break;
  }

  const ranked = hits.map((hit) => {
    const scored = scoreOfficialPage({
      url: hit.link,
      title: hit.title,
      text: hit.snippet,
      teamName,
      prefecture,
    });
    return { ...hit, scored };
  }).sort((a, b) => b.scored.score - a.scored.score);

  const toFetch = ranked
    .filter((hit) => hit.scored.blocked === false && isPublicHttpUrl(hit.link) && !isUncrawlableUrl(hit.link))
    .slice(0, MAX_FETCHES);
  const fetched = new Map<string, { url: string; title: string; text: string; status: number; failure: string | null }>();

  for (const hit of toFetch) {
    if (gate.shouldStop()) throw new Error("time_budget");
    const result = await gate.fetch(hit.link);
    if (result.failure === "budget") throw new Error("time_budget");
    fetched.set(hit.link, {
      url: result.finalUrl || hit.link,
      title: result.ok ? pageTitle(result.html) : hit.title,
      text: result.ok ? pageText(result.html) : hit.snippet,
      status: result.status,
      failure: result.ok ? null : result.failure,
    });
  }

  const verifiedCandidates = [];
  for (const hit of toFetch) {
    const page = fetched.get(hit.link);
    if (!page || page.failure || !page.title && !page.text) continue;
    const scored = scoreOfficialPage({
      url: page.url,
      title: page.title || hit.title,
      text: page.text,
      teamName,
      prefecture,
    });
    verifiedCandidates.push({
      url: page.url,
      score: scored.score,
      reasons: scored.reasons,
      verified: true,
      blocked: scored.blocked,
    });
  }

  const decision = decideOfficialSite(teamName, verifiedCandidates);
  const acceptedUrl = decision.crawlTarget;
  const winnerUrl = decision.candidate?.url || null;

  for (const hit of ranked) {
    const page = fetched.get(hit.link);
    let rowDecision = "pending_unverified";
    let confidence = hit.scored.score;
    let finalUrl = null;
    let httpStatus = null;
    let reasons = hit.scored.reasons;
    if (hit.scored.blocked || !isPublicHttpUrl(hit.link) || isUncrawlableUrl(hit.link)) {
      rowDecision = "skipped_blocked";
      confidence = 0;
      reasons = hit.scored.reasons.length > 0 ? hit.scored.reasons : ["blocked_host"];
    } else if (page?.failure === "robots") {
      rowDecision = "robots_denied";
      finalUrl = page.url;
      httpStatus = page.status;
    } else if (page?.failure === "blocked") {
      rowDecision = "skipped_blocked";
      finalUrl = page.url;
      httpStatus = page.status;
    } else if (page?.failure) {
      rowDecision = "fetch_failed";
      finalUrl = page.url;
      httpStatus = page.status;
    } else if (page) {
      const verified = verifiedCandidates.find((candidate) => candidate.url === page.url);
      confidence = verified?.score ?? confidence;
      reasons = verified?.reasons ?? reasons;
      finalUrl = page.url;
      httpStatus = page.status;
      if (verified?.blocked) {
        rowDecision = "skipped_blocked";
        confidence = 0;
      } else {
        rowDecision = decision.decision === "auto_accept" &&
            winnerUrl &&
            normalizeSelectionUrl(page.url) === normalizeSelectionUrl(winnerUrl)
          ? "auto_accepted"
          : "pending";
      }
    }
    const isWinner = rowDecision === "auto_accepted";
    await storeCandidate({
      team_master_id: research.team_master_id,
      research_id: research.id,
      query: hit.query,
      candidate_url: hit.link,
      candidate_norm: normalizeSelectionUrl(hit.link) || hit.link,
      final_url: finalUrl,
      accepted_url: isWinner ? acceptedUrl : null,
      title: page?.title || hit.title,
      snippet: hit.snippet,
      confidence: Math.round(confidence),
      reasons,
      decision: rowDecision,
      http_status: httpStatus,
      previous_selection_page_url: isWinner ? research.selection_page_url : null,
      previous_team_official_url: isWinner ? team.official_url || null : null,
      run_id: runId,
      updated_at: nowIso(),
    });
  }

  if (decision.decision === "auto_accept" && acceptedUrl) {
    const patch: Record<string, unknown> = {
      selection_page_url: acceptedUrl,
      official_homepage_url: acceptedUrl,
      official_site_checked_at: nowIso(),
      official_site_decision: "auto_accepted",
      research_status: "official_site_auto_accepted",
      checked_at: null,
      crawl_after: null,
      checked_by: "discover-official-sites",
      notes: `公式サイトを自動採用 ${acceptedUrl} score:${decision.candidate?.score ?? ""}`,
      updated_at: nowIso(),
    };
    if (!research.previous_selection_page_url) {
      patch.previous_selection_page_url = research.selection_page_url;
    }
    const { error } = await supabase.from("team_selection_research").update(patch).eq("id", research.id);
    if (error) throw error;
    const currentOfficial = team.official_url || "";
    if (!currentOfficial || isUncrawlableUrl(currentOfficial)) {
      await supabase.from("team_master").update({ official_url: acceptedUrl }).eq("id", research.team_master_id);
    }
    return { status: "auto_accepted", accepted: true, url: acceptedUrl };
  }

  const teamDecision = ranked.length === 0 ? "no_candidate" : "pending_review";
  await supabase.from("team_selection_research").update({
    official_site_checked_at: nowIso(),
    official_site_decision: teamDecision,
    checked_by: "discover-official-sites",
  }).eq("id", research.id);
  return { status: teamDecision, accepted: false };
}

async function runDiscovery(batchSize: number, runId: string | null) {
  const gate = new HostGate(createSupabaseHostStore(supabase), Date.now() + MAX_RUN_MS);
  let attempted = 0;
  let accepted = 0;
  let failed = 0;
  if (!Deno.env.get("SERPER_API_KEY")) {
    await finishRun(runId, {
      status: "failed",
      error: "SERPER_API_KEY missing",
      urls_attempted: 0,
      urls_succeeded: 0,
      urls_failed: 0,
    });
    return { ok: false, runId, error: "SERPER_API_KEY missing" };
  }

  try {
    const teams = await claimInstagramTeams(batchSize);
    for (const research of teams) {
      if (gate.shouldStop()) break;
      attempted += 1;
      const started = nowIso();
      gate.closeVisit();
      try {
        const result = await discoverTeam(research, gate, runId);
        if (result.accepted) accepted += 1;
        await recordOutcome(runId, {
          research_id: research.id,
          team_master_id: research.team_master_id,
          url: research.selection_page_url,
          final_url: result.url || null,
          status: result.status,
          events_inserted: 0,
          events_updated: 0,
          error: null,
          started_at: started,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === "time_budget") break;
        failed += 1;
        await recordOutcome(runId, {
          research_id: research.id,
          team_master_id: research.team_master_id,
          url: research.selection_page_url,
          status: "error",
          events_inserted: 0,
          events_updated: 0,
          error: message.slice(0, 500),
          started_at: started,
        });
      }
    }
    await finishRun(runId, {
      status: "succeeded",
      urls_attempted: attempted,
      urls_succeeded: accepted,
      urls_failed: failed,
      events_inserted: 0,
      events_updated: 0,
    });
    return { ok: true, runId, attempted, accepted, failed };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishRun(runId, {
      status: "failed",
      urls_attempted: attempted,
      urls_succeeded: accepted,
      urls_failed: failed,
      error: message.slice(0, 500),
    });
    return { ok: false, runId, error: message };
  }
}

serve(async (req) => {
  const denied = requireSelectionSecret(req);
  if (denied) return denied;
  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Number(body.batchSize || body.limit || BATCH_SIZE), 4);
    const trigger = String(body.trigger || "manual");
    const run = await startRun(trigger, batchSize);
    if (run.overlap) return json({ ok: true, accepted: false, skipped: "overlap" });
    const work = runDiscovery(batchSize, run.id);
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(work);
      return json({ ok: true, accepted: true, runId: run.id });
    }
    return json(await work);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ ok: false, error: message }, 500);
  }
});
