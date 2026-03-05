// tools/gen_town_kana_tokyo.mjs
// 目的：kanto_towns.csv の「東京都」だけ town_kana を Yahoo Furigana API で生成し、
//      Supabase に貼る用の SQL（select public.import_town_kana(...);）を分割出力する

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env.local");

// ====== .env.local を読む（#コメント以外でも "=" が無い行は無視）======
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const lineRaw of text.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line) continue;
    if (line.startsWith("#")) continue;

    const i = line.indexOf("=");
    if (i <= 0) continue;

    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();

    // "..." '...' を剥がす
    v = v.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");

    if (!k) continue;
    if (process.env[k]) continue; // 既に入ってたら上書きしない
    process.env[k] = v;
  }
}
loadEnv(ENV_PATH);

const YAHOO_APP_ID = (process.env.YAHOO_APP_ID ?? "").trim();

console.log(`[env] YAHOO_APP_ID length=${YAHOO_APP_ID.length} head=${YAHOO_APP_ID.slice(0, 6)}`);

if (!YAHOO_APP_ID || YAHOO_APP_ID.length < 10) {
  console.error("❌ YAHOO_APP_ID が空、または短すぎます。.env.local の YAHOO_APP_ID=... を確認してください。");
  process.exit(1);
}

// ====== CSV読み込み（簡易）======
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = (lines.shift() ?? "").split(",").map((s) => s.trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  const rows = [];
  for (const ln of lines) {
    const cols = ln.split(",").map((s) => s.trim());
    rows.push({
      prefecture: cols[idx.prefecture] ?? "",
      city: cols[idx.city] ?? "",
      town: cols[idx.town] ?? "",
    });
  }
  return rows;
}

// ====== Yahoo Furigana API ======
// ✅ 認証は「appid をクエリに付ける」方式に統一（これで 401 を潰す）
async function toKana(text) {
  const body = {
    id: "1",
    jsonrpc: "2.0",
    method: "jlp.furiganaservice.furigana",
    params: { q: text, grade: 1 },
  };

  const url =
    "https://jlp.yahooapis.jp/FuriganaService/V2/furigana" +
    `?appid=${encodeURIComponent(YAHOO_APP_ID)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // User-Agent は念のため（無くても通ることが多い）
      "User-Agent": "soccerhub-kana-gen",
    },
    body: JSON.stringify(body),
  });

  const txt = await res.text().catch(() => "");

  if (!res.ok) {
    throw new Error(`Yahoo API failed: ${res.status} ${res.statusText} ${txt}`);
  }

  const json = txt ? JSON.parse(txt) : {};
  const words = json?.result?.word ?? [];

  const kana = words
    .map((w) => (w?.furigana ? String(w.furigana) : String(w?.surface ?? "")))
    .join("")
    .trim();

  return kana || "";
}

// ====== メイン ======
const CSV_PATH = path.join(ROOT, "kanto_towns.csv");
if (!fs.existsSync(CSV_PATH)) {
  console.error("❌ kanto_towns.csv が見つかりません（プロジェクト直下にある前提）");
  process.exit(1);
}

const csvText = fs.readFileSync(CSV_PATH, "utf8");
const all = parseCsv(csvText);

// 東京都だけ
const tokyo = all.filter((r) => r.prefecture === "東京都" && r.city && r.town);

// 重複排除（pref/city/town）
const seen = new Set();
const uniq = [];
for (const r of tokyo) {
  const key = `${r.prefecture}||${r.city}||${r.town}`;
  if (seen.has(key)) continue;
  seen.add(key);
  uniq.push(r);
}

console.log(`東京都 town 件数: ${uniq.length}`);

const outDir = path.join(ROOT, "tools", "out");
fs.mkdirSync(outDir, { recursive: true });

// ここを調整：1ファイルあたりの件数（Supabase SQL Editorで貼りやすい）
const CHUNK = 300;

async function sleep(ms) {
  await new Promise((s) => setTimeout(s, ms));
}

async function main() {
  // ✅ まず1件だけ疎通テスト（ここが通ればOK）
  const testKana = await toKana("三宿");
  console.log(`[test] 三宿 -> ${testKana}`);

  const enriched = [];
  for (let i = 0; i < uniq.length; i++) {
    const r = uniq[i];
    try {
      const townKana = await toKana(r.town);
      enriched.push({
        prefecture: r.prefecture,
        city: r.city,
        town: r.town,
        townKana,
      });
      if (i % 25 === 0) console.log(`...${i}/${uniq.length} ${r.city} ${r.town} -> ${townKana}`);
      await sleep(120);
    } catch (e) {
      console.error(`❌ 失敗: ${r.city} ${r.town}`, e?.message ?? e);
      enriched.push({
        prefecture: r.prefecture,
        city: r.city,
        town: r.town,
        townKana: "",
      });
      await sleep(250);
    }
  }

  // JSON保存（確認用）
  fs.writeFileSync(path.join(outDir, "tokyo_towns_kana.json"), JSON.stringify(enriched, null, 2), "utf8");

  // Supabase貼り付け用 SQL を分割出力
  let fileNo = 1;
  for (let i = 0; i < enriched.length; i += CHUNK) {
    const chunk = enriched.slice(i, i + CHUNK);
    const sql =
      "select public.import_town_kana(\n" +
      "$$\n" +
      JSON.stringify(chunk, null, 2) +
      "\n$$::jsonb\n" +
      ");\n";

    const p = path.join(outDir, `import_tokyo_town_kana_${String(fileNo).padStart(3, "0")}.sql`);
    fs.writeFileSync(p, sql, "utf8");
    fileNo++;
  }

  console.log(`✅ 出力完了: tools/out/tokyo_towns_kana.json`);
  console.log(`✅ 出力完了: tools/out/import_tokyo_town_kana_*.sql （${fileNo - 1}ファイル）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});