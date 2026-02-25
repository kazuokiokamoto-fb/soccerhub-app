import fs from "fs";

const APP_ID = process.env.YAHOO_APP_ID;
if (!APP_ID) throw new Error("YAHOO_APP_ID is missing");

const src = fs.readFileSync("kanto_municipalities.csv", "utf8");
const lines = src.split(/\r?\n/).filter(Boolean);

// CSVが「pref,city」想定。違う場合はここを調整
const rows = lines.map((line) => {
  const [pref, city] = line.split(",").map((s) => s.trim());
  return { pref, city };
});

async function furigana(text) {
  const res = await fetch("https://jlp.yahooapis.jp/FuriganaService/V2/furigana", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": `Yahoo AppID: ${APP_ID}`,
    },
    body: JSON.stringify({
      id: "1",
      jsonrpc: "2.0",
      method: "jlp.furiganaservice.furigana",
      params: { q: text, grade: 1 },
    }),
  });

  const json = await res.json();
  const word = json?.result?.word || [];
  const kana = word.map((w) => w.furigana || w.surface || "").join("");
  return kana;
}

const out = [];
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const text = `${r.pref}${r.city}`;
  const kanaAll = await furigana(text);
  // 例）「とうきょうとせたがやく」から都道府県分を雑に除去
  // （prefだけのかなを引いて cityかなを得る）
  const prefKana = await furigana(r.pref);
  const cityKana = kanaAll.startsWith(prefKana) ? kanaAll.slice(prefKana.length) : kanaAll;

  out.push({ ...r, prefKana, cityKana });
  if (i % 20 === 0) console.log(i, r.pref, r.city, cityKana);
}

fs.writeFileSync("kanto_municipalities_kana.json", JSON.stringify(out, null, 2));
console.log("written: kanto_municipalities_kana.json");