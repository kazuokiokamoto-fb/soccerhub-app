// @ts-nocheck
// audit-selection-sources/index.ts
// selection_events から「年またぎ」等の疑わしい組織を検出し、Serper検索結果を使って
// (1) DBに登録されている年とWeb検索から推定される年のズレ
// (2) DBに保存されている source_url が、そもそも正しいセレクション情報ページを
//     指しているか(検索上位結果と大きく食い違うページ・無関係なページでないか)
// の両方をチェックして data_quality_flags に記録する。
//
// [修正] 年度検出・候補URL選定の両方で「セレクション関連語を含まない結果」を
// 拾ってしまうバグを修正:
//   - FC Kanaloa B, FC HORTENCIA B 等で、「事業報告（案）」という無関係な文書の
//     年号(2022年, 2023年等)を「セレクションの年度」と誤認して year_mismatch を
//     誤検出していた。
//   - ウイングスSC 2nd で、掲示板/アグリゲーターサイト(srchrank.com)が
//     代替候補URLとして採用され、team_selection_research に投入されてしまっていた。
//   → 年度カウント・候補URL選定のどちらも、タイトル/スニペットにセレクション
//     関連語を含む結果だけを対象にするようフィルタを追加。加えて掲示板/フォーラム系
//     ドメインを候補から除外するリストを新設した。
//
// URL不一致(url_mismatch)が検出され、かつ検索上位に妥当な代替候補URLが
// 見つかった場合、その候補を team_selection_research に自動投入する(選択肢B)。
// 古い source_url・selection_events は削除せず残したまま、候補URLを
// 「次にクロールすべき対象」として追加するだけに留める。実際にその候補が
// 正しいかどうかの最終判断は、verify-selection-domain-pages が実際に
// ページ内容を読み取った上で行う(URLドメイン一致だけでは判断材料として弱いため)。
//
// Claude APIは使わず、Serperのみで完結させるルールベース版。

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY")!;
const SERPER_ENDPOINT = "https://google.serper.dev/search";

const BATCH_SIZE = 15;

// セレクション関連語(タイトル・スニペットにこれらを含む結果だけを
// 「年度検出」「候補URL選定」の対象にする)
const SELECTION_WORDS = [
  "セレクション", "選考会", "トライアウト", "体験練習会", "体験会",
  "練習会", "選手募集", "新入団", "入団希望", "体験入団", "募集",
];
function includesSelectionWord(text: string): boolean {
  return SELECTION_WORDS.some((w) => (text || "").includes(w));
}

// 代替候補URLとして採用してはいけないドメイン(SNS・動画・掲示板/アグリゲーター等)
const EXCLUDED_CANDIDATE_DOMAINS = [
  "instagram.com", "twitter.com", "x.com", "facebook.com",
  "youtube.com", "tiktok.com", "line.me", "wikipedia.org",
  // [修正] 掲示板・アグリゲーターサイトを追加。ウイングスSC 2ndで
  // srchrank.com(掲示板)が誤って代替候補として採用されたため。
  "srchrank.com", "5ch.net", "2ch.sc", "yahoo.co.jp/questions",
  "detail.chiebukuro.yahoo.co.jp",
];

function nowIso() { return new Date().toISOString(); }
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return ""; }
}

function isExcludedCandidateDomain(url: string): boolean {
  const host = hostOf(url);
  return EXCLUDED_CANDIDATE_DOMAINS.some((d) => host.includes(d));
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

// 疑わしい (organization_name, source_url) の組み合わせを検出
async function findTargets(limit: number) {
  const { data: rows, error } = await supabase
    .from("selection_events")
    .select("organization_name, source_url, event_date, team_master_id")
    .not("source_url", "is", null);
  if (error) throw error;

  const grouped = new Map<string, {
    years: Set<number>; sourceUrl: string; orgName: string; teamMasterId: string | null;
  }>();
  for (const r of rows || []) {
    const key = `${r.organization_name}|||${r.source_url}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        years: new Set(),
        sourceUrl: r.source_url,
        orgName: r.organization_name,
        teamMasterId: r.team_master_id,
      });
    }
    if (r.event_date) {
      grouped.get(key)!.years.add(new Date(r.event_date).getFullYear());
    }
  }

  // 既にフラグ済みのものは除外(重複記録を避ける)
  const { data: existingFlags } = await supabase
    .from("data_quality_flags")
    .select("organization_name, source_url");
  const flaggedKeys = new Set(
    (existingFlags || []).map((f: any) => `${f.organization_name}|||${f.source_url}`)
  );

  const targets = [];
  for (const [key, info] of grouped.entries()) {
    if (flaggedKeys.has(key)) continue;
    targets.push({
      organization_name: info.orgName,
      source_url: info.sourceUrl,
      team_master_id: info.teamMasterId,
      years: Array.from(info.years).sort(),
      hasYearSpread: info.years.size > 1,
    });
  }

  // 年またぎしているものを優先的に処理する
  targets.sort((a, b) => (b.hasYearSpread ? 1 : 0) - (a.hasYearSpread ? 1 : 0));

  return targets.slice(0, limit);
}

// タイトル・スニペットから「20XX年度」「20XX年」の年数字を全て抽出
function extractYearsFromText(text: string): number[] {
  const years: number[] = [];
  const patterns = [/20(\d{2})年度/g, /20(\d{2})年/g];
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(text)) !== null) {
      years.push(2000 + Number(m[1]));
    }
  }
  return years;
}

// 検索結果全体から、最も頻出する年を「実際の年度」として推定
// [修正] セレクション関連語を含む結果だけを対象にする。
// これが無いと「事業報告（案）」等の無関係な文書内の年号を拾ってしまう
// (FC Kanaloa B, FC HORTENCIA Bで、2022年/2023年を誤って検出した事故)。
function detectDominantYear(results: SerperResult[]): { year: number | null; evidence: string } {
  const counts = new Map<number, number>();
  const evidences: string[] = [];

  const relevantResults = results.filter((r) =>
    includesSelectionWord(`${r.title} ${r.snippet || ""}`)
  );

  for (const r of relevantResults.slice(0, 5)) {
    const text = `${r.title} ${r.snippet || ""}`;
    const years = extractYearsFromText(text);
    for (const y of years) {
      counts.set(y, (counts.get(y) || 0) + 1);
    }
    if (years.length > 0) evidences.push(`"${r.title}" → ${years.join(",")}`);
  }

  if (counts.size === 0) {
    return {
      year: null,
      evidence: relevantResults.length === 0
        ? "セレクション関連語を含む検索結果が無く、年度を判定できず"
        : "検索結果から年度を抽出できず",
    };
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  return { year: sorted[0][0], evidence: evidences.join(" / ") };
}

// DBに保存されているsource_urlが、実際に検索上位に出てくるページと
// 一致する(=そのドメインが妥当)かどうかを判定する。
// 一致しない場合、検索結果のトップ候補URLを代替案として記録する。
// [修正] 代替候補は、除外ドメインでないことに加え、セレクション関連語を
// 含む結果であることも条件にする(掲示板等の無関係なページの誤採用を防ぐ)。
function checkUrlPlausibility(
  storedUrl: string,
  searchResults: SerperResult[],
): { plausible: boolean; topResultUrl: string | null; reason: string } {
  const storedHost = hostOf(storedUrl);
  const topResults = searchResults.slice(0, 5);

  if (!storedHost) {
    return { plausible: false, topResultUrl: null, reason: "保存されているURLが不正な形式" };
  }

  const foundSameHost = topResults.some((r) => hostOf(r.link) === storedHost);

  if (foundSameHost) {
    return { plausible: true, topResultUrl: null, reason: "同ドメインが上位検索結果に存在" };
  }

  // [修正] 除外ドメインでなく、かつセレクション関連語を含む結果のみを候補にする
  const bestCandidate = topResults.find(
    (r) =>
      !isExcludedCandidateDomain(r.link) &&
      includesSelectionWord(`${r.title} ${r.snippet || ""}`)
  );

  return {
    plausible: false,
    topResultUrl: bestCandidate ? bestCandidate.link : null,
    reason: bestCandidate
      ? `保存URL(${storedHost})が上位検索結果に見当たらず。トップ候補: ${bestCandidate.link}`
      : "検索結果が乏しい、候補が全て除外ドメイン、またはセレクション関連語を含む候補が無い",
  };
}

// 代替候補URLを team_selection_research に投入する。
// 既存行があれば upsert で上書きし、checked_at を null に戻して
// verify-selection-domain-pages が次回実行時に必ず拾えるようにする。
async function submitCandidateForRecrawl(
  teamMasterId: string | null,
  candidateUrl: string,
  reason: string,
): Promise<{ submitted: boolean; skipReason?: string }> {
  if (!teamMasterId) {
    return { submitted: false, skipReason: "team_master_idが不明なため投入できず" };
  }

  const { error } = await supabase
    .from("team_selection_research")
    .upsert({
      team_master_id: teamMasterId,
      selection_page_url: candidateUrl,
      notes: `audit-selection-sourcesが検出したURL不一致の代替候補。${reason}`,
      research_status: "found_by_audit_candidate",
      checked_by: "audit-selection-sources",
      checked_at: null,
      updated_at: nowIso(),
    }, { onConflict: "team_master_id" });

  if (error) {
    return { submitted: false, skipReason: `upsert error: ${JSON.stringify(error)}` };
  }
  return { submitted: true };
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Number(body.batchSize || BATCH_SIZE), 30);

    const targets = await findTargets(batchSize);
    if (targets.length === 0) {
      return json({ ok: true, message: "no targets found", processed: 0 });
    }

    const results = [];
    for (const item of targets) {
      try {
        const query = `"${item.organization_name}" セレクション`;
        const searchResults = await serperSearch(query);

        // ① 年のミスマッチチェック
        const { year: detectedYear, evidence: yearEvidence } = detectDominantYear(searchResults);
        const yearMismatch =
          item.years.length > 0 &&
          detectedYear !== null &&
          !item.years.includes(detectedYear);

        // ② URL妥当性チェック
        const urlCheck = checkUrlPlausibility(item.source_url, searchResults);

        const hasIssue = yearMismatch || !urlCheck.plausible;

        let candidateSubmission: { submitted: boolean; skipReason?: string } | null = null;

        if (hasIssue) {
          const flagTypes: string[] = [];
          if (yearMismatch) flagTypes.push("year_mismatch_confirmed");
          if (!urlCheck.plausible) flagTypes.push("url_mismatch");

          // URL不一致で候補URLがあれば、再クロール対象として投入
          if (!urlCheck.plausible && urlCheck.topResultUrl) {
            candidateSubmission = await submitCandidateForRecrawl(
              item.team_master_id,
              urlCheck.topResultUrl,
              urlCheck.reason,
            );
          }

          const { error: insertError } = await supabase
            .from("data_quality_flags")
            .insert({
              organization_name: item.organization_name,
              source_url: item.source_url,
              flag_type: flagTypes.join(","),
              db_years: item.years,
              detected_year_from_search: detectedYear,
              search_evidence: `[年度] ${yearEvidence} / [URL] ${urlCheck.reason}` +
                (urlCheck.topResultUrl ? ` / 候補URL: ${urlCheck.topResultUrl}` : "") +
                (candidateSubmission
                  ? ` / [再クロール投入] ${candidateSubmission.submitted ? "成功" : "失敗:" + candidateSubmission.skipReason}`
                  : ""),
              reviewed: false,
              created_at: nowIso(),
            });

          if (insertError) throw new Error(`insert error: ${JSON.stringify(insertError)}`);
        } else {
          const { error: insertError } = await supabase
            .from("data_quality_flags")
            .insert({
              organization_name: item.organization_name,
              source_url: item.source_url,
              flag_type: "no_issue_found",
              db_years: item.years,
              detected_year_from_search: detectedYear,
              search_evidence: `[年度] ${yearEvidence} / [URL] ${urlCheck.reason}`,
              reviewed: true,
              created_at: nowIso(),
            });

          if (insertError) throw new Error(`insert error: ${JSON.stringify(insertError)}`);
        }

        results.push({
          organizationName: item.organization_name,
          sourceUrl: item.source_url,
          dbYears: item.years,
          detectedYear,
          yearMismatch,
          urlPlausible: urlCheck.plausible,
          suggestedUrl: urlCheck.topResultUrl,
          candidateSubmitted: candidateSubmission?.submitted ?? null,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        results.push({ organizationName: item.organization_name, status: "error", error: message });
      }

      await sleep(300);
    }

    return json({ ok: true, processed: targets.length, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: message }, 500);
  }
});
