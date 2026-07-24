// @ts-nocheck
// discover-selection-pages/index.ts
// team_master のうち selection_events が1件も無いチームについて、
// Serper API (Google検索結果API) を使ってセレクション情報ページを検索し、
// team_selection_research に selection_page_url として登録する。
// 登録された行は、既存の verify-selection-domain-pages が次回実行時に拾ってクロールする。
//
// [修正] team_selection_research.team_master_id には UNIQUE制約があり、
// 既に他の経路(既存クローラー等)で行が作られているチームに対して単純な
// insert を行うと "duplicate key value violates unique constraint" で
// 全件エラーになっていた(VIVAIO船橋SC等で確認)。
// → insert を upsert(onConflict: team_master_id)に変更し、既存行があれば
//   上書きするようにした。また checked_at を明示的に null に戻すことで、
//   verify-selection-domain-pages 側の「24時間以内チェック済みはスキップ」
//   条件を回避し、次回バッチで確実に拾われるようにした。
//
// [2026-07-19 修正] リーグ順位表・大会結果まとめページを誤って候補として
//   採用してしまうバグの修正:
//   jy-soccer.jp/contents/gunma-u15-league-standings/ のような「リーグ順位表」
//   ページが、19の無関係なチーム名の候補として誤採用されていた。
//   → URLパスに順位表・結果系のキーワードを含む場合は候補から除外するように
//     isStandingsOrResultsPage() を新設した。

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY")!;
const SERPER_ENDPOINT = "https://google.serper.dev/search";

const BATCH_SIZE = 20;
const MAX_RUN_MS = 50_000;

const KNOWN_MEDIA_DOMAINS = [
  "juniorsoccer-news.com",
  "sgrum.com",
  "soccer-history.com",
  "sposearch.com",
  "spoban.com",
  "jy-soccer.jp",
];

const EXCLUDED_DOMAINS = [
  "instagram.com", "twitter.com", "x.com", "facebook.com",
  "youtube.com", "tiktok.com", "line.me",
  "wikipedia.org",
];

// [2026-07-19 追加] URLパスに含まれていたら「順位表・大会結果」ページと
// みなし、候補から除外するキーワード。
const STANDINGS_OR_RESULTS_PATH_KEYWORDS = [
  "standings", "-league-", "league-standings", "順位表", "結果速報",
  "match_report", "matchreport", "試合結果",
];

function nowIso() { return new Date().toISOString(); }
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return ""; }
}

function pathOf(url: string): string {
  try { return new URL(url).pathname.toLowerCase(); }
  catch { return ""; }
}

function isExcludedDomain(url: string): boolean {
  const host = hostOf(url);
  return EXCLUDED_DOMAINS.some((d) => host.includes(d));
}

function isKnownMediaDomain(url: string): boolean {
  const host = hostOf(url);
  return KNOWN_MEDIA_DOMAINS.some((d) => host.includes(d));
}

function isMatomeTitle(title: string): boolean {
  return /まとめ/.test(title || "");
}

// [2026-07-19 追加] URLパスから、リーグ順位表・大会結果まとめページかどうかを判定
function isStandingsOrResultsPage(url: string, title: string): boolean {
  const p = pathOf(url);
  const t = (title || "").toLowerCase();
  return STANDINGS_OR_RESULTS_PATH_KEYWORDS.some(
    (kw) => p.includes(kw.toLowerCase()) || t.includes(kw.toLowerCase())
  );
}

interface SerperResult {
  title: string;
  link: string;
  snippet?: string;
}

async function serperSearch(query: string): Promise<SerperResult[]> {
  const res = await fetch(SERPER_ENDPOINT, {
    method: "POST",
    headers: {
      "X-API-KEY": SERPER_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, gl: "jp", hl: "ja", num: 10 }),
  });
  if (!res.ok) throw new Error(`Serper API error: HTTP ${res.status}`);
  const data = await res.json();
  return (data.organic || []) as SerperResult[];
}

const SELECTION_WORDS = [
  "セレクション", "選考会", "トライアウト", "体験練習会", "体験会",
  "練習会", "選手募集", "新入団", "入団希望", "体験入団",
];
function includesSelectionWord(text: string): boolean {
  return SELECTION_WORDS.some((w) => (text || "").includes(w));
}

interface Candidate {
  url: string;
  title: string;
  score: number;
  reasons: string[];
}

function evaluateCandidates(
  results: SerperResult[],
  teamName: string,
  officialUrl: string | null,
): Candidate[] {
  const officialHost = officialUrl ? hostOf(officialUrl) : "";
  const candidates: Candidate[] = [];

  for (const r of results) {
    if (!r.link) continue;
    if (isExcludedDomain(r.link)) continue;
    if (isMatomeTitle(r.title)) continue;
    // [2026-07-19 追加] 順位表・大会結果ページを除外
    if (isStandingsOrResultsPage(r.link, r.title)) continue;

    const text = `${r.title} ${r.snippet || ""}`;
    let score = 0;
    const reasons: string[] = [];

    if (includesSelectionWord(text)) {
      score += 100;
      reasons.push("has_selection_word");
    }
    if (r.title?.includes(teamName)) {
      score += 80;
      reasons.push("title_has_team_name");
    }
    if (isKnownMediaDomain(r.link)) {
      score += 60;
      reasons.push("known_media_domain");
    }
    if (officialHost && hostOf(r.link) === officialHost) {
      score += 50;
      reasons.push("official_domain");
    }

    if (score > 0) {
      candidates.push({ url: r.link, title: r.title, score, reasons });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

async function findSelectionPageForTeam(
  teamName: string,
  prefecture: string | null,
  officialUrl: string | null,
): Promise<{ candidate: Candidate | null; queriesUsed: string[] }> {
  const queriesUsed: string[] = [];

  const q1 = `"${teamName}" ${prefecture || ""} セレクション`.trim();
  queriesUsed.push(q1);
  let results = await serperSearch(q1);
  let candidates = evaluateCandidates(results, teamName, officialUrl);
  if (candidates.length > 0 && candidates[0].score >= 100) {
    return { candidate: candidates[0], queriesUsed };
  }

  await sleep(300);

  const q2 = `"${teamName}" ${prefecture || ""} 体験練習会`.trim();
  queriesUsed.push(q2);
  results = await serperSearch(q2);
  const candidates2 = evaluateCandidates(results, teamName, officialUrl);
  candidates = [...candidates, ...candidates2].sort((a, b) => b.score - a.score);

  return { candidate: candidates.length > 0 ? candidates[0] : null, queriesUsed };
}

async function claimTeamsWithoutData(limit: number) {
  const { data: allTeams, error } = await supabase
    .from("team_master")
    .select("id, team_name, prefecture, category, official_url")
    .order("prefecture", { ascending: true });
  if (error) throw error;

  const { data: teamsWithEvents, error: err2 } = await supabase
    .from("selection_events")
    .select("team_master_id")
    .not("team_master_id", "is", null);
  if (err2) throw err2;

  const idsWithEvents = new Set((teamsWithEvents || []).map((r: any) => r.team_master_id));

  const { data: alreadyResearched, error: err3 } = await supabase
    .from("team_selection_research")
    .select("team_master_id, research_status")
    .not("team_master_id", "is", null);
  if (err3) throw err3;

  const researchedIds = new Set(
    (alreadyResearched || [])
      .filter((r: any) => r.research_status === "found_by_discovery" || r.research_status === "no_candidate_found")
      .map((r: any) => r.team_master_id)
  );

  const targets = (allTeams || []).filter(
    (t: any) => !idsWithEvents.has(t.id) && !researchedIds.has(t.id)
  );

  return targets.slice(0, limit);
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Number(body.batchSize || body.limit || BATCH_SIZE), 50);
    const startedAt = Date.now();

    const teams = await claimTeamsWithoutData(batchSize);
    if (teams.length === 0) {
      return json({ ok: true, message: "no teams to process", processed: 0 });
    }

    const results = [];
    let totalFound = 0, totalNotFound = 0, totalErrors = 0;

    for (const team of teams) {
      if (Date.now() - startedAt > MAX_RUN_MS) {
        results.push({ status: "time_limit_reached" });
        break;
      }

      try {
        const { candidate, queriesUsed } = await findSelectionPageForTeam(
          team.team_name,
          team.prefecture,
          team.official_url,
        );

        if (candidate) {
          const { error: upsertError } = await supabase
            .from("team_selection_research")
            .upsert({
              team_master_id: team.id,
              official_homepage_url: team.official_url,
              selection_page_url: candidate.url,
              target_category: team.category,
              notes: `discovered via Serper. score:${candidate.score} reasons:${candidate.reasons.join(",")} title:${candidate.title}`,
              research_status: "found_by_discovery",
              checked_by: "discover-selection-pages",
              checked_at: null,
              updated_at: nowIso(),
            }, { onConflict: "team_master_id" });

          if (upsertError) throw new Error(`upsert error: ${JSON.stringify(upsertError)}`);

          results.push({
            teamName: team.team_name,
            status: "found",
            url: candidate.url,
            score: candidate.score,
            queriesUsed,
          });
          totalFound++;
        } else {
          const { error: upsertError } = await supabase
            .from("team_selection_research")
            .upsert({
              team_master_id: team.id,
              official_homepage_url: team.official_url,
              target_category: team.category,
              notes: `no candidate found. queries:${queriesUsed.join(" | ")}`,
              research_status: "no_candidate_found",
              checked_by: "discover-selection-pages",
              checked_at: nowIso(),
              updated_at: nowIso(),
            }, { onConflict: "team_master_id" });

          if (upsertError) throw new Error(`upsert error: ${JSON.stringify(upsertError)}`);

          results.push({ teamName: team.team_name, status: "not_found", queriesUsed });
          totalNotFound++;
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        results.push({ teamName: team.team_name, status: "error", error: message });
        totalErrors++;
      }

      await sleep(500);
    }

    return json({
      ok: true,
      elapsedMs: Date.now() - startedAt,
      processed: teams.length,
      totalFound,
      totalNotFound,
      totalErrors,
      results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: message }, 500);
  }
});
