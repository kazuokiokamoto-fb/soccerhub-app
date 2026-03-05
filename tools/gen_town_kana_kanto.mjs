// tools/gen_town_kana_kanto.mjs
// 目的：kanto_towns.csv（関東）を読み込み、町名の town_kana を Yahoo Furigana API で生成して
//      Supabase に貼る用 SQL（select public.import_town_kana(...);）を分割出力する

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env.local");

// ====== .env.local を雑に読む（コメント行は無視）======
function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");

  for (const lineRaw of text.split(/\r?\n/)) {
    const line = lineRaw.trim();
    if (!line || line.startsWith("#")) continue;

    const i = line.indexOf("=");
    if (i <= 0) continue;

    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();

    v = v.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    if (k && v && !process.env[k]) process.env[k] = v;
  }
}
loadEnv(ENV_PATH);

const YAHOO_APP_ID = process.env.YAHOO_APP_ID;
if (!YAHOO_APP_ID) {
  console.error("❌ YAHOO_APP_ID が見つかりません。.env.local に入っているか確認してください。");
  process.exit(1);
}

// ====== CSV読み込み（超簡易：カンマ区切り前提）======
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(",").map((s) => s.trim());
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
async function toKana(text) {
  const body = {
    id: "1",
    jsonrpc: "2.0",
    method: "jlp.furiganaservice.furigana",
    params: { q: text },
  };

  const res = await fetch("https://jlp.yahooapis.jp/FuriganaService/V2/furigana", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "soccerhub-kana-gen",
      "X-Yahoo-App-Id": YAHOO_APP_ID,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Yahoo API failed: ${res.status} ${res.statusText} ${t}`);
  }

  const json = await res.json();
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
const all = parseCsv(csvText).filter((r) => r.prefecture && r.city && r.town);

// 重複排除（pref/city/town）
const seen = new Set();
const uniq = [];
for (const r of all) {
  const key = r.prefecture + "||" + r.city + "||" + r.town;
  if (seen.has(key)) continue;
  seen.add(key);
  uniq.push(r);
}

console.log("関東 town 件数:", uniq.length);

const outDir = path.join(ROOT, "tools", "out");
fs.mkdirSync(outDir, { recursive: true });

// 1ファイルあたり件数
const CHUNK = 300;

async function main() {
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

      if (i % 50 === 0) {
        console.log("..", i + "/" + uniq.length, r.prefecture, r.city, r.town, "->", townKana);
      }

      // 叩きすぎ防止
      await new Promise((s) => setTimeout(s, 120));
    } catch (e) {
      console.error("❌ 失敗:", r.prefecture, r.city, r.town, e?.message ?? e);

      enriched.push({
        prefecture: r.prefecture,
        city: r.city,
        town: r.town,
        townKana: "",
      });

      await new Promise((s) => setTimeout(s, 250));
    }
  }

  // JSON保存（確認用）
  fs.writeFileSync(path.join(outDir, "kanto_towns_kana.json"), JSON.stringify(enriched, null, 2), "utf8");

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

    const name = "import_kanto_town_kana_" + String(fileNo).padStart(3, "0") + ".sql";
    const p = path.join(outDir, name);

    fs.writeFileSync(p, sql, "utf8");
    fileNo++;
  }

  console.log("✅ 出力完了: tools/out/kanto_towns_kana.json");
  console.log("✅ 出力完了: tools/out/import_kanto_town_kana_*.sql（" + (fileNo - 1) + "ファイル）");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});