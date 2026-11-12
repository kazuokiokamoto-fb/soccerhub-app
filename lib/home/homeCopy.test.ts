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

  assert.match(read("app/components/AppHeader.tsx"), /練習試合マッチング/);
  assert.match(read("app/components/AppHeader.tsx"), /セレクション検索/);
  assert.doesNotMatch(read("app/components/AppHeader.tsx"), /Soccer Match/);
  const labels = [
    ...read("app/components/AppTabNav.tsx").matchAll(/label:\s*"([^"]+)"/g),
  ].map((match) => match[1]);
  assert.deepEqual(labels, ["ホーム", "チャット", "マイページ"]);
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

test("site metadata centers the hub on practice matches and names selection separately", () => {
  const hubDescription =
    "練習試合マッチングです。相手を探して、募集して、チャットで調整できます。";
  const selectionDescription =
    "セレクション検索。気になるチームのセレクションを探せます。";
  const layout = read("app/layout.tsx");
  const manifest = read("app/manifest.ts");
  const publicManifest = read("public/manifest.webmanifest");
  const selectionLayout = read("apps/selection/app/layout.tsx");
  const selectionManifest = read("apps/selection/app/manifest.ts");
  const selectionList = read("app/selection/page.tsx");
  const selectionDetail = read("app/selection/[id]/page.tsx");

  for (const source of [layout, manifest, publicManifest]) {
    assert.match(source, new RegExp(hubDescription));
    assert.doesNotMatch(source, /セレクション情報もまとめて確認できます/);
    assert.doesNotMatch(source, /練習試合とセレクション/);
    assert.doesNotMatch(source, /サッカー練習試合をもっと簡単に/);
  }

  assert.match(layout, /openGraph:\s*\{[^}]*description: hubDescription/s);
  assert.match(layout, /twitter:\s*\{[^}]*description: hubDescription/s);
  assert.match(manifest, /name:\s*"サカまっち"/);
  assert.match(manifest, /short_name:\s*"サカまっち"/);

  for (const source of [selectionLayout, selectionList, selectionDetail]) {
    assert.match(source, /title:\s*"セレクション検索"/);
    assert.match(source, new RegExp(selectionDescription));
    assert.match(source, /openGraph:\s*\{[^}]*title:\s*"セレクション検索"/s);
    assert.match(source, /twitter:\s*\{[^}]*title:\s*"セレクション検索"/s);
    assert.doesNotMatch(source, /練習試合とセレクション/);
    assert.doesNotMatch(source, /セレクション情報もまとめて確認できます/);
    assert.doesNotMatch(source, /title:\s*"セレクション"(?!検索)/);
  }

  assert.match(selectionManifest, /name:\s*"セレクション検索"/);
  assert.match(selectionManifest, /short_name:\s*"セレクション検索"/);
  assert.match(selectionManifest, new RegExp(selectionDescription));
  assert.doesNotMatch(selectionManifest, /サッカー練習試合をもっと簡単に/);
  assert.doesNotMatch(selectionManifest, /練習試合とセレクション/);
  assert.doesNotMatch(selectionManifest, /name:\s*"セレクション"(?!検索)/);
});

test("the report banner reuses the official-results API and does not query tables itself", () => {
  const banner = read("app/components/home/AnnualReportBanner.tsx");
  assert.match(banner, /\/api\/official-results/);
  assert.doesNotMatch(banner, /official_result_/);
  assert.doesNotMatch(banner, /\.from\(/);
});
