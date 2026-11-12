import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("the home explains the service without the old empty counts", () => {
  const files = [
    "app/page.tsx",
    "app/components/home/HomeHero.tsx",
    "app/components/home/HomeEntryCards.tsx",
    "app/components/home/HomeSchedule.tsx",
    "app/components/home/HomeRegisterPrompt.tsx",
    "app/components/home/HomeHelp.tsx",
    "app/components/home/AnnualReportBanner.tsx",
    "app/home/components/SelectionSection.tsx",
    "app/components/AppHeader.tsx",
    "app/components/AppTabNav.tsx",
    "app/layout.tsx",
  ].map(read);
  const source = files.join("\n");

  assert.match(read("app/components/AppHeader.tsx"), /練習試合とセレクション/);
  assert.doesNotMatch(read("app/components/AppHeader.tsx"), /Soccer Match/);
  const labels = [
    ...read("app/components/AppTabNav.tsx").matchAll(/label:\s*"([^"]+)"/g),
  ].map((match) => match[1]);
  assert.deepEqual(labels, ["ホーム", "チャット", "マイページ"]);
  assert.match(read("app/layout.tsx"), /セレクション情報もまとめて確認できます/);
  assert.match(source, /練習試合の相手が見つかる、/);
  assert.match(source, /無料ではじめる/);
  assert.match(source, /ログインすると、自分の試合予定がここに表示されます/);
  assert.match(source, /まだ予定はありません。/);
  assert.match(source, /まずはチームを登録しましょう/);
  assert.match(source, /ログインしてチームを登録する/);
  assert.match(source, /練習試合を探すか、募集を出す/);
  assert.match(source, /チャットで日程を調整する/);
  assert.match(source, /報告を開く/);
  assert.doesNotMatch(source, /対象チーム数/);
  assert.doesNotMatch(source, /掲載件数/);
  assert.doesNotMatch(source, /カレンダーと絞り込み/);
  assert.doesNotMatch(source, /0件/);
});

test("signed-out help starts open and signed-in home leads with the report", () => {
  const page = read("app/page.tsx");
  const signedOut = page.slice(page.indexOf("signed-out-home"), page.indexOf("signed-in-home"));
  const signedIn = page.slice(page.indexOf("signed-in-home"));

  assert.match(signedOut, /guideInitiallyOpen=\{true\}/);
  assert.ok(signedOut.indexOf("<HomeHero") < signedOut.indexOf("<HomeEntryCards"));
  assert.ok(signedOut.indexOf("<HomeEntryCards") < signedOut.indexOf("<HomeSchedule"));

  assert.match(signedIn, /guideInitiallyOpen=\{false\}/);
  const banner = signedIn.indexOf("<AnnualReportBanner");
  const schedule = signedIn.indexOf("<HomeSchedule");
  const cards = signedIn.indexOf("<HomeEntryCards");
  assert.ok(banner !== -1 && banner < schedule && schedule < cards);
});

test("the report banner reuses the official-results API and does not query tables itself", () => {
  const banner = read("app/components/home/AnnualReportBanner.tsx");
  assert.match(banner, /\/api\/official-results/);
  assert.doesNotMatch(banner, /official_result_/);
  assert.doesNotMatch(banner, /\.from\(/);
});
