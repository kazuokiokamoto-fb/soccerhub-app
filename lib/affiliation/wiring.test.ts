import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("registration requires the affiliation step and still offers 所属なし", () => {
  const page = read("app/teams/new/page.tsx");
  assert.match(page, /AffiliationStep/);
  assert.match(page, /次へ（所属）/);
  assert.match(page, /\/api\/team-affiliation/);
  const step = read("app/components/affiliation/AffiliationStep.tsx");
  assert.match(step, /所属なし/);
  assert.match(step, /都道府県/);
  assert.match(step, /所属リーグ・連盟名/);
  assert.match(step, /LEAGUE_LEVELS/);
  assert.match(step, /LEAGUE_DIVISIONS/);
  assert.match(step, /RankSuggestion/);
  const guides = read("app/match/constants/strengthGuides.ts");
  assert.match(guides, /都・県リーグ/);
  assert.match(guides, /地域リーグ/);
  assert.match(guides, /リーグなし・その他/);
  assert.match(read("app/components/RankSuggestion.tsx"), /所属からの目安/);
  const card = read("app/mypage/MyPageTeamCard.tsx");
  const detail = card.indexOf("詳細");
  const affiliation = card.indexOf("/affiliation");
  const more = card.indexOf('label="その他"');
  assert.ok(detail !== -1 && affiliation !== -1 && more !== -1);
  assert.ok(detail < affiliation && affiliation < more);
  assert.equal(card.slice(more).includes("/affiliation"), false);
  assert.match(read("app/mypage/page.tsx"), /MyPageTeamCard/);
  const save = read("app/lib/server/affiliation.ts");
  const saveFn = save.slice(
    save.indexOf("export async function saveAffiliation"),
    save.indexOf("export async function applySuggestedRank"),
  );
  assert.match(saveFn, /league_level/);
  assert.doesNotMatch(saveFn, /strength_rank/);
  assert.match(save, /export async function applySuggestedRank/);
});

test("the home prompt sits under the report banner and does not block the schedule", () => {
  const page = read("app/page.tsx");
  const signedIn = page.slice(page.indexOf("signed-in-home"));
  const banner = signedIn.indexOf("<AnnualReportBanner");
  const prompt = signedIn.indexOf("<AffiliationPrompt");
  const schedule = signedIn.indexOf("<HomeSchedule");
  assert.ok(banner !== -1 && prompt !== -1 && schedule !== -1);
  assert.ok(banner < prompt && prompt < schedule);
  const promptFile = read("app/components/home/AffiliationPrompt.tsx");
  assert.match(promptFile, /今は閉じる/);
  assert.match(promptFile, /ResultsUrlPrompt/);
  assert.doesNotMatch(promptFile, /blocksProduct:\s*true/);
  assert.match(read("app/components/affiliation/ResultsUrlPrompt.tsx"), /結果ページのURLを教えてください/);
});
