export type GradeKey = "G1" | "G2" | "G3" | "G4" | "G5" | "G6";

export type Team = {
  id: string;
  name: string;
  area: string;
  category: string; // "U-12" など
  level: number; // 1-10
  hasGround: boolean; // グラウンド提供できる
  bikeParking: string; // "あり" | "なし" | "不明"
  uniformMain: string; // 例: "青"
  uniformSub: string; // 例: "白"
  rosterByGrade: Record<GradeKey, number>; // 各学年のざっくり人数
  desiredDates: string[]; // "YYYY-MM-DD" の配列（練習試合したい日）
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