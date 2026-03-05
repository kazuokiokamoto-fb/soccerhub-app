// tools/gen_town_kana_kanto.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ENV_PATH = path.join(ROOT, ".env.local");

// =============================
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
  console.error("YAHOO_APP_ID がありません");
  process.exit(1);
}

// =============================
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);

  const header = lines.shift().split(",");

  const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));

  const rows = [];

  for (const ln of lines) {
    const cols = ln.split(",");

    rows.push({
      prefecture: cols[idx.prefecture],
      city: cols[idx.city],
      town: cols[idx.town],
    });
  }

  return rows;
}

// =============================
async function toKana(text) {

  const body = {
    id: "1",
    jsonrpc: "2.0",
    method: "jlp.furiganaservice.furigana",
    params: { q: text }
  };

  const res = await fetch(
    "https://jlp.yahooapis.jp/FuriganaService/V2/furigana",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "kana-gen",
        "X-Yahoo-App-Id": YAHOO_APP_ID
      },
      body: JSON.stringify(body)
    }
  );

  if (!res.ok) {
    throw new Error("Yahoo API error");
  }

  const json = await res.json();

  const words = json?.result?.word ?? [];

  return words
    .map(w => w.furigana ?? w.surface)
    .join("");
}

// =============================

const CSV_PATH = path.join(ROOT, "kanto_towns.csv");

const csvText = fs.readFileSync(CSV_PATH, "utf8");

const all = parseCsv(csvText);

console.log("関東町数:", all.length);

const outDir = path.join(ROOT, "tools/out");

fs.mkdirSync(outDir, { recursive: true });

const CHUNK = 300;

async function main() {

  const enriched = [];

  for (let i = 0; i < all.length; i++) {

    const r = all[i];

    try {

      const kana = await toKana(r.town);

      enriched.push({
        prefecture: r.prefecture,
        city: r.city,
        town: r.town,
        townKana: kana
      });

      if (i % 50 === 0) {
        console.log(i, "/", all.length, r.city, r.town, kana);
      }

      await new Promise(s => setTimeout(s, 100));

    } catch (e) {

      enriched.push({
        prefecture: r.prefecture,
        city: r.city,
        town: r.town,
        townKana: ""
      });

      console.log("失敗:", r.city, r.town);

      await new Promise(s => setTimeout(s, 200));
    }
  }

  fs.writeFileSync(
    path.join(outDir, "kanto_towns_kana.json"),
    JSON.stringify(enriched, null, 2)
  );

  let fileNo = 1;

  for (let i = 0; i < enriched.length; i += CHUNK) {

    const chunk = enriched.slice(i, i + CHUNK);

    const sql =
`select public.import_town_kana(
$$
${JSON.stringify(chunk, null, 2)}
$$::jsonb
);`;

    const p = path.join(
      outDir,
      \`import_kanto_town_kana_\${String(fileNo).padStart(3, "0")}.sql\`
    );

    fs.writeFileSync(p, sql);

    fileNo++;
  }

  console.log("生成完了");
}

main();