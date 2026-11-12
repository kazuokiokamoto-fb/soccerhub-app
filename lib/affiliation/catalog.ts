// Affiliation is the league the team plays in. It is separate from the
// activity-area prefecture and from the match-making category list.

export const AFFILIATION_PREFECTURES = [
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
] as const;

export type AffiliationPrefecture = (typeof AFFILIATION_PREFECTURES)[number];

export const AFFILIATION_CATEGORIES = [
  "U-6",
  "U-8",
  "U-10",
  "U-12",
  "U-13",
  "U-14",
  "U-15",
  "U-18",
  "一般",
  "女子",
  "シニア",
] as const;

export type AffiliationCategory = (typeof AFFILIATION_CATEGORIES)[number];

const PREFECTURE_SET = new Set<string>(AFFILIATION_PREFECTURES);
const CATEGORY_SET = new Set<string>(AFFILIATION_CATEGORIES);

export function isAffiliationPrefecture(value: string): value is AffiliationPrefecture {
  return PREFECTURE_SET.has(value);
}

export function isAffiliationCategory(value: string): value is AffiliationCategory {
  return CATEGORY_SET.has(value);
}
