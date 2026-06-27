import { cleanText, normalizedKey, normalizeTeamName } from "./normalize.ts";
import type { ParsedTeam } from "./parser.ts";

const BAD_TEAM_WORDS = [
  "順位",
  "チーム",
  "クラブ",
  "勝点",
  "勝ち点",
  "試合",
  "勝",
  "分",
  "敗",
  "得点",
  "失点",
  "得失点",
  "結果",
  "日程",
  "会場",
  "詳細",
  "大会",
  "要項",
  "リーグ",
  "順位表",
  "星取表",
  "戦績表",
  "組み合わせ",
  "トーナメント",
  "サッカー連盟",
  "クラブユース",
  "高円宮杯",
  "参加",
  "出場",
  "以下",
  "以上",
  "当該",
  "不戦勝",
  "抽選",
  "昇格",
  "降格",
  "PDF",
  "download",
  "schedule",
  "news",
  "home",
  "top",
  "copyright",
  "お問い合わせ",
  "問い合わせ",
  "個人情報",
  "プライバシー",
  "サイトマップ",
  "U-15で行う",
  "(U-15で行う)",
  "U-15",
  "U15",
];

function hasAny(text: string, words: string[]) {
  const t = text.toLowerCase();
  return words.some((w) => t.includes(w.toLowerCase()));
}

function isMostlyNumeric(text: string) {
  return /^[0-9０-９.\-ー－+\s]+$/.test(text);
}

function hasTeamSignal(text: string) {
  const t = cleanText(text);

  const signals = [
    "FC",
    "ＦＣ",
    "SC",
    "ＳＣ",
    "JY",
    "ジュニア",
    "ユース",
    "クラブ",
    "フットボール",
    "サッカー",
    "アカデミー",
    "レディース",
    "ベルマーレ",
    "マリノス",
    "フロンターレ",
    "ヴェルディ",
    "レイソル",
    "アントラーズ",
    "レッズ",
    "アルディージャ",
    "ジェフ",
    "ゼルビア",
    "ホーリーホック",
    "栃木SC",
    "ザスパ",
    "Forza",
    "LAVIDA",
    "GRANDE",
    "Kanaloa",
    "FUTURO",
    "CHAMP",
    "トリプレッタ",
    "トレーロス",
    "クリアージュ",
    "クラッキ",
    "カナロア",
  ];

  if (signals.some((w) => t.toLowerCase().includes(w.toLowerCase()))) {
    return true;
  }

  // 学校名系
  if (t.includes("中学校") || t.includes("中学")) return true;

  // 日本語だけの短いチーム名も許可
  if (/^[ァ-ヶー一-龠々A-Za-z0-9０-９・･'.\-\s]+$/.test(t)) {
    return t.length >= 3 && t.length <= 30;
  }

  return false;
}

export function isValidTeamName(name: string) {
  const teamName = normalizeTeamName(name);

  if (!teamName) return false;
  if (teamName.length < 2) return false;
  if (teamName.length > 70) return false;
  if (isMostlyNumeric(teamName)) return false;
  if (hasAny(teamName, BAD_TEAM_WORDS)) return false;
  if (!hasTeamSignal(teamName)) return false;

  return true;
}

export function filterTeams(teams: ParsedTeam[]): ParsedTeam[] {
  const seen = new Set<string>();
  const out: ParsedTeam[] = [];

  for (const team of teams) {
    const teamName = normalizeTeamName(team.teamName);

    if (!isValidTeamName(teamName)) continue;

    const key = normalizedKey(teamName);
    if (!key || seen.has(key)) continue;

    seen.add(key);
    out.push({ teamName });
  }

  return out;
}