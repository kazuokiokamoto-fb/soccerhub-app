// tools/gen_town_kana_from_yubin_kanto.mjs
// 目的：utf_ken_all.csv（日本郵便 住所+かな）から関東7都県の town_kana を抽出し、
//      jp_towns に一括 UPDATE するSQLを tools/out に1本出力する（SQL Editorで1回Run）
//
// 前提：プロジェクト直下に utf_ken_all.csv がある（あなたの構成どおり）
// 注意：jp_towns には (prefecture, city, town) の一致行が存在する前提（※新規INSERTしない）

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CSV_PATH = path.join(ROOT, "utf_ken_all.csv");
const outDir = path.join(ROOT, "tools", "out");
fs.mkdirSync(outDir, { recursive: true });

const KANTO_PREFS = new Set(["東京都", "神奈川県", "千葉県", "埼玉県", "茨城県", "栃木県", "群馬県"]);

// ---------- CSVパーサ（ダブルクォート対応の簡易） ----------
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQ) {
      if (ch === '"') {
        // "" はエスケープ
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

// ---------- 正規化 ----------
function normalizeTown(town) {
  if (!town) return "";
  let t = String(town).trim();

  // よくある「以下に掲載がない場合」等は town カナにしても意味がないので除外
  if (t.includes("以下に掲載がない場合")) return "";

  // 末尾・先頭の空白/全角空白
  t = t.replace(/\u3000/g, " ").trim();

  return t;
}

function kataToHira(s) {
  // カタカナ（ァ-ン）→ひらがな（ぁ-ん）
  return String(s).replace(/[\u30A1-\u30F6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function normalizeKana(kana) {
  if (!kana) return "";
  let k = String(kana).trim();
  k = k.replace(/\u3000/g, " ").trim();
  // 半角スペース削除（検索・ソート用）
  k = k.replace(/\s+/g, "");
  // カタカナ→ひらがな
  k = kataToHira(k);
  return k;
}

// ---------- メイン ----------
async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ utf_ken_all.csv が見つかりません: ${CSV_PATH}`);
    process.exit(1);
  }

  const text = fs.readFileSync(CSV_PATH, "utf8");

  // 日本郵便 KEN_ALL の一般的な列（13列）
  // 0:全国地方公共団体コード
  // 1:旧郵便番号
  // 2:郵便番号
  // 3:都道府県名カナ
  // 4:市区町村名カナ
  // 5:町域名カナ
  // 6:都道府県名
  // 7:市区町村名
  // 8:町域名
  // 9..12:フラグ
  //
  // あなたのファイルが微妙に違っても、6/7/8/5 を使う設計なので多くの場合OK

  const lines = text.split(/\r?\n/).filter(Boolean);

  const map = new Map(); // key: pref||city||town => town_kana

  for (const ln of lines) {
    const cols = parseCsvLine(ln);

    // 最低限必要な列がない行はスキップ
    if (cols.length < 9) continue;

    const prefecture = (cols[6] ?? "").trim();
    const city = (cols[7] ?? "").trim();
    const townRaw = cols[8] ?? "";
    const townKanaRaw = cols[5] ?? "";

    if (!KANTO_PREFS.has(prefecture)) continue;
    if (!prefecture || !city) continue;

    const town = normalizeTown(townRaw);
    const town_kana = normalizeKana(townKanaRaw);

    if (!town || !town_kana) continue;

    const key = `${prefecture}||${city}||${town}`;

    // 同じ町名が複数行（丁目等）で出ることがあるので「最初の有効値」を採用
    if (!map.has(key)) map.set(key, town_kana);
  }

  const rows = Array.from(map.entries()).map(([key, town_kana]) => {
    const [prefecture, city, town] = key.split("||");
    return { prefecture, city, town, town_kana };
  });

  console.log(`✅ 抽出件数（関東7都県・町名かなあり）: ${rows.length}`);

  // SQLを1本にまとめる（SQL Editorで1回Run）
  // - temp table に入れる
  // - jp_towns と一致したものだけ update（insertしない）
  // - 既に town_kana が入っているものは上書きしない（必要なら条件を外す）
  const valuesSql = rows
    .map(
      (r) =>
        `('${escapeSql(r.prefecture)}','${escapeSql(r.city)}','${escapeSql(r.town)}','${escapeSql(r.town_kana)}')`
    )
    .join(",\n");

  const sql = `-- AUTO-GENERATED: update Kanto town_kana from utf_ken_all.csv
begin;

create temp table if not exists tmp_kanto_town_kana (
  prefecture text,
  city text,
  town text,
  town_kana text
) on commit drop;

truncate tmp_kanto_town_kana;

insert into tmp_kanto_town_kana(prefecture, city, town, town_kana)
values
${valuesSql}
;

-- ✅ 既に値があるものは上書きしない（必要なら where 条件を外す）
update public.jp_towns t
set town_kana = s.town_kana
from tmp_kanto_town_kana s
where t.prefecture = s.prefecture
  and t.city = s.city
  and t.town = s.town
  and (t.town_kana is null or t.town_kana = '');

commit;

-- 確認（任意）
-- select prefecture, count(*) total, count(town_kana) has_kana
-- from public.jp_towns
-- where prefecture in ('東京都','神奈川県','千葉県','埼玉県','茨城県','栃木県','群馬県')
-- group by prefecture
-- order by prefecture;
`;

  const outPath = path.join(outDir, "import_kanto_town_kana_from_yubin.sql");
  fs.writeFileSync(outPath, sql, "utf8");
  console.log(`✅ 出力: ${outPath}`);
}

function escapeSql(s) {
  return String(s ?? "").replace(/'/g, "''");
}

main().catch((e) => {
  console.error("❌ error:", e);
  process.exit(1);
});