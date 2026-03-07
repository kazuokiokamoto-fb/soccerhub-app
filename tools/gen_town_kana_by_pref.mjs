import fs from "fs";

const pref = process.argv[2];
if (!pref) {
  console.log("県名を指定してください");
  process.exit();
}

const csv = fs.readFileSync("utf_ken_all.csv","utf8").split("\n");

const rows = [];

for (const line of csv) {

  const cols = line.split(",");

  const prefName = cols[6];
  const city = cols[7];
  const town = cols[8];
  const kana = cols[5];

  if (prefName !== pref) continue;
  if (!town) continue;
  if (town.includes("以下に掲載がない場合")) continue;

  const hira = kana.replace(/[ァ-ヶ]/g, m =>
    String.fromCharCode(m.charCodeAt(0)-0x60)
  );

  rows.push({
    prefecture: prefName,
    city,
    town,
    kana: hira
  });

}

const chunk = 300;
let file = 1;

for (let i=0;i<rows.length;i+=chunk){

  const part = rows.slice(i,i+chunk);

  let sql = `begin;

create temp table tmp_town_kana(
prefecture text,
city text,
town text,
town_kana text
);

insert into tmp_town_kana values
`;

  sql += part.map(r=>
`('${r.prefecture}','${r.city}','${r.town}','${r.kana}')`
).join(",\n");

sql += `;

update jp_towns t
set town_kana = s.town_kana
from tmp_town_kana s
where t.prefecture=s.prefecture
and t.city=s.city
and t.town=s.town;

commit;`;

fs.writeFileSync(
`tools/out/import_${pref}_${file}.sql`,
sql
);

file++;

}

console.log(pref," 完了 ",rows.length,"件");