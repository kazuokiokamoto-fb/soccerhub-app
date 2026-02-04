export type GradeKey = "G1" | "G2" | "G3" | "G4" | "G5" | "G6";

export type Team = {
  id: string;
  name: string;

  // 表示用（例: "東京都 世田谷区・三宿"）
  area: string;

  // ✅ 住所（構造化）
  prefecture?: string | null;     // 例: "東京都"
  city?: string | null;           // 例: "世田谷区"
  town?: string | null;           // 例: "三宿"
  addressDetail?: string | null;  // ✅ NEW: "1-3-23" など（丁目・番地・号）

  category: string; // "U-12" など
  level: number; // 1-10
  hasGround: boolean; // グラウンド提供できる
  bikeParking: string; // "あり" | "なし" | "不明"
  uniformMain: string; // 例: "青"
  uniformSub: string; // 例: "白"
  rosterByGrade: Record<GradeKey, number>; // 各学年のざっくり人数

  // ※コメントと中身がズレてたのでコメントも現状に合わせておく（今は「希望枠」文字列）
  desiredDates: string[]; // 例: ["土 午後", "祝日"] など（曜日/時間帯の希望）

  note: string;
  updatedAt: string;
};

export type Venue = {
  id: string;
  name: string;
  area: string;
  address?: string;
  hasParking: boolean;
  hasBikeParking: boolean;
  note: string;
  updatedAt: string;
};

export type MatchRow = {
  id: string;
  teamA: Team;
  teamB: Team;
  date: string; // マッチした日付
  score: number;
  reasons: string[];
};