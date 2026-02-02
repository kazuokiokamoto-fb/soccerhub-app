// app/lib/prefectures.ts

export const KANTO_PREFECTURES = [
  "東京都",
  "神奈川県",
  "千葉県",
  "埼玉県",
  "茨城県",
  "栃木県",
  "群馬県",
] as const;

export type Prefecture = typeof KANTO_PREFECTURES[number];