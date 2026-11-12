import {
  isLeagueDivision,
  isLeagueLevel,
  type LeagueLevelId,
} from "../../app/match/constants/strengthGuides.ts";
import {
  isAffiliationCategory,
  isAffiliationPrefecture,
  type AffiliationCategory,
  type AffiliationPrefecture,
} from "./catalog.ts";

export type AffiliationDraft = {
  none: boolean;
  prefecture: string;
  category: string;
  organizationName: string;
  leagueLevel?: string;
  leagueDivision?: string;
};

export type AffiliationLeague = {
  leagueLevel: LeagueLevelId | null;
  leagueDivision: number | null;
};

export type AffiliationValue =
  | { status: "none" }
  | ({
      status: "affiliated";
      prefecture: AffiliationPrefecture;
      category: AffiliationCategory;
      organizationName: string;
    } & AffiliationLeague);

function leagueFromDraft(
  levelRaw: string | undefined,
  divisionRaw: string | undefined,
): { ok: true; league: AffiliationLeague } | { ok: false; message: string } {
  const leagueLevel = (levelRaw ?? "").trim();
  const divisionText = (divisionRaw ?? "").trim();
  if (!leagueLevel && !divisionText) {
    return { ok: true, league: { leagueLevel: null, leagueDivision: null } };
  }
  if (!isLeagueLevel(leagueLevel)) {
    return { ok: false, message: "リーグを選び直してください。" };
  }
  if (leagueLevel === "other") {
    return { ok: true, league: { leagueLevel, leagueDivision: null } };
  }
  if (!divisionText) {
    return { ok: false, message: "部を選んでください。" };
  }
  const division = Number(divisionText);
  if (!Number.isInteger(division) || !isLeagueDivision(division)) {
    return { ok: false, message: "部を選び直してください。" };
  }
  return { ok: true, league: { leagueLevel, leagueDivision: division } };
}

export function affiliationDraftFromBody(body: Record<string, unknown>): AffiliationDraft {
  return {
    none: body.none === true,
    prefecture: typeof body.prefecture === "string" ? body.prefecture : "",
    category: typeof body.category === "string" ? body.category : "",
    organizationName: typeof body.organizationName === "string" ? body.organizationName : "",
    leagueLevel: typeof body.leagueLevel === "string" ? body.leagueLevel : "",
    leagueDivision:
      typeof body.leagueDivision === "string"
        ? body.leagueDivision
        : typeof body.leagueDivision === "number" && Number.isInteger(body.leagueDivision)
          ? String(body.leagueDivision)
          : "",
  };
}

export function validateAffiliation(
  input: AffiliationDraft,
): { ok: true; value: AffiliationValue } | { ok: false; message: string } {
  if (input.none) return { ok: true, value: { status: "none" } };

  const prefecture = input.prefecture.trim();
  const category = input.category.trim();
  const organizationName = input.organizationName.trim().replace(/\s+/g, " ");

  if (!prefecture || !category || !organizationName) {
    return {
      ok: false,
      message: "都道府県、カテゴリ、所属リーグ・連盟名を入力してください。所属がない場合は「所属なし」を選んでください。",
    };
  }
  if (!isAffiliationPrefecture(prefecture)) {
    return { ok: false, message: "都道府県を選び直してください。" };
  }
  if (!isAffiliationCategory(category)) {
    return { ok: false, message: "カテゴリを選び直してください。" };
  }
  if (organizationName.length > 80) {
    return { ok: false, message: "所属リーグ・連盟名は80文字以内にしてください。" };
  }
  const league = leagueFromDraft(input.leagueLevel, input.leagueDivision);
  if (!league.ok) return league;
  return {
    ok: true,
    value: { status: "affiliated", prefecture, category, organizationName, ...league.league },
  };
}
