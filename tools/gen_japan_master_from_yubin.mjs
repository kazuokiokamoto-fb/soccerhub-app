import fs from "fs";
import path from "path";

const SRC = path.join(process.cwd(), "utf_ken_all.csv");
const OUT_DIR = path.join(process.cwd(), "tools", "out");

if (!fs.existsSync(SRC)) {
  console.error("utf_ken_all.csv が見つかりません");
  process.exit(1);
}
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }
  out.push(cur);
  return out;
}

function clean(v) {
  return String(v ?? "").trim();
}

function sqlEscape(v) {
  return String(v ?? "").replace(/'/g, "''");
}

function normalizeKana(v) {
  return clean(v)
    .replace(/\s+/g, "")
    .replace(/　+/g, "")
    .normalize("NFKC");
}

function normalizeText(v) {
  return clean(v)
    .replace(/\s+/g, "")
    .replace(/　+/g, "")
    .normalize("NFKC");
}

function isIgnoredTown(town) {
  const t = normalizeText(town);
  if (!t) return true;
  if (t === "以下に掲載がない場合") return true;
  return false;
}

function makeInsertValues(rows, cols) {
  return rows
    .map((row) => {
      const vals = cols.map((c) => {
        const v = row[c];
        if (v === null || v === undefined || v === "") return "NULL";
        return `'${sqlEscape(v)}'`;
      });
      return `(${vals.join(", ")})`;
    })
    .join(",\n");
}

const lines = fs.readFileSync(SRC, "utf8").split(/\r?\n/).filter(Boolean);

const prefectureMap = new Map();
const municipalityMap = new Map();
const townMap = new Map();

for (const line of lines) {
  const cols = parseCsvLine(line);
  if (cols.length < 9) continue;

  // 日本郵便CSV（全国一括）想定
  // 6: 都道府県
  // 7: 市区町村
  // 8: 町域
  // 3: 都道府県カナ
  // 4: 市区町村カナ
  // 5: 町域カナ
  const prefKana = normalizeKana(cols[3]);
  const cityKana = normalizeKana(cols[4]);
  const townKana = normalizeKana(cols[5]);

  const prefecture = normalizeText(cols[6]);
  const city = normalizeText(cols[7]);
  const town = normalizeText(cols[8]);

  if (!prefecture || !city) continue;

  if (!prefectureMap.has(prefecture)) {
    prefectureMap.set(prefecture, {
      prefecture,
      prefecture_kana: prefKana || null,
    });
  } else {
    const prev = prefectureMap.get(prefecture);
    if (!prev.prefecture_kana && prefKana) prev.prefecture_kana = prefKana;
  }

  const muniKey = `${prefecture}__${city}`;
  if (!municipalityMap.has(muniKey)) {
    municipalityMap.set(muniKey, {
      prefecture,
      prefecture_kana: prefKana || null,
      city,
      city_kana: cityKana || null,
    });
  } else {
    const prev = municipalityMap.get(muniKey);
    if (!prev.prefecture_kana && prefKana) prev.prefecture_kana = prefKana;
    if (!prev.city_kana && cityKana) prev.city_kana = cityKana;
  }

  if (isIgnoredTown(town)) continue;

  const townKey = `${prefecture}__${city}__${town}`;
  if (!townMap.has(townKey)) {
    townMap.set(townKey, {
      prefecture,
      prefecture_kana: prefKana || null,
      city,
      city_kana: cityKana || null,
      town,
      town_kana: townKana || null,
    });
  } else {
    const prev = townMap.get(townKey);
    if (!prev.prefecture_kana && prefKana) prev.prefecture_kana = prefKana;
    if (!prev.city_kana && cityKana) prev.city_kana = cityKana;
    if (!prev.town_kana && townKana) prev.town_kana = townKana;
  }
}

const prefectures = [...prefectureMap.values()].sort((a, b) =>
  (a.prefecture_kana || a.prefecture).localeCompare(b.prefecture_kana || b.prefecture, "ja")
);

const municipalities = [...municipalityMap.values()].sort((a, b) => {
  const ak = a.city_kana || a.city;
  const bk = b.city_kana || b.city;
  const c1 = ak.localeCompare(bk, "ja");
  if (c1 !== 0) return c1;
  const c2 = a.prefecture.localeCompare(b.prefecture, "ja");
  if (c2 !== 0) return c2;
  return a.city.localeCompare(b.city, "ja");
});

const towns = [...townMap.values()].sort((a, b) => {
  const c0 = a.prefecture.localeCompare(b.prefecture, "ja");
  if (c0 !== 0) return c0;
  const c1 = (a.city_kana || a.city).localeCompare(b.city_kana || b.city, "ja");
  if (c1 !== 0) return c1;
  const c2 = a.city.localeCompare(b.city, "ja");
  if (c2 !== 0) return c2;
  const c3 = (a.town_kana || a.town).localeCompare(b.town_kana || b.town, "ja");
  if (c3 !== 0) return c3;
  return a.town.localeCompare(b.town, "ja");
});

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const header = `
begin;

create table if not exists public.jp_prefectures (
  prefecture text primary key,
  prefecture_kana text
);

create table if not exists public.jp_municipalities (
  prefecture text not null,
  prefecture_kana text,
  city text not null,
  city_kana text,
  primary key (prefecture, city)
);

create table if not exists public.jp_towns (
  prefecture text not null,
  prefecture_kana text,
  city text not null,
  city_kana text,
  town text not null,
  town_kana text,
  primary key (prefecture, city, town)
);
`.trim();

const footer = `
create index if not exists idx_jp_municipalities_pref_city_kana
  on public.jp_municipalities (prefecture, city_kana, city);

create index if not exists idx_jp_towns_pref_city_town_kana
  on public.jp_towns (prefecture, city, town_kana, town);

commit;
`.trim();

const prefectureSql = `
${header}

truncate table public.jp_prefectures;

insert into public.jp_prefectures (prefecture, prefecture_kana)
values
${makeInsertValues(prefectures, ["prefecture", "prefecture_kana"])};

commit;
`.trim();

fs.writeFileSync(
  path.join(OUT_DIR, "import_jp_prefectures.sql"),
  prefectureSql,
  "utf8"
);

const muniChunks = chunk(municipalities, 500);
let muniSql = `
begin;

create table if not exists public.jp_municipalities (
  prefecture text not null,
  prefecture_kana text,
  city text not null,
  city_kana text,
  primary key (prefecture, city)
);

truncate table public.jp_municipalities;
`.trim();

for (const part of muniChunks) {
  muniSql += `

insert into public.jp_municipalities (prefecture, prefecture_kana, city, city_kana)
values
${makeInsertValues(part, ["prefecture", "prefecture_kana", "city", "city_kana"])};
`;
}

muniSql += `

create index if not exists idx_jp_municipalities_pref_city_kana
  on public.jp_municipalities (prefecture, city_kana, city);

commit;
`;

fs.writeFileSync(
  path.join(OUT_DIR, "import_jp_municipalities.sql"),
  muniSql.trim(),
  "utf8"
);

const townChunks = chunk(towns, 500);
let townSql = `
begin;

create table if not exists public.jp_towns (
  prefecture text not null,
  prefecture_kana text,
  city text not null,
  city_kana text,
  town text not null,
  town_kana text,
  primary key (prefecture, city, town)
);

truncate table public.jp_towns;
`.trim();

for (const part of townChunks) {
  townSql += `

insert into public.jp_towns (prefecture, prefecture_kana, city, city_kana, town, town_kana)
values
${makeInsertValues(part, ["prefecture", "prefecture_kana", "city", "city_kana", "town", "town_kana"])};
`;
}

townSql += `

create index if not exists idx_jp_towns_pref_city_town_kana
  on public.jp_towns (prefecture, city, town_kana, town);

commit;
`;

fs.writeFileSync(
  path.join(OUT_DIR, "import_jp_towns.sql"),
  townSql.trim(),
  "utf8"
);

console.log("生成完了");
console.log("prefectures:", prefectures.length);
console.log("municipalities:", municipalities.length);
console.log("towns:", towns.length);
console.log("out:", OUT_DIR);