import { createHash } from "node:crypto";
import { dateInFiscalYear, isRealIsoDate } from "./fiscal.ts";
import { containsPersonalMarker, normalizeTeamName } from "./text.ts";

export type SourceCandidate = {
  competitionName: string | null;
  opponentName: string | null;
  playedOn: string | null;
  teamGoals: number;
  opponentGoals: number;
  excerpt: string;
  matchBasis: string;
  fingerprint: string;
};

export type PageExtraction = {
  pageTitle: string | null;
  matchConfidence:
    | "not_evaluated"
    | "team_and_year_seen"
    | "team_or_year_missing"
    | "no_explicit_results";
  note: string;
  candidates: SourceCandidate[];
};

const SCORE = /(?<!\d)(\d{1,2})\s*[-–—−:：]\s*(\d{1,2})(?!\d)/;
const DATE = /(\d{4})[.\/年-](\d{1,2})[.\/月-](\d{1,2})日?/;
const OPPONENT = /(?:対|vs\.?|VS)\s*([^\d\n]{2,40})/;
const COMPETITION = /大会|リーグ|カップ|選手権|トーナメント/;

function pageTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]{0,200})<\/title>/i);
  if (!match) return null;
  const title = decode(match[1]).replace(/\s+/g, " ").trim().slice(0, 120);
  return title || null;
}

function decode(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, digits: string) => {
      const code = Number(digits);
      return code > 31 && code < 0x110000 ? String.fromCodePoint(code) : " ";
    });
}

function visibleText(html: string): string {
  const withoutCode = html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "\n");
  return decode(withoutCode).replace(/[ \t\f\v]+/g, " ");
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function fingerprint(candidate: Omit<SourceCandidate, "fingerprint" | "matchBasis">): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        candidate.excerpt,
        candidate.teamGoals,
        candidate.opponentGoals,
        candidate.playedOn,
        candidate.opponentName,
        candidate.competitionName,
      ]),
    )
    .digest("hex");
}

export function extractOfficialCandidates(input: {
  html: string;
  teamName: string;
  reportingYear: number;
}): PageExtraction {
  const title = pageTitle(input.html);
  const text = visibleText(input.html);
  const normalizedTeam = normalizeTeamName(input.teamName);
  const yearText = String(input.reportingYear);
  const teamSeen = normalizedTeam.length >= 2 && normalizeTeamName(text).includes(normalizedTeam);
  const yearSeen = new RegExp(`(?<!\\d)${yearText}年度(?!\\d)|(?<!\\d)${yearText}(?!\\d)`).test(text);

  if (!teamSeen || !yearSeen) {
    return {
      pageTitle: title,
      matchConfidence: "team_or_year_missing",
      note: teamSeen
        ? "対象年がページ本文から確認できなかったため、得点は候補にしていません。"
        : "チーム名がページ本文から確認できなかったため、得点は候補にしていません。",
      candidates: [],
    };
  }

  const titleCompetition =
    title && COMPETITION.test(title) && (title.includes(`${yearText}年度`) || title.includes(yearText))
      ? title.slice(0, 80)
      : null;
  const candidates: SourceCandidate[] = [];
  const seen = new Set<string>();

  for (const rawLine of text.split(/\n+/)) {
    if (candidates.length >= 30) break;
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (line.length < 3 || line.length > 240) continue;
    if (containsPersonalMarker(line)) continue;
    if (!/\p{L}/u.test(line)) continue;

    const score = line.match(SCORE);
    if (!score) continue;
    const teamGoals = Number(score[1]);
    const opponentGoals = Number(score[2]);
    if (teamGoals > 20 || opponentGoals > 20) continue;

    const date = line.match(DATE);
    let playedOn: string | null = null;
    if (date) {
      const month = Number(date[2]);
      const day = Number(date[3]);
      const iso = `${date[1]}-${pad(month)}-${pad(day)}`;
      if (!isRealIsoDate(iso) || !dateInFiscalYear(iso, input.reportingYear)) continue;
      playedOn = iso;
    }

    const opponentMatch = line.match(OPPONENT);
    let opponentName: string | null = null;
    if (opponentMatch) {
      const cleaned = opponentMatch[1].replace(/[（(].*$/, "").trim().slice(0, 80);
      if (
        /\p{L}/u.test(cleaned) &&
        normalizeTeamName(cleaned) !== normalizedTeam &&
        !containsPersonalMarker(cleaned)
      ) {
        opponentName = cleaned;
      }
    }

    const basis = [
      "ページ内にチーム名と対象年があり、同じ行の明示されたスコアを写しました。",
      titleCompetition ? "ページ題名を大会名の候補にしました。" : "大会名はページから特定していません。",
      opponentName ? "同じ行の対またはvsから対戦相手を写しました。" : "対戦相手は特定していません。",
    ].join("");

    const draft = {
      competitionName: titleCompetition,
      opponentName,
      playedOn,
      teamGoals,
      opponentGoals,
      excerpt: line.slice(0, 240),
      matchBasis: basis,
    };
    const id = fingerprint(draft);
    if (seen.has(id)) continue;
    seen.add(id);
    candidates.push({ ...draft, fingerprint: id });
  }

  if (candidates.length === 0) {
    return {
      pageTitle: title,
      matchConfidence: "no_explicit_results",
      note: "チーム名と対象年は見ましたが、明示されたスコア行はありませんでした。",
      candidates: [],
    };
  }

  return {
    pageTitle: title,
    matchConfidence: "team_and_year_seen",
    note: "取得したスコア行は下書き候補です。チームの提出ではありません。",
    candidates,
  };
}
