// @ts-nocheck
// verify-selection-domain-pages/index.ts
// team_selection_research から selection_page_url を取得して直接クロール
// 複数日程対応・チームID紐付け・2段階クロール（専用ページ→ニュース記事）
// 公式サイト優先ロジック：同じチームで公式HP経由の行がある場合はそれを先に試し、
// 成功したらまとめサイト等の補完行はスキップする
// まとめサイト由来で見つかった場合も、リンク先は必ず公式サイト側に解決する（まとめサイトへは絶対にリンクしない）
// 入口ページが概要ページ（URLに日付なし）だった場合、日付入りの個別記事を優先的に探す
// 「20XX年度入団」等の入団年度ラベル、「随時募集」等の年度非依存募集を抽出する
//
// [2026-07-10 修正] event_date誤登録バグの修正:
//   従来は改行を全てスペースに潰した compactText 済みテキストを
//   extractEventDates / extractDeadline / extractVenue に渡していたため、
//   「開催日」「日程」等のキーワードを含む行だけに絞る仕組みが機能せず、
//   ページ全体が実質1行になって無関係な日付（更新日表示・フッター等、
//   クロール実行日と一致しがちな箇所）まで日程として誤抽出していた。
//   → 改行を保持した生テキスト(rawText)を別途用意し、行分割に依存する
//     抽出関数にはそちらを渡すよう修正。
//
// [2026-07-11 修正] リンク先が概要/一覧ページのままになる問題の修正:
//   従来は「概要ページ→個別記事」への深堀り探索が、URLに日付パターン
//   （/2026/0615等）を含むリンクしか候補にしていなかったため、
//   /pickup/44265/ や /page-11967/ のようなID形式のURLを使うサイトでは
//   何も見つからず、概要・一覧ページ自体がリンク先として保存されていた。
//   → findDeeperSelectionPage() として汎用化し、リンクのラベル文言に
//     セレクション関連語を含むかどうかも候補選定の基準に追加。
//   また、PDFへの直リンク（例: 募集要項PDF）にも対応。PDFは中身を解析
//   できないため、到達可能性の確認のみで採否を決め、日程等の抽出用
//   テキストは親ページ側のものを使い続けるようにした。
//
// [2026-07-16 修正①] 年度コンテキスト消失バグの修正:
//   extractEventDates は「開催日」「セレクション」等のキーワードを含む行だけを
//   抜き出し、その1行だけを extractAllDates に渡していた。しかし実際のページ
//   では「20XX年度　〇〇 体験練習会」という年度表記と、「第1回 6月21日(日)」
//   のような実際の日付が別々の行に分かれているケースが多く、行単位で処理すると
//   年度情報が失われて currentYear(クロール実行年)にフォールバックしてしまい、
//   本来2027年開催のはずのイベントが2026年として登録される事故が発生した
//   (FC HORTENCIA B 等、確認できただけで1000件超に影響)。
//   → 年度をドキュメント全体から一度だけ抽出する extractFiscalYear() を新設し、
//     extractAllDates の第2引数として明示的に渡すことで、行ごとに処理しても
//     年度コンテキストが失われないようにした。
//
// [2026-07-16 修正②] フッター「関連記事」等からの日付混入バグの修正:
//   ページ下部の「関連記事」「〇〇の記事一覧」「本日の人気の記事」「月を選択」
//   といったウィジェット/フッター領域には、他の団体の別記事のタイトルや日付が
//   大量に含まれる。これらの行は「セレクション」「体験練習会」等のキーワードを
//   含むため extractEventDates の行フィルタをすり抜け、無関係な日付が大量に
//   誤登録される原因になっていた(同一の日付セットが65〜100件以上の無関係な
//   組織に重複して現れる形で発覚)。
//   → truncateAtNoiseSection() を新設し、これらのマーカーが最初に出現する
//     位置より後ろのテキストを日付・締切・会場抽出の対象から除外するようにした。
//
// [2026-07-16 修正③] Instagram URLクロールによる日付誤抽出バグの修正:
//   selection_page_url が Instagram を指しているケースで、fetchHtml() は
//   ログイン画面/JS読み込み待ちの空シェルしか取得できないにもかかわらず、
//   ページ内の断片的なテキストが CORE_SELECTION_WORDS の判定を通過してしまい、
//   無関係な日付(17個の固定ノイズ日付セットと同じパターン)が繰り返し・年を
//   ずらしながら量産され続けていた(FC HORTENCIA関連で確認)。
//   → BAD_DOMAINS に instagram.com を追加し、クロール自体を行わないようにした。
//
// [2026-07-19 修正④] 学校サイト全体の行事予定を誤ってセレクション日程として
//   拾ってしまうバグの修正:
//   .ac.jp / .ed.jp ドメイン(大学・高校・中学の公式サイト)は、部活動固有の
//   ページではなく学校全体のトップページや行事予定表であることが多い。
//   日本大学第３中学校(nihon-u.ac.jp)で37件、明治大学明治中学校(meiji.ac.jp)で
//   8件もの日程が抽出されており、これはサッカー部の日程ではなく学校行事全般の
//   誤抽出が疑われる。
//   → 学校系ドメインかつ抽出日程が8件を超える場合は、実際の日程データは保持
//     しつつ extraction_status を "school_calendar_suspected" にし、
//     display_status を強制的に「日付未取得」にすることで、確証が持てるまで
//     ユーザーには表示しないようにした。
//
// [2026-07-19 修正⑤] まとめサイト解決後のURL固定化:
//   resolveOfficialUrl() でまとめサイトから公式サイトへのリンク解決に成功しても、
//   その結果を team_selection_research に書き戻していなかったため、毎回同じ
//   まとめサイトの解決処理をやり直す非効率な状態になっていた。
//   → 解決後のURLが元の selection_page_url と異なるドメインだった場合、
//     team_selection_research.selection_page_url をその解決済みURLで更新し、
//     次回以降は直接そこをクロールするようにした。
//
// [2026-07-19 修正⑥] 「接続確認」ページの検知強化:
//   年齢確認・Cookie同意・ブラウザ非対応通知等の中間ページを、本来のコンテンツと
//   誤認するケースがあったため、SUSPICIOUS_PAGE_PATTERNS にパターンを追加した。

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const MAX_RUN_MS = 50_000;
const FETCH_TIMEOUT_MS = 12_000;
const RECRAWL_HOURS = 24;
const BATCH_SIZE = 5;
const SITE_BASE_URL = "https://www.sakamatch.com";

const BAD_DOMAINS = [
  "youtube.com", "line.me", "google.com", "forms.gle",
  // [2026-07-16 追加] Instagramはfetchで実際の投稿内容を取得できず
  // (ログイン画面/JSシェルのみ返る)、無関係な断片から日付を誤抽出する
  // 原因になっていたため、クロール対象から除外する。
  "instagram.com",
];

const CORE_SELECTION_WORDS = [
  "セレクション", "選考会", "トライアウト", "tryout", "selection",
  "練習会", "体験練習会", "体験会", "練習参加", "体験参加",
  "選手募集", "新入団", "入団希望", "現小学6年生", "新中学1年生",
  "ジュニアユース説明会", "GK募集", "ゴールキーパー募集",
  "メンバー募集", "加入テスト", "体験入団", "新規入団", "セレクション実施",
  "入団説明会", "体験セッション", "練習体験", "新入部員募集", "選手選考",
];

const NEWS_LIST_PATTERNS = [
  "/news", "/topics", "/information", "/info", "/notice",
  "/blog", "/posts", "/articles", "/お知らせ",
];

const SOURCE_RANK_MAP: Record<string, string> = {
  "関東": "pref_top", "プリンス": "pref_top", "プレミア": "pref_top",
  "T1": "pref_top", "S1": "pref_top", "C1": "pref_top",
  "ウルトラ": "pref_top", "1部": "pref_top",
  "T2": "pref_2", "G1": "pref_2", "2部": "pref_2",
  "T3": "pref_3", "G2": "pref_3", "3部": "pref_3",
  "T4": "pref_4", "4部": "pref_4",
};

const J_CLUBS = [
  "鹿島アントラーズ", "水戸ホーリーホック", "浦和レッズ", "大宮アルディージャ",
  "柏レイソル", "ジェフユナイテッド", "FC東京", "東京ヴェルディ", "FC町田ゼルビア",
  "川崎フロンターレ", "横浜F・マリノス", "横浜FC", "湘南ベルマーレ",
  "栃木SC", "ザスパ群馬", "ヴァンフォーレ甲府",
];

const NOISE_SECTION_MARKERS = [
  "関連記事", "の記事一覧", "の最近の投稿", "本日の人気の記事",
  "今月の人気記事", "月を選択", "コメント欄", "保護者情報", "CANCEL REPLY",
  "寄稿者プロフィール", "寄稿者の最近の投稿",
];

// [2026-07-19 追加] 学校の公式ドメインパターン。これらのドメインで抽出日程が
// 多すぎる場合、学校全体の行事予定を誤って拾っている疑いがある。
const SCHOOL_GENERAL_DOMAINS_PATTERN = /\.(ac|ed)\.jp$/;
const SCHOOL_CALENDAR_SUSPECT_DATE_THRESHOLD = 8;

function isSuspiciousSchoolPage(url: string, eventDatesCount: number): boolean {
  return SCHOOL_GENERAL_DOMAINS_PATTERN.test(hostOf(url)) &&
    eventDatesCount > SCHOOL_CALENDAR_SUSPECT_DATE_THRESHOLD;
}

function nowIso() { return new Date().toISOString(); }
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function cleanForDb(text: string, max = 20000) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\u2028/g, " ").replace(/\u2029/g, " ")
    .slice(0, max);
}

function compactText(text: string, max = 12000) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function truncateAtNoiseSection(text: string): string {
  const raw = String(text || "");
  let cutIndex = raw.length;
  for (const marker of NOISE_SECTION_MARKERS) {
    const idx = raw.indexOf(marker);
    if (idx !== -1 && idx < cutIndex) cutIndex = idx;
  }
  return raw.slice(0, cutIndex);
}

function isBadDomain(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return BAD_DOMAINS.some((d) => host.includes(d));
  } catch { return true; }
}

// [2026-07-14 追加、2026-07-19 拡張] team_master の official_url が壊れている/
// 期限切れ等の理由で、本来のチームサイトではないページに着地してしまうケースを検知。
// [2026-07-19 追加] 年齢確認・Cookie同意・ブラウザ非対応通知等の「接続確認」系の
// 中間ページも同様に検知対象に追加。
const SUSPICIOUS_PAGE_PATTERNS: RegExp[] = [
  /wp-signup\.php/i,
  /そのようなサイトはありません/,
  /ページが見つかりません|お探しのページは見つかりません/,
  /404\s*not\s*found/i,
  /this\s+domain\s+(is\s+for\s+sale|may\s+be\s+for\s+sale)/i,
  /domain\s+parking/i,
  /このドメインは(現在)?(登録され)?ていません/,
  /coming\s+soon.{0,20}wordpress/i,
  // [2026-07-19 追加] 接続確認・年齢確認・Cookie同意系の中間ページ
  /年齢確認|age\s*verification/i,
  /このサイトに接続しますか|このサイトへのアクセスを続行しますか/,
  /cookieを有効に|enable\s*cookies/i,
  /このサイトはお使いのブラウザではサポートされていません/i,
  /javascriptを有効にしてください|please\s+enable\s+javascript/i,
  /このコンテンツを表示するには(ログイン|会員登録)が必要です/,
];

function isSuspiciousPage(html: string, url: string): boolean {
  if (SUSPICIOUS_PAGE_PATTERNS.some((re) => re.test(url))) return true;
  const text = stripTags(html).slice(0, 3000);
  return SUSPICIOUS_PAGE_PATTERNS.some((re) => re.test(text));
}

function includesAny(text: string, words: string[]) {
  const t = String(text || "").toLowerCase();
  return words.some((w) => t.includes(w.toLowerCase()));
}

function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return ""; }
}

function canonicalUrl(url: string) {
  try {
    const u = new URL(url);
    u.hash = "";
    ["utm_source","utm_medium","utm_campaign","fbclid"]
      .forEach(p => u.searchParams.delete(p));
    return u.toString().replace(/\/$/, "");
  } catch { return url; }
}

function pathOf(url: string) {
  try { return new URL(url).pathname.toLowerCase(); }
  catch { return ""; }
}

function decodeHtml(s: string) {
  return String(s || "")
    .replaceAll("&amp;", "&").replaceAll("&lt;", "<").replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&nbsp;", " ");
}

function stripTags(html: string) {
  return decodeHtml(
    String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n").replace(/<\/li>/gi, "\n")
      .replace(/<[^>]*>/g, " "),
  ).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function getTitle(html: string, fallback = "") {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1?.[1]) return stripTags(h1[1]).slice(0, 120);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title?.[1]) return stripTags(title[1]).slice(0, 120);
  return fallback.slice(0, 120);
}

function extractMetaDescription(html: string): string {
  const patterns = [
    /<meta\s+property=["']og:description["']\s+content=["']([\s\S]*?)["']\s*\/?>/i,
    /<meta\s+content=["']([\s\S]*?)["']\s+property=["']og:description["']\s*\/?>/i,
    /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']\s*\/?>/i,
    /<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']\s*\/?>/i,
  ];
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m?.[1]) return decodeHtml(m[1]).trim();
  }
  return "";
}

function extractLinks(html: string, baseUrl: string) {
  const links: { url: string; label: string }[] = [];
  const seen = new Set<string>();
  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = decodeHtml(m[1] || "").trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    try {
      const u = new URL(href, baseUrl);
      u.hash = "";
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      const url = canonicalUrl(u.toString());
      if (seen.has(url)) continue;
      seen.add(url);
      links.push({ url, label: stripTags(m[2] || "").trim() });
    } catch { continue; }
  }
  return links;
}

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "accept-language": "ja,en-US;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html") && !ct.includes("xhtml") && !ct.includes("text/plain")) {
      throw new Error(`not html: ${ct}`);
    }
    return { html: await res.text(), finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

async function probeUrlOk(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      },
      redirect: "follow",
    });
    if (res.ok) return true;
  } catch {
  } finally {
    clearTimeout(timer);
  }

  const controller2 = new AbortController();
  const timer2 = setTimeout(() => controller2.abort(), FETCH_TIMEOUT_MS);
  try {
    const res2 = await fetch(url, {
      signal: controller2.signal,
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      },
      redirect: "follow",
    });
    return res2.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer2);
  }
}

function isPdfUrl(url: string): boolean {
  return pathOf(url).endsWith(".pdf");
}

function hasDatePattern(url: string): boolean {
  const p = pathOf(url);
  return /(20\d{2})[\/\-]?(\d{2})[\/\-]?(\d{2})/.test(p);
}

function extractDateKeyFromUrl(url: string): string | null {
  const p = pathOf(url);
  let m = p.match(/(20\d{2})\/(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = p.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = p.match(/(20\d{2})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

async function findDeeperSelectionPage(
  html: string,
  baseUrl: string,
  parentText: string,
  parentTitle: string,
): Promise<{ url: string; html: string; text: string; title: string } | null> {
  const allLinks = extractLinks(html, baseUrl)
    .filter(l => hostOf(l.url) === hostOf(baseUrl))
    .filter(l => !isBadDomain(l.url));

  const withMeta = allLinks.map(l => ({
    ...l,
    dateKey: extractDateKeyFromUrl(l.url),
    labelMatches: includesAny(l.label, CORE_SELECTION_WORDS),
  }));

  const candidates = withMeta
    .filter(l => l.labelMatches || l.dateKey)
    .sort((a, b) => {
      if (a.labelMatches !== b.labelMatches) return a.labelMatches ? -1 : 1;
      const ak = a.dateKey || "";
      const bk = b.dateKey || "";
      return bk > ak ? 1 : (bk < ak ? -1 : 0);
    })
    .slice(0, 10);

  for (const candidate of candidates) {
    try {
      await sleep(200);

      if (isPdfUrl(candidate.url)) {
        if (candidate.labelMatches && (await probeUrlOk(candidate.url))) {
          return {
            url: candidate.url,
            html: "",
            text: parentText,
            title: candidate.label || parentTitle,
          };
        }
        continue;
      }

      const { html: cHtml, finalUrl: cUrl } = await fetchHtml(candidate.url);
      const cText = `${stripTags(cHtml)} ${extractMetaDescription(cHtml)}`.trim();
      if (includesAny(cText, CORE_SELECTION_WORDS)) {
        return { url: cUrl, html: cHtml, text: cText, title: getTitle(cHtml, candidate.label) };
      }
    } catch { continue; }
  }
  return null;
}

function toDateString(d: Date | null) {
  if (!d || isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function validDate(y: number, m: number, d: number) {
  const dt = new Date(y, m-1, d);
  return (dt.getFullYear()===y && dt.getMonth()===m-1 && dt.getDate()===d) ? dt : null;
}

function extractFiscalYear(text: string): number | null {
  const fiscal = String(text || "").match(/(20\d{2})年度/);
  return fiscal ? Number(fiscal[1]) : null;
}

function extractAllDates(text: string, fiscalYearOverride?: number | null): string[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const dates = new Map<string, Date>();
  const raw = String(text || "");

  const consumedRanges: Array<[number, number]> = [];

  const fullPatterns = [
    /(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/g,
    /(20\d{2})[\/.-](\d{1,2})[\/.-](\d{1,2})/g,
  ];
  const todayMonthForFull = now.getMonth() + 1;
  const todayDateForFull = now.getDate();
  for (const pattern of fullPatterns) {
    let m;
    while ((m = pattern.exec(raw)) !== null) {
      const mm = Number(m[2]);
      const dd = Number(m[3]);
      if (!(mm === todayMonthForFull && dd === todayDateForFull)) {
        const d = validDate(Number(m[1]), mm, dd);
        if (d) { const s = toDateString(d)!; if (!dates.has(s)) dates.set(s, d); }
      }
      consumedRanges.push([m.index, m.index + m[0].length]);
    }
  }

  function isConsumed(index: number, length: number) {
    return consumedRanges.some(([s, e]) => index < e && index + length > s);
  }

  const fiscalYear = fiscalYearOverride !== undefined
    ? fiscalYearOverride
    : (() => {
        const fiscal = raw.match(/(20\d{2})年度/);
        return fiscal ? Number(fiscal[1]) : null;
      })();

  const todayMonth = now.getMonth() + 1;
  const todayDate = now.getDate();
  const jpShort = /(\d{1,2})月\s*(\d{1,2})日/g;
  let m;
  while ((m = jpShort.exec(raw)) !== null) {
    if (isConsumed(m.index, m[0].length)) continue;

    const month = Number(m[1]);
    const day = Number(m[2]);

    if (month === todayMonth && day === todayDate) continue;

    const year = fiscalYear
      ? (month >= 4 ? fiscalYear - 1 : fiscalYear)
      : currentYear;

    const d = validDate(year, month, day);
    if (d) { const s = toDateString(d)!; if (!dates.has(s)) dates.set(s, d); }
  }

  const today = toDateString(now)!;
  const twoYearsLater = `${currentYear+2}-12-31`;
  return Array.from(dates.keys())
    .filter(d => d >= today && d <= twoYearsLater)
    .sort();
}

function extractEventDates(text: string): string[] {
  const documentFiscalYear = extractFiscalYear(text);
  const lines = String(text || "")
    .slice(0, 30000)
    .split(/\n|。|\./)
    .map(v => v.trim())
    .filter(Boolean);
  const selectionLines = lines.filter(line =>
    includesAny(line, ["開催日","実施日","日程","セレクション","選考会","練習会","体験会","体験練習"])
  );
  const fromSelectionLines: string[] = [];
  for (const line of selectionLines) {
    fromSelectionLines.push(...extractAllDates(line, documentFiscalYear));
  }
  const fromAll = extractAllDates(text, documentFiscalYear);
  const result = fromSelectionLines.length > 0 ? fromSelectionLines : fromAll;
  return [...new Set(result)].sort();
}

function extractDeadline(text: string): string | null {
  const documentFiscalYear = extractFiscalYear(text);
  const lines = String(text || "")
    .slice(0, 20000)
    .split(/。|\.|\n/)
    .map(v => v.trim())
    .filter(Boolean);
  const deadlineLines = lines.filter(line =>
    line.includes("締切") || line.includes("〆切") || line.includes("申込期限") ||
    line.includes("受付期限") || line.includes("受付締切")
  );
  for (const line of deadlineLines) {
    const dates = extractAllDates(line, documentFiscalYear);
    if (dates.length > 0) return dates[0];
  }
  return null;
}

function extractCategories(text: string): string[] {
  const t = String(text || "").toLowerCase();
  const cats = new Set<string>();
  if (t.includes("u-12") || t.includes("u12") || t.includes("小学")) cats.add("U-12");
  if (t.includes("u-13") || t.includes("u13") || t.includes("新中1") || t.includes("中学1")) cats.add("U-13");
  if (t.includes("u-15") || t.includes("u15") || t.includes("ジュニアユース") || t.includes("中学生")) cats.add("U-15");
  if (t.includes("u-18") || t.includes("u18") || t.includes("ユース") || t.includes("高校")) cats.add("U-18");
  if (t.includes("女子") || t.includes("レディース")) cats.add("女子");
  if (t.includes("gk") || t.includes("ゴールキーパー")) cats.add("GK");
  return Array.from(cats);
}

function extractGender(text: string): string {
  const t = String(text || "").toLowerCase();
  if (t.includes("女子") || t.includes("レディース") || t.includes("women") || t.includes("girls")) return "girls";
  return "any";
}

function extractVenue(text: string) {
  const lines = String(text || "").split(/\n|。/).map(v => v.trim()).filter(Boolean);
  const line = lines.find(l =>
    l.includes("会場") || l.includes("場所") || l.includes("グラウンド") || l.includes("競技場")
  );
  if (!line) return { venueName: null, venueAddress: null };
  const cleaned = line.replace(/^【?(?:会場|場所)】?\s*[:：]?\s*/, "").slice(0, 120);
  const addr = cleaned.match(/(東京都|神奈川県|埼玉県|千葉県|茨城県|栃木県|群馬県|山梨県)[^\s　、。)]{3,80}/);
  return { venueName: cleaned || null, venueAddress: addr?.[0] || null };
}

function extractFee(text: string) {
  const t = String(text || "");
  if (t.includes("無料") || t.includes("参加費無料")) return { feeAmount: 0, feeNote: "無料" };
  const m = t.match(/(?:参加費|費用|料金)[^\d０-９]{0,10}([0-9０-９,，]+)\s*円/);
  if (!m?.[1]) return { feeAmount: null, feeNote: null };
  const amount = Number(m[1].replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0)-0xfee0)).replace(/[，,]/g,""));
  return { feeAmount: isFinite(amount) ? amount : null, feeNote: m[0].slice(0, 80) };
}

function extractTimeRange(text: string) {
  const m = text.match(/(\d{1,2})[:：](\d{2})\s*[〜~\-－～]\s*(\d{1,2})[:：](\d{2})/);
  if (!m) return { eventStartTime: null, eventEndTime: null };
  return {
    eventStartTime: `${m[1].padStart(2,"0")}:${m[2]}`,
    eventEndTime: `${m[3].padStart(2,"0")}:${m[4]}`,
  };
}

function displayStatus(eventDates: string[], deadline: string | null, text: string): string {
  const today = toDateString(new Date())!;
  if (text.includes("募集終了") || text.includes("受付終了") || text.includes("締め切りました")) return "申込終了";
  if (deadline && deadline < today) return "申込終了";
  if (eventDates.length > 0 && eventDates[eventDates.length-1] < today) return "開催終了";
  if (eventDates.length === 0) return "日付未取得";
  return "募集中";
}

function inferSourceRank(leagueName: string, teamName: string): string {
  const t = `${leagueName} ${teamName}`;
  if (J_CLUBS.some(j => t.includes(j))) return "j_academy";
  if (t.includes("関東")) return "pref_top";
  if (t.includes("プリンス") || t.includes("プレミア")) return "pref_top";
  if (t.includes("T1") || t.includes("S1") || t.includes("C1")) return "pref_top";
  if (t.includes("ウルトラ") || /TOP/i.test(t) || /1部/.test(t)) return "pref_top";
  if (t.includes("地区トップ")) return "pref_3";
  if (t.includes("T2") || t.includes("G1") || t.includes("S2") || t.includes("C2") || /2部/.test(t)) return "pref_2";
  if (t.includes("T3") || t.includes("G2") || /3部/.test(t)) return "pref_3";
  if (t.includes("T4") || /4部/.test(t)) return "pref_4";
  return "district";
}

function extractAdmissionFiscalYear(text: string): number | null {
  const t = String(text || "");
  const patterns = [
    /(20\d{2})年度\s*(?:新)?入団/,
    /(20\d{2})年度\s*入部/,
    /(20\d{2})年度\s*新入部員/,
    /(20\d{2})年度\s*加入/,
  ];
  for (const pattern of patterns) {
    const m = t.match(pattern);
    if (m) return Number(m[1]);
  }
  return null;
}

function extractIsRollingRecruitment(text: string): boolean {
  const t = String(text || "");
  return /随時募集|随時受付|通年募集|中途加入|中途入団|随時入団/.test(t);
}

function isOfficialSourceRow(row: any): boolean {
  if (!row.official_homepage_url || !row.selection_page_url) return false;
  return hostOf(row.selection_page_url) === hostOf(row.official_homepage_url);
}

function findOfficialLink(html: string, baseUrl: string, officialHomepageUrl: string): string | null {
  if (!officialHomepageUrl) return null;
  const officialHost = hostOf(officialHomepageUrl);
  if (!officialHost) return null;
  const links = extractLinks(html, baseUrl);
  const match = links.find(l => hostOf(l.url) === officialHost);
  return match ? match.url : null;
}

async function resolveOfficialUrl(
  foundPage: { url: string; html: string },
  officialHomepageUrl: string | null,
): Promise<string> {
  if (!officialHomepageUrl) return foundPage.url;

  if (hostOf(foundPage.url) === hostOf(officialHomepageUrl)) {
    return foundPage.url;
  }

  const candidate = findOfficialLink(foundPage.html, foundPage.url, officialHomepageUrl);
  if (candidate) {
    try {
      await fetchHtml(candidate);
      return candidate;
    } catch {
    }
  }

  return officialHomepageUrl;
}

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,"0")).join("");
}

async function crawlAndFindSelectionPageRaw(
  selectionPageUrl: string,
  teamName: string,
): Promise<{ url: string; html: string; text: string; title: string } | null> {
  if (isBadDomain(selectionPageUrl)) return null;

  try {
    const { html, finalUrl } = await fetchHtml(selectionPageUrl);

    if (isSuspiciousPage(html, finalUrl)) {
      console.warn(
        `[suspicious page] ${teamName}: official_urlが本来のチームサイトではない` +
        `可能性があるページ(WordPress初期画面/404/ドメイン期限切れ/接続確認等)を返しています。` +
        `url=${finalUrl} 元URL=${selectionPageUrl} 要目視確認。`
      );
      return null;
    }

    const metaDescription = extractMetaDescription(html);
    const text = `${stripTags(html)} ${metaDescription}`.trim();
    const title = getTitle(html, teamName);

    if (includesAny(text, CORE_SELECTION_WORDS)) {
      const deeper = await findDeeperSelectionPage(html, finalUrl, text, title);
      if (deeper) return deeper;
      return { url: finalUrl, html, text, title };
    }

    const links = extractLinks(html, finalUrl)
      .filter(l => hostOf(l.url) === hostOf(finalUrl))
      .filter(l => !isBadDomain(l.url));

    const newsListLinks = links.filter(l => {
      const p = pathOf(l.url);
      return NEWS_LIST_PATTERNS.some(pattern => p.includes(pattern)) ||
        includesAny(l.label, ["ニュース","お知らせ","最新情報","topics","news","information"]);
    }).slice(0, 3);

    const directLinks = links.filter(l =>
      includesAny(`${l.url} ${l.label}`, [...CORE_SELECTION_WORDS,"selection","recruit","boshu","taiken"])
    ).slice(0, 5);

    for (const link of directLinks) {
      try {
        await sleep(300);
        const { html: lHtml, finalUrl: lUrl } = await fetchHtml(link.url);
        const lText = `${stripTags(lHtml)} ${extractMetaDescription(lHtml)}`.trim();
        if (includesAny(lText, CORE_SELECTION_WORDS)) {
          return { url: lUrl, html: lHtml, text: lText, title: getTitle(lHtml, link.label) };
        }
      } catch { continue; }
    }

    for (const newsList of newsListLinks) {
      try {
        await sleep(300);
        const { html: listHtml, finalUrl: listUrl } = await fetchHtml(newsList.url);
        const articleLinks = extractLinks(listHtml, listUrl)
          .filter(l => hostOf(l.url) === hostOf(finalUrl))
          .filter(l => {
            const p = pathOf(l.url);
            return /\d{4}/.test(p) || /\/(news|entry|post|article|topics)\/[^/]+/.test(p);
          }).slice(0, 10);

        for (const article of articleLinks) {
          try {
            await sleep(200);
            const { html: aHtml, finalUrl: aUrl } = await fetchHtml(article.url);
            const aText = `${stripTags(aHtml)} ${extractMetaDescription(aHtml)}`.trim();
            if (includesAny(aText, CORE_SELECTION_WORDS)) {
              return { url: aUrl, html: aHtml, text: aText, title: getTitle(aHtml, article.label) };
            }
          } catch { continue; }
        }
      } catch { continue; }
    }

    return null;
  } catch {
    return null;
  }
}

// [2026-07-19 修正] まとめサイト解決に成功し、解決後URLのドメインが元の
// selection_page_url のドメインと異なる場合、その解決結果を
// team_selection_research に書き戻して固定化する。research.id が必要なため
// 呼び出し元(upsertSelectionEvents内)で行う設計にせず、ここで直接引数として
// research 行の id を受け取れるようラッパーの型を拡張する。
async function crawlAndFindSelectionPage(
  selectionPageUrl: string,
  teamName: string,
  officialHomepageUrl?: string | null,
): Promise<{ url: string; html: string; text: string; title: string; resolvedFromMatome: boolean } | null> {
  const page = await crawlAndFindSelectionPageRaw(selectionPageUrl, teamName);
  if (!page) return null;

  const resolvedUrl = await resolveOfficialUrl(page, officialHomepageUrl || null);
  const resolvedFromMatome = resolvedUrl !== page.url && hostOf(resolvedUrl) !== hostOf(selectionPageUrl);
  return { ...page, url: resolvedUrl, resolvedFromMatome };
}

async function claimResearchRows(limit: number) {
  const cutoffIso = new Date(Date.now() - RECRAWL_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("team_selection_research")
    .select("*, team_master:team_master_id(id, team_name, prefecture, category, current_league_name, current_league_rank, gender)")
    .not("selection_page_url", "is", null)
    .neq("selection_page_url", "")
    .or(`checked_at.is.null,checked_at.lt.${cutoffIso}`)
    .order("checked_at", { ascending: true, nullsFirst: true })
    .limit(limit * 5);

  if (error) throw error;

  const rows = data || [];

  const groups = new Map<string, any[]>();
  for (const row of rows) {
    const key = row.team_master_id || `no_team_${row.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const groupList = Array.from(groups.values()).map((groupRows) => {
    groupRows.sort((a, b) => {
      const aOfficial = isOfficialSourceRow(a) ? 0 : 1;
      const bOfficial = isOfficialSourceRow(b) ? 0 : 1;
      return aOfficial - bOfficial;
    });
    return groupRows;
  });

  groupList.sort((a, b) => {
    const aTeam = a[0].team_master;
    const bTeam = b[0].team_master;
    const catOrder: Record<string, number> = { "U15": 0, "U18": 1, "U12": 2 };
    const aCat = catOrder[aTeam?.category || ""] ?? 9;
    const bCat = catOrder[bTeam?.category || ""] ?? 9;
    if (aCat !== bCat) return aCat - bCat;
    const aRank = aTeam?.current_league_rank ?? 999;
    const bRank = bTeam?.current_league_rank ?? 999;
    return aRank - bRank;
  });

  const flat: any[] = [];
  for (const group of groupList) {
    flat.push(...group);
    if (flat.length >= limit) break;
  }

  return flat.slice(0, limit);
}

async function notifyMatchingUsers(params: {
  prefecture: string | null;
  categories: string[];
  rank: string | null;
  teamName: string;
  dates: string[];
  sampleId: string | null | undefined;
}) {
  const { prefecture, categories, rank, teamName, dates, sampleId } = params;
  if (!sampleId) return;

  try {
    const { data: subs, error } = await supabase
      .from("selection_alert_subscriptions")
      .select("user_id, prefectures, categories, ranks")
      .eq("enabled", true);

    if (error) {
      console.error("selection_alert_subscriptions fetch error:", error);
      return;
    }

    const matched = (subs || []).filter((sub: any) => {
      const subPrefs: string[] | null = sub.prefectures;
      const subCats: string[] | null = sub.categories;
      const subRanks: string[] | null = sub.ranks;

      const prefOk =
        !subPrefs || subPrefs.length === 0 ||
        (!!prefecture && subPrefs.includes(prefecture));

      const catOk =
        !subCats || subCats.length === 0 ||
        categories.some((c) => subCats.includes(c));

      const rankOk =
        !subRanks || subRanks.length === 0 ||
        (!!rank && subRanks.includes(rank));

      return prefOk && catOk && rankOk;
    });

    if (matched.length === 0) return;

    const dateText =
      dates.length === 0
        ? "日程未定"
        : dates.length === 1
        ? dates[0]
        : `${dates[0]} 他${dates.length - 1}件`;

    const title = "新着セレクション情報";
    const body = `${teamName}（${dateText}）の情報が登録されました`;
    const targetUrl = `/selection/${sampleId}`;

    for (const sub of matched) {
      try {
        await supabase.from("notifications").insert({
          user_id: sub.user_id,
          type: "selection_event",
          title,
          body,
          target_url: targetUrl,
          is_read: false,
        });
      } catch (e) {
        console.error("notifications insert error:", e);
      }

      try {
        await fetch(`${SITE_BASE_URL}/api/push/send`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            userId: sub.user_id,
            title,
            body,
            url: targetUrl,
          }),
        });
      } catch (e) {
        console.error("push send fetch error:", e);
      }
    }
  } catch (e) {
    console.error("notifyMatchingUsers error:", e);
  }
}

async function upsertSelectionEvents(
  research: any,
  page: { url: string; text: string; title: string; resolvedFromMatome?: boolean },
) {
  const teamMaster = research.team_master || {};
  const teamName = teamMaster.team_name || "不明";
  const leagueName = teamMaster.current_league_name || "";
  const prefecture = teamMaster.prefecture || null;
  const category = teamMaster.category || research.target_category || "";

  const rawText = `${page.title}\n${teamName}\n${page.text}`.slice(0, 40000);
  const fullText = compactText(rawText, 40000);

  const rawTextForExtraction = truncateAtNoiseSection(rawText);

  const eventDates = extractEventDates(rawTextForExtraction);
  const deadline = extractDeadline(rawTextForExtraction);
  const venue = extractVenue(rawTextForExtraction);

  const categories = extractCategories(fullText);
  const gender = extractGender(fullText);
  let statusText = displayStatus(eventDates, deadline, fullText);
  const fee = extractFee(fullText);
  const timeRange = extractTimeRange(fullText);
  const sourceRank = inferSourceRank(leagueName, teamName);
  const admissionFiscalYear = extractAdmissionFiscalYear(fullText);
  const isRollingRecruitment = extractIsRollingRecruitment(fullText);
  const summary = cleanForDb(compactText(page.text, 200), 200);
  const description = cleanForDb(compactText(page.text, 800), 800);

  // [2026-07-19 追加] 学校サイト全体の行事予定を誤って拾っている疑いがある場合、
  // 表示上は「日付未取得」に強制し、抽出ステータスに要確認マークを付ける。
  const schoolCalendarSuspected = isSuspiciousSchoolPage(page.url, eventDates.length);
  if (schoolCalendarSuspected) {
    statusText = "日付未取得";
  }

  const baseEventRow = {
    team_master_id: research.team_master_id || null,
    organization_name: teamName,
    organization_type: J_CLUBS.some(j => teamName.includes(j)) ? "j_club" : "club_team",
    target_categories: categories.length > 0 ? categories : [category].filter(Boolean),
    gender,
    prefecture,
    area: prefecture,
    venue_name: venue.venueName,
    venue_address: venue.venueAddress,
    event_dates: eventDates,
    event_start_time: timeRange.eventStartTime,
    event_end_time: timeRange.eventEndTime,
    application_deadline: deadline,
    fee_amount: fee.feeAmount,
    fee_note: fee.feeNote,
    source_url: research.selection_page_url,
    official_url: page.url,
    selection_page_url: research.selection_page_url,
    summary,
    description,
    raw_text: cleanForDb(page.text, 20000),
    fetched_at: nowIso(),
    status: "published",
    display_status: statusText,
    is_featured: J_CLUBS.some(j => teamName.includes(j)),
    last_seen_at: nowIso(),
    updated_at: nowIso(),
    source_type: "team_selection_research",
    extraction_status: schoolCalendarSuspected
      ? "school_calendar_suspected"
      : (eventDates.length > 0 ? "success" : "date_missing"),
    source_rank: sourceRank,
    admission_fiscal_year: admissionFiscalYear,
    is_rolling_recruitment: isRollingRecruitment,
  };

  const results = [];
  const datesToProcess = eventDates.length > 0 ? eventDates : [null];

  for (const eventDate of datesToProcess) {
    const hashKey = eventDate
      ? `${research.team_master_id}:${eventDate}:${research.selection_page_url}`
      : `${research.team_master_id}:no_date:${research.selection_page_url}`;
    const duplicateKey = await sha256(hashKey);
    const title = eventDate
      ? `${teamName} セレクション ${eventDate}`
      : `${teamName} セレクション情報`;

    const eventRow = {
      ...baseEventRow,
      title,
      event_date: eventDate,
      duplicate_key: duplicateKey,
      content_hash: duplicateKey,
      memo: cleanForDb(`team_master_id:${research.team_master_id}\nleague:${leagueName}\ncategory:${category}\nevent_date:${eventDate}\nall_dates:${eventDates.join(",")}\ncrawled_url:${page.url}${schoolCalendarSuspected ? "\nWARNING:school_calendar_suspected" : ""}`, 2000),
    };

    const { data: existing } = await supabase
      .from("selection_events")
      .select("id, manual_locked")
      .eq("duplicate_key", duplicateKey)
      .limit(1)
      .maybeSingle();

    if (existing?.manual_locked) {
      results.push({ status: "manual_locked", eventDate });
      continue;
    }

    if (existing?.id) {
      const { error } = await supabase
        .from("selection_events")
        .update(eventRow)
        .eq("id", existing.id);
      if (error) throw new Error(`update error: ${JSON.stringify(error)}`);
      results.push({ status: "updated", eventDate, id: existing.id });
    } else {
      const { data: insertedRow, error } = await supabase
        .from("selection_events")
        .insert({ ...eventRow, created_at: nowIso() })
        .select("id")
        .single();
      if (error) throw new Error(`insert error: ${JSON.stringify(error)}`);
      results.push({ status: "inserted", eventDate, id: insertedRow?.id });
    }
  }

  const insertedResults = results.filter(r => r.status === "inserted");
  if (insertedResults.length > 0 && !schoolCalendarSuspected) {
    await notifyMatchingUsers({
      prefecture,
      categories: baseEventRow.target_categories as string[],
      rank: sourceRank,
      teamName,
      dates: insertedResults.map(r => r.eventDate).filter(Boolean) as string[],
      sampleId: insertedResults[0].id,
    });
  }

  // [2026-07-19 追加] まとめサイトから公式サイトへの解決に成功した場合、
  // その解決済みURLを team_selection_research に書き戻して固定化する。
  // これにより次回以降は直接公式サイトをクロールでき、まとめサイトへの
  // 依存を減らせる。
  const updatePayload: Record<string, unknown> = { checked_at: nowIso() };
  if (page.resolvedFromMatome) {
    updatePayload.selection_page_url = page.url;
    updatePayload.notes = `まとめサイトから公式サイトへ自動解決・固定化(${nowIso()})`;
  }

  await supabase
    .from("team_selection_research")
    .update(updatePayload)
    .eq("id", research.id);

  return results;
}

serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Number(body.batchSize || body.limit || BATCH_SIZE), 20);
    const startedAt = Date.now();

    const rows = await claimResearchRows(batchSize);
    if (rows.length === 0) {
      return json({ ok: true, message: "no rows to process", processed: 0 });
    }

    const results = [];
    let totalInserted = 0, totalUpdated = 0, totalNotFound = 0, totalErrors = 0, totalSkipped = 0;
    const succeededTeams = new Set<string>();

    for (const research of rows) {
      if (Date.now() - startedAt > MAX_RUN_MS) {
        results.push({ status: "time_limit_reached" });
        break;
      }

      const teamName = research.team_master?.team_name || "不明";
      const teamKey = research.team_master_id;

      if (teamKey && succeededTeams.has(teamKey) && !isOfficialSourceRow(research)) {
        await supabase
          .from("team_selection_research")
          .update({ checked_at: nowIso() })
          .eq("id", research.id);
        results.push({ teamName, status: "skipped_official_success" });
        totalSkipped++;
        continue;
      }

      try {
        const page = await crawlAndFindSelectionPage(
          research.selection_page_url,
          teamName,
          research.official_homepage_url,
        );

        if (!page) {
          await supabase
            .from("team_selection_research")
            .update({ checked_at: nowIso() })
            .eq("id", research.id);
          results.push({ teamName, status: "not_found", url: research.selection_page_url });
          totalNotFound++;
          continue;
        }

        const upsertResults = await upsertSelectionEvents(research, page);
        const inserted = upsertResults.filter(r => r.status === "inserted").length;
        const updated = upsertResults.filter(r => r.status === "updated").length;
        totalInserted += inserted;
        totalUpdated += updated;

        if (teamKey && isOfficialSourceRow(research)) {
          succeededTeams.add(teamKey);
        }

        results.push({
          teamName,
          status: "success",
          url: page.url,
          eventDates: upsertResults.map(r => r.eventDate).filter(Boolean),
          inserted,
          updated,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        results.push({ teamName, status: "error", error: message });
        totalErrors++;
        await supabase
          .from("team_selection_research")
          .update({ checked_at: nowIso() })
          .eq("id", research.id);
      }

      await sleep(500);
    }

    return json({
      ok: true,
      elapsedMs: Date.now() - startedAt,
      processed: rows.length,
      totalInserted,
      totalUpdated,
      totalNotFound,
      totalErrors,
      totalSkipped,
      results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json({ ok: false, error: message }, 500);
  }
});
